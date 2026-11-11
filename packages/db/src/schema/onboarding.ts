import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns.ts';
import { user } from './auth.ts';
import { businesses } from './businesses.ts';

export const staffRole = pgEnum('staff_role', ['owner', 'staff']);

export const serviceDepositType = pgEnum('service_deposit_type', [
  'fixed',
  'percent',
  'none',
  'full',
]);

export const staff = pgTable(
  'staff',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    role: staffRole().notNull().default('staff'),
    /** Display role title set during onboarding (e.g. 'Lead Barber', 'Fade Specialist') */
    roleTitle: text().notNull().default('Staff Provider'),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index('staff_business_id_idx').on(table.businessId)],
);

export const services = pgTable(
  'services',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    durationMin: integer().notNull(),
    /** Price in integer kobo (Invariant I6) */
    priceKobo: bigint({ mode: 'number' }).notNull(),
    depositType: serviceDepositType().notNull().default('fixed'),
    /** Deposit value: integer kobo when depositType='fixed', percentage (0-100) when 'percent' */
    depositValue: bigint({ mode: 'number' }).notNull().default(0),
    freeCancelHours: integer().notNull().default(4),
    depositCountsTowardBill: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index('services_business_id_idx').on(table.businessId)],
);

export const staffServices = pgTable(
  'staff_services',
  {
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.staffId, table.serviceId] })],
);

export const workingHours = pgTable(
  'working_hours',
  {
    id: id(),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
    weekday: integer().notNull(),
    startLocal: time().notNull(),
    endLocal: time().notNull(),
    ...timestamps,
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

export const staffRelations = relations(staff, ({ one, many }) => ({
  business: one(businesses, {
    fields: [staff.businessId],
    references: [businesses.id],
  }),
  user: one(user, {
    fields: [staff.userId],
    references: [user.id],
  }),
  staffServices: many(staffServices),
  workingHours: many(workingHours),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  business: one(businesses, {
    fields: [services.businessId],
    references: [businesses.id],
  }),
  staffServices: many(staffServices),
}));

export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staff, {
    fields: [staffServices.staffId],
    references: [staff.id],
  }),
  service: one(services, {
    fields: [staffServices.serviceId],
    references: [services.id],
  }),
}));

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  staff: one(staff, {
    fields: [workingHours.staffId],
    references: [staff.id],
  }),
}));

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type StaffService = typeof staffServices.$inferSelect;
export type WorkingHour = typeof workingHours.$inferSelect;
export type NewWorkingHour = typeof workingHours.$inferInsert;
