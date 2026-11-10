import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbSchema, parseEnv } from '@switchboard/env';
import { eq } from 'drizzle-orm';
import { createDb, createPool } from './client.ts';
import { businesses, services, staff, staffServices, workingHours } from './schema/index.ts';

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

  console.log('seeded: Fade Republic, Ota (business, services, staff, working_hours)');
} finally {
  await pool.end();
}
