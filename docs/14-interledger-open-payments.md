# 14 — Interledger Open Payments Integration & Production Readiness

## 1. Architecture Summary

Switchboard supports **Interledger Open Payments** alongside **Kora** using a single booking engine (`packages/booking`) and provider-aware payment records (`payments` + `open_payments_attempts`).

- **Protocol package:** `packages/open-payments` wraps `@interledger/open-payments` (`v7.4.0`).
- **SSRF protection:** All wallet address inputs are normalized (`$host/path` → `https://host/path`), restricted to `https:`, and DNS-checked to block loopback, private, link-local, and cloud metadata IPs (`169.254.169.254`).
- **Cryptographic security:**
  - Client requests are signed server-side via `createAuthenticatedClient` using an Ed25519 key pair (`OPEN_PAYMENTS_KEY_ID` + `OPEN_PAYMENTS_PRIVATE_KEY_PEM`).
  - Persisted GNAP continuation & outgoing access tokens are encrypted at rest with AES-256-GCM (`OPEN_PAYMENTS_TOKEN_ENCRYPTION_KEY`).
  - Callback state tokens are single-use (`auth_nonce_hash` cleared upon continuation) and verified against the GNAP interaction hash.
- **Independent verification:** Switchboard never confirms a booking on browser redirect alone. After `outgoingPayment.create`, Switchboard independently queries the recipient's `incomingPayment` resource (via immediate check + durable Inngest `interledger/payment.verify` + 5-minute `interledger-reconcile` cron) and confirms the booking inside a Postgres transaction only when `receivedAmount >= expectedAmount`.

---

## 2. Testnet Setup (`wallet.interledger-test.dev`)

1. Create two accounts on [https://wallet.interledger-test.dev](https://wallet.interledger-test.dev):
   - **Business receiving wallet** (e.g. `https://ilp.interledger-test.dev/fade-republic`)
   - **Customer sending wallet** (e.g. `https://ilp.interledger-test.dev/alice`) with test funds.
2. In the business/client wallet settings on `wallet.interledger-test.dev`, generate or upload an **Ed25519 key pair** and copy the **Key ID** and **Private Key PEM**.
3. Set server-only environment variables in `.env`:
   - `OPEN_PAYMENTS_ENABLED=true`
   - `OPEN_PAYMENTS_ENV=testnet`
   - `OPEN_PAYMENTS_PRODUCTION_APPROVED=false`
   - `OPEN_PAYMENTS_CLIENT_WALLET_ADDRESS=https://ilp.interledger-test.dev/<your-client-wallet>`
   - `OPEN_PAYMENTS_KEY_ID=<your-key-id>`
   - `OPEN_PAYMENTS_PRIVATE_KEY_PEM="<pem-contents>"`
   - `OPEN_PAYMENTS_TOKEN_ENCRYPTION_KEY=<32+-char-random-secret>`
4. In Switchboard Dashboard → **Integrations**, enter the business receiving wallet address, enable Interledger Wallet payments, save, and click **Test connection**.
5. All testnet transactions are marked `is_simulated = true` in `payments` and displayed with **Testnet · Simulated Money** badges in the checkout and Payments dashboard.

---

## 3. Real-Money Production Readiness Evaluation

Production Open Payments (`OPEN_PAYMENTS_ENV=production`) is **explicitly gated and disabled** by `OPEN_PAYMENTS_PRODUCTION_APPROVED=false` in both `packages/env` and API/dashboard guards.

### Requirements Before Enabling Live Funds
1. **Live Open Payments ASE / Wallet Provider:** Partner with a regulated Account Servicing Entity (ASE) running Rafiki / Open Payments in production (e.g., GateHub, Chimoney, or a licensed Nigerian/African PSP supporting Open Payments).
2. **Geography, Currency & Settlement:** Verify supported jurisdictions, whether NGN settlement is supported directly or requires an explicit FX quote/settlement rail, settlement finality SLA, and transaction fee schedule.
3. **Business Onboarding & Compliance (KYB/KYC):** Complete merchant KYB, beneficial-owner verification, sanctions screening, and key registration on the production ASE.
4. **Refunds & Reversals:** Open Payments does not provide a generic Kora-style pull refund endpoint (`POST /api/v1/refunds/initiate`). Automated refunds require either a provider-specific repayment API or an explicitly authorized compensating outgoing payment from the business wallet with recipient verification, limits, and audit controls. Until automated repayment is verified with the live ASE, late payments and overpayments are routed to human review (`LATE_PAYMENT_NEEDS_RECOVERY` / `OVERPAID_SURPLUS_REVIEW`).
5. **Security & Incident Response:** Rotate production Ed25519 keys via KMS/HSM, separate production and testnet credentials/databases, and establish incident response runbooks for stuck grants or settlement discrepancies.
