import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { holdSlot } from './hold.ts';
import { cancelBooking, confirmBooking, expireHold, sweepExpiredHolds } from './lifecycle.ts';
import { connect, type Fixture, makeFixture, makeHoldOverdue } from './test-support/fixtures.ts';

// Model-based property test (docs/04-booking-engine.md → Tests that must exist): random sequences
// of hold / confirm / cancel / expire / sweep across 2 staff. After every step, Postgres must agree
// with a tiny in-memory model, and no staff member may ever have two overlapping active bookings.

const { pool, db } = connect();
afterAll(() => pool.end());

// 10:00, 10:15, … 11:45 Lagos; services are 30 or 60 min, so many choices overlap.
const STARTS = Array.from(
  { length: 8 },
  (_, i) => `${10 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`,
);

type Cmd =
  | { kind: 'hold'; staff: number; start: number; long: boolean; free: boolean; key: number }
  | { kind: 'confirm' | 'cancel' | 'expire'; pick: number }
  | { kind: 'sweep' };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('hold' as const),
      staff: fc.integer({ min: 0, max: 1 }),
      start: fc.integer({ min: 0, max: STARTS.length - 1 }),
      long: fc.boolean(),
      free: fc.boolean(),
      // A small key space so retries (same key) and key reuse (same key, other slot) both happen.
      key: fc.integer({ min: 0, max: 5 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constantFrom('confirm' as const, 'cancel' as const, 'expire' as const),
      pick: fc.nat(),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'sweep' as const }) },
);

interface ModelBooking {
  id: string;
  key: number;
  staff: number;
  startMs: number;
  endMs: number;
  serviceId: string;
  status: 'held' | 'confirmed' | 'expired' | 'cancelled';
}

const active = (b: ModelBooking) => b.status === 'held' || b.status === 'confirmed';
const clash = (a: ModelBooking, s: number, startMs: number, endMs: number) =>
  active(a) && a.staff === s && a.startMs < endMs && startMs < a.endMs;

async function overlapsInDb(businessId: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM bookings a JOIN bookings b
       ON a.staff_id = b.staff_id AND a.id < b.id
      AND a.status IN ('held','confirmed') AND b.status IN ('held','confirmed')
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
    WHERE a.business_id = $1`,
    [businessId],
  );
  return Number(rows[0]?.n);
}

async function step(f: Fixture, model: ModelBooking[], cmd: Cmd) {
  if (cmd.kind === 'hold') {
    const serviceId = cmd.free ? f.freeServiceId : cmd.long ? f.longServiceId : f.depositServiceId;
    const startsAt = f.at(STARTS[cmd.start] ?? '10:00');
    const startMs = startsAt.getTime();
    const endMs = startMs + (cmd.long && !cmd.free ? 60 : 30) * 60_000;
    const staffId = f.staffIds[cmd.staff] ?? '';

    const r = await holdSlot(db, {
      businessId: f.businessId,
      serviceId,
      staffId,
      customerId: f.customerId,
      startsAt,
      idempotencyKey: `key-${cmd.key}`,
      source: 'booking_page',
    });

    const prior = model.find((b) => b.key === cmd.key);
    if (prior) {
      const same =
        prior.serviceId === serviceId && prior.startMs === startMs && prior.staff === cmd.staff;
      if (same)
        expect(r).toMatchObject({ ok: true, value: { replayed: true, booking: { id: prior.id } } });
      else
        expect(r).toMatchObject({
          ok: false,
          error: { code: 'IDEMPOTENCY_KEY_REUSED', bookingId: prior.id },
        });
      return;
    }
    if (model.some((b) => clash(b, cmd.staff, startMs, endMs))) {
      expect(r).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
      return;
    }
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    model.push({
      id: r.value.booking.id,
      key: cmd.key,
      staff: cmd.staff,
      startMs,
      endMs,
      serviceId,
      status: cmd.free ? 'confirmed' : 'held',
    });
    return;
  }

  if (cmd.kind === 'sweep') {
    for (const b of model.filter((x) => x.status === 'held')) await makeHoldOverdue(pool, b.id);
    await sweepExpiredHolds(db);
    for (const b of model) if (b.status === 'held') b.status = 'expired';
    return;
  }

  if (model.length === 0) return;
  const b = model[cmd.pick % model.length];
  if (!b) return;
  if (cmd.kind === 'confirm') {
    const r = await confirmBooking(db, f.businessId, b.id);
    expect(r.ok).toBe(b.status === 'held');
    if (r.ok) b.status = 'confirmed';
  } else if (cmd.kind === 'cancel') {
    const r = await cancelBooking(db, f.businessId, b.id, 'property test');
    expect(r.ok).toBe(active(b));
    if (r.ok) b.status = 'cancelled';
  } else {
    if (b.status === 'held') await makeHoldOverdue(pool, b.id);
    const expired = await expireHold(db, b.id);
    expect(expired).toBe(b.status === 'held');
    if (expired) b.status = 'expired';
  }
}

describe('property: random operation sequences never double-book and every hold ends', () => {
  it('Postgres agrees with the model after every step', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(cmdArb, { minLength: 1, maxLength: 30 }), async (cmds) => {
        const f = await makeFixture(db, { staffCount: 2 });
        const model: ModelBooking[] = [];
        for (const cmd of cmds) {
          await step(f, model, cmd);
          expect(await overlapsInDb(f.businessId)).toBe(0);
        }
        // Guarantee 3: after the sweeper runs past every deadline, no hold is left un-ended.
        await step(f, model, { kind: 'sweep' });
        const { rows } = await pool.query(
          `SELECT 1 FROM bookings WHERE business_id = $1 AND status = 'held'`,
          [f.businessId],
        );
        expect(rows).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });
});
