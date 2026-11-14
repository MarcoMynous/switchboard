# 03 — Data model

All tables have `id uuid` (v7), `created_at`, `updated_at timestamptz`. Every business-owned table has `business_id` and every query filters on it (tenant isolation). Money is `bigint` kobo.

## Core tables

```
businesses        id, name, slug (public booking URL), vertical, timezone ('Africa/Lagos'),
                  whatsapp_phone_number_id, plan ('starter'|'pro'), kora_payout_account (json),
                  agent_enabled bool

staff             id, business_id, name, role ('owner'|'staff'), user_id (Better Auth, nullable),
                  active bool

services          id, business_id, name, duration_min, price_kobo,
                  deposit_type ('fixed'|'percent'|'none'|'full'), deposit_value,
                  free_cancel_hours, deposit_counts_toward_bill bool

staff_services    staff_id, service_id                      -- who can do what

working_hours     id, staff_id, weekday (0-6), start_local time, end_local time
time_off          id, staff_id, starts_at, ends_at, reason

customers         id, business_id, phone_e164, name, notes, tags text[],
                  visits int, no_shows int, UNIQUE (business_id, phone_e164)

bookings          id, business_id, staff_id, service_id, customer_id,
                  starts_at, ends_at, status, hold_expires_at,
                  source ('whatsapp'|'web_chat'|'booking_page'|'staff'),
                  idempotency_key, cancel_reason, version int

payments          id, business_id, booking_id, kind ('deposit'|'subscription'|'refund'|'payout'),
                  amount_kobo, status, kora_reference UNIQUE, kora_account_number,
                  expires_at, verified_at, raw_last jsonb, idempotency_key

payment_events    id, provider ('kora'), provider_event_key, event_type, payload jsonb,
                  received_at, processed_at,
                  UNIQUE (provider, provider_event_key)

conversations     id, business_id, customer_id, channel, status ('agent'|'needs_human'|'closed'),
                  last_message_at, wa_window_expires_at

messages          id, conversation_id, direction ('in'|'out'), author ('customer'|'agent'|'staff'),
                  body, provider_message_id UNIQUE (nulls allowed, dedupes WhatsApp redeliveries), tool_calls jsonb

outbox            id, topic, payload jsonb, created_at, dispatched_at, attempts
audit_log         id, business_id, actor, action, entity, entity_id, before jsonb, after jsonb
subscriptions     id, business_id, plan, status, current_period_end, kora_reference
```

## The overlap constraint (invariant I1)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('held', 'confirmed'));
```

Drizzle can't express this, so it is hand-appended to the end of `packages/db/sql/0004_booking_engine.sql` (the one migration of P1; re-append it after any regenerate). `migrate.int.test.ts` asserts the constraint exists, and the property test was checked to *fail* when it is dropped.

Also enforced in 0004: `bookings_held_has_expiry` (a `held` row always has `hold_expires_at`), `ends_at > starts_at`, and a partial index on `hold_expires_at WHERE status = 'held'` for the sweeper. Customers' phone column is `phone_e164`.

## Idempotency indexes (invariant I4)

```sql
CREATE UNIQUE INDEX bookings_idem ON bookings (business_id, idempotency_key);
CREATE UNIQUE INDEX payments_idem ON payments (business_id, idempotency_key);
```

## State machines

### Booking

```
            hold_slot
   (none) ───────────▶ held ──── payment verified ──▶ confirmed ──▶ completed
                        │                               │   │
             expiry job │                 staff cancel  │   │ customer no-show
                        ▼                               ▼   ▼
                     expired                       cancelled  no_show
                                                  (refund?)  (deposit kept)
   service with deposit_type='none': hold_slot → confirmed directly
```

Allowed transitions live in `packages/booking/src/transitions.ts` as a table. Every update is `UPDATE … WHERE id = $1 AND status = $expected` and checks `rowCount = 1`.

### Payment

```
 created ─▶ pending ─▶ succeeded
              │  └──▶ pending_verification ─(reconcile)─▶ succeeded | failed
              ├────▶ failed
              └────▶ expired
 succeeded ─▶ refund_pending ─▶ refunded | refund_failed
```

## Seed data

`pnpm db:seed` creates **Fade Republic, Ota**: 3 barbers, 1 stylist, services (Low cut ₦3,000 / 30m / ₦1,000 deposit; Beard sculpt ₦2,500; Braids ₦15,000 / 180m / 30% deposit; Dreadlock retwist ₦10,000), working hours Mon–Sat 9:00–20:00, 2 weeks of realistic past bookings and customers for the CRM and money dashboard.
