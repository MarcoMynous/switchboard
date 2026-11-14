import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns.ts';
import { businesses } from './businesses.ts';
import { services, staff } from './onboarding.ts';

/** docs/03-data-model.md → Booking state machine. Transitions: packages/booking/src/transitions.ts */
export const bookingStatus = pgEnum('booking_status', [
  'held',
  'confirmed',
  'expired',
  'cancelled',
  'completed',
  'no_show',
]);

export const bookingSource = pgEnum('booking_source', [
  'whatsapp',
  'web_chat',
  'booking_page',
  'staff',
]);

export const customers = pgTable(
  'customers',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** E.164, e.g. +2348031234567. One customer per phone per business. */
    phoneE164: text('phone_e164').notNull(),
    name: text(),
    notes: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    visits: integer().notNull().default(0),
    noShows: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('customers_business_phone_uq').on(t.businessId, t.phoneE164)],
);

export const timeOff = pgTable(
  'time_off',
  {
    id: id(),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    reason: text(),
    ...timestamps,
  },
  (t) => [
    index('time_off_staff_id_idx').on(t.staffId),
    check('time_off_range_valid', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

/**
 * Invariant I1 (no overlapping held/confirmed bookings per staff) is the EXCLUDE constraint
 * `bookings_no_overlap`, hand-written in the migration: Drizzle can't express it.
 * Invariant I4: `bookings_idem` unique (business_id, idempotency_key).
 */
export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: 'restrict' }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: bookingStatus().notNull(),
    /** Set while status = 'held'; Postgres now() is the clock (docs/concerns/timezones-and-time.md). */
    holdExpiresAt: timestamp({ withTimezone: true }),
    source: bookingSource().notNull(),
    idempotencyKey: text().notNull(),
    cancelReason: text(),
    /** Optimistic concurrency for staff edits / reschedules. */
    version: integer().notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('bookings_idem').on(t.businessId, t.idempotencyKey),
    index('bookings_business_starts_idx').on(t.businessId, t.startsAt),
    index('bookings_staff_starts_idx').on(t.staffId, t.startsAt),
    // Sweeper: find stale holds fast.
    index('bookings_held_expiry_idx').on(t.holdExpiresAt).where(sql`${t.status} = 'held'`),
    check('bookings_range_valid', sql`${t.endsAt} > ${t.startsAt}`),
    // Every hold ends (guarantee 3): a held row always carries its deadline.
    check('bookings_held_has_expiry', sql`${t.status} <> 'held' OR ${t.holdExpiresAt} IS NOT NULL`),
  ],
);

/** Transactional outbox: written in the same tx as the state change, relayed to Inngest. */
export const outbox = pgTable(
  'outbox',
  {
    id: id(),
    topic: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
  },
  (t) => [index('outbox_undispatched_idx').on(t.createdAt).where(sql`${t.dispatchedAt} IS NULL`)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** 'system' | 'agent' | 'staff:<id>' | 'customer:<id>' */
    actor: text().notNull(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entity, t.entityId)],
);

export const customersRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, { fields: [customers.businessId], references: [businesses.id] }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  business: one(businesses, { fields: [bookings.businessId], references: [businesses.id] }),
  staff: one(staff, { fields: [bookings.staffId], references: [staff.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type TimeOff = typeof timeOff.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type BookingSource = (typeof bookingSource.enumValues)[number];
export type OutboxRow = typeof outbox.$inferSelect;
