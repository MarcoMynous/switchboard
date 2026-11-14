import { DEFAULT_CONFIG } from '@switchboard/booking';
import { connect, type Fixture, makeFixture } from '@switchboard/booking/testing';
import { outbox } from '@switchboard/db/schema';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createLogger } from './logger.ts';
import { relayOutbox } from './outbox.ts';

interface CatalogBody {
  business: { id: string; slug: string; timezone: string };
  services: { slug: string }[];
  staff: { serviceIds: string[] }[];
}
interface SlotJson {
  startsAt: string;
  endsAt: string;
  staffIds: string[];
}
interface SlotsBody {
  date: string | null;
  timezone: string;
  slots: SlotJson[];
}
interface HoldBody {
  replayed: boolean;
  booking: { id: string; status: string; startsAt: string; holdExpiresAt: string | null };
}
interface ErrorBody {
  error: { code: string };
  alternatives?: SlotJson[];
}
const json = async <T>(res: Response): Promise<T> => (await res.json()) as T;

const { pool, db } = connect(10);
afterAll(() => pool.end());
const app = createApp({
  pool,
  db,
  bookingConfig: DEFAULT_CONFIG,
  logger: createLogger({ level: 'silent' }),
});

const hold = (f: Fixture, over: Record<string, unknown> = {}) =>
  app.request(`/api/public/${f.slug}/holds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      serviceId: f.depositServiceId,
      staffId: f.staffIds[0],
      startsAt: f.at('10:00').toISOString(),
      customer: { name: 'Bisi', phone: '0803 555 0199' },
      idempotencyKey: crypto.randomUUID(),
      ...over,
    }),
  });

describe('GET /public/:slug', () => {
  it('returns the public catalog: business, services with slugs, staff with what they do', async () => {
    const f = await makeFixture(db);
    const res = await app.request(`/public/${f.slug}`);
    expect(res.status).toBe(200);
    const body = await json<CatalogBody>(res);
    expect(body.business).toMatchObject({
      id: f.businessId,
      slug: f.slug,
      timezone: 'Africa/Lagos',
    });
    expect(body.services.map((s) => s.slug).sort()).toEqual(['beard-sculpt', 'braids', 'low-cut']);
    expect(body.staff[0]?.serviceIds).toHaveLength(3);
    expect(JSON.stringify(body)).not.toMatch(/kora|owner/i);
  });

  it('404s for an unknown business', async () => {
    expect((await app.request('/public/no-such-salon')).status).toBe(404);
  });
});

describe('GET /public/:slug/slots', () => {
  it('lists slots for a day, by service slug or id, on both mount points', async () => {
    const f = await makeFixture(db);
    const bySlug = await app.request(
      `/public/${f.slug}/slots?service=low-cut&date=${f.day}&limit=3`,
    );
    const byId = await app.request(
      `/api/public/${f.slug}/slots?service=${f.depositServiceId}&date=${f.day}&limit=3`,
    );
    expect(bySlug.status).toBe(200);
    const a = await json<SlotsBody>(bySlug);
    expect(a).toMatchObject({ date: f.day, timezone: 'Africa/Lagos' });
    expect(a.slots[0]).toEqual({
      startsAt: f.at('09:00').toISOString(),
      endsAt: f.at('09:30').toISOString(),
      staffIds: [f.staffIds[0]],
    });
    expect(await json<SlotsBody>(byId)).toEqual(a);
  });

  it('without a date, answers with the next day that has anything free', async () => {
    const f = await makeFixture(db);
    const res = await app.request(`/public/${f.slug}/slots?service=low-cut&limit=10`);
    const body = await json<SlotsBody>(res);
    expect(res.status).toBe(200);
    expect(body.date).not.toBeNull();
    expect(body.slots).toHaveLength(10);
  });

  it('rejects bad queries and unknown services; maps domain refusals to 422', async () => {
    const f = await makeFixture(db);
    expect((await app.request(`/public/${f.slug}/slots`)).status).toBe(400);
    expect(
      (await app.request(`/public/${f.slug}/slots?service=low-cut&date=20-11-2026`)).status,
    ).toBe(400);
    expect((await app.request(`/public/${f.slug}/slots?service=perm`)).status).toBe(404);
    expect((await app.request(`/public/nope/slots?service=low-cut`)).status).toBe(404);
    const far = await app.request(`/public/${f.slug}/slots?service=low-cut&date=2099-01-01`);
    expect(far.status).toBe(422);
    expect(await json<ErrorBody>(far)).toEqual({
      error: { code: 'TOO_FAR_AHEAD', advanceDays: 14 },
    });
  });
});

describe('POST /public/:slug/holds', () => {
  it('holds a deposit service (201) and replays the same key (200, same booking)', async () => {
    const f = await makeFixture(db);
    const key = crypto.randomUUID();
    const first = await hold(f, { idempotencyKey: key });
    expect(first.status).toBe(201);
    const a = await json<HoldBody>(first);
    expect(a).toMatchObject({
      replayed: false,
      booking: { status: 'held', startsAt: f.at('10:00').toISOString() },
    });
    expect(a.booking.holdExpiresAt).not.toBeNull();

    const again = await hold(f, { idempotencyKey: key });
    expect(again.status).toBe(200);
    expect(await json<HoldBody>(again)).toEqual({ ...a, replayed: true });
  });

  it('confirms a no-deposit service immediately (the P1 exit flow)', async () => {
    const f = await makeFixture(db);
    const res = await hold(f, { serviceId: f.freeServiceId });
    expect(res.status).toBe(201);
    expect(await json<HoldBody>(res)).toMatchObject({
      booking: { status: 'confirmed', holdExpiresAt: null },
    });
  });

  it('on SLOT_TAKEN (409) offers the next three free times, so the customer never hits a dead end', async () => {
    const f = await makeFixture(db);
    await hold(f);
    const res = await hold(f);
    expect(res.status).toBe(409);
    const body = await json<ErrorBody>(res);
    expect(body.error).toEqual({ code: 'SLOT_TAKEN' });
    expect(body.alternatives?.map((s) => s.startsAt)).toEqual(
      ['10:30', '10:45', '11:00'].map((t) => f.at(t).toISOString()),
    );
  });

  it('validates the body, the phone number and idempotency-key reuse', async () => {
    const f = await makeFixture(db);
    expect((await hold(f, { startsAt: '2026-11-20 10:00' })).status).toBe(400); // no offset
    expect((await hold(f, { serviceId: 'not-a-uuid' })).status).toBe(400);
    const badPhone = await hold(f, { customer: { name: 'X', phone: 'call me pls' } });
    expect(badPhone.status).toBe(400);
    expect(await json<ErrorBody>(badPhone)).toEqual({ error: { code: 'INVALID_PHONE' } });
    const notJson = await app.request(`/public/${f.slug}/holds`, { method: 'POST', body: 'nope' });
    expect(notJson.status).toBe(400);

    await hold(f, { idempotencyKey: 'reused-key-123' });
    const reused = await hold(f, {
      idempotencyKey: 'reused-key-123',
      startsAt: f.at('15:00').toISOString(),
    });
    expect(reused.status).toBe(409);
    expect((await json<ErrorBody>(reused)).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses times outside working hours (422) and unknown businesses (404)', async () => {
    const f = await makeFixture(db);
    const early = await hold(f, { startsAt: f.at('06:00').toISOString() });
    expect(early.status).toBe(422);
    expect(await json<ErrorBody>(early)).toEqual({ error: { code: 'OUTSIDE_WORKING_HOURS' } });
    expect((await hold({ ...f, slug: 'no-such-salon' })).status).toBe(404);
  });
});

describe('relayOutbox (transactional outbox → Inngest)', () => {
  it('sends each undispatched row once, with its id for dedupe, then marks it dispatched', async () => {
    const f = await makeFixture(db);
    const res = await hold(f);
    const { booking } = await json<HoldBody>(res);
    const sent: { id: string; name: string; data: Record<string, unknown> }[] = [];

    let n = 0;
    do n = await relayOutbox(db, async (events) => void sent.push(...events), 500);
    while (n > 0);

    const mine = sent.filter((e) => e.data.bookingId === booking.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: 'booking.held', data: { bookingId: booking.id } });
    const rows = await db
      .select()
      .from(outbox)
      .where(
        inArray(
          outbox.id,
          mine.map((e) => e.id),
        ),
      );
    expect(rows[0]?.dispatchedAt).not.toBeNull();
    expect(await relayOutbox(db, async () => undefined)).toBe(0);
  });

  it('a failed send leaves rows undispatched for the next run and counts the attempt', async () => {
    const f = await makeFixture(db);
    const { booking } = await json<HoldBody>(await hold(f));
    await expect(
      relayOutbox(
        db,
        async () => {
          throw new Error('inngest down');
        },
        500,
      ),
    ).rejects.toThrow('inngest down');
    const [row] = await db
      .select()
      .from(outbox)
      .where(sql`${outbox.payload}->>'bookingId' = ${booking.id}`);
    expect(row).toMatchObject({ dispatchedAt: null, attempts: 1 });
  });
});
