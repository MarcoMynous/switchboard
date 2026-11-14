import { afterAll, describe, expect, it } from 'vitest';
import { upsertCustomer } from './customers.ts';
import { findSlots } from './find-slots.ts';
import { holdSlot } from './hold.ts';
import {
  connect,
  type Fixture,
  makeFixture,
  makeHoldOverdue,
  TZ,
} from './test-support/fixtures.ts';
import { addDaysToLocalDate, localToUtc } from './time.ts';

const { pool, db } = connect();
afterAll(() => pool.end());

const starts = (r: Awaited<ReturnType<typeof findSlots>>) =>
  r.ok ? r.value.map((s) => s.startsAt.toISOString()) : [`error:${r.error.code}`];

async function hold(f: Fixture, hhmm: string, serviceId = f.depositServiceId) {
  const r = await holdSlot(db, {
    businessId: f.businessId,
    serviceId,
    staffId: f.staffIds[0],
    customerId: f.customerId,
    startsAt: f.at(hhmm),
    idempotencyKey: crypto.randomUUID(),
    source: 'booking_page',
  });
  if (!r.ok) throw new Error(r.error.code);
  return r.value.booking;
}

describe('findSlots', () => {
  it('offers the working day in 15-minute steps, for the service’s full length', async () => {
    const f = await makeFixture(db);
    const r = await findSlots(db, {
      businessId: f.businessId,
      serviceId: f.depositServiceId,
      date: f.day,
      limit: 100,
    });
    const all = starts(r);
    expect(all[0]).toBe(f.at('09:00').toISOString());
    expect(all.at(-1)).toBe(f.at('19:30').toISOString()); // 19:30 + 30 min = closing
    expect(all).toHaveLength(43);
  });

  it('skips time taken by confirmed bookings, live holds and time off, but not by expired holds', async () => {
    const f = await makeFixture(db);
    await hold(f, '10:00', f.freeServiceId); // confirmed
    await hold(f, '11:00'); // held
    const stale = await hold(f, '12:00');
    await makeHoldOverdue(pool, stale.id);
    await pool.query(
      `INSERT INTO time_off (id, staff_id, starts_at, ends_at) VALUES (gen_random_uuid(), $1, $2, $3)`,
      [f.staffIds[0], f.at('14:00'), f.at('15:00')],
    );

    const all = starts(
      await findSlots(db, {
        businessId: f.businessId,
        serviceId: f.depositServiceId,
        date: f.day,
        limit: 100,
      }),
    );
    for (const blocked of [
      '09:45',
      '10:00',
      '10:15',
      '10:45',
      '11:00',
      '11:15',
      '14:00',
      '14:30',
    ]) {
      expect(all).not.toContain(f.at(blocked).toISOString());
    }
    for (const free of ['09:30', '10:30', '11:30', '12:00', '13:30', '15:00']) {
      expect(all).toContain(f.at(free).toISOString());
    }
  });

  it('lists every free staff member per slot, and narrows to one staff member on request', async () => {
    const f = await makeFixture(db, { staffCount: 2 });
    const both = await findSlots(db, {
      businessId: f.businessId,
      serviceId: f.depositServiceId,
      date: f.day,
      limit: 1,
    });
    expect(both.ok && both.value[0]?.staffIds.length).toBe(2);
    const one = await findSlots(db, {
      businessId: f.businessId,
      serviceId: f.depositServiceId,
      date: f.day,
      staffId: f.staffIds[1],
      limit: 1,
    });
    expect(one.ok && one.value[0]?.staffIds).toEqual([f.staffIds[1]]);
  });

  it('spreads a limited result across the day', async () => {
    const f = await makeFixture(db);
    const r = starts(
      await findSlots(db, {
        businessId: f.businessId,
        serviceId: f.depositServiceId,
        date: f.day,
        limit: 3,
      }),
    );
    expect(r).toEqual([f.at('09:00'), f.at('14:15'), f.at('19:30')].map((d) => d.toISOString()));
  });

  it('honours the lead time on today: at 10:00 the first slot is 10:30', async () => {
    const f = await makeFixture(db);
    const today = addDaysToLocalDate(f.day, -1);
    const tenAm = localToUtc(today, '10:00', TZ);
    const r = await findSlots(
      db,
      { businessId: f.businessId, serviceId: f.depositServiceId, date: today, limit: 100 },
      { clock: () => tenAm },
    );
    expect(starts(r)[0]).toBe(localToUtc(today, '10:30', TZ).toISOString());
  });

  it('defaults to 12 suggestions when no limit is given', async () => {
    const f = await makeFixture(db);
    const r = await findSlots(db, {
      businessId: f.businessId,
      serviceId: f.depositServiceId,
      date: f.day,
    });
    expect(r.ok && r.value).toHaveLength(12);
  });

  it('offers nothing when nobody can do the service, or nobody works that day', async () => {
    const f = await makeFixture(db);
    // A service no staff member is linked to.
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO services (id, business_id, name, duration_min, price_kobo, deposit_type)
       VALUES (gen_random_uuid(), $1, 'Unstaffed', 30, 100000, 'none') RETURNING id`,
      [f.businessId],
    );
    const unstaffed = await findSlots(db, {
      businessId: f.businessId,
      serviceId: rows[0]?.id ?? '',
      date: f.day,
    });
    expect(unstaffed).toEqual({ ok: true, value: [] });

    await pool.query(`DELETE FROM working_hours WHERE staff_id = $1`, [f.staffIds[0]]);
    const dayOff = await findSlots(db, {
      businessId: f.businessId,
      serviceId: f.depositServiceId,
      date: f.day,
    });
    expect(dayOff).toEqual({ ok: true, value: [] });
  });

  it('ignores working-hours rows that end before they start (overnight shifts are unsupported)', async () => {
    const f = await makeFixture(db);
    await pool.query(
      `UPDATE working_hours SET start_local = '22:00', end_local = '02:00' WHERE staff_id = $1`,
      [f.staffIds[0]],
    );
    expect(
      await findSlots(db, { businessId: f.businessId, serviceId: f.depositServiceId, date: f.day }),
    ).toEqual({
      ok: true,
      value: [],
    });
  });

  it('reports bad input and unknown entities', async () => {
    const f = await makeFixture(db);
    const other = await makeFixture(db);
    const base = { businessId: f.businessId, serviceId: f.depositServiceId, date: f.day };
    expect(await findSlots(db, { ...base, date: '2026-02-30' })).toEqual({
      ok: false,
      error: { code: 'INVALID_DATE' },
    });
    expect(await findSlots(db, { ...base, businessId: crypto.randomUUID() })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'business' },
    });
    expect(await findSlots(db, { ...base, serviceId: other.depositServiceId })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', entity: 'service' },
    });
    expect(await findSlots(db, { ...base, staffId: other.staffIds[0] })).toEqual({
      ok: false,
      error: { code: 'STAFF_CANNOT_DO_SERVICE' },
    });
    expect(await findSlots(db, { ...base, date: '2099-01-01' })).toEqual({
      ok: false,
      error: { code: 'TOO_FAR_AHEAD', advanceDays: 14 },
    });
  });
});

describe('upsertCustomer', () => {
  it('collapses spellings of one phone number into one customer, concurrently', async () => {
    const f = await makeFixture(db);
    const results = await Promise.all(
      ['0803 555 0101', '+2348035550101', '2348035550101', '08035550101'].map((phone, i) =>
        upsertCustomer(db, { businessId: f.businessId, phone, name: i === 0 ? '' : `Name ${i}` }),
      ),
    );
    const ids = new Set(results.map((r) => (r.ok ? r.value.id : 'error')));
    expect(ids.size).toBe(1);
    expect(results[0]).toMatchObject({ ok: true, value: { phoneE164: '+2348035550101' } });
  });

  it('keeps an existing name and fills a blank one', async () => {
    const f = await makeFixture(db);
    await upsertCustomer(db, { businessId: f.businessId, phone: '08035550202' });
    const named = await upsertCustomer(db, {
      businessId: f.businessId,
      phone: '08035550202',
      name: 'Chidi',
    });
    const renamed = await upsertCustomer(db, {
      businessId: f.businessId,
      phone: '08035550202',
      name: 'Someone else',
    });
    expect(named).toMatchObject({ ok: true, value: { name: 'Chidi' } });
    expect(renamed).toMatchObject({ ok: true, value: { name: 'Chidi' } });
  });

  it('rejects numbers that are not phone numbers', async () => {
    const f = await makeFixture(db);
    expect(await upsertCustomer(db, { businessId: f.businessId, phone: 'not a phone' })).toEqual({
      ok: false,
      error: { code: 'INVALID_PHONE' },
    });
  });
});
