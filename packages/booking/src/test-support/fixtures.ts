import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, createPool, type Db } from '@switchboard/db';
import {
  businesses,
  customers,
  services,
  staff,
  staffServices,
  workingHours,
} from '@switchboard/db/schema';
import { dbSchema, parseEnv } from '@switchboard/env';
import { v7 as uuidv7 } from 'uuid';
import { addDaysToLocalDate, type LocalDate, localDateOf, localToUtc } from '../time.ts';

// Integration fixtures: each test builds its own business, so tests never see each other's rows.

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  const rootEnv = resolve(fileURLToPath(import.meta.url), '../../../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
}

export const TZ = 'Africa/Lagos';

export function connect(max = 25) {
  const pool = createPool(parseEnv(dbSchema).DATABASE_URL, { max });
  return { pool, db: createDb(pool) };
}

export interface Fixture {
  businessId: string;
  slug: string;
  staffIds: string[];
  /** 30 min, ₦1,000 fixed deposit → holds start as `held`. */
  depositServiceId: string;
  /** 60 min, ₦1,000 fixed deposit. */
  longServiceId: string;
  /** 30 min, no deposit → holds are `confirmed` immediately. */
  freeServiceId: string;
  customerId: string;
  /** Tomorrow in Lagos: always inside the lead time and the 14-day window. */
  day: LocalDate;
  /** UTC instant of `hh:mm` Lagos time on `day`. */
  at: (hhmm: string) => Date;
}

export async function makeFixture(db: Db, opts: { staffCount?: number } = {}): Promise<Fixture> {
  const tag = uuidv7().slice(-12);
  const [biz] = await db
    .insert(businesses)
    .values({ name: `Test ${tag}`, slug: `test-${tag}`, vertical: 'barber', timezone: TZ })
    .returning();
  if (!biz) throw new Error('fixture: no business');

  const staffRows = await db
    .insert(staff)
    .values(
      Array.from({ length: opts.staffCount ?? 1 }, (_, i) => ({
        businessId: biz.id,
        name: `Barber ${String.fromCharCode(65 + i)}`,
      })),
    )
    .returning();

  const [deposit, long, free] = await db
    .insert(services)
    .values([
      {
        businessId: biz.id,
        name: 'Low cut',
        durationMin: 30,
        priceKobo: 300_000,
        depositType: 'fixed',
        depositValue: 100_000,
      },
      {
        businessId: biz.id,
        name: 'Braids',
        durationMin: 60,
        priceKobo: 1_500_000,
        depositType: 'fixed',
        depositValue: 100_000,
      },
      {
        businessId: biz.id,
        name: 'Beard sculpt',
        durationMin: 30,
        priceKobo: 250_000,
        depositType: 'none',
        depositValue: 0,
      },
    ])
    .returning();
  if (!deposit || !long || !free) throw new Error('fixture: no services');

  for (const s of staffRows) {
    await db
      .insert(staffServices)
      .values([deposit, long, free].map((svc) => ({ staffId: s.id, serviceId: svc.id })));
    // Every weekday, so tests don't depend on what day they run.
    await db.insert(workingHours).values(
      Array.from({ length: 7 }, (_, weekday) => ({
        staffId: s.id,
        weekday,
        startLocal: '09:00:00',
        endLocal: '20:00:00',
      })),
    );
  }

  const [customer] = await db
    .insert(customers)
    .values({
      businessId: biz.id,
      phoneE164: `+23480${tag.replace(/\D/g, '0').slice(0, 8).padEnd(8, '0')}`,
      name: 'Ada',
    })
    .returning();
  if (!customer) throw new Error('fixture: no customer');

  const day = addDaysToLocalDate(localDateOf(new Date(), TZ), 1);
  return {
    businessId: biz.id,
    slug: biz.slug,
    staffIds: staffRows.map((s) => s.id),
    depositServiceId: deposit.id,
    longServiceId: long.id,
    freeServiceId: free.id,
    customerId: customer.id,
    day,
    at: (hhmm) => localToUtc(day, hhmm, TZ),
  };
}

/** Moves a hold's deadline into the past, as if HOLD_MINUTES had elapsed. */
export async function makeHoldOverdue(pool: ReturnType<typeof connect>['pool'], bookingId: string) {
  await pool.query(
    `UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE id = $1`,
    [bookingId],
  );
}
