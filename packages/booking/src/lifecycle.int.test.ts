import { bookings, outbox } from '@switchboard/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { holdSlot } from './hold.ts';
import {
  cancelBooking,
  confirmBooking,
  expireHold,
  rescheduleBooking,
  sweepExpiredHolds,
  transitionBooking,
} from './lifecycle.ts';
import { connect, type Fixture, makeFixture, makeHoldOverdue } from './test-support/fixtures.ts';

const { pool, db } = connect();
afterAll(() => pool.end());

async function hold(f: Fixture, hhmm = '10:00', serviceId = f.depositServiceId) {
  const r = await holdSlot(db, {
    businessId: f.businessId,
    serviceId,
    staffId: f.staffIds[0],
    customerId: f.customerId,
    startsAt: f.at(hhmm),
    idempotencyKey: crypto.randomUUID(),
    source: 'booking_page',
  });
  if (!r.ok) throw new Error(`fixture hold failed: ${r.error.code}`);
  return r.value.booking;
}

const topicsFor = async (bookingId: string) =>
  (await db.select().from(outbox).where(sql`${outbox.payload}->>'bookingId' = ${bookingId}`)).map(
    (e) => e.topic,
  );

describe('confirmBooking (held → confirmed; P2 calls it only after Kora re-verification)', () => {
  it('confirms a held booking, clears its deadline, bumps the version and writes booking.confirmed', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    const r = await confirmBooking(db, f.businessId, b.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      status: 'confirmed',
      holdExpiresAt: null,
      version: b.version + 1,
    });
    expect(await topicsFor(b.id)).toEqual(['booking.held', 'booking.confirmed']);
  });

  it('refuses to confirm twice, an expired hold, or another business’s booking', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    await confirmBooking(db, f.businessId, b.id);
    expect(await confirmBooking(db, f.businessId, b.id)).toEqual({
      ok: false,
      error: { code: 'INVALID_TRANSITION', from: 'confirmed', to: 'confirmed' },
    });

    const late = await hold(f, '11:00');
    await makeHoldOverdue(pool, late.id);
    await expireHold(db, late.id);
    expect(await confirmBooking(db, f.businessId, late.id)).toMatchObject({
      error: { code: 'INVALID_TRANSITION', from: 'expired' },
    });

    const other = await makeFixture(db);
    expect(await confirmBooking(db, other.businessId, b.id)).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'booking' },
    });
  });

  it('composes into a caller’s transaction (P2 confirms inside its payment tx)', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    await db
      .transaction(async (tx) => {
        const r = await confirmBooking(tx, f.businessId, b.id);
        expect(r.ok).toBe(true);
        throw new Error('rollback');
      })
      .catch(() => undefined);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after?.status).toBe('held');
  });
});

describe('expiry (holds always end, guarantee 3)', () => {
  it('expireHold does nothing before the deadline, expires after it, and is idempotent', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    expect(await expireHold(db, b.id)).toBe(false);
    await makeHoldOverdue(pool, b.id);
    expect(await expireHold(db, b.id)).toBe(true);
    expect(await expireHold(db, b.id)).toBe(false);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after?.status).toBe('expired');
    expect(after?.holdExpiresAt).not.toBeNull(); // kept as history
    expect(await topicsFor(b.id)).toEqual(['booking.held', 'booking.expired']);
  });

  it('expireHold leaves a hold that was confirmed in the meantime alone', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    await confirmBooking(db, f.businessId, b.id);
    expect(await expireHold(db, b.id)).toBe(false);
  });

  it('the sweeper expires every overdue hold and nothing else', async () => {
    const f = await makeFixture(db);
    const overdue1 = await hold(f, '10:00');
    const overdue2 = await hold(f, '11:00');
    const fresh = await hold(f, '12:00');
    const confirmed = await hold(f, '13:00', f.freeServiceId);
    await makeHoldOverdue(pool, overdue1.id);
    await makeHoldOverdue(pool, overdue2.id);

    const swept = await sweepExpiredHolds(db);
    expect(swept).toEqual(expect.arrayContaining([overdue1.id, overdue2.id]));
    const rows = await db.select().from(bookings).where(eq(bookings.businessId, f.businessId));
    const status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(status).toEqual({
      [overdue1.id]: 'expired',
      [overdue2.id]: 'expired',
      [fresh.id]: 'held',
      [confirmed.id]: 'confirmed',
    });
  });
});

describe('cancel, complete, no-show', () => {
  it('cancels held or confirmed bookings with a reason, which frees the slot', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    const r = await cancelBooking(db, f.businessId, b.id, 'customer asked');
    expect(r).toMatchObject({
      ok: true,
      value: { status: 'cancelled', cancelReason: 'customer asked' },
    });
    expect((await hold(f)).status).toBe('held');
  });

  it('runs confirmed bookings to completed or no_show, and refuses moves out of terminal states', async () => {
    const f = await makeFixture(db);
    const done = await hold(f, '10:00', f.freeServiceId);
    const gone = await hold(f, '11:00', f.freeServiceId);
    expect(
      await transitionBooking(db, {
        businessId: f.businessId,
        bookingId: done.id,
        to: 'completed',
      }),
    ).toMatchObject({
      ok: true,
    });
    expect(
      await transitionBooking(db, { businessId: f.businessId, bookingId: gone.id, to: 'no_show' }),
    ).toMatchObject({
      ok: true,
    });
    expect(await cancelBooking(db, f.businessId, done.id, 'too late')).toEqual({
      ok: false,
      error: { code: 'INVALID_TRANSITION', from: 'completed', to: 'cancelled' },
    });
  });

  it('a held booking cannot be completed (it was never confirmed)', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    expect(
      await transitionBooking(db, { businessId: f.businessId, bookingId: b.id, to: 'completed' }),
    ).toEqual({
      ok: false,
      error: { code: 'INVALID_TRANSITION', from: 'held', to: 'completed' },
    });
  });
});

describe('rescheduleBooking', () => {
  it('moves the booking, bumps the version and writes booking.rescheduled', async () => {
    const f = await makeFixture(db);
    const b = await hold(f, '10:00', f.freeServiceId);
    const r = await rescheduleBooking(db, {
      businessId: f.businessId,
      bookingId: b.id,
      startsAt: f.at('15:00'),
      expectedVersion: b.version,
    });
    expect(r).toMatchObject({
      ok: true,
      value: { startsAt: f.at('15:00'), version: b.version + 1 },
    });
    expect(await topicsFor(b.id)).toContain('booking.rescheduled');
  });

  it('can shift a booking by less than its own length (its old range does not block it)', async () => {
    const f = await makeFixture(db);
    const b = await hold(f, '10:00');
    const r = await rescheduleBooking(db, {
      businessId: f.businessId,
      bookingId: b.id,
      startsAt: f.at('10:15'),
      expectedVersion: b.version,
    });
    expect(r.ok).toBe(true);
  });

  it('refuses a taken slot via the constraint, and a stale version via optimistic locking', async () => {
    const f = await makeFixture(db);
    const b = await hold(f, '10:00');
    await hold(f, '15:00');
    const base = { businessId: f.businessId, bookingId: b.id };
    expect(
      await rescheduleBooking(db, { ...base, startsAt: f.at('15:00'), expectedVersion: b.version }),
    ).toEqual({
      ok: false,
      error: { code: 'SLOT_TAKEN' },
    });
    expect(
      await rescheduleBooking(db, {
        ...base,
        startsAt: f.at('16:00'),
        expectedVersion: b.version + 5,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'STALE_VERSION', currentVersion: b.version },
    });
  });

  it('moves to another eligible staff member when asked', async () => {
    const f = await makeFixture(db, { staffCount: 2 });
    const b = await hold(f);
    const r = await rescheduleBooking(db, {
      businessId: f.businessId,
      bookingId: b.id,
      startsAt: f.at('10:00'),
      staffId: f.staffIds[1],
      expectedVersion: b.version,
    });
    expect(r).toMatchObject({ ok: true, value: { staffId: f.staffIds[1] } });
  });

  it('applies the same validation as holdSlot, and refuses terminal or missing bookings', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    const base = { businessId: f.businessId, bookingId: b.id, expectedVersion: b.version };
    expect(await rescheduleBooking(db, { ...base, startsAt: f.at('07:00') })).toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
    expect(
      await rescheduleBooking(db, { ...base, startsAt: new Date(Date.now() + 5 * 60_000) }),
    ).toMatchObject({
      error: { code: expect.stringMatching(/TOO_SOON|OUTSIDE_WORKING_HOURS/) },
    });
    expect(
      await rescheduleBooking(db, {
        ...base,
        startsAt: new Date(f.at('10:00').getTime() + 40 * 86_400_000),
      }),
    ).toMatchObject({ error: { code: 'TOO_FAR_AHEAD' } });
    expect(
      await rescheduleBooking(db, {
        ...base,
        bookingId: crypto.randomUUID(),
        startsAt: f.at('11:00'),
      }),
    ).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'booking' },
    });

    await cancelBooking(db, f.businessId, b.id, 'changed mind');
    expect(
      await rescheduleBooking(db, {
        ...base,
        expectedVersion: b.version + 1,
        startsAt: f.at('11:00'),
      }),
    ).toMatchObject({
      error: { code: 'INVALID_TRANSITION', from: 'cancelled' },
    });
  });

  it('loses cleanly to a concurrent edit that lands between its read and its update', async () => {
    const f = await makeFixture(db);
    const b = await hold(f);
    const base = { businessId: f.businessId, bookingId: b.id, expectedVersion: b.version };
    const [x, y] = await Promise.all([
      rescheduleBooking(db, { ...base, startsAt: f.at('14:00') }),
      rescheduleBooking(db, { ...base, startsAt: f.at('16:00') }),
    ]);
    const outcomes = [x, y].map((r) => (r.ok ? 'ok' : r.error.code)).sort();
    expect(outcomes).toEqual(['STALE_VERSION', 'ok']);
    const [after] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, b.id), eq(bookings.version, b.version + 1)));
    expect(after).toBeDefined();
  });
});
