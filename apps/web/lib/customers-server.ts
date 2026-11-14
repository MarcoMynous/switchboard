import { parseEnv, webSchema } from '@switchboard/env';
import { Pool } from 'pg';
import { auth } from './auth';

const env = parseEnv(webSchema);
const databaseUrl: string = env.DATABASE_URL ?? '';
const normalizedDatabaseUrl = databaseUrl.includes('uselibpqcompat=')
  ? databaseUrl
  : databaseUrl.replace(/([?&])sslmode=(?:require|prefer|verify-ca)\b/g, '$1sslmode=verify-full');

export const customersPool = new Pool({
  connectionString: normalizedDatabaseUrl,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function toE164(input: string, defaultCountryCode = '234'): string | null {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  let e164: string;
  if (hasPlus) e164 = `+${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith(defaultCountryCode)) e164 = `+${digits}`;
  else if (digits.startsWith('0')) e164 = `+${defaultCountryCode}${digits.slice(1)}`;
  else e164 = `+${defaultCountryCode}${digits}`;

  if (!E164_RE.test(e164)) return null;
  if (e164.startsWith('+234') && e164.length !== 14) return null;
  return e164;
}

export type CustomerSource = 'whatsapp' | 'web_chat' | 'booking_page' | 'staff' | 'unknown';

export interface CustomerBookingSummary {
  id: string;
  reference: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
  endsAt: string;
  status: 'held' | 'confirmed' | 'expired' | 'cancelled' | 'completed' | 'no_show';
  holdExpiresAt: string | null;
  source: 'whatsapp' | 'web_chat' | 'booking_page' | 'staff';
  depositKobo: number;
  paymentStatus:
    | 'not_required'
    | 'awaiting_payment'
    | 'pending_verification'
    | 'verified'
    | 'refund_pending'
    | 'refunded'
    | 'failed';
  createdAt: string;
}

export interface CustomerConversationSummary {
  id: string;
  channel: 'whatsapp' | 'web_chat';
  status: 'agent' | 'needs_human' | 'closed';
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
}

export interface CustomerActivityEvent {
  id: string;
  timestamp: string;
  label: string;
  detail: string;
  kind: 'customer' | 'conversation' | 'booking' | 'payment' | 'attention';
}

export interface CustomerDirectoryRecord {
  id: string;
  reference: string;
  name: string;
  phoneE164: string;
  preferredChannel: 'whatsapp' | 'web_chat' | 'phone' | null;
  preferredLanguage: string | null;
  notes: string | null;
  source: CustomerSource;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  confirmedBookingsCount: number;
  lastBookingAt: string | null;
  nextUpcomingBooking: CustomerBookingSummary | null;
  verifiedDepositKobo: number;
  pendingVerificationKobo: number;
  latestPaymentAt: string | null;
  refundStatus: string | null;
  hasOpenAttention: boolean;
  bookings: CustomerBookingSummary[];
  conversations: CustomerConversationSummary[];
  activities: CustomerActivityEvent[];
}

export interface AuthorizedBusinessContext {
  user: {
    id: string;
    name: string;
    email: string;
  };
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  role: 'owner' | 'staff';
}

export async function resolveAuthorizedBusiness(
  request: Request,
  requestedSlug?: string | null,
): Promise<AuthorizedBusinessContext | null> {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const userName = session.user.name || session.user.email.split('@')[0] || 'Team Member';

  // Owner lookup (optionally scoped by slug)
  const ownerRes = requestedSlug
    ? await customersPool.query<{ id: string; name: string; slug: string; timezone: string }>(
        `SELECT id, name, slug, timezone FROM businesses WHERE owner_user_id = $1 AND slug = $2 LIMIT 1`,
        [userId, requestedSlug],
      )
    : await customersPool.query<{ id: string; name: string; slug: string; timezone: string }>(
        `SELECT id, name, slug, timezone FROM businesses WHERE owner_user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );

  if (ownerRes.rows[0]) {
    return {
      user: { id: userId, name: userName, email: session.user.email },
      business: ownerRes.rows[0],
      role: 'owner',
    };
  }

  // Staff lookup
  const staffRes = requestedSlug
    ? await customersPool.query<{ id: string; name: string; slug: string; timezone: string }>(
        `SELECT b.id, b.name, b.slug, b.timezone
         FROM staff s
         JOIN businesses b ON b.id = s.business_id
         WHERE s.user_id = $1 AND s.active = true AND b.slug = $2
         LIMIT 1`,
        [userId, requestedSlug],
      )
    : await customersPool.query<{ id: string; name: string; slug: string; timezone: string }>(
        `SELECT b.id, b.name, b.slug, b.timezone
         FROM staff s
         JOIN businesses b ON b.id = s.business_id
         WHERE s.user_id = $1 AND s.active = true
         ORDER BY b.updated_at DESC
         LIMIT 1`,
        [userId],
      );

  if (staffRes.rows[0]) {
    return {
      user: { id: userId, name: userName, email: session.user.email },
      business: staffRes.rows[0],
      role: 'staff',
    };
  }

  return null;
}

export async function fetchCustomersDirectory(
  businessId: string,
  customerIdFilter?: string,
): Promise<CustomerDirectoryRecord[]> {
  const custQuery = customerIdFilter
    ? customersPool.query<{
        id: string;
        phone_e164: string;
        name: string | null;
        notes: string | null;
        tags: string[];
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, phone_e164, name, notes, tags, created_at, updated_at
         FROM customers
         WHERE business_id = $1 AND id = $2
         ORDER BY updated_at DESC`,
        [businessId, customerIdFilter],
      )
    : customersPool.query<{
        id: string;
        phone_e164: string;
        name: string | null;
        notes: string | null;
        tags: string[];
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, phone_e164, name, notes, tags, created_at, updated_at
         FROM customers
         WHERE business_id = $1
         ORDER BY updated_at DESC`,
        [businessId],
      );

  const custRes = await custQuery;
  if (custRes.rows.length === 0) return [];

  const customerIds = custRes.rows.map((c) => c.id);

  const [bookingsRes, convsRes, paymentsRes] = await Promise.all([
    customersPool.query<{
      id: string;
      customer_id: string;
      service_name: string;
      staff_name: string;
      starts_at: Date;
      ends_at: Date;
      status: 'held' | 'confirmed' | 'expired' | 'cancelled' | 'completed' | 'no_show';
      hold_expires_at: Date | null;
      source: 'whatsapp' | 'web_chat' | 'booking_page' | 'staff';
      created_at: Date;
      deposit_type: string;
      deposit_value: number;
      price_kobo: number;
    }>(
      `SELECT b.id, b.customer_id, sv.name AS service_name, st.name AS staff_name,
              b.starts_at, b.ends_at, b.status, b.hold_expires_at, b.source, b.created_at,
              sv.deposit_type, sv.deposit_value, sv.price_kobo
       FROM bookings b
       JOIN services sv ON sv.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       WHERE b.business_id = $1 AND b.customer_id = ANY($2::uuid[])
       ORDER BY b.starts_at DESC`,
      [businessId, customerIds],
    ),
    customersPool.query<{
      id: string;
      customer_id: string;
      channel: 'whatsapp' | 'web_chat';
      status: 'agent' | 'needs_human' | 'closed';
      last_message_at: Date | null;
      created_at: Date;
      last_message_preview: string | null;
    }>(
      `SELECT c.id, c.customer_id, c.channel, c.status, c.last_message_at, c.created_at,
              (
                SELECT m.body
                FROM messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
              ) AS last_message_preview
       FROM conversations c
       WHERE c.business_id = $1 AND c.customer_id = ANY($2::uuid[])
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [businessId, customerIds],
    ),
    customersPool.query<{
      id: string;
      booking_id: string | null;
      kind: 'deposit' | 'subscription' | 'refund' | 'payout';
      amount_kobo: number;
      status:
        | 'created'
        | 'pending'
        | 'pending_verification'
        | 'succeeded'
        | 'failed'
        | 'expired'
        | 'refund_pending'
        | 'refunded'
        | 'refund_failed';
      kora_reference: string;
      verified_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, booking_id, kind, amount_kobo, status, kora_reference, verified_at, created_at
       FROM payments
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [businessId],
    ),
  ]);

  const paymentByBookingId = new Map<string, (typeof paymentsRes.rows)[number]>();
  for (const p of paymentsRes.rows) {
    if (p.booking_id && !paymentByBookingId.has(p.booking_id)) {
      paymentByBookingId.set(p.booking_id, p);
    }
  }

  const nowMs = Date.now();

  return custRes.rows.map((cust) => {
    const custBookings = bookingsRes.rows
      .filter((b) => b.customer_id === cust.id)
      .map((b): CustomerBookingSummary => {
        const pay = paymentByBookingId.get(b.id);
        const computedDepositKobo =
          b.deposit_type === 'none'
            ? 0
            : b.deposit_type === 'full'
              ? Number(b.price_kobo)
              : b.deposit_type === 'percent'
                ? Math.round((Number(b.price_kobo) * Number(b.deposit_value)) / 100)
                : Number(b.deposit_value);

        const mappedPayStatus: CustomerBookingSummary['paymentStatus'] = !pay
          ? computedDepositKobo === 0
            ? 'not_required'
            : b.status === 'confirmed' || b.status === 'completed'
              ? 'verified'
              : 'awaiting_payment'
          : pay.status === 'succeeded'
            ? 'verified'
            : pay.status === 'pending_verification'
              ? 'pending_verification'
              : pay.status === 'refund_pending'
                ? 'refund_pending'
                : pay.status === 'refunded'
                  ? 'refunded'
                  : pay.status === 'failed' || pay.status === 'expired'
                    ? 'failed'
                    : 'awaiting_payment';

        return {
          id: b.id,
          reference: pay?.kora_reference ?? `bk_${b.id.slice(0, 8)}`,
          serviceName: b.service_name,
          staffName: b.staff_name,
          startsAt: b.starts_at.toISOString(),
          endsAt: b.ends_at.toISOString(),
          status: b.status,
          holdExpiresAt: b.hold_expires_at ? b.hold_expires_at.toISOString() : null,
          source: b.source,
          depositKobo: pay ? Number(pay.amount_kobo) : computedDepositKobo,
          paymentStatus: mappedPayStatus,
          createdAt: b.created_at.toISOString(),
        };
      });

    const custConvs: CustomerConversationSummary[] = convsRes.rows
      .filter((cv) => cv.customer_id === cust.id)
      .map((cv) => ({
        id: cv.id,
        channel: cv.channel,
        status: cv.status,
        lastMessageAt: cv.last_message_at ? cv.last_message_at.toISOString() : null,
        lastMessagePreview: cv.last_message_preview,
        createdAt: cv.created_at.toISOString(),
      }));

    const confirmedOrCompleted = custBookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed',
    );
    const futureConfirmed = custBookings
      .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() >= nowMs)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const lastConfirmed = confirmedOrCompleted
      .slice()
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0];

    // Payment summary (strictly verified only!)
    const custPayments = paymentsRes.rows.filter((p) =>
      custBookings.some((b) => b.id === p.booking_id),
    );
    const verifiedDepositKobo = custPayments
      .filter((p) => p.kind === 'deposit' && p.status === 'succeeded')
      .reduce((acc, p) => acc + Number(p.amount_kobo), 0);
    const pendingVerificationKobo = custPayments
      .filter((p) => p.status === 'pending_verification')
      .reduce((acc, p) => acc + Number(p.amount_kobo), 0);
    const latestPay = custPayments.find((p) => p.verified_at || p.created_at);
    const refundRow = custPayments.find(
      (p) =>
        p.status === 'refund_pending' || p.status === 'refunded' || p.status === 'refund_failed',
    );

    // Determine acquisition source from earliest booking or conversation, else tag/manual
    const earliestBooking = custBookings
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const earliestConv = custConvs
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

    const preferredTag = cust.tags.find((t) => t.startsWith('pref_channel:'));
    const langTag = cust.tags.find((t) => t.startsWith('lang:'));
    const sourceTag = cust.tags.find((t) => t.startsWith('source:'));

    const source: CustomerSource = earliestBooking
      ? earliestBooking.source
      : earliestConv
        ? earliestConv.channel
        : sourceTag === 'source:manual'
          ? 'staff'
          : 'unknown';

    const preferredChannel =
      preferredTag === 'pref_channel:whatsapp'
        ? 'whatsapp'
        : preferredTag === 'pref_channel:web_chat'
          ? 'web_chat'
          : preferredTag === 'pref_channel:phone'
            ? 'phone'
            : null;

    // Activity timeline from persisted timestamps
    const activities: CustomerActivityEvent[] = [
      {
        id: `act_created_${cust.id}`,
        timestamp: cust.created_at.toISOString(),
        label: 'Customer profile created',
        detail: `Profile recorded (${cust.phone_e164}).`,
        kind: 'customer',
      },
    ];

    for (const cv of custConvs) {
      activities.push({
        id: `act_cv_${cv.id}`,
        timestamp: cv.createdAt,
        label: `Customer started ${cv.channel === 'whatsapp' ? 'WhatsApp' : 'web'} chat`,
        detail: cv.lastMessagePreview || 'Conversation started.',
        kind: cv.status === 'needs_human' ? 'attention' : 'conversation',
      });
    }

    for (const bk of custBookings) {
      activities.push({
        id: `act_bk_${bk.id}`,
        timestamp: bk.createdAt,
        label:
          bk.status === 'confirmed'
            ? 'Booking confirmed'
            : bk.status === 'cancelled'
              ? 'Appointment cancelled'
              : bk.status === 'expired'
                ? 'Slot hold expired'
                : 'Appointment slot held',
        detail: `${bk.serviceName} with ${bk.staffName}`,
        kind: 'booking',
      });
      if (bk.paymentStatus === 'verified' && bk.depositKobo > 0) {
        activities.push({
          id: `act_pay_${bk.id}`,
          timestamp: bk.createdAt,
          label: 'Deposit verified',
          detail: `₦${Math.round(bk.depositKobo / 100).toLocaleString('en-NG')} verified via Kora`,
          kind: 'payment',
        });
      }
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const lastActivityAt = activities[0]?.timestamp ?? cust.updated_at.toISOString();
    const hasOpenAttention =
      custConvs.some((cv) => cv.status === 'needs_human') ||
      custBookings.some((bk) => bk.paymentStatus === 'pending_verification');

    return {
      id: cust.id,
      reference: `cus_${cust.id.slice(0, 8).toUpperCase()}`,
      name: cust.name?.trim() || cust.phone_e164,
      phoneE164: cust.phone_e164,
      preferredChannel,
      preferredLanguage: langTag ? langTag.replace('lang:', '') : null,
      notes: cust.notes,
      source,
      createdAt: cust.created_at.toISOString(),
      updatedAt: cust.updated_at.toISOString(),
      lastActivityAt,
      confirmedBookingsCount: confirmedOrCompleted.length,
      lastBookingAt: lastConfirmed ? lastConfirmed.startsAt : null,
      nextUpcomingBooking: futureConfirmed[0] ?? null,
      verifiedDepositKobo,
      pendingVerificationKobo,
      latestPaymentAt: latestPay
        ? (latestPay.verified_at ?? latestPay.created_at).toISOString()
        : null,
      refundStatus: refundRow ? refundRow.status : null,
      hasOpenAttention,
      bookings: custBookings,
      conversations: custConvs,
      activities: activities.slice(0, 15),
    };
  });
}
