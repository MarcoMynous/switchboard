import { parseEnv, webSchema } from '@switchboard/env';
import { desc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '../../../lib/auth';
import * as schema from '../../../lib/db-schema';
import {
  type BusinessCapability,
  type BusinessDaySchedule,
  businesses,
  services,
  staff,
  staffServices,
  workingHours,
} from '../../../lib/db-schema';

const env = parseEnv(webSchema);

// Absent only under SKIP_ENV_VALIDATION=1 (build); pg never connects during a build. See lib/auth.ts.
const databaseUrl: string = env.DATABASE_URL ?? '';

const normalizedDatabaseUrl = databaseUrl.includes('uselibpqcompat=')
  ? databaseUrl
  : databaseUrl.replace(/([?&])sslmode=(?:require|prefer|verify-ca)\b/g, '$1sslmode=verify-full');

const pool = new Pool({
  connectionString: normalizedDatabaseUrl,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

const db = drizzle(pool, { schema });

const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const INDEX_TO_WEEKDAY: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

function normalizeTimezone(tz?: string): string {
  if (!tz) return 'Africa/Lagos';
  if (tz.includes('Accra')) return 'Africa/Accra';
  if (tz.includes('Nairobi')) return 'Africa/Nairobi';
  return 'Africa/Lagos';
}

function formatTimezoneLabel(tz: string): string {
  if (tz.includes('Accra')) return 'Africa/Accra (GMT)';
  if (tz.includes('Nairobi')) return 'Africa/Nairobi (GMT+3)';
  return 'Africa/Lagos (GMT+1)';
}

function mapVerticalToCategory(vertical: string): 'barber' | 'beauty' | 'auto' | 'property' {
  if (vertical === 'salon') return 'beauty';
  if (vertical === 'auto') return 'auto';
  if (vertical === 'property') return 'property';
  return 'barber';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug')?.trim();

    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);

    let businessRow: typeof businesses.$inferSelect | undefined;

    if (requestedSlug) {
      const rows = await db
        .select()
        .from(businesses)
        .where(eq(businesses.slug, requestedSlug))
        .limit(1);
      businessRow = rows[0];
    }

    if (!businessRow && session?.user?.id) {
      const ownedRows = await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerUserId, session.user.id))
        .orderBy(desc(businesses.updatedAt))
        .limit(1);
      businessRow = ownedRows[0];
    }

    if (!businessRow) {
      const latestRows = await db
        .select()
        .from(businesses)
        .orderBy(desc(businesses.updatedAt))
        .limit(1);
      businessRow = latestRows[0];
    }

    if (!businessRow) {
      return NextResponse.json({
        ok: true,
        user: session?.user
          ? {
              id: session.user.id,
              name: session.user.name || session.user.email.split('@')[0] || 'Owner',
              email: session.user.email,
              role: 'owner' as const,
            }
          : null,
        business: null,
        services: [],
        staff: [],
        workingHours: [],
      });
    }

    const [serviceRows, staffRows] = await Promise.all([
      db.select().from(services).where(eq(services.businessId, businessRow.id)),
      db.select().from(staff).where(eq(staff.businessId, businessRow.id)),
    ]);

    const staffIds = staffRows.map((s) => s.id);
    const hoursRows =
      staffIds.length > 0
        ? await db.select().from(workingHours).where(inArray(workingHours.staffId, staffIds))
        : [];

    // Reconstruct schedule from JSONB or working_hours rows
    let schedule = businessRow.schedule ?? null;
    if (!schedule && hoursRows.length > 0) {
      const builtSchedule: Record<string, BusinessDaySchedule> = {
        Monday: { open: false, openTime: '09:00', closeTime: '19:00' },
        Tuesday: { open: false, openTime: '09:00', closeTime: '19:00' },
        Wednesday: { open: false, openTime: '09:00', closeTime: '19:00' },
        Thursday: { open: false, openTime: '09:00', closeTime: '19:00' },
        Friday: { open: false, openTime: '09:00', closeTime: '20:00' },
        Saturday: { open: false, openTime: '09:00', closeTime: '20:00' },
        Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
      };
      for (const h of hoursRows) {
        const dayName = INDEX_TO_WEEKDAY[h.weekday];
        if (dayName) {
          builtSchedule[dayName] = {
            open: true,
            openTime: h.startLocal.slice(0, 5),
            closeTime: h.endLocal.slice(0, 5),
          };
        }
      }
      schedule = builtSchedule;
    }

    const formattedServices = serviceRows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      duration: s.durationMin,
      durationMin: s.durationMin,
      price: Math.round(Number(s.priceKobo) / 100),
      priceKobo: Number(s.priceKobo),
      depositRequired: s.depositType !== 'none',
      depositType: s.depositType,
      depositAmount:
        s.depositType === 'fixed'
          ? Math.round(Number(s.depositValue) / 100)
          : Number(s.depositValue),
      depositValue: Number(s.depositValue),
      freeCancelHours: s.freeCancelHours,
    }));

    const formattedStaff = staffRows.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.roleTitle || (member.role === 'owner' ? 'Lead Specialist' : 'Staff Provider'),
      dbRole: member.role,
      active: member.active,
    }));

    const defaultDepositNaira = Math.round(Number(businessRow.defaultDepositKobo ?? 150_000) / 100);

    return NextResponse.json({
      ok: true,
      user: session?.user
        ? {
            id: session.user.id,
            name: session.user.name || session.user.email.split('@')[0] || 'Owner',
            email: session.user.email,
            role: 'owner' as const,
          }
        : null,
      business: {
        id: businessRow.id,
        ownerUserId: businessRow.ownerUserId,
        name: businessRow.name,
        businessName: businessRow.name,
        slug: businessRow.slug,
        vertical: businessRow.vertical,
        category: mapVerticalToCategory(businessRow.vertical),
        phone: businessRow.phone || '+234 803 123 4567',
        location: businessRow.location || 'KM 10 Idiroko Road, Ota, Ogun State',
        country: businessRow.country || 'Nigeria (NG)',
        timezone: businessRow.timezone,
        timezoneLabel: formatTimezoneLabel(businessRow.timezone),
        instagramOrWeb: businessRow.website || '',
        selfProvided: businessRow.selfProvided,
        schedule,
        advanceDays: businessRow.advanceDays,
        allowSameDay: businessRow.allowSameDay,
        depositRequired: businessRow.depositRequired,
        depositType: (businessRow.depositType === 'percentage' ? 'percentage' : 'fixed') as
          | 'fixed'
          | 'percentage',
        depositAmount: defaultDepositNaira,
        defaultDepositKobo: Number(businessRow.defaultDepositKobo ?? 150_000),
        cancellationPolicy:
          businessRow.cancellationPolicy ||
          'Full refund if cancelled at least 4 hours before your scheduled slot.',
        koraStatus: (businessRow.koraStatus === 'pending' ? 'pending' : 'ready') as
          | 'ready'
          | 'pending',
        assistantName: businessRow.assistantName || 'Maya',
        greeting:
          businessRow.greeting ||
          `Hi! Welcome to ${businessRow.name}. I'm ${businessRow.assistantName || 'Maya'}, your booking assistant. Which service would you like to book today?`,
        tone: (['Friendly', 'Professional', 'Casual'].includes(businessRow.tone)
          ? businessRow.tone
          : 'Friendly') as 'Friendly' | 'Professional' | 'Casual',
        capabilities: businessRow.capabilities ?? null,
        onboardingCompleted: businessRow.onboardingCompleted,
        whatsappPhoneNumberId: businessRow.whatsappPhoneNumberId,
        plan: businessRow.plan,
        koraConfigured:
          Boolean(businessRow.koraPayoutAccount) || businessRow.koraStatus === 'ready',
        agentEnabled: businessRow.agentEnabled,
        createdAt: businessRow.createdAt,
        updatedAt: businessRow.updatedAt,
      },
      services: formattedServices,
      staff: formattedStaff,
      workingHours: hoursRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database or workspace service temporarily unavailable.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 },
    );
  }
}

interface IncomingServiceItem {
  id?: string;
  name: string;
  duration: number;
  price: number;
  depositRequired?: boolean;
  depositAmount?: number;
  description?: string;
}

interface IncomingStaffItem {
  id?: string;
  name: string;
  role: string;
}

interface IncomingWorkspaceBody {
  // Step 1
  name?: string;
  businessName?: string;
  slug?: string;
  vertical?: string;
  category?: string;
  phone?: string;
  location?: string;
  country?: string;
  timezone?: string;
  instagramOrWeb?: string;
  website?: string;

  // Step 2
  services?: IncomingServiceItem[];
  staff?: IncomingStaffItem[];
  selfProvided?: boolean;

  // Step 3
  schedule?: Record<string, BusinessDaySchedule>;
  advanceDays?: number;
  allowSameDay?: boolean;

  // Step 4
  depositRequired?: boolean;
  depositType?: 'fixed' | 'percentage';
  depositAmount?: number;
  cancellationPolicy?: string;
  koraStatus?: 'ready' | 'pending';

  // Step 5
  assistantName?: string;
  greeting?: string;
  tone?: 'Friendly' | 'Professional' | 'Casual';
  capabilities?: BusinessCapability[];
  agentEnabled?: boolean;

  // Step 6
  onboardingCompleted?: boolean;
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
    const body = (await request.json()) as IncomingWorkspaceBody;

    const rawName = (body.businessName || body.name || 'Fade Republic').trim();
    const rawSlug =
      (body.slug || rawName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'fade-republic';

    const rawCategory = body.category || body.vertical || 'barber';
    const mappedVertical: 'salon' | 'barber' | 'auto' | 'property' | 'clinic' =
      rawCategory === 'beauty' || rawCategory === 'salon'
        ? 'salon'
        : rawCategory === 'auto'
          ? 'auto'
          : rawCategory === 'property'
            ? 'property'
            : rawCategory === 'clinic'
              ? 'clinic'
              : 'barber';

    const timezone = normalizeTimezone(body.timezone);
    const phone = body.phone?.trim() || '+234 803 123 4567';
    const location = body.location?.trim() || 'KM 10 Idiroko Road, Ota, Ogun State';
    const country = body.country?.trim() || 'Nigeria (NG)';
    const website = (body.instagramOrWeb ?? body.website ?? '').trim();
    const selfProvided = Boolean(body.selfProvided);
    const advanceDays = Number.isFinite(body.advanceDays) ? Number(body.advanceDays) : 14;
    const allowSameDay = body.allowSameDay ?? true;
    const depositRequired = body.depositRequired ?? true;
    const depositType = body.depositType === 'percentage' ? 'percentage' : 'fixed';
    const depositAmountNaira = Number.isFinite(body.depositAmount)
      ? Math.max(0, Number(body.depositAmount))
      : 1500;
    const defaultDepositKobo = Math.round(depositAmountNaira * 100);
    const cancellationPolicy =
      body.cancellationPolicy?.trim() ||
      'Full refund if cancelled at least 4 hours before your scheduled slot.';
    const koraStatus = body.koraStatus === 'pending' ? 'pending' : 'ready';
    const assistantName = body.assistantName?.trim() || 'Maya';
    const greeting =
      body.greeting?.trim() ||
      `Hi! Welcome to ${rawName}. I'm ${assistantName}, your booking assistant. Which service would you like to book today?`;
    const tone =
      body.tone && ['Friendly', 'Professional', 'Casual'].includes(body.tone)
        ? body.tone
        : 'Friendly';
    const agentEnabled = body.agentEnabled ?? true;
    const onboardingCompleted = body.onboardingCompleted ?? false;
    const ownerUserId = session?.user?.id ?? null;

    const saved = await db.transaction(async (tx) => {
      // 1. Upsert business row in `businesses`
      const [upsertedBusiness] = await tx
        .insert(businesses)
        .values({
          ownerUserId,
          name: rawName,
          slug: rawSlug,
          vertical: mappedVertical,
          phone,
          location,
          country,
          timezone,
          website,
          selfProvided,
          schedule: body.schedule ?? null,
          advanceDays,
          allowSameDay,
          depositRequired,
          depositType,
          defaultDepositKobo,
          cancellationPolicy,
          koraStatus,
          assistantName,
          greeting,
          tone,
          capabilities: body.capabilities ?? null,
          onboardingCompleted,
          plan: 'pro',
          agentEnabled,
        })
        .onConflictDoUpdate({
          target: businesses.slug,
          set: {
            ...(ownerUserId ? { ownerUserId } : {}),
            name: rawName,
            vertical: mappedVertical,
            phone,
            location,
            country,
            timezone,
            website,
            selfProvided,
            ...(body.schedule ? { schedule: body.schedule } : {}),
            advanceDays,
            allowSameDay,
            depositRequired,
            depositType,
            defaultDepositKobo,
            cancellationPolicy,
            koraStatus,
            assistantName,
            greeting,
            tone,
            ...(body.capabilities ? { capabilities: body.capabilities } : {}),
            onboardingCompleted,
            agentEnabled,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!upsertedBusiness) {
        throw new Error('Failed to upsert business record');
      }

      const businessId = upsertedBusiness.id;

      // 2. Sync `services` table if services were provided in the onboarding payload
      let insertedServices: (typeof services.$inferSelect)[] = [];
      if (Array.isArray(body.services) && body.services.length > 0) {
        await tx.delete(services).where(eq(services.businessId, businessId));

        const serviceValues = body.services
          .filter((s) => s.name?.trim())
          .map((s) => {
            const priceKobo = Math.max(0, Math.round(Number(s.price || 0) * 100));
            const svcDepositRequired = s.depositRequired ?? depositRequired;
            const svcDepositType: 'fixed' | 'percent' | 'none' = !svcDepositRequired
              ? 'none'
              : depositType === 'percentage'
                ? 'percent'
                : 'fixed';
            const rawDepAmt = Number(s.depositAmount ?? depositAmountNaira);
            const depositValue = !svcDepositRequired
              ? 0
              : svcDepositType === 'fixed'
                ? Math.max(0, Math.round(rawDepAmt * 100))
                : Math.min(100, Math.max(0, Math.round(rawDepAmt)));

            return {
              businessId,
              name: s.name.trim(),
              description: (s.description || 'Bookable appointment service.').trim(),
              durationMin: Math.max(5, Number(s.duration) || 30),
              priceKobo,
              depositType: svcDepositType,
              depositValue,
              freeCancelHours: 4,
              depositCountsTowardBill: true,
            };
          });

        if (serviceValues.length > 0) {
          insertedServices = await tx.insert(services).values(serviceValues).returning();
        }
      } else {
        insertedServices = await tx
          .select()
          .from(services)
          .where(eq(services.businessId, businessId));
      }

      // 3. Sync `staff` table if staff were provided in the onboarding payload
      let insertedStaff: (typeof staff.$inferSelect)[] = [];
      if (Array.isArray(body.staff) && body.staff.length > 0) {
        await tx.delete(staff).where(eq(staff.businessId, businessId));

        const staffValues = body.staff
          .filter((m) => m.name?.trim())
          .map((m, idx) => ({
            businessId,
            name: m.name.trim(),
            role: (idx === 0 ? 'owner' : 'staff') as 'owner' | 'staff',
            roleTitle: (m.role || 'Staff Provider').trim(),
            userId: idx === 0 && ownerUserId ? ownerUserId : null,
            active: true,
          }));

        if (staffValues.length > 0) {
          insertedStaff = await tx.insert(staff).values(staffValues).returning();
        }
      } else {
        insertedStaff = await tx.select().from(staff).where(eq(staff.businessId, businessId));
      }

      // 4. Link `staff_services` (every active staff member can perform the business's services by default)
      if (insertedStaff.length > 0 && insertedServices.length > 0) {
        const staffServicePairs: { staffId: string; serviceId: string }[] = [];
        for (const member of insertedStaff) {
          for (const svc of insertedServices) {
            staffServicePairs.push({
              staffId: member.id,
              serviceId: svc.id,
            });
          }
        }
        if (staffServicePairs.length > 0) {
          await tx.insert(staffServices).values(staffServicePairs).onConflictDoNothing();
        }
      }

      // 5. Sync `working_hours` table for each staff member from `schedule`
      if (body.schedule && insertedStaff.length > 0) {
        const staffIds = insertedStaff.map((s) => s.id);
        await tx.delete(workingHours).where(inArray(workingHours.staffId, staffIds));

        const workingHourRows: {
          staffId: string;
          weekday: number;
          startLocal: string;
          endLocal: string;
        }[] = [];

        for (const member of insertedStaff) {
          for (const [dayName, daySched] of Object.entries(body.schedule)) {
            const weekday = WEEKDAY_INDEX[dayName];
            if (weekday !== undefined && daySched?.open) {
              workingHourRows.push({
                staffId: member.id,
                weekday,
                startLocal: `${(daySched.openTime || '09:00').slice(0, 5)}:00`,
                endLocal: `${(daySched.closeTime || '19:00').slice(0, 5)}:00`,
              });
            }
          }
        }

        if (workingHourRows.length > 0) {
          await tx.insert(workingHours).values(workingHourRows);
        }
      }

      return {
        business: upsertedBusiness,
        servicesCount: insertedServices.length,
        staffCount: insertedStaff.length,
      };
    });

    return NextResponse.json({
      ok: true,
      business: saved.business,
      servicesCount: saved.servicesCount,
      staffCount: saved.staffCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not save onboarding details to database.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
