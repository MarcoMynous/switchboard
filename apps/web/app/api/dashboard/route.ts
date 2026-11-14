import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type {
  DashboardBookingRecord,
  DashboardConversationRecord,
  PaymentStatus,
} from '@/components/dashboard/bookings/BookingsManagementView';
import { customersPool, resolveAuthorizedBusiness, toE164 } from '@/lib/customers-server';

function formatSlotInTimezone(iso: string, timezone: string): string {
  try {
    const date = new Date(iso);
    const formatted = new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone || 'Africa/Lagos',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} (WAT)`;
  } catch {
    return iso;
  }
}

function formatTimeShort(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone || 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function mapPaymentStatus(
  depositKobo: number,
  paymentRowStatus: string | null,
  amountKobo: number | null,
): PaymentStatus {
  if (depositKobo <= 0 && !paymentRowStatus) return 'not_required';
  switch (paymentRowStatus) {
    case 'succeeded':
      if (amountKobo !== null && amountKobo < depositKobo) return 'underpaid';
      return 'verified';
    case 'pending_verification':
      return 'pending_verification';
    case 'refund_pending':
      return 'refund_pending';
    case 'refunded':
      return 'refunded';
    default:
      return depositKobo > 0 ? 'awaiting_payment' : 'not_required';
  }
}

function mapBookingSource(source: string): DashboardBookingRecord['source'] {
  if (
    source === 'whatsapp' ||
    source === 'web_chat' ||
    source === 'booking_page' ||
    source === 'staff'
  ) {
    return source;
  }
  return 'booking_page';
}

function mapBookingStatus(status: string): DashboardBookingRecord['status'] {
  if (
    status === 'held' ||
    status === 'confirmed' ||
    status === 'completed' ||
    status === 'expired' ||
    status === 'cancelled' ||
    status === 'no_show'
  ) {
    return status;
  }
  return 'held';
}

function mapConversationStatus(status: string): DashboardConversationRecord['status'] {
  if (status === 'needs_human') return 'needs_human';
  if (status === 'closed') return 'resolved';
  return 'agent_active';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug');
    const ctx = await resolveAuthorizedBusiness(request, requestedSlug);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    const { business } = ctx;

    const [bookingRowsRes, convRowsRes] = await Promise.all([
      customersPool.query<{
        id: string;
        customer_name: string | null;
        customer_phone: string;
        service_name: string | null;
        duration_min: number | null;
        staff_name: string | null;
        status: string;
        starts_at: string;
        hold_expires_at: string | null;
        price_kobo: string;
        deposit_kobo: string;
        source: string;
        notes: string | null;
        cancelled_reason: string | null;
        created_at: string;
        kora_reference: string | null;
        payment_status: string | null;
        payment_amount_kobo: string | null;
        verified_at: string | null;
      }>(
        `SELECT
           b.id::text AS id,
           c.name AS customer_name,
           c.phone_e164 AS customer_phone,
           sv.name AS service_name,
           sv.duration_min AS duration_min,
           st.name AS staff_name,
           b.status::text AS status,
           b.starts_at::text AS starts_at,
           b.hold_expires_at::text AS hold_expires_at,
           b.price_kobo::text AS price_kobo,
           b.deposit_kobo::text AS deposit_kobo,
           b.source::text AS source,
           b.notes,
           b.cancelled_reason,
           b.created_at::text AS created_at,
           p.kora_reference,
           p.status::text AS payment_status,
           p.amount_kobo::text AS payment_amount_kobo,
           p.verified_at::text AS verified_at
         FROM bookings b
         JOIN customers c ON c.id = b.customer_id
         LEFT JOIN services sv ON sv.id = b.service_id
         LEFT JOIN staff st ON st.id = b.staff_id
         LEFT JOIN LATERAL (
           SELECT kora_reference, status, amount_kobo, verified_at
           FROM payments
           WHERE booking_id = b.id
           ORDER BY created_at DESC
           LIMIT 1
         ) p ON true
         WHERE b.business_id = $1
         ORDER BY b.starts_at DESC
         LIMIT 200`,
        [business.id],
      ),
      customersPool.query<{
        id: string;
        customer_name: string | null;
        customer_phone: string;
        channel: string;
        status: string;
        last_message_at: string | null;
        updated_at: string;
      }>(
        `SELECT
           cv.id::text AS id,
           c.name AS customer_name,
           c.phone_e164 AS customer_phone,
           cv.channel::text AS channel,
           cv.status::text AS status,
           cv.last_message_at::text AS last_message_at,
           cv.updated_at::text AS updated_at
         FROM conversations cv
         JOIN customers c ON c.id = cv.customer_id
         WHERE cv.business_id = $1
         ORDER BY COALESCE(cv.last_message_at, cv.updated_at) DESC
         LIMIT 100`,
        [business.id],
      ),
    ]);

    const convIds = convRowsRes.rows.map((r) => r.id);
    const messagesByConvId = new Map<string, DashboardConversationRecord['messages']>();

    if (convIds.length > 0) {
      const msgRes = await customersPool.query<{
        id: string;
        conversation_id: string;
        author: string;
        body: string;
        created_at: string;
      }>(
        `SELECT
           id::text AS id,
           conversation_id::text AS conversation_id,
           author::text AS author,
           body,
           created_at::text AS created_at
         FROM messages
         WHERE conversation_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [convIds],
      );

      for (const m of msgRes.rows) {
        const list = messagesByConvId.get(m.conversation_id) ?? [];
        list.push({
          id: m.id,
          sender:
            m.author === 'customer' || m.author === 'agent' || m.author === 'staff'
              ? m.author
              : 'system',
          text: m.body,
          time: formatTimeShort(m.created_at, business.timezone),
        });
        messagesByConvId.set(m.conversation_id, list);
      }
    }

    const nowMs = Date.now();
    const bookings: DashboardBookingRecord[] = bookingRowsRes.rows.map((row) => {
      const priceKobo = Number(row.price_kobo) || 0;
      const depositKobo = Number(row.deposit_kobo) || 0;
      const paymentAmountKobo = row.payment_amount_kobo ? Number(row.payment_amount_kobo) : null;
      const holdRemaining =
        row.status === 'held' && row.hold_expires_at
          ? Math.max(0, Math.floor((new Date(row.hold_expires_at).getTime() - nowMs) / 1000))
          : undefined;

      return {
        id: row.id,
        reference: row.kora_reference ?? `sb_bk_${row.id.slice(0, 8)}`,
        customerName: row.customer_name?.trim() || 'Guest Customer',
        customerPhone: row.customer_phone,
        serviceName: row.service_name ?? 'Service',
        staffName: row.staff_name ?? 'Any available staff',
        slotTime: formatSlotInTimezone(row.starts_at, business.timezone),
        startsAt: row.starts_at,
        durationMin: row.duration_min ?? 30,
        priceKobo,
        depositKobo,
        verifiedAmountKobo:
          row.payment_status === 'succeeded' && paymentAmountKobo !== null
            ? paymentAmountKobo
            : undefined,
        status: mapBookingStatus(row.status),
        paymentStatus: mapPaymentStatus(depositKobo, row.payment_status, paymentAmountKobo),
        holdSecondsRemaining: holdRemaining,
        holdExpiresAt: row.hold_expires_at ?? undefined,
        verifiedAt: row.verified_at ?? undefined,
        cancelReason: row.cancelled_reason ?? undefined,
        customerNotes: row.notes ?? undefined,
        source: mapBookingSource(row.source),
        createdAt: row.created_at,
      };
    });

    const conversations: DashboardConversationRecord[] = convRowsRes.rows.map((row) => {
      const msgs = messagesByConvId.get(row.id) ?? [];
      const lastMsg = msgs[msgs.length - 1];
      return {
        id: row.id,
        customerName: row.customer_name?.trim() || 'Guest Customer',
        customerPhone: row.customer_phone,
        channel: row.channel === 'whatsapp' ? 'whatsapp' : 'web_chat',
        lastMessage: lastMsg?.text ?? 'Conversation started',
        status: mapConversationStatus(row.status),
        updatedAt: formatSlotInTimezone(row.last_message_at ?? row.updated_at, business.timezone),
        messages: msgs,
      };
    });

    return NextResponse.json({
      ok: true,
      bookings,
      conversations,
    });
  } catch (err) {
    console.error('[api/dashboard GET] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load dashboard data from database.' },
      { status: 500 },
    );
  }
}

type PostActionPayload =
  | {
      action: 'create_booking';
      slug?: string;
      customerName: string;
      customerPhone: string;
      serviceName: string;
      staffName?: string;
      startsAt?: string;
      requireDeposit: boolean;
      priceKobo: number;
      depositKobo: number;
      notes?: string;
    }
  | {
      action: 'update_booking';
      slug?: string;
      bookingId: string;
      status?: 'held' | 'confirmed' | 'completed' | 'expired' | 'cancelled' | 'no_show';
      cancelReason?: string;
      paymentStatus?: 'verified' | 'pending_verification' | 'refunded';
    }
  | {
      action: 'update_conversation';
      slug?: string;
      conversationId: string;
      status?: 'agent_active' | 'needs_human' | 'staff_takeover' | 'resolved';
      replyText?: string;
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_BOOKING_STATUSES = new Set([
  'held',
  'confirmed',
  'completed',
  'expired',
  'cancelled',
  'no_show',
]);
const VALID_PAYMENT_STATUSES = new Set(['verified', 'pending_verification', 'refunded']);
const VALID_CONV_STATUSES = new Set(['agent_active', 'needs_human', 'staff_takeover', 'resolved']);

function parsePostAction(raw: unknown): PostActionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const slug = typeof obj.slug === 'string' ? obj.slug : undefined;

  if (obj.action === 'create_booking') {
    const customerName = typeof obj.customerName === 'string' ? obj.customerName.trim() : '';
    const customerPhone = typeof obj.customerPhone === 'string' ? obj.customerPhone.trim() : '';
    const serviceName = typeof obj.serviceName === 'string' ? obj.serviceName.trim() : '';
    if (!customerName || customerName.length > 120) return null;
    if (!customerPhone || customerPhone.length < 7 || customerPhone.length > 40) return null;
    if (!serviceName || serviceName.length > 120) return null;
    if (typeof obj.priceKobo !== 'number' || obj.priceKobo < 0) return null;
    if (typeof obj.depositKobo !== 'number' || obj.depositKobo < 0) return null;
    return {
      action: 'create_booking',
      slug,
      customerName,
      customerPhone,
      serviceName,
      staffName: typeof obj.staffName === 'string' ? obj.staffName.trim() : undefined,
      startsAt: typeof obj.startsAt === 'string' ? obj.startsAt : undefined,
      requireDeposit: typeof obj.requireDeposit === 'boolean' ? obj.requireDeposit : true,
      priceKobo: Math.round(obj.priceKobo),
      depositKobo: Math.round(obj.depositKobo),
      notes: typeof obj.notes === 'string' ? obj.notes.slice(0, 1000) : undefined,
    };
  }

  if (obj.action === 'update_booking') {
    if (typeof obj.bookingId !== 'string' || !UUID_RE.test(obj.bookingId)) return null;
    const status =
      typeof obj.status === 'string' && VALID_BOOKING_STATUSES.has(obj.status)
        ? (obj.status as PostActionPayload extends { action: 'update_booking'; status?: infer S }
            ? S
            : never)
        : undefined;
    const paymentStatus =
      typeof obj.paymentStatus === 'string' && VALID_PAYMENT_STATUSES.has(obj.paymentStatus)
        ? (obj.paymentStatus as 'verified' | 'pending_verification' | 'refunded')
        : undefined;
    return {
      action: 'update_booking',
      slug,
      bookingId: obj.bookingId,
      status,
      cancelReason:
        typeof obj.cancelReason === 'string' ? obj.cancelReason.slice(0, 500) : undefined,
      paymentStatus,
    };
  }

  if (obj.action === 'update_conversation') {
    if (typeof obj.conversationId !== 'string' || !UUID_RE.test(obj.conversationId)) return null;
    const status =
      typeof obj.status === 'string' && VALID_CONV_STATUSES.has(obj.status)
        ? (obj.status as 'agent_active' | 'needs_human' | 'staff_takeover' | 'resolved')
        : undefined;
    const replyText =
      typeof obj.replyText === 'string' && obj.replyText.trim().length > 0
        ? obj.replyText.trim().slice(0, 4000)
        : undefined;
    return {
      action: 'update_conversation',
      slug,
      conversationId: obj.conversationId,
      status,
      replyText,
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const payload = parsePostAction(rawBody);
    if (!payload) {
      return NextResponse.json(
        { ok: false, error: 'Invalid dashboard action payload.' },
        { status: 400 },
      );
    }

    const ctx = await resolveAuthorizedBusiness(request, payload.slug);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }
    const { business, user } = ctx;

    if (payload.action === 'create_booking') {
      const phoneE164 = toE164(payload.customerPhone);
      if (!phoneE164) {
        return NextResponse.json(
          { ok: false, error: 'Enter a valid phone number (e.g. +234 803 123 4567).' },
          { status: 400 },
        );
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        // Find or create customer
        const existingCustomer = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM customers WHERE business_id = $1 AND phone_e164 = $2 LIMIT 1`,
          [business.id, phoneE164],
        );

        let customerId: string;
        if (existingCustomer.rows[0]) {
          customerId = existingCustomer.rows[0].id;
        } else {
          const insertedCustomer = await client.query<{ id: string }>(
            `INSERT INTO customers (business_id, phone_e164, name, preferred_channel)
             VALUES ($1, $2, $3, 'whatsapp')
             RETURNING id::text AS id`,
            [business.id, phoneE164, payload.customerName],
          );
          const createdCust = insertedCustomer.rows[0];
          if (!createdCust) {
            throw new Error('Failed to create customer record');
          }
          customerId = createdCust.id;
        }

        // Resolve service_id and duration
        const svcRes = await client.query<{ id: string; duration_min: number }>(
          `SELECT id::text AS id, duration_min FROM services WHERE business_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [business.id, payload.serviceName],
        );
        const fallbackSvcRes = svcRes.rows[0]
          ? svcRes
          : await client.query<{ id: string; duration_min: number }>(
              `SELECT id::text AS id, duration_min FROM services WHERE business_id = $1 LIMIT 1`,
              [business.id],
            );
        const serviceRow = fallbackSvcRes.rows[0];
        if (!serviceRow) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { ok: false, error: 'Please create at least one service before booking.' },
            { status: 400 },
          );
        }

        // Resolve staff_id
        let staffId: string | null = null;
        if (payload.staffName) {
          const stfRes = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM staff WHERE business_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
            [business.id, payload.staffName],
          );
          staffId = stfRes.rows[0]?.id ?? null;
        }
        if (!staffId) {
          const anyStf = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM staff WHERE business_id = $1 LIMIT 1`,
            [business.id],
          );
          staffId = anyStf.rows[0]?.id ?? null;
        }

        const startsAtDate = payload.startsAt
          ? new Date(payload.startsAt)
          : new Date(Date.now() + 3_600_000);
        const validStartsAt = Number.isNaN(startsAtDate.getTime())
          ? new Date(Date.now() + 3_600_000)
          : startsAtDate;
        const endsAtDate = new Date(validStartsAt.getTime() + serviceRow.duration_min * 60_000);
        const status = payload.requireDeposit ? 'held' : 'confirmed';
        const holdExpiresAt = payload.requireDeposit ? new Date(Date.now() + 900_000) : null;
        const idempotencyKey = `staff_bk_${randomUUID()}`;

        const bkRes = await client.query<{ id: string; created_at: string }>(
          `INSERT INTO bookings (
             business_id, customer_id, service_id, staff_id,
             status, starts_at, ends_at, hold_expires_at,
             price_kobo, deposit_kobo, source, idempotency_key, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'staff', $11, $12)
           RETURNING id::text AS id, created_at::text AS created_at`,
          [
            business.id,
            customerId,
            serviceRow.id,
            staffId,
            status,
            validStartsAt.toISOString(),
            endsAtDate.toISOString(),
            holdExpiresAt ? holdExpiresAt.toISOString() : null,
            payload.priceKobo,
            payload.depositKobo,
            idempotencyKey,
            payload.notes ?? null,
          ],
        );

        const createdBooking = bkRes.rows[0];
        if (!createdBooking) {
          throw new Error('Failed to create booking');
        }

        const koraRef = `sb_dep_${createdBooking.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
        if (payload.requireDeposit && payload.depositKobo > 0) {
          await client.query(
            `INSERT INTO payments (
               business_id, booking_id, kind, amount_kobo, status,
               kora_reference, expires_at, idempotency_key
             ) VALUES ($1, $2, 'deposit', $3, 'pending', $4, $5, $6)`,
            [
              business.id,
              createdBooking.id,
              payload.depositKobo,
              koraRef,
              holdExpiresAt ? holdExpiresAt.toISOString() : null,
              `pay_${createdBooking.id}`,
            ],
          );
        }

        await client.query(
          `INSERT INTO audit_log (business_id, actor_type, actor_id, action, entity_type, entity_id, after)
           VALUES ($1, 'user', $2, 'booking.created_manual', 'booking', $3, $4::jsonb)`,
          [
            business.id,
            user.id,
            createdBooking.id,
            JSON.stringify({ source: 'staff', status, reference: koraRef }),
          ],
        );

        await client.query('COMMIT');

        const record: DashboardBookingRecord = {
          id: createdBooking.id,
          reference: koraRef,
          customerName: payload.customerName,
          customerPhone: phoneE164,
          serviceName: payload.serviceName,
          staffName: payload.staffName || 'Any available staff',
          slotTime: formatSlotInTimezone(validStartsAt.toISOString(), business.timezone),
          startsAt: validStartsAt.toISOString(),
          durationMin: serviceRow.duration_min,
          priceKobo: payload.priceKobo,
          depositKobo: payload.depositKobo,
          status,
          paymentStatus: payload.requireDeposit ? 'awaiting_payment' : 'not_required',
          holdSecondsRemaining: payload.requireDeposit ? 900 : undefined,
          holdExpiresAt: holdExpiresAt?.toISOString(),
          customerNotes: payload.notes,
          source: 'staff',
          createdAt: createdBooking.created_at,
        };

        return NextResponse.json({ ok: true, booking: record }, { status: 201 });
      } catch (dbErr: unknown) {
        await client.query('ROLLBACK').catch(() => {});
        const pgErr = dbErr as { code?: string };
        if (pgErr.code === '23P01') {
          return NextResponse.json(
            { ok: false, error: 'Selected staff member already has a booking at that time.' },
            { status: 409 },
          );
        }
        throw dbErr;
      } finally {
        client.release();
      }
    }

    if (payload.action === 'update_booking') {
      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        if (payload.status) {
          await client.query(
            `UPDATE bookings
             SET status = $1, cancelled_reason = COALESCE($2, cancelled_reason), updated_at = now()
             WHERE id = $3 AND business_id = $4`,
            [payload.status, payload.cancelReason ?? null, payload.bookingId, business.id],
          );
        }

        if (payload.paymentStatus) {
          const dbPayStatus =
            payload.paymentStatus === 'verified'
              ? 'succeeded'
              : payload.paymentStatus === 'refunded'
                ? 'refunded'
                : 'pending_verification';
          await client.query(
            `UPDATE payments
             SET status = $1, verified_at = CASE WHEN $1 = 'succeeded' THEN now() ELSE verified_at END, updated_at = now()
             WHERE booking_id = $2 AND business_id = $3`,
            [dbPayStatus, payload.bookingId, business.id],
          );
        }

        await client.query(
          `INSERT INTO audit_log (business_id, actor_type, actor_id, action, entity_type, entity_id, after)
           VALUES ($1, 'user', $2, 'booking.updated', 'booking', $3, $4::jsonb)`,
          [
            business.id,
            user.id,
            payload.bookingId,
            JSON.stringify({ status: payload.status, paymentStatus: payload.paymentStatus }),
          ],
        );

        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    if (payload.action === 'update_conversation') {
      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        if (payload.status) {
          const dbConvStatus =
            payload.status === 'needs_human'
              ? 'needs_human'
              : payload.status === 'resolved'
                ? 'closed'
                : 'agent';
          await client.query(
            `UPDATE conversations
             SET status = $1, updated_at = now()
             WHERE id = $2 AND business_id = $3`,
            [dbConvStatus, payload.conversationId, business.id],
          );
        }

        if (payload.replyText) {
          await client.query(
            `INSERT INTO messages (conversation_id, direction, author, body)
             SELECT id, 'out', 'staff', $1
             FROM conversations
             WHERE id = $2 AND business_id = $3`,
            [payload.replyText, payload.conversationId, business.id],
          );
          await client.query(
            `UPDATE conversations SET last_message_at = now(), updated_at = now()
             WHERE id = $1 AND business_id = $2`,
            [payload.conversationId, business.id],
          );
        }

        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    console.error('[api/dashboard POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to persist dashboard update.' },
      { status: 500 },
    );
  }
}
