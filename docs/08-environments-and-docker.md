# 08 — Environments and Docker

## Three environments

| | Local | Preview (every PR) | Production (`main`) |
|---|---|---|---|
| Runs on | Docker Compose on your laptop | Vercel preview deploys (web + api) | Vercel production (web + api) |
| Database | `postgres:17` container | **Neon branch** `pr-<number>` off `main` | Neon `main` branch |
| Kora | `mock-kora` container | Kora **sandbox** (`sk_test_`) | Kora sandbox until after the showcase → then live |
| WhatsApp | Simulator + stub | Meta test number | Meta test number (demo) |
| Inngest | Dev server container | Inngest Cloud, branch environment | Inngest Cloud, production |
| LLM | Real key from `.env` (or mock) | Real provider | Real provider |
| Env values come from | `.env` (copied from `.env.example`) | Vercel **Preview** env + CI-injected `DATABASE_URL` | Vercel **Production** env |

Rule: **local never touches Neon or real Kora; preview never touches prod Neon; only GitHub Actions writes to prod Neon (migrations).**

## Env vars

All validated in `packages/env` (Zod). App crashes at boot with a clear message if any are missing.

| Var | Local value | Where set for preview/prod |
|-----|-------------|---------------------------|
| `DATABASE_URL` | `postgres://switchboard:switchboard@postgres:5432/switchboard` | prod: Vercel Production env (Neon pooled URL). preview: injected by CI from Neon branch |
| `POSTGRES_HOST_PORT` | `5432` (compose host port only; change if taken) | not used |
| `DATABASE_URL_UNPOOLED` | same as above | GitHub secret (migrations need direct connection) |
| `API_ORIGIN` | `http://api:4000` | Vercel service binding (`web` → `api`), see root `vercel.json` |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Vercel env |
| `PUBLIC_API_URL` | `http://localhost:4000` | not needed (one Vercel domain); fallback for mock-kora's webhook target |
| `NEXT_PUBLIC_APP_URL` | unset (optional) | Vercel env, only if a client component needs the app URL. The only client-side var (I8) |
| `BETTER_AUTH_SECRET` | any 32+ chars | Vercel env |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Vercel env |
| `KORA_BASE_URL` | `http://mock-kora:4010/merchant` | `https://api.korapay.com/merchant` |
| `KORA_SECRET_KEY` | `sk_test_local_mock` | Vercel env (sandbox key) |
| `KORA_PUBLIC_KEY` | `pk_test_local_mock` | Vercel env |
| `WA_API_BASE_URL` | `http://mock-kora:4010/_wa` | `https://graph.facebook.com/v<ver>` |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` | dummy | Vercel env |
| `INNGEST_DEV` | `1` | unset |
| `INNGEST_BASE_URL` | `http://inngest:8288` | unset |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | unset | Vercel env (via Inngest Vercel integration) |
| `LLM_PROVIDER`, `LLM_MODEL` | `mock`, empty | Vercel env. `LLM_MODEL` required unless `mock` |
| `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `GROQ_API_KEY` | empty | Vercel env: only the one matching `LLM_PROVIDER` is required |
| `HOLD_MINUTES` | `15` (`2` handy for testing) | `15` |
| `MIN_LEAD_MINUTES` | `30` | `30` (earliest bookable slot from now) |
| `SLOT_STEP_MINUTES` | `15` | `15` (slot grid spacing) |
| `CHAOS_TOKEN` | `local-chaos` | Vercel env (optional): guards chaos controls |
| `PORT` | set per service in compose (api `4000`, mock-kora `4010`) | set by Vercel |
| `WEBHOOK_TARGET`, `WA_WEBHOOK_TARGET` | compose: `http://api:4000/webhooks/kora` / `.../whatsapp` | mock-kora only: where it sends signed webhooks |

## Docker Compose (local)

See `docker-compose.yml`. Services:

| Service | Port | Notes |
|---------|------|-------|
| `postgres` | 5432 | `postgres:17-alpine`, healthcheck, `btree_gist` created by migration |
| `api` | 4000 | Hono via `tsx watch`, source bind-mounted |
| `web` | 3000 | `next dev`, source bind-mounted |
| `inngest` | 8288 | `inngest/inngest` dev server pointed at `http://api:4000/api/inngest` |
| `mock-kora` | 4010 | Fake Kora + WhatsApp stub + chaos controls |
| `deps` | — | One-shot: `pnpm install --frozen-lockfile --prefer-offline` into the shared `node_modules` volumes; `migrate` and `mock-kora` wait for it |
| `migrate` | — | One-shot: runs `db:migrate` then exits; `api` waits for it |
| `k6` | — | profile `load` only |
| `lhci` | — | profile `quality` only |

Hot reload: source is bind-mounted; `node_modules` lives in a named volume per package so host and container don't fight.

Those volumes are seeded from the image only the first time they're created, so after a dependency change they go stale. The `deps` service brings them up to date once before anything else starts (it needs the network only for packages that changed). If they ever get into a bad state: `docker compose down && docker volume rm $(docker volume ls -q | grep '^switchboard_.*node_modules')`.

Port 5432 taken by another project? Set `POSTGRES_HOST_PORT=5433` in `.env`. Containers still talk to `postgres:5432`; only host tools use the new port.

```bash
pnpm docker:up                          # docker compose up -d --build
docker compose logs -f api
docker compose --profile load run --rm k6 run /scripts/booking-contention.js
docker compose exec api pnpm test:int
```

## Regions

No Vercel or Neon region in Africa. Use **Neon `aws-eu-central-1` (Frankfurt)** + **Vercel `fra1`** so functions and DB sit together (~1ms apart; Lagos → Frankfurt ≈ 90–120ms). Region is set in the root `vercel.json` (one project, `services` for web/api/mock-kora; see `09-ci-cd.md`).

## Production-like local check

`docker compose -f docker-compose.yml -f docker-compose.prod.yml up` builds `next build` + compiled API and runs them with `NODE_ENV=production` — use this for local Lighthouse runs (dev mode scores are meaningless).
