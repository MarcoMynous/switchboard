import { type Interval, intervalFrom } from './time.ts';

// Pure availability maths: no DB, no clock. findSlots loads the inputs; this decides.
// The result is only a suggestion; the EXCLUDE constraint decides the truth at hold time.

export interface StaffAvailability {
  staffId: string;
  /** Working windows for the day, already converted to UTC. */
  windows: Interval[];
  /** Time off plus active (held-and-unexpired or confirmed) bookings. */
  busy: Interval[];
}

export interface ComputeSlotsInput {
  staff: StaffAvailability[];
  durationMin: number;
  stepMin: number;
  /** now + MIN_LEAD_MINUTES: nothing may start before this. */
  earliestStart: Date;
  limit: number;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  /** Every eligible staff member free for the whole slot, in input order. */
  staffIds: string[];
}

/** `from` minus every interval in `remove`, as sorted, non-overlapping intervals. */
export function subtractIntervals(from: Interval[], remove: Interval[]): Interval[] {
  const cuts = [...remove].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Interval[] = [];
  for (const window of from) {
    let cursor = window.start;
    for (const cut of cuts) {
      if (cut.end <= cursor || cut.start >= window.end) continue;
      if (cut.start > cursor) out.push({ start: cursor, end: cut.start });
      if (cut.end > cursor) cursor = cut.end;
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) out.push({ start: cursor, end: window.end });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * First instant ≥ `t` on the step grid. The grid is anchored to the epoch, so steps land on
 * :00/:15/:30/:45 in any timezone whose offset is a multiple of 15 minutes (all real ones).
 */
export function ceilToStep(t: Date, stepMin: number): Date {
  const stepMs = stepMin * 60_000;
  return new Date(Math.ceil(t.getTime() / stepMs) * stepMs);
}

/** Candidate starts for one staff member: every grid point where the whole service fits. */
export function candidatesFor(
  staff: StaffAvailability,
  durationMin: number,
  stepMin: number,
  earliestStart: Date,
): Interval[] {
  const free = subtractIntervals(staff.windows, staff.busy);
  const out: Interval[] = [];
  for (const window of free) {
    const from = window.start > earliestStart ? window.start : earliestStart;
    for (let t = ceilToStep(from, stepMin); ; t = new Date(t.getTime() + stepMin * 60_000)) {
      const slot = intervalFrom(t, durationMin);
      if (slot.end > window.end) break;
      out.push(slot);
    }
  }
  return out;
}

/** Pick `limit` items evenly across the list, so 10 slots aren't all at 9:00. */
export function spread<T>(items: T[], limit: number): T[] {
  if (limit <= 0) return [];
  if (items.length <= limit) return items;
  if (limit === 1) return items.slice(0, 1);
  const out: T[] = [];
  for (let i = 0; i < limit; i++) {
    const item = items[Math.round((i * (items.length - 1)) / (limit - 1))];
    if (item !== undefined) out.push(item);
  }
  return out;
}

export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const byStart = new Map<number, Slot>();
  for (const staff of input.staff) {
    for (const c of candidatesFor(staff, input.durationMin, input.stepMin, input.earliestStart)) {
      const key = c.start.getTime();
      const existing = byStart.get(key);
      if (existing) existing.staffIds.push(staff.staffId);
      else byStart.set(key, { startsAt: c.start, endsAt: c.end, staffIds: [staff.staffId] });
    }
  }
  const all = [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return spread(all, input.limit);
}
