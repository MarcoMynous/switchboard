import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import { bookings } from './booking.ts';
import { businesses, businessPlan } from './businesses.ts';

// Shapes are fixed now so P2 (deposits) and P5 (refunds/payouts/subscriptions) only add behaviour.

export const paymentProvider = pgEnum('payment_provider', ['kora', 'interledger']);

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

export const openPaymentsGrantState = pgEnum('open_payments_grant_state', [
  'created',
  'incoming_created',
  'quoted',
  'awaiting_authorization',
  'authorized',
  'outgoing_created',
  'verified',
  'failed',
  'expired',
]);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'restrict' }),
    provider: paymentProvider().notNull().default('kora'),
    providerEnvironment: text().notNull().default('sandbox'),
    providerReference: text(),
    kind: paymentKind().notNull(),
    /** I6: integer kobo. Naira conversion happens only in packages/kora. */
    amountKobo: bigint({ mode: 'number' }).notNull(),
    assetCode: text().notNull().default('NGN'),
    assetScale: integer().notNull().default(2),
    providerExpectedAmount: text(),
    providerReceivedAmount: text(),
    isSimulated: boolean().notNull().default(false),
    status: paymentStatus().notNull().default('created'),
    /** Public reference sent to Kora: sb_dep_<ulid>. Nullable for non-Kora providers. */
    koraReference: text().unique('payments_kora_reference_unique'),
    koraAccountNumber: text(),
    expiresAt: timestamp({ withTimezone: true }),
    verifiedAt: timestamp({ withTimezone: true }),
    rawLast: jsonb(),
    idempotencyKey: text().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('payments_idem').on(t.businessId, t.idempotencyKey),
    uniqueIndex('payments_provider_ref_uq').on(t.provider, t.providerReference),
    index('payments_booking_id_idx').on(t.bookingId),
    check('payments_amount_positive', sql`${t.amountKobo} > 0`),
  ],
);

export const openPaymentsAttempts = pgTable(
  'open_payments_attempts',
  {
    id: id(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' })
      .unique('open_payments_attempts_payment_id_uq'),
    businessId: uuid()
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: 'restrict' }),
    senderWalletAddress: text().notNull(),
    recipientWalletAddress: text().notNull(),
    incomingPaymentId: text(),
    quoteId: text(),
    outgoingPaymentId: text(),
    quoteDebitAmount: text(),
    quoteDebitAssetCode: text(),
    quoteDebitAssetScale: integer(),
    quoteReceiveAmount: text(),
    quoteExpiresAt: timestamp({ withTimezone: true }),
    grantState: openPaymentsGrantState().notNull().default('created'),
    authNonceHash: text(),
    interactNonce: text(),
    continueUri: text(),
    continueAccessTokenEnc: text(),
    outgoingAccessTokenEnc: text(),
    lastErrorCode: text(),
    lastErrorMessage: text(),
    expiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('open_payments_attempts_auth_nonce_uq').on(t.authNonceHash),
    uniqueIndex('open_payments_attempts_incoming_id_uq').on(t.incomingPaymentId),
    index('open_payments_attempts_booking_id_idx').on(t.bookingId),
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
export type PaymentProvider = (typeof paymentProvider.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type OpenPaymentsAttempt = typeof openPaymentsAttempts.$inferSelect;
export type NewOpenPaymentsAttempt = typeof openPaymentsAttempts.$inferInsert;
export type OpenPaymentsGrantState = (typeof openPaymentsGrantState.enumValues)[number];
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
