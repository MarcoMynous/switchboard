# F02 — Public booking page

**Phase:** P1–P2 · **Owner:** B (UI), A (API)

**Story:** As a customer who found the salon on Instagram, I book and pay a deposit without chatting.

## Flow

Service → (optional) staff → day strip → time chip → name + phone → **Hold this time** → deposit card with hold band → transfer → Confirmed.

## Acceptance criteria

- [ ] Works without JavaScript up to slot selection (server-rendered); JS enhances
- [ ] Idempotency key generated on mount; double tap on "Hold this time" creates one booking
- [ ] `SLOT_TAKEN` → inline message "That time just got taken. Here are the next three." + refreshed chips
- [ ] Deposit card shows `amount_expected` exactly, account number with copy button, bank name, live countdown
- [ ] Status polling every 3s; stops on terminal state
- [ ] Expired → "Your hold ended. Pick a time again." with chips restored
- [ ] Lighthouse mobile ≥ 95 perf, 100 a11y/BP/SEO; JS ≤ 120 KB gzip
- [ ] Open Graph tags (business name, area) for WhatsApp link previews

## API (shipped in P1, `apps/api/src/routes/public.ts`)

Mounted at `/api/public/*` (what Vercel routes to the api service) and `/public/*` (direct to the api origin locally). All times are ISO 8601 UTC; display in the business `timezone`.

| Request | Success | Errors |
|---|---|---|
| `GET /api/public/:slug` | `200 { business, services[], staff[] }`. Services carry `slug` (e.g. `low-cut`), `durationMin`, `priceKobo`, `depositType`, `depositValue`. Staff carry `serviceIds`. | `404` unknown slug |
| `GET /api/public/:slug/slots?service=<id or slug>&date=YYYY-MM-DD&staff=<id>&limit=12` | `200 { date, timezone, slots: [{ startsAt, endsAt, staffIds[] }] }`. Omit `date` to get the **next day with anything free**. | `400` bad query · `404` business/service · `422 TOO_FAR_AHEAD` / `SAME_DAY_NOT_ALLOWED` / `STAFF_CANNOT_DO_SERVICE` |
| `POST /api/public/:slug/holds` body `{ serviceId, staffId?, startsAt, customer: { name, phone }, idempotencyKey }` | `201 { replayed: false, booking: { id, status, startsAt, endsAt, holdExpiresAt, staffId, serviceId } }`. `status` is `confirmed` for no-deposit services, else `held` with `holdExpiresAt`. Same key again → `200` with `replayed: true` and the same booking. | `409 { error: { code: 'SLOT_TAKEN' }, alternatives: [3 slots] }` · `409 IDEMPOTENCY_KEY_REUSED` · `400 INVALID_PHONE` / bad body · `422 OUTSIDE_WORKING_HOURS` / `TOO_SOON` |

- Omit `staffId` for "any barber": the API picks the first free one.
- `startsAt` must carry an offset or `Z`; send back a slot's `startsAt` unchanged.
- Generate `idempotencyKey` (`crypto.randomUUID()`) when the form mounts, resend it on retry, and make a **new** one after a successful hold or when the customer picks a different time (reusing it for another time returns `IDEMPOTENCY_KEY_REUSED`).
- Phone accepts any common Nigerian spelling (`0803…`, `+234 803…`); it's stored as E.164.
