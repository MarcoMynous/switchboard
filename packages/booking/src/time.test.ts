import { describe, expect, it } from 'vitest';
import {
  addDaysToLocalDate,
  contains,
  intervalFrom,
  type LocalDate,
  localDateOf,
  localToUtc,
  overlaps,
  parseLocalDate,
  weekdayOf,
} from './time.ts';

const d = (s: string) => s as LocalDate;

describe('parseLocalDate', () => {
  it('accepts real calendar dates', () => {
    expect(parseLocalDate('2026-11-20')).toBe('2026-11-20');
    expect(parseLocalDate('2028-02-29')).toBe('2028-02-29');
  });

  it('rejects malformed and impossible dates', () => {
    for (const bad of [
      '2026-2-1',
      '20261120',
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      'tomorrow',
    ]) {
      expect(parseLocalDate(bad)).toBeNull();
    }
  });
});

describe('local ↔ UTC (asserted in explicit zones, so CI in UTC and laptops in Lagos agree)', () => {
  it('converts Lagos wall-clock to UTC (UTC+1, no DST)', () => {
    expect(localToUtc(d('2026-11-20'), '09:00', 'Africa/Lagos').toISOString()).toBe(
      '2026-11-20T08:00:00.000Z',
    );
    expect(localToUtc(d('2026-11-20'), '19:30:00', 'Africa/Lagos').toISOString()).toBe(
      '2026-11-20T18:30:00.000Z',
    );
  });

  it('works for other zones too (DST and half-hour offsets)', () => {
    expect(localToUtc(d('2026-07-01'), '09:00', 'Europe/London').toISOString()).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(localToUtc(d('2026-01-01'), '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-01-01T03:30:00.000Z',
    );
  });

  it('rejects invalid wall-clock times', () => {
    expect(() => localToUtc(d('2026-11-20'), '25:00', 'Africa/Lagos')).toThrow(
      'invalid local time',
    );
  });

  it('finds the business-local date of an instant (late UTC evening is already tomorrow in Lagos)', () => {
    expect(localDateOf(new Date('2026-11-20T23:30:00.000Z'), 'Africa/Lagos')).toBe('2026-11-21');
    expect(localDateOf(new Date('2026-11-20T22:59:00.000Z'), 'Africa/Lagos')).toBe('2026-11-20');
  });
});

describe('calendar helpers', () => {
  it('gives the weekday with 0 = Sunday', () => {
    expect(weekdayOf(d('2026-11-22'))).toBe(0);
    expect(weekdayOf(d('2026-11-20'))).toBe(5);
  });

  it('adds days across month and year ends', () => {
    expect(addDaysToLocalDate(d('2026-11-30'), 1)).toBe('2026-12-01');
    expect(addDaysToLocalDate(d('2026-12-31'), 14)).toBe('2027-01-14');
  });
});

describe('intervals (half-open)', () => {
  const a = intervalFrom(new Date('2026-11-20T08:00:00.000Z'), 30);
  const b = intervalFrom(new Date('2026-11-20T08:30:00.000Z'), 30);
  const c = intervalFrom(new Date('2026-11-20T08:15:00.000Z'), 30);

  it('back-to-back intervals do not overlap; partial ones do', () => {
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(a, c)).toBe(true);
  });

  it('containment includes the edges', () => {
    expect(contains({ start: a.start, end: b.end }, a)).toBe(true);
    expect(contains(a, c)).toBe(false);
  });
});
