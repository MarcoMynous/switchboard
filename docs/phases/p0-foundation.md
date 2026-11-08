# P0 — Foundation (Nov 3–4)

**Goal:** an empty app that already deploys the way the final one will.

## Tasks

- [x] A: Turborepo + pnpm workspace, `packages/config` (tsconfig, biome, vitest presets)
- [x] A: `packages/env` with Zod server/client schemas; `.env.example`
- [x] A: `docker-compose.yml` (postgres, api, web, inngest, mock-kora, migrate) + Dockerfiles; `pnpm docker:up` works from clean clone
- [x] A: `apps/api` Hono hello + `/health` (checks DB) + Inngest handler mounted
- [x] A: `packages/db` Drizzle setup, first migration (`btree_gist` extension, businesses table)
- [x] A: `apps/mock-kora` skeleton with `/_control/reset` and health
- [ ] A: GitHub Actions: `ci.yml`, `preview.yml`, `production.yml`, `pr-cleanup.yml`; secrets set; branch protection on — workflows written; needs GitHub remote, secrets, branch protection
- [ ] A: Two Vercel projects (root dirs `apps/web`, `apps/api`), git auto-deploy disabled — `vercel.json` copied into both apps; projects not created yet. Verify Vercel picks up `apps/api/src/index.ts` as the Hono entry on first deploy
- [x] B: `apps/web` Next.js (bare placeholder exists so Docker boots), Tailwind v4, shadcn init, tokens from `11-frontend-design.md`, fonts
- [x] B: `/api/*` rewrite to `API_ORIGIN`
- [x] B: Landing page placeholder scoring 100/100/100/100 in LHCI
- [x] B: Playwright + axe setup, one smoke test
- [ ] Both: day-1 external tasks from `12-team-and-timeline.md`

## Exit criteria

- Clean clone → `cp .env.example .env && pnpm docker:up` → web on :3000 shows landing, api `/health` = ok
- A PR produces a preview with its own Neon branch and a Lighthouse comment
- Merge to `main` migrates Neon prod and deploys both apps

**Post:** "We switched ideas. Here's why, and here's the pipeline we built before writing a feature."
