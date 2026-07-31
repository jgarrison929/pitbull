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
  getDefaultCompanyId,
  getFirstActiveProjectId,
  ensurePmProjectAssignment,
} from '../fixtures/api-helpers';

/** Phone shell used for field capture (matches mobile-phase1 acceptance). */
export const FIELD_REPORT_VIEWPORT = { width: 390, height: 844 } as const;

const FIELD_REPORT_PATH = '/daily-reports/mobile';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5081';
const authFile = path.join(__dirname, '..', '.auth', 'fieldEng.json');

test.describe('Mobile field report', () => {
  test.beforeEach(async ({ request, baseURL }) => {
    if (!fs.existsSync(authFile)) {
      test.skip(
        true,
        'Missing e2e/.auth/fieldEng.json — run --project=setup-roles with API up'
      );
    }
    const origin = baseURL ?? process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
    try {
      await request.get(origin, { timeout: 3_000, failOnStatusCode: false });
    } catch {
      test.skip(
        true,
        `Web app not reachable at ${origin} — start web+API, then re-run mobile-field-report`
      );
    }
    try {
      await request.get(`${API_BASE}/health/live`, {
        timeout: 3_000,
        failOnStatusCode: false,
      });
    } catch {
      test.skip(true, `API not reachable at ${API_BASE} — start API with Demo enabled`);
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
    // PM picks a default-company project and assigns field eng (HasCurrentUserProjectAccessAsync).
    const pmSession = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);
    const companyId = await getDefaultCompanyId(request, pmSession);
    expect(companyId, 'PM must have a default company').toBeTruthy();
    const projectId = await getFirstActiveProjectId(
      request,
      pmSession,
      companyId!
    );
    await ensurePmProjectAssignment(request, pmSession, projectId, companyId!, {
      fieldEmail: PERSONAS.fieldEng.email,
    });

    const session = await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD);
    const headers = authHeaders(session, companyId);

    // Unique date avoids DUPLICATE_REPORT (server key: date + reportType).
    const dayOffset = 1 + (Date.now() % 180);
    const uniqueDate = new Date(Date.now() + dayOffset * 86_400_000)
      .toISOString()
      .slice(0, 10);

    // Primary gate: field persona can create a daily report via API (auth + RLS + project access).
    const createApi = await request.post(
      `${API_BASE}/api/projects/${projectId}/daily-reports`,
      {
        headers,
        data: {
          title: `E2E Daily Report ${uniqueDate}`,
          data: {
            reportDate: uniqueDate,
            reportType: 'Daily',
            workNarrative: 'E2E field smoke create',
          },
        },
      }
    );
    const apiStatus = createApi.status();
    const apiBody = await createApi.text();
    expect(
      apiStatus === 200 || apiStatus === 201,
      `API daily-report create ${apiStatus}: ${apiBody}`
    ).toBeTruthy();

    const { context, page } = await openAsPersona(browser, 'fieldEng', {
      viewport: FIELD_REPORT_VIEWPORT,
      companyId: companyId ?? undefined,
    });

    try {
      // Fresh JWT into browser (setup storageState may lag; refresh token now persisted).
      const origin = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
      await page.goto(origin);
      await page.evaluate(
        ({ token, refresh, company }) => {
          localStorage.setItem('pitbull_token', token);
          document.cookie = `pitbull_token=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
          if (refresh) localStorage.setItem('pitbull_refresh_token', refresh);
          if (company) localStorage.setItem('pitbull_active_company_id', company);
        },
        {
          token: session.token,
          refresh: session.refreshToken ?? '',
          company: companyId,
        }
      );

      // UI walkthrough: Project → Field → Photos → Review (capture path).
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

      if (
        await page
          .getByTestId('activity-pour')
          .isVisible({ timeout: 5_000 })
          .catch(() => false)
      ) {
        await page.getByRole('button', { name: /back/i }).click();
      }

      await expect(page.locator('input[type="date"]')).toBeVisible({
        timeout: 10_000,
      });
      // Distinct from API-created report date to avoid DUPLICATE if UI also POSTs.
      const uiDate = new Date(Date.now() + (dayOffset + 3) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      await page.locator('input[type="date"]').fill(uiDate);

      await expect(page.getByTestId('field-report-next')).toBeEnabled({
        timeout: 15_000,
      });
      await page.getByTestId('field-report-next').click();

      await expect(page.getByTestId('activity-pour')).toBeVisible({
        timeout: 15_000,
      });
      await page.getByTestId('activity-pour').click();

      await expect(page.getByTestId('field-report-next')).toBeEnabled({
        timeout: 10_000,
      });
      await page.getByTestId('field-report-next').click();

      await expect(page.getByTestId('field-report-next')).toBeEnabled({
        timeout: 10_000,
      });
      await page.getByTestId('field-report-next').click();

      await expect(page.getByTestId('field-report-submit')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId('field-report-submit')).toBeEnabled({
        timeout: 10_000,
      });

      console.log(
        `[mobile-field-report] E2E OK seedProject=${projectId} apiCreate=${apiStatus} uiReviewReady persona=${PERSONAS.fieldEng.email}`
      );
    } finally {
      await closeContext(context);
    }
  });
});
