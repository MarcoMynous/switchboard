# 09 — CI/CD

GitHub Actions is the only thing that deploys. Vercel Git auto-deploy is **disabled** (root `vercel.json → "git": { "deploymentEnabled": false }`).

## One Vercel project, three services

We deploy **one** Vercel project from the repo root. Root `vercel.json` declares Vercel `services`:

| Service | Root | Reached at |
|---------|------|-----------|
| `web` | `apps/web` (Next.js) | everything not matched below |
| `api` | `apps/api` (Hono, entry `src/index.ts`) | `/api/*` (except `/api/auth/*` → web), `/health`, `/webhooks/*` |
| `mock-kora` | `apps/mock-kora` (Hono) | internal only, bound into `api` as `MOCK_KORA_URL` |

`API_ORIGIN` (web) and `MOCK_KORA_URL` (api) come from service bindings, not hand-set env vars. Because web and api share a domain, a preview or prod deployment has **one URL**; the API is that URL + `/api/...`.

`apps/web/vercel.json` and `apps/api/vercel.json` are leftovers from the earlier two-project plan. Remove them only after confirming a services build doesn't read them.

> mock-kora is deployed today only because the services config includes it. Before P2, decide whether to drop it from prod: production `KORA_BASE_URL` must point at real Kora, never at mock-kora (I2).

## Pipeline

```
PR opened / pushed                                        merge to main
─────────────────                                         ─────────────
ci.yml                                                    production.yml
 ├─ install (pnpm, turbo cache)                            ├─ same quality gates (fast, cached)
 ├─ lint (biome) · typecheck · knip                        ├─ drizzle migrate → Neon main (unpooled URL)
 ├─ unit tests (vitest + coverage)                         ├─ vercel deploy --prod  (one project: web + api)
 ├─ integration tests (service: postgres:17 + mock-kora)   └─ smoke: /, /health, /api/health (db ok)
 ├─ build all apps
 └─ e2e (playwright vs docker compose stack)
        │
preview.yml (needs ci)
 ├─ create Neon branch  pr-<n>   (neondatabase/create-branch-action)
 ├─ drizzle migrate → branch
 ├─ seed demo business
 ├─ vercel pull/build/deploy  (one project, DATABASE_URL=branch; API_ORIGIN via service binding)
 ├─ lighthouse CI against preview URLs (fails PR under budget)
 ├─ k6 smoke (light, 1 min) against preview
 └─ PR comment: preview links + Lighthouse scores + k6 p95

pr-cleanup.yml  (PR closed) → delete Neon branch pr-<n>

load.yml  (manual workflow_dispatch + nightly) → full k6 + chaos suite against docker stack in CI
```

## Required GitHub secrets

| Secret | Use |
|--------|-----|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID` | Vercel CLI |
| `VERCEL_PROJECT_ID` | The single services project (web + api + mock-kora) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Lets Lighthouse/k6 reach protected preview URLs (`x-vercel-protection-bypass` header) |
| `NEON_API_KEY`, `NEON_PROJECT_ID` (var) | Branch create/delete |
| `DATABASE_URL_PROD_UNPOOLED` | Prod migrations only |
| `TURBO_TOKEN`, `TURBO_TEAM` (var) | Remote cache |
| `LHCI_GITHUB_APP_TOKEN` (optional) | Lighthouse status checks |
| `PROD_URL` (var, optional) | Smoke-test target; defaults to `https://switchboard-bm.vercel.app` |

Deploy jobs fail with a clear error if `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` are missing, so add them **before** merging the change that turns off git auto-deploy.

Production runtime secrets (Kora, WhatsApp, LLM, Better Auth) live **only in Vercel** env, not GitHub.

## Branch protection on `main`

- Require PR, 1 approval (the other teammate)
- Required checks: `preview / ci / quality`, `preview / ci / integration`, `preview / ci / e2e`, `preview / lighthouse`
- `ci.yml` is a reusable workflow (`workflow_call` only) — called by `preview.yml` on PRs and `production.yml` on `main`, so it runs once per event and deploys always wait for it

## Webhooks on preview deployments

Vercel Deployment Protection blocks unauthenticated requests to previews — including Kora's webhooks. Fix:

- Kora: each charge sets its own `notification_url`, so preview charges use `${API_PREVIEW_URL}/webhooks/kora?x-vercel-protection-bypass=${VERCEL_AUTOMATION_BYPASS_SECRET}`. Webhooks reach the right preview and its Neon branch.
- Meta WhatsApp has **one** webhook URL per app → point it at production only. Test WhatsApp on preview with `pnpm wa:simulate --target <preview-url>`.
- Linear history (squash merge), conventional commit titles

## Migration safety

- Forward-only, additive first (expand → migrate code → contract in a later PR).
- `production.yml` migrates **before** deploying, so new code never runs on an old schema. Old code must tolerate the new schema (that's why additive-first).
- Preview branches let you test the migration on a copy of prod schema before merge.

## Lighthouse budgets (`lighthouserc.cjs`)

| Category | Minimum |
|----------|---------|
| Performance | 0.95 |
| Accessibility | 1.0 |
| Best practices | 1.0 |
| SEO | 1.0 (public pages only) |

Plus resource budgets: LCP ≤ 2.0s, CLS ≤ 0.02, TBT ≤ 150ms, JS on booking page ≤ 120 KB gzip. Pages: `/` landing, `/b/fade-republic` booking page, `/b/fade-republic/chat`, `/login` — each added to `lighthouserc.cjs` (and `load/k6/smoke.js`) in the PR that ships it, so the gate never audits a 404. Authenticated dashboard pages are audited in Playwright with a logged-in storage state (accessibility + basic perf), not LHCI.

Tested with mobile emulation + simulated slow 4G, because that's our customers' reality.
