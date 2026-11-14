// Lighthouse CI — budgets enforced on every PR (preview) and after prod deploy.
// LHCI_BASE_URL: preview/prod web URL (CI) or http://web:3000 (docker profile "quality").
// VERCEL_AUTOMATION_BYPASS_SECRET: lets LHCI through Vercel preview protection.
const base = process.env.LHCI_BASE_URL ?? 'http://localhost:3000';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Only pages that exist. Add as they land: '/b/fade-republic' (P2), '/b/fade-republic/chat' (P3), '/login' (P4).
const pages = ['/'];

module.exports = {
  ci: {
    collect: {
      url: pages.map((p) => base + p),
      numberOfRuns: 3, // median of 3 to smooth noise
      settings: {
        // No `preset`: Lighthouse's default IS mobile emulation + slow 4G, which is our customers'
        // reality. ('mobile' is not a valid preset; the choices are perf | experimental | desktop.)
        throttlingMethod: 'simulate',
        ...(bypass && {
          extraHeaders: JSON.stringify({ 'x-vercel-protection-bypass': bypass }),
        }),
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 1 }],
        'categories:seo': ['error', { minScore: 1 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
        'total-blocking-time': ['error', { maxNumericValue: 150 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 120000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // gives a shareable report link for the PR comment
    },
  },
};
