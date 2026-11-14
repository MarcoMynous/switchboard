import { randomUUID } from 'node:crypto';
import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { account, session, user, verification } from './auth-schema';

export { account, session, user, verification };

export const businessVertical = pgEnum('business_vertical', [
  'salon',
  'barber',
  'auto',
  'property',
  'clinic',
]);

export const businessPlan = pgEnum('business_plan', ['starter', 'pro']);

export const staffRole = pgEnum('staff_role', ['owner', 'staff']);

export const serviceDepositType = pgEnum('service_deposit_type', [
  'fixed',
  'percent',
  'none',
  'full',
]);

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
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    ownerUserId: text('owner_user_id').references(() => user.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    vertical: businessVertical('vertical').notNull(),
    phone: text('phone'),
    location: text('location'),
    country: text('country').notNull().default('Nigeria (NG)'),
    timezone: text('timezone').notNull().default('Africa/Lagos'),
    website: text('website'),
    selfProvided: boolean('self_provided').notNull().default(false),
    schedule: jsonb('schedule').$type<Record<string, BusinessDaySchedule>>(),
    advanceDays: integer('advance_days').notNull().default(14),
    allowSameDay: boolean('allow_same_day').notNull().default(true),
    depositRequired: boolean('deposit_required').notNull().default(true),
    depositType: text('deposit_type').notNull().default('fixed'),
    defaultDepositKobo: bigint('default_deposit_kobo', { mode: 'number' })
      .notNull()
      .default(150_000),
    freeCancelHours: integer('free_cancel_hours').notNull().default(4),
    merchantBearsCost: boolean('merchant_bears_cost').notNull().default(false),
    cancellationPolicy: text('cancellation_policy'),
    koraStatus: text('kora_status').notNull().default('ready'),
    assistantName: text('assistant_name').notNull().default('Maya'),
    greeting: text('greeting'),
    tone: text('tone').notNull().default('Friendly'),
    capabilities: jsonb('capabilities').$type<BusinessCapability[]>(),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    whatsappPhoneNumberId: text('whatsapp_phone_number_id').unique(
      'businesses_whatsapp_phone_number_id_unique',
    ),
    plan: businessPlan('plan').notNull().default('starter'),
    koraPayoutAccount: jsonb('kora_payout_account').$type<Record<string, unknown>>(),
    agentEnabled: boolean('agent_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('businesses_owner_user_id_idx').on(table.ownerUserId)],
);

export const staff = pgTable(
  'staff',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: staffRole('role').notNull().default('staff'),
    roleTitle: text('role_title').notNull().default('Staff Provider'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('staff_business_id_idx').on(table.businessId)],
);

export const services = pgTable(
  'services',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    durationMin: integer('duration_min').notNull(),
    priceKobo: bigint('price_kobo', { mode: 'number' }).notNull(),
    depositType: serviceDepositType('deposit_type').notNull().default('fixed'),
    depositValue: bigint('deposit_value', { mode: 'number' }).notNull().default(0),
    freeCancelHours: integer('free_cancel_hours').notNull().default(4),
    depositCountsTowardBill: boolean('deposit_counts_toward_bill').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('services_business_id_idx').on(table.businessId)],
);

export const staffServices = pgTable(
  'staff_services',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.staffId, table.serviceId] })],
);

export const workingHours = pgTable(
  'working_hours',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    startLocal: time('start_local').notNull(),
    endLocal: time('end_local').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('working_hours_staff_id_idx').on(table.staffId)],
);

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(user, {
    fields: [businesses.ownerUserId],
    references: [user.id],
  }),
  staff: many(staff),
  services: many(services),
}));
