import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbSchema, parseEnv } from '@switchboard/env';
import { and, eq, sql } from 'drizzle-orm';
import { createDb, createPool } from './client.ts';
import {
  bookings,
  businesses,
  customers,
  services,
  staff,
  staffServices,
  workingHours,
} from './schema/index.ts';

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  const rootEnv = resolve(fileURLToPath(import.meta.url), '../../../../.env');
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
}

// Idempotent: safe to rerun on every preview deploy.
const env = parseEnv(dbSchema);
const pool = createPool(env.DATABASE_URL, { max: 1 });

try {
  const db = createDb(pool);

  const defaultSchedule = {
    Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
    Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
    Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
  };

  const [biz] = await db
    .insert(businesses)
    .values({
      name: 'Fade Republic',
      slug: 'fade-republic',
      vertical: 'barber',
      phone: '+234 803 123 4567',
      location: 'KM 10 Idiroko Road, Ota, Ogun State',
      country: 'Nigeria (NG)',
      timezone: 'Africa/Lagos',
      website: 'https://faderepublic.ng',
      schedule: defaultSchedule,
      advanceDays: 14,
      allowSameDay: true,
      depositRequired: true,
      depositType: 'fixed',
      defaultDepositKobo: 150_000,
      cancellationPolicy: 'Full refund if cancelled at least 4 hours before your scheduled slot.',
      koraStatus: 'ready',
      assistantName: 'Maya',
      greeting:
        "Hi! Welcome to Fade Republic. I'm Maya, your booking assistant. Which service or barber would you like to book today?",
      tone: 'Friendly',
      plan: 'pro',
      onboardingCompleted: true,
    })
    .onConflictDoUpdate({
      target: businesses.slug,
      set: {
        phone: '+234 803 123 4567',
        location: 'KM 10 Idiroko Road, Ota, Ogun State',
        schedule: defaultSchedule,
        defaultDepositKobo: 150_000,
        assistantName: 'Maya',
        onboardingCompleted: true,
      },
    })
    .returning();

  if (biz) {
    const existingServices = await db
      .select()
      .from(services)
      .where(eq(services.businessId, biz.id));
    if (existingServices.length === 0) {
      const insertedSvcs = await db
        .insert(services)
        .values([
          {
            businessId: biz.id,
            name: 'Classic Fade & Beard Sculpt',
            description: 'Detailed razor fade, hot towel prep & beard oil.',
            durationMin: 45,
            priceKobo: 500_000,
            depositType: 'fixed',
            depositValue: 150_000,
          },
          {
            businessId: biz.id,
            name: 'Standard Haircut',
            description: 'Clean clipper cut and sharp perimeter line-up.',
            durationMin: 30,
            priceKobo: 350_000,
            depositType: 'fixed',
            depositValue: 100_000,
          },
          {
            businessId: biz.id,
            name: 'VIP Dreadlocks Retwist & Wash',
            description: 'Organic shampoo wash & deep palm-roll retwist.',
            durationMin: 90,
            priceKobo: 1_500_000,
            depositType: 'fixed',
            depositValue: 500_000,
          },
        ])
        .returning();

      const insertedStaff = await db
        .insert(staff)
        .values([
          {
            businessId: biz.id,
            name: 'Tunde Adeyemi',
            role: 'owner',
            roleTitle: 'Lead Barber',
            active: true,
          },
          {
            businessId: biz.id,
            name: 'Emeka Okafor',
            role: 'staff',
            roleTitle: 'Fade Specialist',
            active: true,
          },
        ])
        .returning();

      for (const stf of insertedStaff) {
        for (const svc of insertedSvcs) {
          await db
            .insert(staffServices)
            .values({ staffId: stf.id, serviceId: svc.id })
            .onConflictDoNothing();
        }
        await db.insert(workingHours).values([
          { staffId: stf.id, weekday: 1, startLocal: '09:00:00', endLocal: '19:00:00' },
          { staffId: stf.id, weekday: 2, startLocal: '09:00:00', endLocal: '19:00:00' },
          { staffId: stf.id, weekday: 3, startLocal: '09:00:00', endLocal: '19:00:00' },
          { staffId: stf.id, weekday: 4, startLocal: '09:00:00', endLocal: '19:00:00' },
          { staffId: stf.id, weekday: 5, startLocal: '09:00:00', endLocal: '20:00:00' },
          { staffId: stf.id, weekday: 6, startLocal: '09:00:00', endLocal: '20:00:00' },
        ]);
      }
    }
  }

  if (biz) await seedBookingData(db, biz.id, biz.timezone);

  console.log(
    'seeded: Fade Republic, Ota (business, services incl. no-deposit Low cut, staff, working_hours, customers, 2 weeks of bookings)',
  );
} finally {
  await pool.end();
}

/**
 * P1 additions (kept separate from the onboarding seed above, which stays as Martins wrote it):
 * a no-deposit "Low cut" (slug low-cut: the k6 scripts and the P1 exit flow need a service that
 * confirms without payment), customers, and two weeks of history for the CRM and money dashboard.
 * Idempotent: the service is matched by name, history only seeds into a business with no bookings.
 */
async function seedBookingData(
  db: ReturnType<typeof createDb>,
  businessId: string,
  timezone: string,
) {
  let [lowCut] = await db
    .select()
    .from(services)
    .where(and(eq(services.businessId, businessId), eq(services.name, 'Low cut')));
  if (!lowCut) {
    [lowCut] = await db
      .insert(services)
      .values({
        businessId,
        name: 'Low cut',
        description: 'Quick, clean low cut. Pay at the chair: no deposit needed.',
        durationMin: 30,
        priceKobo: 300_000,
        depositType: 'none',
        depositValue: 0,
      })
      .returning();
  }
  const staffRows = await db.select().from(staff).where(eq(staff.businessId, businessId));
  if (lowCut) {
    for (const s of staffRows) {
      await db
        .insert(staffServices)
        .values({ staffId: s.id, serviceId: lowCut.id })
        .onConflictDoNothing();
    }
  }

  const people = [
    ['Adaeze Okonkwo', '+2348035550101'],
    ['Babatunde Bello', '+2348035550102'],
    ['Chinedu Eze', '+2348035550103'],
    ['Damilola Adebayo', '+2348035550104'],
    ['Emeka Nwosu', '+2348035550105'],
    ['Funmilayo Ogunleye', '+2348035550106'],
    ['Gbenga Ajayi', '+2348035550107'],
    ['Halima Sule', '+2348035550108'],
    ['Ifeanyi Obi', '+2348035550109'],
    ['Jide Olawale', '+2348035550110'],
    ['Kemi Adeyemi', '+2348035550111'],
    ['Lanre Fashola', '+2348035550112'],
  ] as const;
  await db
    .insert(customers)
    .values(people.map(([name, phoneE164]) => ({ businessId, name, phoneE164 })))
    .onConflictDoNothing();
  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, businessId));

  const [existing] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.businessId, businessId))
    .limit(1);
  const svcRows = await db.select().from(services).where(eq(services.businessId, businessId));
  if (existing || staffRows.length === 0 || svcRows.length === 0 || customerRows.length === 0)
    return;

  // Deterministic pseudo-random, so every preview gets the same demo history.
  let state = 42;
  const rand = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;

  type Row = {
    day: number;
    time: string;
    staffId: string;
    serviceId: string;
    durationMin: number;
    customerId: string;
    status: 'completed' | 'no_show' | 'cancelled' | 'confirmed';
  };
  const rows: Row[] = [];
  // Past 14 days: a few bookings per barber per working day, laid end to end so none overlap.
  for (let day = -14; day <= -1; day++) {
    for (const s of staffRows) {
      let minute = 9 * 60 + Math.floor(rand() * 4) * 30;
      const count = 2 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        const svc = pick(svcRows);
        if (minute + svc.durationMin > 19 * 60) break;
        const roll = rand();
        rows.push({
          day,
          time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
          staffId: s.id,
          serviceId: svc.id,
          durationMin: svc.durationMin,
          customerId: pick(customerRows).id,
          status: roll < 0.08 ? 'no_show' : roll < 0.15 ? 'cancelled' : 'completed',
        });
        minute += svc.durationMin + 30 * Math.floor(rand() * 3);
      }
    }
  }
  // A few upcoming confirmed bookings (tomorrow, late afternoon) so the dashboard isn't empty.
  for (const [i, s] of staffRows.entries()) {
    const svc = lowCut ?? pick(svcRows);
    rows.push({
      day: 1,
      time: `${16 + i}:00`,
      staffId: s.id,
      serviceId: svc.id,
      durationMin: svc.durationMin,
      customerId: pick(customerRows).id,
      status: 'confirmed',
    });
  }

  // Business-local wall clock → UTC in Postgres (AT TIME ZONE), relative to today in that zone.
  const local = (day: number, time: string) =>
    sql`(((now() AT TIME ZONE ${timezone})::date + ${day}::int) + ${time}::time) AT TIME ZONE ${timezone}`;
  await db
    .insert(bookings)
    .values(
      rows.map((r, i) => ({
        businessId,
        staffId: r.staffId,
        serviceId: r.serviceId,
        customerId: r.customerId,
        startsAt: local(r.day, r.time),
        endsAt: sql`${local(r.day, r.time)} + make_interval(mins => ${r.durationMin})`,
        status: r.status,
        source: pick(['whatsapp', 'whatsapp', 'web_chat', 'booking_page', 'staff'] as const),
        idempotencyKey: `seed-${i}`,
        ...(r.status === 'cancelled' ? { cancelReason: 'Customer rescheduled by phone' } : {}),
      })),
    )
    .onConflictDoNothing();

  // CRM counters from the history just written.
  await db.execute(sql`
    UPDATE customers c SET
      visits = (SELECT count(*) FROM bookings b WHERE b.customer_id = c.id AND b.status = 'completed'),
      no_shows = (SELECT count(*) FROM bookings b WHERE b.customer_id = c.id AND b.status = 'no_show')
    WHERE c.business_id = ${businessId}`);
}
