# P1 — Booking engine (Nov 5–7)

**Goal:** the correctness core, proven by tests, before any AI or payments.

## Tasks

- [ ] A: Full schema from `03-data-model.md`; hand-written SQL migration for `bookings_no_overlap` + idempotency indexes
- [ ] A: `packages/booking`: `findSlots`, `holdSlot`, `confirm`, `expire`, `cancel`, `reschedule`, transition table
- [ ] A: Inngest `hold.expire` + sweeper cron
- [ ] A: Seed script (Fade Republic, Ota)
- [ ] A: Tests: property test, 100-parallel-hold test, idempotency race test, stale-hold reclaim test
- [ ] A: API routes: `GET /public/:slug`, `GET /public/:slug/slots`, `POST /public/:slug/holds`
- [x] B: Public booking page: business header, services, day strip, time chips (with no-deposit services confirming directly)
- [x] B: Hold band component (Storybook-free: a `/dev/components` page excluded from prod)
- [x] B: Better Auth sign-up/login, business onboarding wizard (name, services, staff, hours)

## Exit criteria

- `pnpm test:int` shows 100 parallel holds → 1 success, 99 `SLOT_TAKEN`
- Booking page can hold a no-deposit service end to end on preview
- `packages/booking` coverage ≥ 90%

**Post:** "One Postgres constraint that makes double-booking impossible" (with the test output).
