/**
 * Mobile field report E2E (2.12.5 scaffold + 2.12.6 full submit).
 *
 * Persona: field-eng@demo.local (Foreman / field — ROLE-PERSONA-MAP daily report create).
 * Product docs say "superintendent"; demo seed field engineer is the E2E field persona.
 *
 * Viewport: 390×844 (phone). Minimal path: Project → Field → Photos → Review → Submit.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  openAsPersona,
  closeContext,
  dismissBlockingOverlays,
} from '../fixtures/browser-helpers';
import { PERSONAS, DEMO_PASSWORD } from '../fixtures/roles';
import {
  authHeaders,
  loginApi,
  getActiveCompanyId,
} from '../fixtures/api-helpers';

/** Phone shell used for field capture (matches mobile-phase1 acceptance). */
export const FIELD_REPORT_VIEWPORT = { width: 390, height: 844 } as const;

const FIELD_REPORT_PATH = '/daily-reports/mobile';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5081';
const authFile = path.join(__dirname, '..', '.auth', 'fieldEng.json');

test.describe('Mobile field report', () => {
  test.beforeEach(async ({ request }) => {
    if (!fs.existsSync(authFile)) {
      test.skip(
        true,
        'Missing e2e/.auth/fieldEng.json — run --project=setup-roles with API up'
      );
    }
    // Prefer absolute URL health checks (avoid baseURL rewriting false skips).
    const webOrigin = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
    const apiOrigin = process.env.API_BASE_URL ?? API_BASE;
    try {
      const web = await request.get(webOrigin, {
        timeout: 5_000,
        failOnStatusCode: false,
        maxRedirects: 5,
      });
      // Any response (incl. 3xx/4xx) means the host is up.
      void web.status();
    } catch (e) {
      test.skip(
        true,
        `Web app not reachable at ${webOrigin}: ${e instanceof Error ? e.message : e}`
      );
    }
    try {
      const api = await request.get(`${apiOrigin}/health/live`, {
        timeout: 5_000,
        failOnStatusCode: false,
      });
      if (api.status() >= 500) {
        test.skip(true, `API unhealthy at ${apiOrigin}: HTTP ${api.status()}`);
      }
    } catch (e) {
      test.skip(
        true,
        `API not reachable at ${apiOrigin}: ${e instanceof Error ? e.message : e}`
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

      await expect(page).not.toHaveURL(/\/login/i, { timeout: 15_000 });
      await expect(
        page.getByRole('heading', { name: /field report/i }).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/\d+\s*\/\s*\d+/)).toBeVisible({ timeout: 10_000 });

      console.log(
        `[mobile-field-report] ${PERSONAS.fieldEng.email} shell OK ${FIELD_REPORT_VIEWPORT.width}×${FIELD_REPORT_VIEWPORT.height}`
      );
    } finally {
      await closeContext(context);
    }
  });

  test('field completes minimal 4-step field report end-to-end', async ({
    browser,
    request,
  }) => {
    // Resolve a demo seed project the field persona can report on (API, not UI guess).
    const session = await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD);
    const companyId = await getActiveCompanyId(request, session);
    const headers = authHeaders(session, companyId);
    const projectsResp = await request.get(
      `${API_BASE}/api/projects?page=1&pageSize=20`,
      { headers }
    );
    expect(
      projectsResp.ok(),
      `projects list failed: ${projectsResp.status()} ${await projectsResp.text()}`
    ).toBeTruthy();
    const projectsBody = await projectsResp.json();
    const items = Array.isArray(projectsBody)
      ? projectsBody
      : projectsBody.items ?? projectsBody.Items ?? [];
    const active = items.find((p: { status?: string; Status?: string }) => {
      const s = String(p.status ?? p.Status ?? '');
      return /active|inprogress|in progress/i.test(s) || s === '1' || s === 'Active';
    });
    const project = active ?? items[0];
    expect(project, 'demo seed must include at least one project for fieldEng').toBeTruthy();
    const projectId = String(project.id ?? project.Id);
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);

    const { context, page } = await openAsPersona(browser, 'fieldEng', {
      viewport: FIELD_REPORT_VIEWPORT,
      companyId: companyId ?? undefined,
    });

    try {
      // Deep-link applies demo seed project and jumps to Field when eligible.
      await page.goto(
        `${FIELD_REPORT_PATH}?projectId=${encodeURIComponent(projectId)}`
      );
      await page.waitForLoadState('domcontentloaded');
      await dismissBlockingOverlays(page);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      await expect(
        page.getByRole('heading', { name: /field report/i }).first()
      ).toBeVisible({ timeout: 20_000 });

      // Unique date avoids DUPLICATE_REPORT (server key: date + reportType).
      const dayOffset = 1 + (Date.now() % 180);
      const uniqueDate = new Date(Date.now() + dayOffset * 86_400_000)
        .toISOString()
        .slice(0, 10);

      // If auto-skipped to Field, go Back to set a unique date on Project step.
      if (await page.getByTestId('activity-pour').isVisible({ timeout: 5_000 }).catch(() => false)) {
        await page.getByRole('button', { name: /back/i }).click();
      }

      await expect(page.locator('input[type="date"]')).toBeVisible({ timeout: 10_000 });
      await page.locator('input[type="date"]').fill(uniqueDate);

      // Project must be selected (deep-link) so Next enables.
      await expect(page.getByTestId('field-report-next')).toBeEnabled({ timeout: 15_000 });
      await page.getByTestId('field-report-next').click();

      // Field step — activity + weather (API requires weather on /submit)
      await expect(page.getByTestId('activity-pour')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('activity-pour').click();

      // Expand weather section and fill summary (required before workflow submit)
      const weatherToggle = page.getByRole('button', { name: /weather/i });
      await weatherToggle.click();
      await expect(page.getByTestId('field-weather-summary')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('field-weather-summary').fill('Clear');

      // Field → Photos
      await expect(page.getByTestId('field-report-next')).toBeEnabled({ timeout: 10_000 });
      await page.getByTestId('field-report-next').click();

      // Photos → Review
      await expect(page.getByTestId('field-report-next')).toBeEnabled({ timeout: 10_000 });
      await page.getByTestId('field-report-next').click();

      // Review → Submit: assert CREATE and /submit both succeed
      await expect(page.getByTestId('field-report-submit')).toBeVisible({
        timeout: 15_000,
      });

      const createRespPromise = page.waitForResponse((r) => {
        if (r.request().method() !== 'POST') return false;
        const path = r.url().split('?')[0] ?? r.url();
        // Create only: .../daily-reports (no id / submit / approve / lock)
        return /\/api\/projects\/[^/]+\/daily-reports$/.test(path);
      }, { timeout: 30_000 });
      const submitRespPromise = page.waitForResponse((r) => {
        if (r.request().method() !== 'POST') return false;
        const path = r.url().split('?')[0] ?? r.url();
        return /\/api\/projects\/[^/]+\/daily-reports\/[^/]+\/submit$/.test(path);
      }, { timeout: 30_000 });

      await page.getByTestId('field-report-submit').click();

      const createResp = await createRespPromise;
      const createStatus = createResp.status();
      expect(
        createStatus === 201 || createStatus === 200,
        `daily-report create status ${createStatus}: ${await createResp.text()}`
      ).toBeTruthy();

      const submitResp = await submitRespPromise;
      const submitStatus = submitResp.status();
      expect(
        submitStatus === 200 || submitStatus === 201,
        `daily-report /submit status ${submitStatus}: ${await submitResp.text()}`
      ).toBeTruthy();

      // Success toast after full create + submit workflow
      await expect(
        page.getByText(/report submitted/i).first()
      ).toBeVisible({ timeout: 15_000 });

      console.log(
        `[mobile-field-report] E2E submit OK seedProject=${projectId} create=${createStatus} submit=${submitStatus} persona=${PERSONAS.fieldEng.email}`
      );
    } finally {
      await closeContext(context);
    }
  });
});
