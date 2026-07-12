/**
 * Mobile field report E2E scaffold (2.12.5).
 *
 * Persona: field-eng@demo.local (Foreman / field — ROLE-PERSONA-MAP daily report create).
 * Product docs also say "superintendent"; demo seed field engineer is the E2E field persona.
 *
 * Viewport: 390×844 (phone). Full 4-step submit + toast/201 is deferred to 2.12.6.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { openAsPersona, closeContext, dismissBlockingOverlays } from '../fixtures/browser-helpers';
import { PERSONAS } from '../fixtures/roles';

/** Phone shell used for field capture (matches mobile-phase1 acceptance). */
export const FIELD_REPORT_VIEWPORT = { width: 390, height: 844 } as const;

const FIELD_REPORT_PATH = '/daily-reports/mobile';
const authFile = path.join(__dirname, '..', '.auth', 'fieldEng.json');

test.describe('Mobile field report (scaffold)', () => {
  test.beforeEach(async ({ request, baseURL }) => {
    // setup-roles writes this; without API/auth the scaffold still must not crash the suite.
    if (!fs.existsSync(authFile)) {
      test.skip(
        true,
        'Missing e2e/.auth/fieldEng.json — run --project=setup-roles with API up (see 2.12.5 scaffold)'
      );
    }
    // Green scaffold when web is not running (CI local without stack): skip, don't fail.
    const origin = baseURL ?? process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
    try {
      await request.get(origin, { timeout: 3_000, failOnStatusCode: false });
    } catch {
      test.skip(
        true,
        `Web app not reachable at ${origin} — start web+API, then re-run mobile-field-report`
      );
    }
  });

  test('field persona reaches Field report shell at 390×844', async ({ browser }) => {
    const { context, page } = await openAsPersona(browser, 'fieldEng', {
      viewport: FIELD_REPORT_VIEWPORT,
    });

    try {
      const vp = page.viewportSize();
      expect(vp?.width).toBe(FIELD_REPORT_VIEWPORT.width);
      expect(vp?.height).toBe(FIELD_REPORT_VIEWPORT.height);

      await page.goto(FIELD_REPORT_PATH);
      await page.waitForLoadState('domcontentloaded');
      await dismissBlockingOverlays(page);

      // Not bounced to login
      await expect(page).not.toHaveURL(/\/login/i, { timeout: 15_000 });

      // Mobile wizard chrome (daily-reports/mobile page title)
      await expect(
        page.getByRole('heading', { name: /field report/i }).first()
      ).toBeVisible({ timeout: 20_000 });

      // Step indicator present on scaffold
      await expect(page.getByText(/\d+\s*\/\s*\d+/)).toBeVisible({ timeout: 10_000 });

      console.log(
        `[mobile-field-report] ${PERSONAS.fieldEng.email} OK at ${FIELD_REPORT_PATH} ${FIELD_REPORT_VIEWPORT.width}×${FIELD_REPORT_VIEWPORT.height}`
      );
    } finally {
      await closeContext(context);
    }
  });

  /**
   * 2.12.6 — complete minimal 4-step field report (demo project, toast or API 201).
   * Skipped in 2.12.5 so scaffold stays green without multi-step flake.
   */
  test.skip(
    'superintendent/field completes minimal 4-step field report end-to-end (2.12.6)',
    async () => {
      // Implemented in 2.12.6: Project → Field → Photos → Review → submit assert.
    }
  );
});
