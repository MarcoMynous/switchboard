import type { Db } from '@switchboard/db';
import { type Booking, type BookingSource, bookings, outbox } from '@switchboard/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { type BookingConfig, type Clock, DEFAULT_CONFIG, systemClock } from './context.ts';
import type { DomainError } from './errors.ts';
import {
  loadBusiness,
  loadEligibleStaff,
  loadService,
  loadTimeOff,
  loadWorkingWindows,
  lockStaff,
} from './load.ts';
import { isExclusionViolation, isUniqueViolation, retryOnConflict } from './pg-errors.ts';
import { err, ok, type Result } from './result.ts';
import { checkBookingDate, earliestStart } from './rules.ts';
import { contains, intervalFrom, localDateOf, overlaps } from './time.ts';

export interface HoldSlotInput {
  businessId: string;
  serviceId: string;
  /** Omit for "any available staff": eligible staff are tried in order until one sticks. */
  staffId?: string;
  customerId: string;
  startsAt: Date;
  /** Same key → same booking back, never a second row (I4). */
  idempotencyKey: string;
  source: BookingSource;
}

export interface HoldResult {
  booking: Booking;
  /** true when this call returned an earlier call's booking for the same key. */
  replayed: boolean;
}

export interface HoldDeps {
  config?: BookingConfig;
  clock?: Clock;
}

type Attempt = { kind: 'held'; booking: Booking } | { kind: 'taken' } | { kind: 'replay' };

/**
 * Holds a slot (docs/04-booking-engine.md → Hold). The EXCLUDE constraint is the referee: of any
 * number of concurrent calls for overlapping time on one staff member, exactly one inserts.
 * No-deposit services are confirmed directly; everything else is `held` for HOLD_MINUTES.
 */
export async function holdSlot(
  db: Db,
  input: HoldSlotInput,
  deps: HoldDeps = {},
): Promise<Result<HoldResult, DomainError>> {
  const config = deps.config ?? DEFAULT_CONFIG;
  const now = (deps.clock ?? systemClock)();

  // 1. Idempotent replay (fast path, before any validation can disagree with the original call).
  const prior = await replay(db, input);
  if (prior) return prior;

  const business = await loadBusiness(db, input.businessId);
  if (!business) return err({ code: 'NOT_FOUND', entity: 'business' });
  const service = await loadService(db, input.businessId, input.serviceId);
  if (!service) return err({ code: 'NOT_FOUND', entity: 'service' });

  const slot = intervalFrom(input.startsAt, service.durationMin);
  const date = localDateOf(slot.start, business.timezone);
  const windowError = checkBookingDate(business, date, now);
  if (windowError) return err(windowError);
  if (slot.start < earliestStart(now, config.minLeadMinutes)) {
    return err({ code: 'TOO_SOON', minLeadMinutes: config.minLeadMinutes });
  }

  const eligible = await loadEligibleStaff(db, input.businessId, input.serviceId, input.staffId);
  if (eligible.length === 0) return err({ code: 'STAFF_CANNOT_DO_SERVICE' });

  // 2. Working hours and time off are validated here; overlap with bookings is left to Postgres.
  const ids = eligible.map((s) => s.id);
  const windows = await loadWorkingWindows(db, ids, date, business.timezone);
  const off = await loadTimeOff(db, ids, slot);
  const fitting = ids.filter(
    (id) =>
      (windows.get(id) ?? []).some((w) => contains(w, slot)) &&
      !(off.get(id) ?? []).some((o) => overlaps(o, slot)),
  );
  if (fitting.length === 0) return err({ code: 'OUTSIDE_WORKING_HOURS' });

  const status = service.depositType === 'none' ? 'confirmed' : 'held';
  for (const staffId of fitting) {
    const attempt = await insertBooking(db, input, staffId, slot.end, status, config.holdMinutes);
    if (attempt.kind === 'held') return ok({ booking: attempt.booking, replayed: false });
    if (attempt.kind === 'replay') {
      const again = await replay(db, input);
      if (again) return again;
    }
  }
  return err({ code: 'SLOT_TAKEN' });
}

/** The booking an earlier call made with this key, if any. Mismatched details are refused. */
async function replay(
  db: Db,
  input: HoldSlotInput,
): Promise<Result<HoldResult, DomainError> | null> {
  const [existing] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.businessId, input.businessId),
        eq(bookings.idempotencyKey, input.idempotencyKey),
      ),
    );
  if (!existing) return null;
  const same =
    existing.serviceId === input.serviceId &&
    existing.startsAt.getTime() === input.startsAt.getTime() &&
    (input.staffId === undefined || existing.staffId === input.staffId);
  return same
    ? ok({ booking: existing, replayed: true })
    : err({ code: 'IDEMPOTENCY_KEY_REUSED', bookingId: existing.id });
}

async function insertBooking(
  db: Db,
  input: HoldSlotInput,
  staffId: string,
  endsAt: Date,
  status: 'held' | 'confirmed',
  holdMinutes: number,
): Promise<Attempt> {
  try {
    const booking = await retryOnConflict(() =>
      db.transaction(async (tx) => {
        // Queue holds for the same staff member on their row. Without this, concurrent inserts
        // checked by the EXCLUDE constraint wait on each other's uncommitted rows and deadlock
        // (each cycle costs Postgres' 1s deadlock_timeout: throughput collapses under load).
        // Correctness still comes from the constraint; this only keeps contention orderly.
        // Transaction-scoped, so safe behind PgBouncer. NO KEY UPDATE doesn't block FK checks.
        await lockStaff(tx, [staffId]);

        // Reclaim expired holds the expiry job hasn't reached yet, so they don't block this slot.
        const reclaimed = await tx
          .update(bookings)
          .set({ status: 'expired', version: sql`${bookings.version} + 1` })
          .where(
            and(
              eq(bookings.staffId, staffId),
              eq(bookings.status, 'held'),
              sql`${bookings.holdExpiresAt} <= now()`,
              sql`tstzrange(${bookings.startsAt}, ${bookings.endsAt}, '[)') && tstzrange(${input.startsAt}, ${endsAt}, '[)')`,
            ),
          )
          .returning({ id: bookings.id, businessId: bookings.businessId });
        if (reclaimed.length > 0) {
          await tx.insert(outbox).values(
            reclaimed.map((r) => ({
              topic: 'booking.expired',
              payload: { bookingId: r.id, businessId: r.businessId, reason: 'reclaimed' },
            })),
          );
        }

        const [row] = await tx
          .insert(bookings)
          .values({
            businessId: input.businessId,
            staffId,
            serviceId: input.serviceId,
            customerId: input.customerId,
            startsAt: input.startsAt,
            endsAt,
            status,
            // Postgres' clock, not the app server's (docs/concerns/timezones-and-time.md).
            holdExpiresAt:
              status === 'held' ? sql`now() + make_interval(mins => ${holdMinutes})` : null,
            source: input.source,
            idempotencyKey: input.idempotencyKey,
          })
          .returning();
        if (!row) throw new Error('insert into bookings returned no row');

        await tx.insert(outbox).values({
          topic: status === 'held' ? 'booking.held' : 'booking.confirmed',
          payload: {
            bookingId: row.id,
            businessId: row.businessId,
            holdExpiresAt: row.holdExpiresAt?.toISOString() ?? null,
          },
        });
        return row;
      }),
    );
    return { kind: 'held', booking };
  } catch (e) {
    // A same-key twin can lose on either constraint, depending on which index Postgres checks
    // first, so any refusal is re-checked against the key before calling the slot taken.
    if (isUniqueViolation(e, 'bookings_idem')) return { kind: 'replay' };
    if (isExclusionViolation(e, 'bookings_no_overlap')) {
      const [twin] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.businessId, input.businessId),
            eq(bookings.idempotencyKey, input.idempotencyKey),
          ),
        );
      return twin ? { kind: 'replay' } : { kind: 'taken' };
    }
    throw e;
  }
}
