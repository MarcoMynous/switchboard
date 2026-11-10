# Switchboard

<p align="center">
  <img src="./apps/web/public/switchboard-logo.svg" alt="Switchboard Logo" width="320" />
</p>

**AI booking agent for Nigerian salons and barbers — on WhatsApp and web chat.**  
Books real staff slots, holds appointments for 15 minutes, collects a **Kora** deposit to stop no-shows, and **never confirms a booking it cannot prove**.

- **Live Deployment (Vercel):** [https://switchboard-bm.vercel.app/](https://switchboard-bm.vercel.app/)
- **Repository:** [https://github.com/MarcoMynous/switchboard](https://github.com/MarcoMynous/switchboard)

> Built for the **Korabytes "Build in Public" Challenge** · Covenant University × Kora · Nov 2026

---

## Live Routes

| Route | Description |
|-------|-------------|
| [`/`](https://switchboard-bm.vercel.app/) | Marketing landing page with interactive AI-to-Kora booking walkthrough |
| [`/auth/signin`](https://switchboard-bm.vercel.app/auth/signin) | Passwordless magic-link & Google enterprise sign-in |
| [`/onboarding`](https://switchboard-bm.vercel.app/onboarding) | 6-step responsive onboarding wizard (Desktop split-card & Mobile single-column) |
| [`/dashboard`](https://switchboard-bm.vercel.app/dashboard) | Booking-first business operations dashboard, dynamic setup checklist, live hold band & web chat |
| [`/b/fade-republic`](https://switchboard-bm.vercel.app/b/fade-republic) | Public customer booking page with service/staff selection & 15-minute Kora deposit hold |

---

## Core Capabilities & Non-Negotiable Invariants

1. **Zero Double-Bookings (`I1`):** Staff slot exclusivity is enforced at the database level via PostgreSQL `EXCLUDE USING gist` on `(staff_id, tstzrange(starts_at, ends_at, '[)'))`.
2. **Backend-Verified Kora Deposits (`I2`, `I3`):** A booking transitions from `held` to `confirmed` only after a signed Kora `charge.success` webhook **and** an independent Kora transaction status re-query. Every Kora event is applied at most once (`UNIQUE (provider, provider_event_key)`).
3. **Truthful AI Receptionist (`I4`, `I5`):** Every write tool call is idempotent, and the assistant never claims a slot is confirmed unless the database row is `confirmed`.
4. **Integer Kobo Precision (`I6`, `I7`):** All monetary values are stored in integer kobo (`bigint`). Unknown provider outcomes are stored as `pending_verification`, never assumed successful or failed.

---

## Monorepo Structure

```text
apps/
  web/          Next.js 16 App Router — landing page, auth, 6-step onboarding, dashboard, /b/[slug]
  api/          Hono API — health, webhooks (Kora, WhatsApp), Better Auth, Inngest handler
  mock-kora/    Local fake Kora server with HMAC webhook signing & chaos controls
packages/
  db/           Drizzle ORM schema, SQL migrations (btree_gist), and seed scripts
  env/          Zod environment validation (server / client split)
  config/       Shared TypeScript, Biome, and Vitest configurations
```

---

## Quick Start (Local Development)

```bash
git clone https://github.com/MarcoMynous/switchboard.git
cd switchboard
cp .env.example .env          # local values point at Docker services
pnpm install
pnpm docker:up                # postgres, api, web, inngest dev server, mock-kora
pnpm db:migrate && pnpm db:seed
open http://localhost:3000    # web app
open http://localhost:8288    # Inngest dev UI
open http://localhost:4010    # mock Kora control panel
```

### Verification Commands

```bash
pnpm format                   # Biome format & import sort
pnpm lint                     # Biome lint & a11y checks
pnpm typecheck                # TypeScript strict check across all workspaces
pnpm test                     # Vitest unit test suite
pnpm --filter @switchboard/web build
```

---

## Documentation

Start at [`AGENTS.md`](./AGENTS.md), then [`docs/00-overview.md`](./docs/00-overview.md).

| Doc | What it covers |
|-----|----------------|
| [`00-overview`](./docs/00-overview.md) | Problem, pitch, locked decisions |
| [`01-architecture`](./docs/01-architecture.md) | System diagram, request flows |
| [`02-tech-stack`](./docs/02-tech-stack.md) | Every library and why |
| [`03-data-model`](./docs/03-data-model.md) | Tables, constraints, state machines |
| [`04-booking-engine`](./docs/04-booking-engine.md) | Holds, overlap prevention, idempotency |
| [`05-kora-integration`](./docs/05-kora-integration.md) | Deposits, webhooks, refunds, payouts, billing |
| [`06-ai-agent`](./docs/06-ai-agent.md) | Tools, prompts, guardrails |
| [`07-whatsapp`](./docs/07-whatsapp.md) | Meta Cloud API, 24h window, templates |
| [`08-environments-and-docker`](./docs/08-environments-and-docker.md) | Local Docker vs preview vs prod |
| [`09-ci-cd`](./docs/09-ci-cd.md) | GitHub Actions, Neon branches, Vercel deploys |
| [`10-testing-strategy`](./docs/10-testing-strategy.md) | Unit → integration → e2e → Lighthouse → k6 → chaos |
| [`11-frontend-design`](./docs/11-frontend-design.md) | Visual identity, tokens, copy rules |
| [`12-team-and-timeline`](./docs/12-team-and-timeline.md) | Who does what, by when |
| [`13-pitch-and-build-in-public`](./docs/13-pitch-and-build-in-public.md) | Showcase script, posting plan |

`docs/phases/` — build order · `docs/features/` — feature specs · `docs/concerns/` — known failure modes
