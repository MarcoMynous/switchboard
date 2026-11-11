import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns.ts';
import { user } from './auth.ts';

export const businessVertical = pgEnum('business_vertical', [
  'salon',
  'barber',
  'auto',
  'property',
  'clinic',
]);

export const businessPlan = pgEnum('business_plan', ['starter', 'pro']);

/** Shape is pinned down in P5 (payouts). Opaque until then. */
export type KoraPayoutAccount = Record<string, unknown>;

export interface BusinessDaySchedule {
  open: boolean;
  openTime: string;
  closeTime: string;
}

export interface BusinessCapability {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  enabled: boolean;
}

export const businesses = pgTable(
  'businesses',
  {
    id: id(),
    /** Better Auth user who owns this business workspace */
    ownerUserId: text().references(() => user.id, { onDelete: 'set null' }),
    name: text().notNull(),
    /** Public booking URL: /b/<slug> */
    slug: text().notNull().unique(),
    vertical: businessVertical().notNull(),
    /** Step 1: Contact & location details */
    phone: text(),
    location: text(),
    country: text().notNull().default('Nigeria (NG)'),
    /** IANA zone. Storage is UTC; this is for display and working-hours conversion. */
    timezone: text().notNull().default('Africa/Lagos'),
    website: text(),
    /** Step 2: Owner self-provides services toggle */
    selfProvided: boolean().notNull().default(false),
    /** Step 3: Weekly opening schedule & booking window rules */
    schedule: jsonb().$type<Record<string, BusinessDaySchedule>>(),
    advanceDays: integer().notNull().default(14),
    allowSameDay: boolean().notNull().default(true),
    /** Step 4: Deposit & Kora rules (Default deposit stored in integer kobo per I6) */
    depositRequired: boolean().notNull().default(true),
    depositType: text().notNull().default('fixed'),
    defaultDepositKobo: bigint({ mode: 'number' }).notNull().default(150_000),
    cancellationPolicy: text(),
    koraStatus: text().notNull().default('ready'),
    /** Step 5: AI receptionist persona & capabilities */
    assistantName: text().notNull().default('Maya'),
    greeting: text(),
    tone: text().notNull().default('Friendly'),
    capabilities: jsonb().$type<BusinessCapability[]>(),
    /** Step 6: Onboarding completion status */
    onboardingCompleted: boolean().notNull().default(false),
    /** Routes inbound WhatsApp messages to a business, so at most one business per number. */
    whatsappPhoneNumberId: text().unique('businesses_whatsapp_phone_number_id_unique'),
    plan: businessPlan().notNull().default('starter'),
    koraPayoutAccount: jsonb().$type<KoraPayoutAccount>(),
    agentEnabled: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index('businesses_owner_user_id_idx').on(table.ownerUserId)],
);

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
