import type { Db } from '@switchboard/db';
import { type Booking, type BookingStatus, bookings, outbox } from '@switchboard/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  type BookingConfig,
  type Clock,
  DEFAULT_CONFIG,
  type Executor,
  systemClock,
} from './context.ts';
import type { DomainError } from './errors.ts';
import { loadBusiness, loadService, loadTimeOff, loadWorkingWindows, lockStaff } from './load.ts';
import { isExclusionViolation, retryOnConflict } from './pg-errors.ts';
import { err, ok, type Result } from './result.ts';
import { checkBookingDate, earliestStart } from './rules.ts';
import { contains, intervalFrom, localDateOf, overlaps } from './time.ts';
import { sourcesOf } from './transitions.ts';

// Every state change is `UPDATE … WHERE id = $1 AND status = ANY(<allowed sources>)` and checks
// that exactly one row moved (docs/03-data-model.md). A concurrent change makes it a no-op.

export interface TransitionInput {
  businessId: string;
  bookingId: string;
  to: Exclude<BookingStatus, 'held'>;
  reason?: string;
}

/**
 * Moves a booking along the state machine and writes `booking.<to>` to the outbox, in one tx.
 * Accepts an open transaction so P2 can confirm inside its payment transaction.
 */
export async function transitionBooking(
  db: Executor,
  input: TransitionInput,
): Promise<Result<Booking, DomainError>> {
  const run = async (tx: Executor) => {
    const [row] = await tx
      .update(bookings)
      .set({
        status: input.to,
        version: sql`${bookings.version} + 1`,
        // A confirmed booking no longer has a deadline. Expired/cancelled keep it as history.
        ...(input.to === 'confirmed' ? { holdExpiresAt: null } : {}),
        ...(input.reason !== undefined ? { cancelReason: input.reason } : {}),
      })
      .where(
        and(
          eq(bookings.id, input.bookingId),
          eq(bookings.businessId, input.businessId),
          inArray(bookings.status, sourcesOf(input.to)),
        ),
      )
      .returning();
    if (row) {
      await tx.insert(outbox).values({
        topic: `booking.${input.to}`,
        payload: { bookingId: row.id, businessId: row.businessId, reason: input.reason ?? null },
      });
    }
    return row;
  };

  // On a Db this opens a transaction; inside a caller's transaction it opens a savepoint.
  const row = await db.transaction(run);
  if (row) return ok(row);
  return refusal(db, input.businessId, input.bookingId, input.to);
}

/** Why a guarded update moved no row: the booking is missing, or its status forbids `to`. */
async function refusal(
  db: Executor,
  businessId: string,
  bookingId: string,
  to: BookingStatus,
): Promise<Result<never, DomainError>> {
  const [current] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, businessId)));
  if (!current) return err({ code: 'NOT_FOUND', entity: 'booking' });
  return err({ code: 'INVALID_TRANSITION', from: current.status, to });
}

/**
 * held → confirmed. Only P2's `payment.received` function calls this, after Kora re-verification
 * (I2). It is never exposed over HTTP. rowCount 0 on a held booking = late payment path.
 */
export function confirmBooking(db: Executor, businessId: string, bookingId: string) {
  return transitionBooking(db, { businessId, bookingId, to: 'confirmed' });
}

export function cancelBooking(db: Executor, businessId: string, bookingId: string, reason: string) {
  return transitionBooking(db, { businessId, bookingId, to: 'cancelled', reason });
}

/**
 * held → expired, but only once its deadline has passed by Postgres' clock. Called by the
 * Inngest `hold.expire` function after sleeping until hold_expires_at. Idempotent: returns
 * `false` when the hold was already confirmed, cancelled, expired, or isn't due yet.
 */
export async function expireHold(db: Db, bookingId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(bookings)
      .set({ status: 'expired', version: sql`${bookings.version} + 1` })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, 'held'),
          sql`${bookings.holdExpiresAt} <= now()`,
        ),
      )
      .returning({ id: bookings.id, businessId: bookings.businessId });
    if (!row) return false;
    await tx.insert(outbox).values({
      topic: 'booking.expired',
      payload: { bookingId: row.id, businessId: row.businessId, reason: 'timeout' },
    });
    return true;
  });
}

/** Sweeper (cron, every 5 min): expires every overdue hold the per-hold job missed. */
export async function sweepExpiredHolds(db: Db): Promise<string[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(bookings)
      .set({ status: 'expired', version: sql`${bookings.version} + 1` })
      .where(and(eq(bookings.status, 'held'), sql`${bookings.holdExpiresAt} <= now()`))
      .returning({ id: bookings.id, businessId: bookings.businessId });
    if (rows.length > 0) {
      await tx.insert(outbox).values(
        rows.map((r) => ({
          topic: 'booking.expired',
          payload: { bookingId: r.id, businessId: r.businessId, reason: 'sweeper' },
        })),
      );
    }
    return rows.map((r) => r.id);
  });
}

export interface RescheduleInput {
  businessId: string;
  bookingId: string;
  startsAt: Date;
  /** Optimistic lock: the version the caller last saw. */
  expectedVersion: number;
  /** Move to another staff member as well; defaults to the current one. */
  staffId?: string;
}

/**
 * Moves an active booking to a new time (and optionally staff). Same validation as holdSlot;
 * the EXCLUDE constraint still referees overlap (the row's own old range doesn't count).
 */
export async function rescheduleBooking(
  db: Db,
  input: RescheduleInput,
  deps: { config?: BookingConfig; clock?: Clock } = {},
): Promise<Result<Booking, DomainError>> {
  const config = deps.config ?? DEFAULT_CONFIG;
  const now = (deps.clock ?? systemClock)();

  const [current] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.businessId, input.businessId)));
  if (!current) return err({ code: 'NOT_FOUND', entity: 'booking' });
  if (current.status !== 'held' && current.status !== 'confirmed') {
    return err({ code: 'INVALID_TRANSITION', from: current.status, to: current.status });
  }
  if (current.version !== input.expectedVersion) {
    return err({ code: 'STALE_VERSION', currentVersion: current.version });
  }

  const business = await loadBusiness(db, input.businessId);
  const service = await loadService(db, input.businessId, current.serviceId);
  if (!business || !service) return err({ code: 'NOT_FOUND', entity: 'service' });

  const staffId = input.staffId ?? current.staffId;
  const slot = intervalFrom(input.startsAt, service.durationMin);
  const date = localDateOf(slot.start, business.timezone);
  const windowError = checkBookingDate(business, date, now);
  if (windowError) return err(windowError);
  if (slot.start < earliestStart(now, config.minLeadMinutes)) {
    return err({ code: 'TOO_SOON', minLeadMinutes: config.minLeadMinutes });
  }
  const windows = await loadWorkingWindows(db, [staffId], date, business.timezone);
  const off = await loadTimeOff(db, [staffId], slot);
  const fits =
    (windows.get(staffId) ?? []).some((w) => contains(w, slot)) &&
    !(off.get(staffId) ?? []).some((o) => overlaps(o, slot));
  if (!fits) return err({ code: 'OUTSIDE_WORKING_HOURS' });

  try {
    const row = await retryOnConflict(() =>
      db.transaction(async (tx) => {
        // Same per-staff queue as holdSlot; both rows, in id order, when changing staff.
        await lockStaff(tx, [current.staffId, staffId]);
        const [moved] = await tx
          .update(bookings)
          .set({
            staffId,
            startsAt: slot.start,
            endsAt: slot.end,
            version: sql`${bookings.version} + 1`,
          })
          .where(
            and(
              eq(bookings.id, input.bookingId),
              eq(bookings.version, input.expectedVersion),
              inArray(bookings.status, ['held', 'confirmed']),
            ),
          )
          .returning();
        if (moved) {
          await tx.insert(outbox).values({
            topic: 'booking.rescheduled',
            payload: {
              bookingId: moved.id,
              businessId: moved.businessId,
              from: current.startsAt.toISOString(),
              to: moved.startsAt.toISOString(),
            },
          });
        }
        return moved;
      }),
    );
    if (row) return ok(row);
    // Lost a race with another edit between the read above and the update.
    const [latest] = await db
      .select({ version: bookings.version })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId));
    return err({ code: 'STALE_VERSION', currentVersion: latest?.version ?? current.version });
  } catch (e) {
    if (isExclusionViolation(e, 'bookings_no_overlap')) return err({ code: 'SLOT_TAKEN' });
    throw e;
  }
}
