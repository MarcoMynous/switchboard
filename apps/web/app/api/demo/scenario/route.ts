import { randomUUID } from 'node:crypto';
import {
  addDaysToLocalDate,
  cancelBooking,
  confirmBooking,
  DEFAULT_CONFIG,
  expireHold,
  findSlots,
  holdSlot,
  localDateOf,
  upsertCustomer,
} from '@switchboard/booking';
import { createDb } from '@switchboard/db';
import { paymentEvents, payments } from '@switchboard/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScenarioPayload =
  | { scenario: 'run_booking_demo' }
  | { scenario: 'simulate_deposit_payment'; bookingId?: string }
  | { scenario: 'simulate_human_handoff' }
  | { scenario: 'simulate_expired_hold'; bookingId?: string }
  | { scenario: 'simulate_refund'; bookingId?: string }
  | { scenario: 'try_maya_chat'; message: string };

function parseScenarioPayload(raw: unknown): ScenarioPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const bookingId =
    typeof obj.bookingId === 'string' && UUID_RE.test(obj.bookingId) ? obj.bookingId : undefined;

  switch (obj.scenario) {
    case 'run_booking_demo':
      return { scenario: 'run_booking_demo' };
    case 'simulate_deposit_payment':
      return { scenario: 'simulate_deposit_payment', ...(bookingId ? { bookingId } : {}) };
    case 'simulate_human_handoff':
      return { scenario: 'simulate_human_handoff' };
    case 'simulate_expired_hold':
      return { scenario: 'simulate_expired_hold', ...(bookingId ? { bookingId } : {}) };
    case 'simulate_refund':
      return { scenario: 'simulate_refund', ...(bookingId ? { bookingId } : {}) };
    case 'try_maya_chat': {
      const message = typeof obj.message === 'string' ? obj.message.trim() : '';
      if (!message || message.length > 500) return null;
      return { scenario: 'try_maya_chat', message };
    }
    default:
      return null;
  }
}

async function createDemoHoldBooking(
  db: ReturnType<typeof createDb>,
  businessId: string,
  timezone: string,
  customerName: string,
  customerPhone: string,
  source: 'web_chat' | 'booking_page' | 'whatsapp' = 'web_chat',
) {
  const svcRes = await customersPool.query<{
    id: string;
    name: string;
    deposit_value: string;
    deposit_type: string;
  }>(
    `SELECT id, name, deposit_value::text AS deposit_value, deposit_type::text AS deposit_type
     FROM services
     WHERE business_id = $1 AND deposit_type <> 'none'
     ORDER BY created_at ASC
     LIMIT 1`,
    [businessId],
  );
  const service = svcRes.rows[0];
  if (!service) {
    return { ok: false as const, error: 'No deposit-enabled demo service available.' };
  }

  const today = localDateOf(new Date(), timezone);
  let chosenSlot: { startsAt: Date; staffId: string } | null = null;

  for (let offset = 0; offset <= 5; offset++) {
    const day = addDaysToLocalDate(today, offset);
    const slotsRes = await findSlots(
      db,
      {
        businessId,
        serviceId: service.id,
        date: day,
        limit: 5,
      },
      { config: DEFAULT_CONFIG },
    );
    if (slotsRes.ok && slotsRes.value.length > 0) {
      const first = slotsRes.value[0];
      const staffId = first?.staffIds[0];
      if (first && staffId) {
        chosenSlot = { startsAt: first.startsAt, staffId };
        break;
      }
    }
  }

  if (!chosenSlot) {
    return { ok: false as const, error: 'No open demo slots found in the next 5 days.' };
  }

  const customerRes = await upsertCustomer(db, {
    businessId,
    phone: customerPhone,
    name: customerName,
  });
  if (!customerRes.ok) {
    return { ok: false as const, error: 'Could not create fictional demo customer.' };
  }

  const holdRes = await holdSlot(
    db,
    {
      businessId,
      serviceId: service.id,
      staffId: chosenSlot.staffId,
      customerId: customerRes.value.id,
      startsAt: chosenSlot.startsAt,
      source,
      idempotencyKey: `demo_hold_${randomUUID()}`,
    },
    { config: DEFAULT_CONFIG },
  );

  if (!holdRes.ok) {
    return {
      ok: false as const,
      error: `Booking engine declined hold (${holdRes.error.code}).`,
    };
  }

  const booking = holdRes.value.booking;
  const depositKobo = Math.max(50_000, Number(service.deposit_value) || 150_000);
  const koraReference = `sb_dep_demo_${randomUUID().replace(/-/g, '').slice(0, 14)}`;

  await customersPool.query(
    `INSERT INTO payments (
       business_id, booking_id, kind, amount_kobo, status,
       kora_reference, kora_account_number, expires_at, idempotency_key
     ) VALUES ($1, $2, 'deposit', $3, 'pending', $4, '9012348800', $5, $6)`,
    [
      businessId,
      booking.id,
      depositKobo,
      koraReference,
      booking.holdExpiresAt?.toISOString() ?? new Date(Date.now() + 15 * 60_000).toISOString(),
      `demo_pay_${randomUUID()}`,
    ],
  );

  await customersPool.query(
    `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
     VALUES ($1, 'demo_scenario', 'demo.booking_hold_created', 'booking', $2, $3)`,
    [
      businessId,
      booking.id,
      JSON.stringify({
        customerName,
        serviceName: service.name,
        koraReference,
        depositKobo,
      }),
    ],
  );

  return {
    ok: true as const,
    bookingId: booking.id,
    serviceName: service.name,
    startsAt: booking.startsAt.toISOString(),
    koraReference,
    depositKobo,
  };
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveAuthorizedBusiness(request);
    if (!ctx?.isDemo) {
      return NextResponse.json(
        { ok: false, error: 'Simulated scenarios are only allowed inside Demo Mode.' },
        { status: 403 },
      );
    }

    const raw = await request.json().catch(() => null);
    const parsedData = parseScenarioPayload(raw);
    if (!parsedData) {
      return NextResponse.json(
        { ok: false, error: 'Invalid demo scenario request.' },
        { status: 400 },
      );
    }

    const db = createDb(customersPool);
    const businessId = ctx.business.id;
    const timezone = ctx.business.timezone || 'Africa/Lagos';

    switch (parsedData.scenario) {
      case 'run_booking_demo': {
        const result = await createDemoHoldBooking(
          db,
          businessId,
          timezone,
          'Tobi Williams',
          '+2348035559901',
          'web_chat',
        );
        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
        }
        return NextResponse.json({
          ok: true,
          scenario: 'run_booking_demo',
          bookingId: result.bookingId,
          koraReference: result.koraReference,
          message: `Slot held for Tobi Williams (${result.serviceName}). Reference ${result.koraReference} awaits simulated Kora deposit.`,
        });
      }

      case 'simulate_deposit_payment': {
        const targetId = parsedData.bookingId;
        const heldRes = await customersPool.query<{
          booking_id: string;
          payment_id: string;
          kora_reference: string;
          amount_kobo: string;
        }>(
          targetId
            ? `SELECT b.id::text AS booking_id, p.id::text AS payment_id, p.kora_reference, p.amount_kobo::text AS amount_kobo
               FROM bookings b
               JOIN payments p ON p.booking_id = b.id
               WHERE b.business_id = $1 AND b.id = $2 AND b.status = 'held'
                 AND p.status IN ('pending', 'pending_verification')
               LIMIT 1`
            : `SELECT b.id::text AS booking_id, p.id::text AS payment_id, p.kora_reference, p.amount_kobo::text AS amount_kobo
               FROM bookings b
               JOIN payments p ON p.booking_id = b.id
               WHERE b.business_id = $1 AND b.status = 'held'
                 AND p.status IN ('pending', 'pending_verification')
               ORDER BY b.created_at DESC
               LIMIT 1`,
          targetId ? [businessId, targetId] : [businessId],
        );

        const target = heldRes.rows[0];
        if (!target) {
          return NextResponse.json(
            {
              ok: false,
              error: 'No held booking awaiting deposit was found. Run "Run Booking Demo" first.',
            },
            { status: 409 },
          );
        }

        const eventKey = `demo_kora_evt_${target.kora_reference}`;
        const txResult = await db.transaction(async (tx) => {
          await tx
            .insert(paymentEvents)
            .values({
              provider: 'kora_mock',
              providerEventKey: eventKey,
              eventType: 'charge.success',
              payload: {
                simulated: true,
                reference: target.kora_reference,
                amountKobo: Number(target.amount_kobo),
              },
              processedAt: new Date(),
            })
            .onConflictDoNothing();

          await tx
            .update(payments)
            .set({
              status: 'succeeded',
              verifiedAt: new Date(),
              rawLast: { simulated: true, event: 'charge.success' },
            })
            .where(and(eq(payments.id, target.payment_id), eq(payments.businessId, businessId)));

          return confirmBooking(tx, businessId, target.booking_id);
        });

        if (!txResult.ok) {
          return NextResponse.json(
            { ok: false, error: `Could not confirm booking (${txResult.error.code}).` },
            { status: 409 },
          );
        }

        await customersPool.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, 'demo_scenario', 'demo.kora_deposit_verified', 'booking', $2, $3)`,
          [
            businessId,
            target.booking_id,
            JSON.stringify({ koraReference: target.kora_reference, simulated: true }),
          ],
        );

        return NextResponse.json({
          ok: true,
          scenario: 'simulate_deposit_payment',
          bookingId: target.booking_id,
          koraReference: target.kora_reference,
          message: `Simulated Kora charge.success verified for ${target.kora_reference}. Booking confirmed.`,
        });
      }

      case 'simulate_human_handoff': {
        const customerRes = await upsertCustomer(db, {
          businessId,
          phone: '+2348035558802',
          name: 'Kemi Adeyemi',
        });
        if (!customerRes.ok) {
          return NextResponse.json(
            { ok: false, error: 'Could not create fictional customer for handoff.' },
            { status: 500 },
          );
        }

        const convRes = await customersPool.query<{ id: string }>(
          `INSERT INTO conversations (business_id, customer_id, channel, status, last_message_at)
           VALUES ($1, $2, 'whatsapp', 'needs_human', NOW())
           RETURNING id::text AS id`,
          [businessId, customerRes.value.id],
        );
        const convId = convRes.rows[0]?.id;
        if (convId) {
          await customersPool.query(
            `INSERT INTO messages (conversation_id, direction, author, body, created_at)
             VALUES
               ($1, 'in', 'customer', 'Hi! Can I book 3 groomsmen fades together this Saturday morning?', NOW() - INTERVAL '1 minute'),
               ($1, 'out', 'agent', 'Group bookings for 3+ chairs need barber confirmation. I am handing this over to the Fade Republic desk now.', NOW())`,
            [convId],
          );
          await customersPool.query(
            `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
             VALUES ($1, 'demo_scenario', 'demo.human_handoff_created', 'conversation', $2, $3)`,
            [businessId, convId, JSON.stringify({ customerName: 'Kemi Adeyemi', simulated: true })],
          );
        }

        return NextResponse.json({
          ok: true,
          scenario: 'simulate_human_handoff',
          conversationId: convId,
          message:
            'Simulated WhatsApp handoff created for Kemi Adeyemi. Check Needs Attention & Conversations.',
        });
      }

      case 'simulate_expired_hold': {
        let bookingId = parsedData.bookingId;
        if (!bookingId) {
          const existingHeld = await customersPool.query<{ id: string }>(
            `SELECT id::text AS id
             FROM bookings
             WHERE business_id = $1 AND status = 'held'
             ORDER BY created_at DESC
             LIMIT 1`,
            [businessId],
          );
          bookingId = existingHeld.rows[0]?.id;
        }

        if (!bookingId) {
          const created = await createDemoHoldBooking(
            db,
            businessId,
            timezone,
            'Seyi Lawal',
            '+2348035557703',
            'booking_page',
          );
          if (!created.ok) {
            return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
          }
          bookingId = created.bookingId;
        }

        // Advance the demo hold's deadline past Postgres now() so the real expireHold() sweeper expires it.
        await customersPool.query(
          `UPDATE bookings
           SET hold_expires_at = NOW() - INTERVAL '1 second'
           WHERE business_id = $1 AND id = $2 AND status = 'held'`,
          [businessId, bookingId],
        );

        const expired = await expireHold(db, bookingId);
        if (!expired) {
          return NextResponse.json(
            { ok: false, error: 'Could not expire hold (booking was not in held state).' },
            { status: 409 },
          );
        }

        await customersPool.query(
          `UPDATE payments SET status = 'expired' WHERE business_id = $1 AND booking_id = $2`,
          [businessId, bookingId],
        );
        await customersPool.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, 'demo_scenario', 'demo.hold_expired', 'booking', $2, $3)`,
          [businessId, bookingId, JSON.stringify({ simulated: true })],
        );

        return NextResponse.json({
          ok: true,
          scenario: 'simulate_expired_hold',
          bookingId,
          message:
            'Temporary hold expired and slot availability has been released back to the calendar.',
        });
      }

      case 'simulate_refund': {
        const targetId = parsedData.bookingId;
        const confirmedRes = await customersPool.query<{
          booking_id: string;
          payment_id: string;
          kora_reference: string;
        }>(
          targetId
            ? `SELECT b.id::text AS booking_id, p.id::text AS payment_id, p.kora_reference
               FROM bookings b
               JOIN payments p ON p.booking_id = b.id
               WHERE b.business_id = $1 AND b.id = $2 AND b.status = 'confirmed' AND p.status = 'succeeded'
               LIMIT 1`
            : `SELECT b.id::text AS booking_id, p.id::text AS payment_id, p.kora_reference
               FROM bookings b
               JOIN payments p ON p.booking_id = b.id
               WHERE b.business_id = $1 AND b.status = 'confirmed' AND p.status = 'succeeded'
               ORDER BY b.created_at DESC
               LIMIT 1`,
          targetId ? [businessId, targetId] : [businessId],
        );

        const target = confirmedRes.rows[0];
        if (!target) {
          return NextResponse.json(
            { ok: false, error: 'No confirmed paid demo booking available to refund.' },
            { status: 409 },
          );
        }

        const refundResult = await db.transaction(async (tx) => {
          await tx
            .update(payments)
            .set({
              status: 'refunded',
              rawLast: { simulated: true, event: 'refund.processed' },
            })
            .where(and(eq(payments.id, target.payment_id), eq(payments.businessId, businessId)));

          return cancelBooking(
            tx,
            businessId,
            target.booking_id,
            'Simulated Kora refund in Demo Mode (no real transfer)',
          );
        });

        if (!refundResult.ok) {
          return NextResponse.json(
            { ok: false, error: `Could not refund booking (${refundResult.error.code}).` },
            { status: 409 },
          );
        }

        await customersPool.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, 'demo_scenario', 'demo.refund_simulated', 'booking', $2, $3)`,
          [
            businessId,
            target.booking_id,
            JSON.stringify({ koraReference: target.kora_reference, simulated: true }),
          ],
        );

        return NextResponse.json({
          ok: true,
          scenario: 'simulate_refund',
          bookingId: target.booking_id,
          koraReference: target.kora_reference,
          message: `Simulated Kora refund recorded for ${target.kora_reference}. No real funds moved.`,
        });
      }

      case 'try_maya_chat': {
        const userMsg = parsedData.message;
        const lower = userMsg.toLowerCase();

        const [svcsRes, staffRes] = await Promise.all([
          customersPool.query<{
            id: string;
            name: string;
            duration_min: number;
            price_kobo: string;
            deposit_value: string;
            deposit_type: string;
          }>(
            `SELECT id, name, duration_min, price_kobo::text AS price_kobo, deposit_value::text AS deposit_value, deposit_type::text AS deposit_type
             FROM services
             WHERE business_id = $1
             ORDER BY price_kobo ASC`,
            [businessId],
          ),
          customersPool.query<{ name: string; role_title: string }>(
            `SELECT name, role_title FROM staff WHERE business_id = $1 AND active = true ORDER BY name ASC`,
            [businessId],
          ),
        ]);

        let reply: string;
        if (lower.includes('price') || lower.includes('service') || lower.includes('how much')) {
          const list = svcsRes.rows
            .slice(0, 4)
            .map(
              (s) =>
                `${s.name} (₦${Math.round(Number(s.price_kobo) / 100).toLocaleString('en-NG')}, ${s.duration_min}m)`,
            )
            .join(', ');
          reply = `[Simulated Maya] At ${ctx.business.name}, our popular services are: ${list}. Would you like me to check an open slot today?`;
        } else if (
          lower.includes('human') ||
          lower.includes('manager') ||
          lower.includes('staff')
        ) {
          const barbers = staffRes.rows.map((s) => `${s.name} (${s.role_title})`).join(', ');
          reply = `[Simulated Maya] Our barbers on duty are ${barbers}. I can flag your request for human follow-up right away in Needs Attention.`;
        } else {
          const firstSvc = svcsRes.rows[0];
          const today = localDateOf(new Date(), timezone);
          let slotText = 'tomorrow morning at 10:00 AM WAT';
          if (firstSvc) {
            const slots = await findSlots(
              db,
              { businessId, serviceId: firstSvc.id, date: addDaysToLocalDate(today, 1), limit: 2 },
              { config: DEFAULT_CONFIG },
            );
            if (slots.ok && slots.value[0]) {
              slotText = new Intl.DateTimeFormat('en-NG', {
                timeZone: timezone,
                weekday: 'short',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(slots.value[0].startsAt);
            }
          }
          reply = `[Simulated Maya] Welcome to ${ctx.business.name}! Our next open slot is ${slotText} (WAT). Use "Run Booking Demo" to place a real conflict-free hold in this demo workspace.`;
        }

        // Persist into web_chat conversation for the demo customer
        const custRes = await upsertCustomer(db, {
          businessId,
          phone: '+2348035559901',
          name: 'Tobi Williams',
        });
        let conversationId: string | undefined;
        if (custRes.ok) {
          const existingConv = await customersPool.query<{ id: string }>(
            `SELECT id::text AS id
             FROM conversations
             WHERE business_id = $1 AND customer_id = $2 AND channel = 'web_chat'
             ORDER BY created_at DESC
             LIMIT 1`,
            [businessId, custRes.value.id],
          );
          conversationId = existingConv.rows[0]?.id;
          if (!conversationId) {
            const newConv = await customersPool.query<{ id: string }>(
              `INSERT INTO conversations (business_id, customer_id, channel, status, last_message_at)
               VALUES ($1, $2, 'web_chat', 'agent', NOW())
               RETURNING id::text AS id`,
              [businessId, custRes.value.id],
            );
            conversationId = newConv.rows[0]?.id;
          }
          if (conversationId) {
            await customersPool.query(
              `INSERT INTO messages (conversation_id, direction, author, body, created_at)
               VALUES
                 ($1, 'in', 'customer', $2, NOW()),
                 ($1, 'out', 'agent', $3, NOW() + INTERVAL '1 second')`,
              [conversationId, userMsg, reply],
            );
            await customersPool.query(
              `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
              [conversationId],
            );
          }
        }

        return NextResponse.json({
          ok: true,
          scenario: 'try_maya_chat',
          reply,
          conversationId,
        });
      }
    }
  } catch (err) {
    console.error('[api/demo/scenario POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to execute simulated demo scenario.' },
      { status: 500 },
    );
  }
}
