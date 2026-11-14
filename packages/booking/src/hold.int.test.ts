import { bookings, outbox } from '@switchboard/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { type HoldSlotInput, holdSlot } from './hold.ts';
import { connect, type Fixture, makeFixture } from './test-support/fixtures.ts';

const { pool, db } = connect();
afterAll(() => pool.end());

const input = (f: Fixture, over: Partial<HoldSlotInput> = {}): HoldSlotInput => ({
  businessId: f.businessId,
  serviceId: f.depositServiceId,
  staffId: f.staffIds[0],
  customerId: f.customerId,
  startsAt: f.at('10:00'),
  idempotencyKey: crypto.randomUUID(),
  source: 'booking_page',
  ...over,
});

const activeCount = async (f: Fixture) => {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM bookings WHERE business_id = $1 AND status IN ('held','confirmed')`,
    [f.businessId],
  );
  return Number(rows[0]?.n);
};

describe('holdSlot: the EXCLUDE constraint is the referee (I1)', () => {
  it('100 parallel holds for one slot → exactly 1 ok, 99 SLOT_TAKEN', async () => {
    const f = await makeFixture(db);
    const results = await Promise.all(Array.from({ length: 100 }, () => holdSlot(db, input(f))));

    const won = results.filter((r) => r.ok);
    const taken = results.filter((r) => !r.ok && r.error.code === 'SLOT_TAKEN');
    // Printed for the build-in-public post (docs/phases/p1-booking-engine.md).
    console.log(`100 parallel holds → ${won.length} success, ${taken.length} SLOT_TAKEN`);
    expect(won).toHaveLength(1);
    expect(taken).toHaveLength(99);
    expect(await activeCount(f)).toBe(1);
  });

  it('allows back-to-back bookings (ranges are half-open)', async () => {
    const f = await makeFixture(db);
    const a = await holdSlot(db, input(f, { startsAt: f.at('10:00') }));
    const b = await holdSlot(db, input(f, { startsAt: f.at('10:30') }));
    const overlapping = await holdSlot(db, input(f, { startsAt: f.at('10:15') }));
    expect(a.ok && b.ok).toBe(true);
    expect(overlapping).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
  });

  it('a long service is refused when it would overlap a later booking', async () => {
    const f = await makeFixture(db);
    expect((await holdSlot(db, input(f, { startsAt: f.at('11:00') }))).ok).toBe(true);
    const long = await holdSlot(
      db,
      input(f, { serviceId: f.longServiceId, startsAt: f.at('10:30') }),
    );
    expect(long).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
  });
});

describe('holdSlot: contention never surfaces as a server error', () => {
  // Regression: without the per-staff row lock, concurrent EXCLUDE checks deadlocked (40P01) on
  // ~6% of contended holds, and each deadlock cost Postgres' 1s detection timeout.
  it('mixed staff, overlapping times and "any staff" under load: no throws, no overlaps', async () => {
    const thrown: unknown[] = [];
    for (let round = 0; round < 5; round++) {
      const f = await makeFixture(db, { staffCount: 2 });
      const times = ['10:00', '10:15', '10:30'];
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          holdSlot(
            db,
            input(f, {
              staffId: i % 3 === 0 ? undefined : f.staffIds[i % 2],
              startsAt: f.at(times[i % 3] ?? '10:00'),
            }),
          ).catch((e: unknown) => thrown.push(e)),
        ),
      );
      const { rows } = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
           ON a.staff_id = b.staff_id AND a.id < b.id
          AND a.status IN ('held','confirmed') AND b.status IN ('held','confirmed')
          AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
        WHERE a.business_id = $1`,
        [f.businessId],
      );
      expect(rows[0]?.n).toBe(0);
      // Two barbers × at most two non-overlapping 30-min holds in 10:00–11:00.
      expect(await activeCount(f)).toBeGreaterThanOrEqual(2);
      expect(await activeCount(f)).toBeLessThanOrEqual(4);
    }
    expect(thrown).toEqual([]);
  });
});

describe('holdSlot: idempotency (I4)', () => {
  it('same key 20× in parallel → one row, every caller gets the same booking', async () => {
    const f = await makeFixture(db);
    const key = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => holdSlot(db, input(f, { idempotencyKey: key }))),
    );
    const ids = new Set(results.map((r) => (r.ok ? r.value.booking.id : `error:${r.error.code}`)));
    expect(ids.size).toBe(1);
    expect([...ids][0]).not.toMatch(/^error:/);
    expect(results.filter((r) => r.ok && !r.value.replayed)).toHaveLength(1);
    const { rows } = await pool.query(
      `SELECT 1 FROM bookings WHERE business_id = $1 AND idempotency_key = $2`,
      [f.businessId, key],
    );
    expect(rows).toHaveLength(1);
  });

  it('a sequential retry returns the original booking, flagged as a replay', async () => {
    const f = await makeFixture(db);
    const first = await holdSlot(db, input(f, { idempotencyKey: 'k-1' }));
    const again = await holdSlot(db, input(f, { idempotencyKey: 'k-1' }));
    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.value).toEqual({ booking: first.value.booking, replayed: true });
  });

  it('refuses a key reused for a different time instead of returning the wrong booking', async () => {
    const f = await makeFixture(db);
    const first = await holdSlot(db, input(f, { idempotencyKey: 'k-2' }));
    const other = await holdSlot(db, input(f, { idempotencyKey: 'k-2', startsAt: f.at('15:00') }));
    expect(first.ok).toBe(true);
    expect(other).toEqual({
      ok: false,
      error: { code: 'IDEMPOTENCY_KEY_REUSED', bookingId: first.ok ? first.value.booking.id : '' },
    });
  });
});

describe('holdSlot: holds and deposits', () => {
  it('a deposit service is held for HOLD_MINUTES by Postgres’ clock and writes booking.held', async () => {
    const f = await makeFixture(db);
    const r = await holdSlot(db, input(f));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.value.booking;
    expect(b.status).toBe('held');
    const { rows } = await pool.query<{ mins: number }>(
      `SELECT extract(epoch FROM hold_expires_at - now()) / 60 AS mins FROM bookings WHERE id = $1`,
      [b.id],
    );
    expect(Number(rows[0]?.mins)).toBeGreaterThan(14.5);
    expect(Number(rows[0]?.mins)).toBeLessThanOrEqual(15);
    const [event] = await db
      .select()
      .from(outbox)
      .where(sql`${outbox.payload}->>'bookingId' = ${b.id}`);
    expect(event?.topic).toBe('booking.held');
  });

  it('a no-deposit service is confirmed directly, with no deadline', async () => {
    const f = await makeFixture(db);
    const r = await holdSlot(db, input(f, { serviceId: f.freeServiceId }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.booking.status).toBe('confirmed');
    expect(r.value.booking.holdExpiresAt).toBeNull();
    const [event] = await db
      .select()
      .from(outbox)
      .where(sql`${outbox.payload}->>'bookingId' = ${r.value.booking.id}`);
    expect(event?.topic).toBe('booking.confirmed');
  });

  it('with no staff named, falls through to the next free barber, then SLOT_TAKEN', async () => {
    const f = await makeFixture(db, { staffCount: 2 });
    const any = (key: string) => input(f, { staffId: undefined, idempotencyKey: key });
    const a = await holdSlot(db, any('a'));
    const b = await holdSlot(db, any('b'));
    const c = await holdSlot(db, any('c'));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(new Set([a.value.booking.staffId, b.value.booking.staffId])).toEqual(
      new Set(f.staffIds),
    );
    expect(c).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
  });
});

describe('holdSlot: stale holds never block (guarantee 3)', () => {
  it('an expired hold the job has not processed yet is reclaimed by the next hold', async () => {
    const f = await makeFixture(db);
    const stale = await holdSlot(db, input(f));
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    await pool.query(
      `UPDATE bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`,
      [stale.value.booking.id],
    );

    const fresh = await holdSlot(db, input(f));
    expect(fresh.ok).toBe(true);
    const [old] = await db.select().from(bookings).where(eq(bookings.id, stale.value.booking.id));
    expect(old?.status).toBe('expired');
    const [event] = await db
      .select()
      .from(outbox)
      .where(
        and(eq(outbox.topic, 'booking.expired'), sql`${outbox.payload}->>'bookingId' = ${old?.id}`),
      );
    expect(event?.payload).toMatchObject({ reason: 'reclaimed' });
  });

  it('an unexpired hold still blocks', async () => {
    const f = await makeFixture(db);
    expect((await holdSlot(db, input(f))).ok).toBe(true);
    expect(await holdSlot(db, input(f))).toEqual({ ok: false, error: { code: 'SLOT_TAKEN' } });
  });
});

describe('holdSlot: server-side validation (the client is never trusted with availability)', () => {
  it('refuses times outside working hours or overlapping time off', async () => {
    const f = await makeFixture(db);
    expect(await holdSlot(db, input(f, { startsAt: f.at('08:30') }))).toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
    // 19:45 + 30 min runs past closing at 20:00.
    expect(await holdSlot(db, input(f, { startsAt: f.at('19:45') }))).toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
    await pool.query(
      `INSERT INTO time_off (id, staff_id, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [f.staffIds[0], f.at('12:00'), f.at('13:00')],
    );
    expect(await holdSlot(db, input(f, { startsAt: f.at('12:15') }))).toMatchObject({
      error: { code: 'OUTSIDE_WORKING_HOURS' },
    });
  });

  it('refuses starts inside the lead time and beyond the booking window', async () => {
    const f = await makeFixture(db);
    const soon = await holdSlot(db, input(f, { startsAt: new Date(Date.now() + 10 * 60_000) }));
    expect(soon).toMatchObject({
      error: { code: expect.stringMatching(/TOO_SOON|OUTSIDE_WORKING_HOURS/) },
    });
    const late = await holdSlot(
      db,
      input(f, { startsAt: new Date(f.at('10:00').getTime() + 30 * 86_400_000) }),
    );
    expect(late).toEqual({ ok: false, error: { code: 'TOO_FAR_AHEAD', advanceDays: 14 } });
  });

  it('refuses unknown services, other businesses’ services, and staff who can’t do the service', async () => {
    const f = await makeFixture(db);
    const other = await makeFixture(db);
    expect(await holdSlot(db, input(f, { serviceId: other.depositServiceId }))).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'service' },
    });
    expect(await holdSlot(db, input(f, { staffId: other.staffIds[0] }))).toEqual({
      ok: false,
      error: { code: 'STAFF_CANNOT_DO_SERVICE' },
    });
    expect(await holdSlot(db, input(f, { businessId: crypto.randomUUID() }))).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'business' },
    });
  });
});
