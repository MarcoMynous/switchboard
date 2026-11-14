import { addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// Storage is UTC; business-local only at the edges (docs/concerns/timezones-and-time.md).
// Never `new Date(string)` on user input: dates arrive as validated 'YYYY-MM-DD' strings.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** A calendar date as written in the business's timezone, e.g. '2026-11-20'. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

export function parseLocalDate(input: string): LocalDate | null {
  const m = DATE_RE.exec(input);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  // Rejects 2026-02-30 and friends.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return input as LocalDate;
}

/** 0 = Sunday … 6 = Saturday, the same convention as working_hours.weekday. */
export function weekdayOf(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysToLocalDate(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10) as LocalDate;
}

/** The business-local calendar date an instant falls on. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return formatInTimeZone(instant, timeZone, 'yyyy-MM-dd') as LocalDate;
}

/** Business-local wall-clock time ('HH:MM' or 'HH:MM:SS') on `date` → the UTC instant. */
export function localToUtc(date: LocalDate, time: string, timeZone: string): Date {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`invalid local time: ${time}`);
  return fromZonedTime(`${date}T${m[1]}:${m[2]}:${m[3] ?? '00'}`, timeZone);
}

/** Half-open [start, end). */
export interface Interval {
  start: Date;
  end: Date;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function intervalFrom(start: Date, durationMin: number): Interval {
  return { start, end: addMinutes(start, durationMin) };
}
