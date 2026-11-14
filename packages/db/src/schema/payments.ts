import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_columns.ts';
import { bookings } from './booking.ts';
import { businesses, businessPlan } from './businesses.ts';

// Shapes are fixed now so P2 (deposits) and P5 (refunds/payouts/subscriptions) only add behaviour.

export const paymentKind = pgEnum('payment_kind', ['deposit', 'subscription', 'refund', 'payout']);

/** docs/03-data-model.md → Payment state machine. I7: unknown outcome = pending_verification. */
export const paymentStatus = pgEnum('payment_status', [
  'created',
  'pending',
  'pending_verification',
  'succeeded',
  'failed',
  'expired',
  'refund_pending',
  'refunded',
  'refund_failed',
]);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'restrict' }),
    kind: paymentKind().notNull(),
    /** I6: integer kobo. Naira conversion happens only in packages/kora. */
    amountKobo: bigint({ mode: 'number' }).notNull(),
    status: paymentStatus().notNull().default('created'),
    /** Public reference sent to Kora: sb_dep_<ulid>. */
    koraReference: text().notNull().unique('payments_kora_reference_unique'),
    koraAccountNumber: text(),
    expiresAt: timestamp({ withTimezone: true }),
    verifiedAt: timestamp({ withTimezone: true }),
    rawLast: jsonb(),
    idempotencyKey: text().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_idem').on(t.businessId, t.idempotencyKey),
    index('payments_booking_id_idx').on(t.bookingId),
    check('payments_amount_positive', sql`${t.amountKobo} > 0`),
  ],
);

/** I3: every provider event applied at most once. */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: id(),
    provider: text().notNull().default('kora'),
    providerEventKey: text().notNull(),
    eventType: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex('payment_events_provider_key_uq').on(t.provider, t.providerEventKey)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    plan: businessPlan().notNull(),
    status: text().notNull(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    koraReference: text().unique('subscriptions_kora_reference_unique'),
    ...timestamps,
  },
  (t) => [index('subscriptions_business_id_idx').on(t.businessId)],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
