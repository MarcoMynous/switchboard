import {
  bookings,
  businesses,
  services,
  staff,
  staffServices,
  timeOff,
  workingHours,
} from '@switchboard/db/schema';
import { and, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import type { Executor } from './context.ts';
import {
  addDaysToLocalDate,
  type Interval,
  type LocalDate,
  localToUtc,
  weekdayOf,
} from './time.ts';

// Shared loaders, so findSlots (suggestion) and holdSlot (validation) apply the same rules.
// Every query is scoped by business_id (tenant isolation, docs/03-data-model.md).

export async function loadBusiness(db: Executor, businessId: string) {
  const [row] = await db
    .select({
      id: businesses.id,
      timezone: businesses.timezone,
      advanceDays: businesses.advanceDays,
      allowSameDay: businesses.allowSameDay,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  return row ?? null;
}

export type LoadedBusiness = NonNullable<Awaited<ReturnType<typeof loadBusiness>>>;

export async function loadService(db: Executor, businessId: string, serviceId: string) {
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.businessId, businessId)));
  return row ?? null;
}

/** Active staff who can perform the service, optionally narrowed to one, ordered by name. */
export async function loadEligibleStaff(
  db: Executor,
  businessId: string,
  serviceId: string,
  staffId?: string,
) {
  return db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
    .where(
      and(
        eq(staff.businessId, businessId),
        eq(staff.active, true),
        eq(staffServices.serviceId, serviceId),
        staffId ? eq(staff.id, staffId) : undefined,
      ),
    )
    .orderBy(staff.name, staff.id);
}

/** The UTC bounds of a business-local calendar day: [00:00, next 00:00). */
export function dayBounds(date: LocalDate, timeZone: string): Interval {
  return {
    start: localToUtc(date, '00:00', timeZone),
    end: localToUtc(addDaysToLocalDate(date, 1), '00:00', timeZone),
  };
}

/** Working windows per staff member on `date`, in UTC. Overnight or empty rows are ignored. */
export async function loadWorkingWindows(
  db: Executor,
  staffIds: string[],
  date: LocalDate,
  timeZone: string,
): Promise<Map<string, Interval[]>> {
  const out = new Map<string, Interval[]>(staffIds.map((id) => [id, []]));
  if (staffIds.length === 0) return out;
  const rows = await db
    .select()
    .from(workingHours)
    .where(and(inArray(workingHours.staffId, staffIds), eq(workingHours.weekday, weekdayOf(date))));
  for (const row of rows) {
    const start = localToUtc(date, row.startLocal, timeZone);
    const end = localToUtc(date, row.endLocal, timeZone);
    if (end > start) out.get(row.staffId)?.push({ start, end });
  }
  return out;
}

/**
 * Time off plus bookings that occupy the staff member during `range`: confirmed, or held and not
 * yet expired by Postgres' clock. Expired-but-unswept holds don't block (holdSlot reclaims them).
 */
export async function loadBusy(
  db: Executor,
  staffIds: string[],
  range: Interval,
): Promise<Map<string, Interval[]>> {
  const out = await loadTimeOff(db, staffIds, range);
  if (staffIds.length === 0) return out;

  const booked = await db
    .select({ staffId: bookings.staffId, start: bookings.startsAt, end: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        inArray(bookings.staffId, staffIds),
        lt(bookings.startsAt, range.end),
        gt(bookings.endsAt, range.start),
        or(
          eq(bookings.status, 'confirmed'),
          and(eq(bookings.status, 'held'), sql`${bookings.holdExpiresAt} > now()`),
        ),
      ),
    );

  for (const r of booked) out.get(r.staffId)?.push({ start: r.start, end: r.end });
  return out;
}

/** Time off overlapping `range`, per staff member. */
export async function loadTimeOff(
  db: Executor,
  staffIds: string[],
  range: Interval,
): Promise<Map<string, Interval[]>> {
  const out = new Map<string, Interval[]>(staffIds.map((id) => [id, []]));
  if (staffIds.length === 0) return out;
  const rows = await db
    .select({ staffId: timeOff.staffId, start: timeOff.startsAt, end: timeOff.endsAt })
    .from(timeOff)
    .where(
      and(
        inArray(timeOff.staffId, staffIds),
        lt(timeOff.startsAt, range.end),
        gt(timeOff.endsAt, range.start),
      ),
    );
  for (const r of rows) out.get(r.staffId)?.push({ start: r.start, end: r.end });
  return out;
}

/**
 * Locks staff rows for the rest of the transaction, in id order (so two multi-staff lockers can't
 * deadlock each other). Serialises booking writes per staff member; see holdSlot for why.
 */
export async function lockStaff(tx: Executor, staffIds: string[]): Promise<void> {
  const ids = [...new Set(staffIds)].sort();
  if (ids.length === 0) return;
  await tx
    .select({ id: staff.id })
    .from(staff)
    .where(inArray(staff.id, ids))
    .orderBy(staff.id)
    .for('no key update');
}
