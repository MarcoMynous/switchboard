# P0 — Foundation (Nov 3–4)

**Goal:** an empty app that already deploys the way the final one will.

## Tasks

- [x] A: Turborepo + pnpm workspace, `packages/config` (tsconfig, biome, vitest presets)
- [x] A: `packages/env` with Zod server/client schemas; `.env.example`
- [x] A: `docker-compose.yml` (postgres, api, web, inngest, mock-kora, migrate) + Dockerfiles; `pnpm docker:up` works from clean clone
- [x] A: `apps/api` Hono hello + `/health` (checks DB) + Inngest handler mounted
- [x] A: `packages/db` Drizzle setup, first migration (`btree_gist` extension, businesses table)
- [x] A: `apps/mock-kora` skeleton with `/_control/reset` and health
- [ ] A: GitHub Actions: `ci.yml`, `preview.yml`, `production.yml`, `pr-cleanup.yml`; secrets set; branch protection on — workflows written and updated for the single Vercel project (production now deploys + smoke-tests). **Remaining (manual, GitHub settings):** add secrets from `09-ci-cd.md` (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEON_API_KEY`, `DATABASE_URL_PROD_UNPOOLED`, var `NEON_PROJECT_ID`) and turn on branch protection
- [x] A: Vercel deploy — **changed to one project with `services`** (web, api, mock-kora; root `vercel.json`) instead of two projects. Git auto-deploy disabled in root `vercel.json`. Hono entry verified live: `/api/health` → `{"status":"ok","db":"ok"}`. `/health` rewrite to api added (was 404 from web)
- [x] B: `apps/web` Next.js (bare placeholder exists so Docker boots), Tailwind v4, shadcn init, tokens from `11-frontend-design.md`, fonts
- [x] B: `/api/*` rewrite to `API_ORIGIN`
- [ ] B: Landing page placeholder scoring 100/100/100/100 in LHCI — a11y / best-practices / SEO now **100** (local LHCI, Nov 11). **Performance fails: 53–58** (needs ≥ 95). Script JS 226 KB vs 120 KB budget; TBT 4.8–12 s, with ~2 s main-thread tasks repeating every ~3 s inside React after load. Suspects: GSAP ScrollTrigger on ~30 `ScrollFloat`/`ScrollReveal` blocks (style/layout ≈ 8 s), `<Link>` prefetch of 4 routes, 1,122 DOM nodes. Local numbers were taken on a loaded machine (load avg ~10/8 cores); confirm on CI
- [x] B (done by A): Playwright + axe setup, one smoke test — `apps/web/playwright.config.ts` (mobile + desktop), `apps/web/e2e/smoke.spec.ts` (landing renders, zero WCAG 2.1 AA axe violations), root `pnpm test:e2e`; CI e2e gate removed. Fixed the contrast failures axe found (success text, secondary grey, dark-section tokens) on `/`, `/auth/*`, `/onboarding`, `/dashboard`
- [ ] Both: day-1 external tasks from `12-team-and-timeline.md`

## Exit criteria

- Clean clone → `cp .env.example .env && pnpm docker:up` → web on :3000 shows landing, api `/health` = ok
- A PR produces a preview with its own Neon branch and a Lighthouse comment
- Merge to `main` migrates Neon prod and deploys both apps

**Post:** "We switched ideas. Here's why, and here's the pipeline we built before writing a feature."
