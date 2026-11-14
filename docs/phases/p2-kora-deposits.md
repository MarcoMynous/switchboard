# P2 — Kora deposits (Nov 7–9)

**Goal:** a held slot becomes confirmed only after a verified Kora payment.

## Tasks

- [ ] A: `packages/kora`: client, amount conversion, signature verify, typed responses (Zod)
- [ ] A: `POST /webhooks/kora` handler (verify → dedupe insert → Inngest → 200)
- [ ] A: Inngest `kora/event.received`: re-verify via transaction query, confirm / underpaid / overpaid / pending_verification
- [ ] A: Reconciliation cron (every 10 min) for `pending` and `pending_verification`
- [ ] A: Late-payment path (slot gone → auto refund; slot free → confirm) — see concern
- [ ] A: mock-kora: bank-transfer charge, transaction query, signed webhooks, `/_control/pay`, chaos mode
- [ ] A: Test with a captured real Kora sandbox webhook payload (signature correctness)
- [x] B: Deposit card: bank, account number (copy button), exact amount to transfer, hold band, live status (poll every 3s, stop on terminal)
- [x] B: Confirmed / expired / underpaid states on booking page
- [x] B: Owner settings: deposit rule per service, free-cancel window, who bears the Kora fee

## Exit criteria

- On preview: hold → Kora sandbox account → sandbox credit → page flips to Confirmed within 10s
- Duplicate webhook replay (×5) → one confirmation, one `payment_events` row
- Webhook with bad signature → ignored, logged

**Post:** "We don't trust the payment webhook — here's why and what we do instead."
