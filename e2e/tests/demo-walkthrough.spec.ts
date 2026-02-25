import { test, expect, Page } from '@playwright/test';

/**
 * Generic app walkthrough that tells a story:
 *   Morning dashboard → check projects → review a daily report →
 *   check billing → review WIP → admin health check → back to dashboard
 *
 * Each page pauses 2-3 seconds so viewers can read the screen.
 * Playwright records the entire session as a .webm video.
 */

const PAUSE = 2500; // ms — time to let each page render and be visible

/**
 * Navigate to a URL and wait for it to settle. If headingText is provided,
 * waits for a matching h1/h2/h3 heading to confirm the page loaded.
 *
 * Uses getByRole('heading') which is resilient to class/tag changes.
 * If the heading check fails (e.g. page layout changed), the test still
 * continues after the timeout — the video will show what actually rendered.
 */
async function visitAndPause(page: Page, url: string, headingText?: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  if (headingText) {
    // Heading selector: matches any heading level by accessible name.
    // Update headingText if the page title changes in the UI.
    await expect(
      page.getByRole('heading', { name: headingText }).first()
    ).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Non-fatal: page may have loaded with a different heading.
      // The video will show whatever actually rendered.
    });
  }
  await page.waitForTimeout(PAUSE);
}

test('App Walkthrough Demo', async ({ page }) => {
  test.slow(); // mark as slow — expected to take 60-90 seconds

  // ── 1. Morning Dashboard ──────────────────────────────────────
  await visitAndPause(page, '/', 'Dashboard');

  // ── 2. Projects list ──────────────────────────────────────────
  await visitAndPause(page, '/projects', 'Projects');

  // Click into the first project in the table.
  // Selector: first <a> inside a table row. If the projects page switches
  // from a <table> to a card layout, update to 'a[href^="/projects/"]'.
  const firstProjectLink = page.locator('table tbody tr a').first();
  const projectLinkFallback = page.locator('a[href^="/projects/"]').first();
  const projectLink = await firstProjectLink.isVisible({ timeout: 5_000 }).catch(() => false)
    ? firstProjectLink
    : projectLinkFallback;

  if (await projectLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const projectHref = await projectLink.getAttribute('href');
    await projectLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(PAUSE);

    // ── 3. Daily Reports for this project ─────────────────────
    // Route: /projects/{id}/daily-reports (see app/(dashboard)/projects/[id]/daily-reports/)
    if (projectHref) {
      const projectBase = projectHref.replace(/\/$/, '');
      await visitAndPause(page, `${projectBase}/daily-reports`);
    }
  }

  // ── 4. Billing — Billing Applications ─────────────────────────
  // Route: /billing/applications (see app/(dashboard)/billing/applications/)
  await visitAndPause(page, '/billing/applications');

  // ── 5. Accounting — WIP Schedule ──────────────────────────────
  // Route: /accounting/wip (see app/(dashboard)/accounting/wip/)
  await visitAndPause(page, '/accounting/wip');

  // ── 6. Admin — System Health ──────────────────────────────────
  // Route: /admin/system-health (see app/(dashboard)/admin/system-health/)
  await visitAndPause(page, '/admin/system-health');

  // ── 7. Back to Dashboard ──────────────────────────────────────
  await visitAndPause(page, '/', 'Dashboard');
});
