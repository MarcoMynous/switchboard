import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL set (CI: docker compose prod stack, or a preview URL) → test that server.
// Unset (local) → build and start the web app on :3000, reusing one that is already running.
const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? 'http://localhost:3000';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Lets tests through Vercel Deployment Protection when pointed at a preview.
    ...(bypass && { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypass } }),
  },
  // Our customers are on phones (docs/09-ci-cd.md); desktop catches layout regressions.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  ...(!externalBaseUrl && {
    webServer: {
      // Call next directly (on PATH via the pnpm script), not `pnpm start`: pnpm starts next in
      // its own process group, so Playwright's shutdown orphans it and the run never exits.
      // `exec` makes next-server the process Playwright owns and kills.
      command: 'next build && exec next start -p 3000',
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { SKIP_ENV_VALIDATION: '1' },
    },
  }),
});
