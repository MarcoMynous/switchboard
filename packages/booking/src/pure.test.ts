import { describe, expect, it, vi } from 'vitest';
import {
  isExclusionViolation,
  isRetryableConflict,
  isUniqueViolation,
  retryOnConflict,
} from './pg-errors.ts';
import { toE164 } from './phone.ts';
import { err, ok } from './result.ts';
import { checkBookingDate, earliestStart } from './rules.ts';
import type { LocalDate } from './time.ts';
import {
  ACTIVE_STATUSES,
  canTransition,
  isTerminal,
  sourcesOf,
  TRANSITIONS,
} from './transitions.ts';

describe('transitions table', () => {
  it('allows exactly the documented moves', () => {
    expect(canTransition('held', 'confirmed')).toBe(true);
    expect(canTransition('held', 'expired')).toBe(true);
    expect(canTransition('confirmed', 'no_show')).toBe(true);
    expect(canTransition('expired', 'confirmed')).toBe(false);
    expect(canTransition('confirmed', 'held')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
  });

  it('marks terminal states and lists sources for guarded updates', () => {
    expect(
      ['expired', 'cancelled', 'completed', 'no_show'].every((s) => isTerminal(s as never)),
    ).toBe(true);
    expect(isTerminal('held')).toBe(false);
    expect(sourcesOf('cancelled').sort()).toEqual(['confirmed', 'held']);
    expect(sourcesOf('confirmed')).toEqual(['held']);
    expect(sourcesOf('held')).toEqual([]);
  });

  it('active statuses are exactly the non-terminal ones (matches the EXCLUDE WHERE clause)', () => {
    const nonTerminal = Object.keys(TRANSITIONS).filter((s) => !isTerminal(s as never));
    expect([...ACTIVE_STATUSES].sort()).toEqual(nonTerminal.sort());
  });
});

describe('toE164', () => {
  it('collapses every common spelling of a Nigerian number to one key', () => {
    for (const s of [
      '08031234567',
      '0803 123 4567',
      '+234 803 123 4567',
      '2348031234567',
      '8031234567',
      '002348031234567',
    ]) {
      expect(toE164(s)).toBe('+2348031234567');
    }
  });

  it('keeps foreign numbers given with a country code', () => {
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects things that are not phone numbers', () => {
    for (const s of ['', 'call me', '0803', '+234803123456789', '+0123456789'])
      expect(toE164(s)).toBeNull();
  });
});

describe('pg error recognition', () => {
  const exclusion = { code: '23P01', constraint: 'bookings_no_overlap' };
  const unique = { code: '23505', constraint: 'bookings_idem' };

  it('sees through Drizzle wrapping (error.cause)', () => {
    expect(isExclusionViolation({ message: 'wrapped', cause: exclusion })).toBe(true);
    expect(isUniqueViolation(new Error('x', { cause: unique }), 'bookings_idem')).toBe(true);
  });

  it('matches the constraint name when given', () => {
    expect(isExclusionViolation(exclusion, 'bookings_no_overlap')).toBe(true);
    expect(isExclusionViolation(exclusion, 'other')).toBe(false);
    expect(isUniqueViolation(unique, 'payments_idem')).toBe(false);
  });

  it('ignores unrelated values', () => {
    expect(isExclusionViolation(unique)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
    expect(isUniqueViolation({ message: 'no code' })).toBe(false);
  });
});

describe('booking window rules', () => {
  const lagos = { timezone: 'Africa/Lagos', advanceDays: 14, allowSameDay: true };
  // 2026-11-20 10:00 in Lagos.
  const now = new Date('2026-11-20T09:00:00.000Z');
  const d = (s: string) => s as LocalDate;

  it('allows today, the last day in the window, and the past (past just has no slots)', () => {
    expect(checkBookingDate(lagos, d('2026-11-20'), now)).toBeNull();
    expect(checkBookingDate(lagos, d('2026-12-04'), now)).toBeNull();
    expect(checkBookingDate(lagos, d('2026-11-01'), now)).toBeNull();
  });

  it('refuses beyond advance_days and same-day when the business forbids it', () => {
    expect(checkBookingDate(lagos, d('2026-12-05'), now)).toEqual({
      code: 'TOO_FAR_AHEAD',
      advanceDays: 14,
    });
    expect(checkBookingDate({ ...lagos, allowSameDay: false }, d('2026-11-20'), now)).toEqual({
      code: 'SAME_DAY_NOT_ALLOWED',
    });
  });

  it('computes the earliest start from the lead time', () => {
    expect(earliestStart(now, 30).toISOString()).toBe('2026-11-20T09:30:00.000Z');
  });
});

describe('Result helpers', () => {
  it('builds tagged results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err({ code: 'SLOT_TAKEN' })).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
  });
});

describe('retryOnConflict (deadlocks between concurrent EXCLUDE checks)', () => {
  const deadlock = Object.assign(new Error('deadlock detected'), { cause: { code: '40P01' } });

  it('recognises deadlocks and serialization failures only', () => {
    expect(isRetryableConflict(deadlock)).toBe(true);
    expect(isRetryableConflict({ code: '40001' })).toBe(true);
    expect(isRetryableConflict({ code: '23P01' })).toBe(false);
  });

  it('runs again after a deadlock and returns the eventual result', async () => {
    const fn = vi.fn().mockRejectedValueOnce(deadlock).mockResolvedValueOnce('won');
    await expect(retryOnConflict(fn)).resolves.toBe('won');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the attempt budget, rethrowing the last error', async () => {
    const fn = vi.fn().mockRejectedValue(deadlock);
    await expect(retryOnConflict(fn, 3)).rejects.toBe(deadlock);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('never retries other errors', async () => {
    const boom = new Error('boom');
    const fn = vi.fn().mockRejectedValue(boom);
    await expect(retryOnConflict(fn)).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
