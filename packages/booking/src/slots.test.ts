import { describe, expect, it } from 'vitest';
import { candidatesFor, ceilToStep, computeSlots, spread, subtractIntervals } from './slots.ts';

// Lagos is UTC+1. 09:00 Lagos on 2026-11-20 = 08:00Z.
const at = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00.000Z`);
const iv = (a: string, b: string) => ({ start: at(a), end: at(b) });
const iso = (d: Date) => d.toISOString().slice(11, 16);

describe('subtractIntervals', () => {
  it('returns the window untouched when nothing overlaps', () => {
    expect(subtractIntervals([iv('08:00', '12:00')], [iv('13:00', '14:00')])).toEqual([
      iv('08:00', '12:00'),
    ]);
  });

  it('cuts holes, trims edges and drops fully covered windows', () => {
    const out = subtractIntervals(
      [iv('08:00', '12:00'), iv('13:00', '14:00')],
      [iv('09:00', '09:30'), iv('11:30', '12:30'), iv('07:00', '08:15'), iv('13:00', '14:00')],
    );
    expect(out).toEqual([iv('08:15', '09:00'), iv('09:30', '11:30')]);
  });

  it('treats ranges as half-open: back-to-back busy time leaves no gap and no overlap', () => {
    expect(
      subtractIntervals([iv('08:00', '10:00')], [iv('08:00', '09:00'), iv('09:00', '10:00')]),
    ).toEqual([]);
  });

  it('handles unsorted, overlapping cuts', () => {
    expect(
      subtractIntervals([iv('08:00', '12:00')], [iv('10:00', '11:00'), iv('09:00', '10:30')]),
    ).toEqual([iv('08:00', '09:00'), iv('11:00', '12:00')]);
  });
});

describe('ceilToStep', () => {
  it('leaves grid points alone and rounds everything else up', () => {
    expect(iso(ceilToStep(at('08:15'), 15))).toBe('08:15');
    expect(iso(ceilToStep(new Date('2026-11-20T08:15:01.000Z'), 15))).toBe('08:30');
    expect(iso(ceilToStep(at('08:46'), 15))).toBe('09:00');
  });
});

describe('candidatesFor', () => {
  const staff = { staffId: 's1', windows: [iv('08:00', '10:00')], busy: [iv('08:30', '09:00')] };

  it('only offers starts where the whole service fits in a free window', () => {
    const c = candidatesFor(staff, 30, 15, at('00:00'));
    expect(c.map((s) => iso(s.start))).toEqual(['08:00', '09:00', '09:15', '09:30']);
  });

  it('respects the earliest start (lead time)', () => {
    const c = candidatesFor(staff, 30, 15, new Date('2026-11-20T09:07:00.000Z'));
    expect(c.map((s) => iso(s.start))).toEqual(['09:15', '09:30']);
  });

  it('offers nothing when the service is longer than any gap', () => {
    expect(candidatesFor(staff, 120, 15, at('00:00'))).toEqual([]);
  });
});

describe('spread', () => {
  const ten = Array.from({ length: 10 }, (_, i) => i);
  it('returns everything when under the limit', () => expect(spread([1, 2], 5)).toEqual([1, 2]));
  it('keeps first and last and spaces the rest evenly', () =>
    expect(spread(ten, 4)).toEqual([0, 3, 6, 9]));
  it('handles a limit of one and of zero', () => {
    expect(spread(ten, 1)).toEqual([0]);
    expect(spread(ten, 0)).toEqual([]);
  });
});

describe('computeSlots', () => {
  it('merges staff by start time and lists who is free, in input order', () => {
    const slots = computeSlots({
      staff: [
        { staffId: 'a', windows: [iv('08:00', '09:00')], busy: [] },
        { staffId: 'b', windows: [iv('08:30', '09:30')], busy: [] },
      ],
      durationMin: 30,
      stepMin: 30,
      earliestStart: at('00:00'),
      limit: 10,
    });
    expect(slots.map((s) => [iso(s.startsAt), iso(s.endsAt), s.staffIds])).toEqual([
      ['08:00', '08:30', ['a']],
      ['08:30', '09:00', ['a', 'b']],
      ['09:00', '09:30', ['b']],
    ]);
  });

  it('spreads results across the day instead of bunching at opening time', () => {
    const slots = computeSlots({
      staff: [{ staffId: 'a', windows: [iv('08:00', '19:00')], busy: [] }],
      durationMin: 30,
      stepMin: 15,
      earliestStart: at('00:00'),
      limit: 3,
    });
    expect(slots.map((s) => iso(s.startsAt))).toEqual(['08:00', '13:15', '18:30']);
  });
});
