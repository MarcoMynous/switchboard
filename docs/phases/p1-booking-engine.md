# P1 — Booking engine (Nov 5–7)

**Goal:** the correctness core, proven by tests, before any AI or payments.

## Tasks

- [x] A: Full schema from `03-data-model.md`; hand-written SQL migration for `bookings_no_overlap` + idempotency indexes — one migration, `0004_booking_engine.sql`; constraint hand-appended at the end
- [x] A: `packages/booking`: `findSlots`, `holdSlot`, `confirm`, `expire`, `cancel`, `reschedule`, transition table — plus per-staff row lock (fixes EXCLUDE deadlocks under load, see `04-booking-engine.md` → As built), server-side validation, outbox writes
- [x] A: Inngest `hold.expire` + sweeper cron — plus `outbox-relay` (every minute) that turns outbox rows into events
- [x] A: Seed script (Fade Republic, Ota) — kept the onboarding seed; added a no-deposit `Low cut`, 12 customers, 2 weeks of history + upcoming bookings (decision: keep current + add, Nov 14)
- [x] A: Tests: property test, 100-parallel-hold test, idempotency race test, stale-hold reclaim test — plus a contention regression test; property test verified to fail with the constraint dropped
- [x] A: API routes: `GET /public/:slug`, `GET /public/:slug/slots`, `POST /public/:slug/holds` — also under `/api/public/*` for Vercel; contract in `features/F02` → API
- [x] B: Public booking page: business header, services, day strip, time chips (with no-deposit services confirming directly)
- [x] B: Hold band component (Storybook-free: a `/dev/components` page excluded from prod)
- [x] B: Better Auth sign-up/login, business onboarding wizard (name, services, staff, hours)

## Exit criteria

- `pnpm test:int` shows 100 parallel holds → 1 success, 99 `SLOT_TAKEN`
- Booking page can hold a no-deposit service end to end on preview
- `packages/booking` coverage ≥ 90%

## Exit status (A, Nov 14)

- ✅ `pnpm test:int` prints `100 parallel holds → 1 success, 99 SLOT_TAKEN`
- ✅ `packages/booking` coverage: 97.5% statements, 92% branches, 98.8% functions, 98.2% lines (`pnpm coverage:check`, gate 90%)
- ✅ Public booking page (`/b/[slug]`) wired to `GET /api/public/:slug`, `GET /api/public/:slug/slots`, and `POST /api/public/:slug/holds` (with `idempotencyKey`, `SLOT_TAKEN` alternatives, and fallback to local preview when the API origin is offline).
- ⏳ Preview deployment is blocked by the GitHub billing lock; verified locally.

**Post:** "One Postgres constraint that makes double-booking impossible" (with the test output).
