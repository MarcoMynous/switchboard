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
| `API_ORIGIN` | `http://api:4000` | Vercel env (web project) |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Vercel env |
| `BETTER_AUTH_SECRET` | any 32+ chars | Vercel env |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Vercel env |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Gmail SMTP credentials for Better Auth magic links | Vercel env |
| `KORA_BASE_URL` | `http://mock-kora:4010/merchant` | `https://api.korapay.com/merchant` |
| `KORA_SECRET_KEY` | `sk_test_local_mock` | Vercel env (sandbox key) |
| `KORA_PUBLIC_KEY` | `pk_test_local_mock` | Vercel env |
| `WA_API_BASE_URL` | `http://mock-kora:4010/_wa` | `https://graph.facebook.com/v<ver>` |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` | dummy | Vercel env |
| `INNGEST_DEV` | `1` | unset |
| `INNGEST_BASE_URL` | `http://inngest:8288` | unset |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | unset | Vercel env (via Inngest Vercel integration) |
| `LLM_PROVIDER`, `LLM_MODEL`, provider API key | your key or `mock` | Vercel env |
| `HOLD_MINUTES` | `15` (`2` handy for testing) | `15` |

## Docker Compose (local)

See `docker-compose.yml`. Services:

| Service | Port | Notes |
|---------|------|-------|
| `postgres` | 5432 | `postgres:17-alpine`, healthcheck, `btree_gist` created by migration |
| `api` | 4000 | Hono via `tsx watch`, source bind-mounted |
| `web` | 3000 | `next dev`, source bind-mounted |
| `inngest` | 8288 | `inngest/inngest` dev server pointed at `http://api:4000/api/inngest` |
| `mock-kora` | 4010 | Fake Kora + WhatsApp stub + chaos controls |
| `migrate` | — | One-shot: runs `db:migrate` then exits; `api` waits for it |
| `k6` | — | profile `load` only |
| `lhci` | — | profile `quality` only |

Hot reload: source is bind-mounted; `node_modules` lives in a named volume per app so host and container don't fight.

```bash
pnpm docker:up                          # docker compose up -d --build
docker compose logs -f api
docker compose --profile load run --rm k6 run /scripts/booking-contention.js
docker compose exec api pnpm test:int
```

## Regions

No Vercel or Neon region in Africa. Use **Neon `aws-eu-central-1` (Frankfurt)** + **Vercel `fra1`** so functions and DB sit together (~1ms apart; Lagos → Frankfurt ≈ 90–120ms). `infra/vercel/*.vercel.json` are copied to `apps/web/vercel.json` and `apps/api/vercel.json` during P0 scaffolding.

## Production-like local check

`docker compose -f docker-compose.yml -f docker-compose.prod.yml up` builds `next build` + compiled API and runs them with `NODE_ENV=production` — use this for local Lighthouse runs (dev mode scores are meaningless).
