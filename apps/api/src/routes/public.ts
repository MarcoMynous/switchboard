import {
  addDaysToLocalDate,
  type BookingConfig,
  type DomainError,
  findSlots,
  getPublicCatalog,
  holdSlot,
  localDateOf,
  resolveService,
  type Slot,
  upsertCustomer,
} from '@switchboard/booking';
import type { Db } from '@switchboard/db';
import {
  bookings,
  customers,
  openPaymentsAttempts,
  payments,
  services,
  staff,
} from '@switchboard/db';
import { parseISO } from 'date-fns';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

// Public booking API (docs/features/F02-public-booking-page.md). Unauthenticated: it exposes only
// the catalog and slot suggestions, and the only write (a hold) is validated and idempotent.

export interface PublicRoutesDeps {
  db: Db;
  config: BookingConfig;
}

const STATUS: Record<DomainError['code'], ContentfulStatusCode> = {
  NOT_FOUND: 404,
  SLOT_TAKEN: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  INVALID_DATE: 400,
  INVALID_PHONE: 400,
  OUTSIDE_WORKING_HOURS: 422,
  TOO_SOON: 422,
  TOO_FAR_AHEAD: 422,
  SAME_DAY_NOT_ALLOWED: 422,
  STAFF_CANNOT_DO_SERVICE: 422,
  INVALID_TRANSITION: 409,
  STALE_VERSION: 409,
};

const uuid = z.uuid();

const slotsQuery = z.object({
  service: z.string().min(1),
  date: z.iso.date().optional(),
  staff: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

const holdBody = z.object({
  serviceId: uuid,
  staffId: uuid.optional(),
  /** ISO 8601 with an explicit offset or Z, e.g. 2026-11-20T10:00:00+01:00. */
  startsAt: z.iso.datetime({ offset: true }),
  customer: z.object({
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(7).max(20),
  }),
  /** Generated when the booking form mounts and resent on retry (docs/04 → Idempotency keys). */
  idempotencyKey: z.string().min(8).max(128),
});

const slotJson = (s: Slot) => ({
  startsAt: s.startsAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
  staffIds: s.staffIds,
});

const problem = (error: DomainError) => ({ error });

export function publicRoutes({ db, config }: PublicRoutesDeps) {
  const app = new Hono();
  const deps = { config };

  app.get('/:slug', async (c) => {
    const catalog = await getPublicCatalog(db, c.req.param('slug'));
    if (!catalog) return c.json(problem({ code: 'NOT_FOUND', entity: 'business' }), 404);
    c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
    return c.json(catalog);
  });

  app.get('/:slug/slots', async (c) => {
    const query = slotsQuery.safeParse(c.req.query());
    if (!query.success)
      return c.json({ error: { code: 'BAD_REQUEST', issues: query.error.issues } }, 400);
    const catalog = await getPublicCatalog(db, c.req.param('slug'));
    if (!catalog) return c.json(problem({ code: 'NOT_FOUND', entity: 'business' }), 404);
    const service = resolveService(catalog, query.data.service);
    if (!service) return c.json(problem({ code: 'NOT_FOUND', entity: 'service' }), 404);

    const base = {
      businessId: catalog.business.id,
      serviceId: service.id,
      ...(query.data.staff ? { staffId: query.data.staff } : {}),
      limit: query.data.limit,
    };

    // A date was asked for: answer for that day only.
    if (query.data.date) {
      const r = await findSlots(db, { ...base, date: query.data.date }, deps);
      if (!r.ok) return c.json(problem(r.error), STATUS[r.error.code]);
      return c.json({
        date: query.data.date,
        timezone: catalog.business.timezone,
        slots: r.value.map(slotJson),
      });
    }

    // No date: the next day with anything free, within the business's booking window.
    const today = localDateOf(new Date(), catalog.business.timezone);
    for (let i = 0; i <= catalog.business.advanceDays; i++) {
      const date = addDaysToLocalDate(today, i);
      const r = await findSlots(db, { ...base, date }, deps);
      if (!r.ok) {
        if (r.error.code === 'SAME_DAY_NOT_ALLOWED') continue;
        return c.json(problem(r.error), STATUS[r.error.code]);
      }
      if (r.value.length > 0) {
        return c.json({ date, timezone: catalog.business.timezone, slots: r.value.map(slotJson) });
      }
    }
    return c.json({ date: null, timezone: catalog.business.timezone, slots: [] });
  });

  app.post('/:slug/holds', async (c) => {
    const body = holdBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json({ error: { code: 'BAD_REQUEST', issues: body.error.issues } }, 400);
    const catalog = await getPublicCatalog(db, c.req.param('slug'));
    if (!catalog) return c.json(problem({ code: 'NOT_FOUND', entity: 'business' }), 404);
    const businessId = catalog.business.id;

    const customer = await upsertCustomer(db, { businessId, ...body.data.customer });
    if (!customer.ok) return c.json(problem(customer.error), STATUS[customer.error.code]);

    // Validated ISO with explicit offset, so parsing is unambiguous (never `new Date(userString)`).
    const startsAt = parseISO(body.data.startsAt);
    const r = await holdSlot(
      db,
      {
        businessId,
        serviceId: body.data.serviceId,
        ...(body.data.staffId ? { staffId: body.data.staffId } : {}),
        customerId: customer.value.id,
        startsAt,
        idempotencyKey: body.data.idempotencyKey,
        source: 'booking_page',
      },
      deps,
    );

    if (!r.ok) {
      if (r.error.code !== 'SLOT_TAKEN') return c.json(problem(r.error), STATUS[r.error.code]);
      // F02: "That time just got taken. Here are the next three." The customer never hits a dead end.
      const next = await findSlots(
        db,
        {
          businessId,
          serviceId: body.data.serviceId,
          date: localDateOf(startsAt, catalog.business.timezone),
          ...(body.data.staffId ? { staffId: body.data.staffId } : {}),
          limit: 50,
        },
        deps,
      );
      const alternatives = next.ok
        ? next.value
            .filter((s) => s.startsAt > startsAt)
            .slice(0, 3)
            .map(slotJson)
        : [];
      return c.json({ error: r.error, alternatives }, 409);
    }

    const b = r.value.booking;
    return c.json(
      {
        replayed: r.value.replayed,
        booking: {
          id: b.id,
          status: b.status,
          serviceId: b.serviceId,
          staffId: b.staffId,
          startsAt: b.startsAt.toISOString(),
          endsAt: b.endsAt.toISOString(),
          holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
        },
      },
      r.value.replayed ? 200 : 201,
    );
  });

  app.get('/:slug/bookings/:bookingId', async (c) => {
    const bookingId = c.req.param('bookingId');
    if (!uuid.safeParse(bookingId).success) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid booking ID' } }, 400);
    }

    const catalog = await getPublicCatalog(db, c.req.param('slug'));
    if (!catalog) return c.json(problem({ code: 'NOT_FOUND', entity: 'business' }), 404);

    const booking = await db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), eq(bookings.businessId, catalog.business.id)),
    });
    if (!booking) return c.json(problem({ code: 'NOT_FOUND', entity: 'booking' }), 404);

    const [service, staffMember, customer, latestPayment] = await Promise.all([
      db.query.services.findFirst({ where: eq(services.id, booking.serviceId) }),
      db.query.staff.findFirst({ where: eq(staff.id, booking.staffId) }),
      db.query.customers.findFirst({ where: eq(customers.id, booking.customerId) }),
      db.query.payments.findFirst({
        where: and(
          eq(payments.bookingId, booking.id),
          eq(payments.businessId, catalog.business.id),
        ),
        orderBy: [desc(payments.createdAt)],
      }),
    ]);

    const attempt =
      latestPayment && latestPayment.provider === 'interledger'
        ? await db.query.openPaymentsAttempts.findFirst({
            where: eq(openPaymentsAttempts.paymentId, latestPayment.id),
          })
        : null;

    const priceKobo = service?.priceKobo ?? 0;
    let depositKobo = 0;
    if (service) {
      if (service.depositType === 'full') depositKobo = priceKobo;
      else if (service.depositType === 'percent') {
        depositKobo = Math.round(
          (priceKobo * Math.max(0, Math.min(100, service.depositValue))) / 100,
        );
      } else if (service.depositType === 'fixed') {
        depositKobo = Math.max(0, service.depositValue);
      }
    }

    const phoneDigits = customer?.phoneE164 ? customer.phoneE164.slice(-4) : null;

    return c.json({
      business: catalog.business,
      booking: {
        id: booking.id,
        reference: latestPayment?.providerReference ?? `sb_bk_${booking.id.slice(0, 8)}`,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
        service: service
          ? {
              id: service.id,
              name: service.name,
              durationMin: service.durationMin,
              priceKobo,
              depositType: service.depositType,
              depositKobo,
              freeCancelHours: service.freeCancelHours,
            }
          : null,
        staff: staffMember ? { id: staffMember.id, name: staffMember.name } : null,
        customer: customer
          ? {
              name: customer.name ?? 'Guest',
              phoneMasked: phoneDigits ? `***${phoneDigits}` : null,
            }
          : null,
      },
      payment: latestPayment
        ? {
            id: latestPayment.id,
            provider: latestPayment.provider,
            reference: latestPayment.providerReference ?? latestPayment.koraReference,
            status: latestPayment.status,
            isSimulated: latestPayment.isSimulated,
            amountKobo: latestPayment.amountKobo,
            assetCode: latestPayment.assetCode,
            assetScale: latestPayment.assetScale,
            expectedAmount: latestPayment.providerExpectedAmount,
            receivedAmount: latestPayment.providerReceivedAmount,
            verifiedAt: latestPayment.verifiedAt?.toISOString() ?? null,
            attempt: attempt
              ? {
                  grantState: attempt.grantState,
                  senderWalletAddress: attempt.senderWalletAddress,
                  recipientWalletAddress: attempt.recipientWalletAddress,
                  incomingPaymentId: attempt.incomingPaymentId,
                  outgoingPaymentId: attempt.outgoingPaymentId,
                  quoteId: attempt.quoteId,
                  quoteDebitAmount: attempt.quoteDebitAmount,
                  quoteDebitAssetCode: attempt.quoteDebitAssetCode,
                  quoteDebitAssetScale: attempt.quoteDebitAssetScale,
                  quoteReceiveAmount: attempt.quoteReceiveAmount,
                  quoteExpiresAt: attempt.quoteExpiresAt?.toISOString() ?? null,
                  lastErrorCode: attempt.lastErrorCode,
                  lastErrorMessage: attempt.lastErrorMessage,
                }
              : null,
          }
        : null,
    });
  });

  return app;
}
