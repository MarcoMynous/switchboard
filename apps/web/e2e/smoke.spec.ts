import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Smoke: public pages render and have zero axe violations (WCAG 2.1 A/AA).
// Add a page here as it ships, alongside lighthouserc.cjs and load/k6/smoke.js.
const publicPages = ['/', '/b/fade-republic'];

test.describe('landing page', () => {
  test('renders the hero', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Switchboard/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('front desk');
  });
});

for (const path of publicPages) {
  test(`${path} has no accessibility violations`, async ({ page }) => {
    // Audit the settled page. Mid-animation text is semi-transparent, which makes
    // axe's colour-contrast check flaky; ScrollFloat/ScrollReveal skip motion under this.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    // Not 'networkidle': some pages poll, so the network never goes quiet.
    await page.waitForLoadState('load');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    // One line per failing element, so a failure reads like a to-do list.
    const problems = results.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(' ')} — ${n.failureSummary}`),
    );
    expect(problems).toEqual([]);
  });
}
