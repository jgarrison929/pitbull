import { test, expect } from '@playwright/test';
import { PERSONAS, LIFECYCLE_NAMES } from '../fixtures/roles';
import {
  authHeaders,
  ensureTimeTrackingPrereqs,
  runPayrollE2e,
  configurePayrollOvertimeForE2e,
  seedApprovedOvertimeTimeEntryForE2e,
  ensurePayPeriodsForCompany,
  createOwnerChangeOrder,
  type AuthSession,
  type BillingPrereqs,
  type PayAppPrereqs,
} from '../fixtures/api-helpers';
import { bootstrapRoleWorkflowPrereqs } from '../fixtures/e2e-bootstrap';
import {
  openAsPersona,
  closeContext,
  filterTableBySearch,
  expectStatusVisible,
  setActiveCompany,
  dismissBlockingOverlays,
} from '../fixtures/browser-helpers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5081';

test.describe.configure({ mode: 'serial' });

/** Prereqs are established once in bootstrapRoleWorkflowPrereqs; failures throw before any test runs. */
test.describe('Role-based workflow lifecycles (UI-first)', () => {
  let runTag: string;
  let projectId: string;
  let pmProjectId: string;
  let companyId: string;
  let payAppPrereqs: PayAppPrereqs;
  let billingPrereqs: BillingPrereqs;
  let pmSession: AuthSession;
  let fieldSession: AuthSession;
  let apSession: AuthSession;
  let payrollSession: AuthSession;

  test.beforeAll(async ({ request }) => {
    const ctx = await bootstrapRoleWorkflowPrereqs(request);
    runTag = ctx.runTag;
    companyId = ctx.companyId;
    projectId = ctx.projectId;
    pmProjectId = ctx.pmProjectId;
    payAppPrereqs = ctx.payAppPrereqs;
    billingPrereqs = ctx.billingPrereqs;
    pmSession = ctx.pmSession;
    fieldSession = ctx.fieldSession;
    apSession = ctx.apSession;
    payrollSession = ctx.payrollSession;
  });

  // ── 1. Bid → Project (Estimator) ──────────────────────────────────
  test('L1 Bid: estimator creates bid and advances to Submitted in UI', async ({ browser }) => {
    const { context, page } = await openAsPersona(browser, 'estimator');
    const bidNum = `E2E-BID-${runTag}`;

    try {
      await page.goto('/bids/new');
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel(/bid number/i).fill(bidNum);
      await page.getByLabel(/bid name/i).fill(`E2E Bid ${runTag}`);
      await page.getByLabel(/bid value/i).fill('150000');
      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      await page.locator('#bidDate').fill(today);
      await page.locator('#dueDate').fill(due);
      await page.getByRole('button', { name: /create bid/i }).click();
      await expect(page).toHaveURL(/\/bids\/[0-9a-f-]+$/i, { timeout: 20_000 });

      const bidUrl = page.url();
      const bidId = bidUrl.split('/').pop()!;
      await page.goto(`/bids/${bidId}/edit`);
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel(/^status$/i).click();
      await page.getByRole('option', { name: 'Submitted' }).click();
      await page.getByRole('button', { name: /save changes/i }).click();
      await expect(
        page.getByText(/submitted/i).or(page.locator('#status')).first()
      ).toBeVisible({ timeout: 15_000 });
      console.log(`[${LIFECYCLE_NAMES[1]}] estimator UI → Submitted OK`);
    } finally {
      await closeContext(context);
    }
  });

  // ── 2. Project setup (PM) — create cost code + Day-1 nav ──────────
  test('L2 Project setup: PM creates cost code and navigates Day-1 chain', async ({ browser, request }) => {
    const { context, page } = await openAsPersona(browser, 'pm');
    const code = `E${runTag.replace(/\D/g, '').slice(-10)}`.slice(0, 12);

    try {
      await page.goto('/cost-codes');
      await page.waitForLoadState('domcontentloaded');
      await page.getByRole('button', { name: 'Add Cost Code', exact: true }).click();
      await page.locator('#cc-code').fill(code);
      await page.locator('#cc-description').fill(`E2E labor ${runTag}`);
      const createResp = page.waitForResponse(
        (r) => r.url().includes('/api/cost-codes') && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await page.getByRole('dialog').getByRole('button', { name: /^create$/i }).click();
      const createResult = await createResp;
      expect(
        createResult.ok(),
        `cost code create failed: ${createResult.status()} ${await createResult.text()}`
      ).toBeTruthy();
      await expect(page.getByText(/cost code created/i)).toBeVisible({ timeout: 15_000 });
      await page.getByPlaceholder(/search by code/i).fill(code);
      await expect(page.locator('table tbody').getByText(code)).toBeVisible({ timeout: 15_000 });

      const chain = [
        { url: '/employees', heading: /employee/i },
        { url: '/projects', heading: /project/i },
        { url: '/contracts', heading: /contract/i },
        { url: `/projects/${projectId}`, heading: /.+/ },
      ];
      for (const step of chain) {
        await page.goto(step.url);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByRole('heading', { name: step.heading }).first()).toBeVisible({
          timeout: 15_000,
        });
      }

      const prjNum = `E2E-PRJ-${runTag.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`.slice(0, 16);
      await page.goto('/projects/new');
      await page.waitForLoadState('domcontentloaded');
      await page.getByLabel(/^project number/i).fill(prjNum);
      await page.getByLabel(/^project name/i).fill(`E2E Project ${runTag}`);
      await page.getByLabel(/^contract amount/i).fill('275000');
      await page.getByRole('button', { name: /commercial building/i }).click();
      await page.getByRole('button', { name: /team assignment/i }).click();
      await page.getByRole('button', { name: /add team member/i }).click();
      const teamSection = page.locator('text=Team Assignment').locator('..').locator('..');
      await teamSection.getByRole('combobox').first().click();
      await page.getByRole('option').filter({ hasText: /demo|pm/i }).first().click();
      await teamSection.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'Project Manager', exact: true }).click();
      const projectCreateResp = page.waitForResponse(
        (r) => r.url().includes('/api/projects') && r.request().method() === 'POST',
        { timeout: 25_000 }
      );
      await page.getByRole('button', { name: /create project/i }).click();
      const projectCreateResult = await projectCreateResp;
      expect(
        projectCreateResult.ok(),
        `project create failed: ${projectCreateResult.status()} ${await projectCreateResult.text()}`
      ).toBeTruthy();
      await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i, { timeout: 20_000 });
      const setupProjectId = page.url().split('/').pop()!;
      await page.waitForResponse(
        (r) =>
          r.url().includes(`/api/projects/${setupProjectId}`) &&
          r.request().method() === 'GET' &&
          r.ok(),
        { timeout: 20_000 }
      );
      await expect(page.getByRole('button', { name: /activate project/i })).toBeVisible({
        timeout: 15_000,
      });

      const activateResp = page.waitForResponse(
        (r) => r.url().includes('/activate') && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await page.getByRole('button', { name: /activate project/i }).click();
      expect((await activateResp).ok()).toBeTruthy();
      await expect(page.getByText(/^active$/i).first()).toBeVisible({ timeout: 15_000 });

      const phasesResp = await request.get(
        `${API_BASE}/api/projects/${setupProjectId}/phases`,
        { headers: authHeaders(pmSession, companyId) }
      );
      if (phasesResp.ok()) {
        const phasesBody = await phasesResp.json();
        const list = Array.isArray(phasesBody) ? phasesBody : phasesBody.items ?? phasesBody.Items ?? [];
        expect(list.length).toBeGreaterThan(0);
        console.log(
          `L2_EVIDENCE phases=${JSON.stringify(list.map((p: { name?: string; Name?: string }) => p.name ?? p.Name))}`
        );
      }

      const assignResp = await request.get(
        `${API_BASE}/api/project-assignments/by-project/${setupProjectId}?activeOnly=true`,
        { headers: authHeaders(pmSession, companyId) }
      );
      expect(assignResp.ok()).toBeTruthy();
      const assignBody = await assignResp.json();
      const assignments = Array.isArray(assignBody) ? assignBody : assignBody.items ?? assignBody.Items ?? [];
      expect(assignments.length).toBeGreaterThan(0);
      const hasPmRole = assignments.some((a: { role?: string | number; Role?: string | number }) => {
        const role = a.role ?? a.Role;
        return role === 'Manager' || role === 2 || role === '2';
      });
      expect(hasPmRole).toBeTruthy();
      console.log(
        `L2_EVIDENCE assignments=${JSON.stringify(assignments.map((a: { employeeId?: string; EmployeeId?: string; role?: unknown; Role?: unknown }) => ({ employeeId: a.employeeId ?? a.EmployeeId, role: a.role ?? a.Role })))} projectId=${setupProjectId} status=Active`
      );
      console.log(`[${LIFECYCLE_NAMES[2]}] PM cost code + Day-1 chain + browser create/activate OK`);
    } finally {
      await closeContext(context);
    }
  });

  // ── 3. Crew time → approval (Field → PM) ──────────────────────────
  test('L3 Time: field submits via mobile UI, PM approves in approval queue', async ({ browser, request }) => {
    const fieldCtx = await openAsPersona(browser, 'fieldEng');
    const pmCtx = await openAsPersona(
      browser,
      'pm',
      { companyId }
    );

    try {
      const { page: fieldPage } = fieldCtx;
      await fieldPage.goto('/time-tracking/mobile');
      await fieldPage.waitForLoadState('networkidle');
      await expect(fieldPage.getByText(/unable to match your login/i)).toHaveCount(0);
      await expect(fieldPage.getByRole('button', { name: /^submit$/i })).toBeEnabled({ timeout: 20_000 });

      await fieldPage.locator('#project option:not([value=""])').first().waitFor({ state: 'attached', timeout: 20_000 });
      const visibleProjectId =
        (await fieldPage.locator(`#project option[value="${projectId}"]`).count()) > 0
          ? projectId
          : await fieldPage.locator('#project option:not([value=""])').first().getAttribute('value');
      expect(visibleProjectId).toBeTruthy();
      if (visibleProjectId !== projectId) {
        await ensureTimeTrackingPrereqs(
          request,
          pmSession,
          PERSONAS.fieldEng.email,
          visibleProjectId!,
          companyId
        );
        projectId = visibleProjectId!;
      }
      await fieldPage.locator('#project').selectOption(visibleProjectId!);
      await expect(fieldPage.locator('#project')).toHaveValue(visibleProjectId!, { timeout: 5000 });
      await fieldPage.locator('#costCode option:not([value=""])').first().waitFor({ state: 'attached', timeout: 20_000 });
      const costCodeOptions = await fieldPage.locator('#costCode option:not([value=""])').all();
      expect(costCodeOptions.length).toBeGreaterThan(0);
      const uniqSeed = [...runTag, projectId.slice(-4)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      const dayOffset = uniqSeed % 28;
      for (let d = 0; d < dayOffset; d++) {
        await fieldPage.getByRole('button', { name: 'Next day' }).click();
      }
      const costCodePick = Math.floor(uniqSeed / 28) % costCodeOptions.length;
      const costCodeId = await costCodeOptions[costCodePick].getAttribute('value');
      expect(costCodeId).toBeTruthy();
      await fieldPage.locator('#costCode').selectOption(costCodeId!);
      await fieldPage.locator('#notes').fill(`E2E time ${runTag}`);

      const batchResponse = fieldPage.waitForResponse(
        (r) => {
          if (!r.url().includes('/api/time-entries/batch') || r.request().method() !== 'POST') return false;
          const body = r.request().postDataJSON() as { entries?: { projectId?: string }[] } | null;
          return Boolean(body?.entries?.[0]?.projectId);
        },
        { timeout: 25_000 }
      );
      await fieldPage.getByRole('button', { name: /^submit$/i }).click();
      const submitResp = await batchResponse;
      const submitPayload = submitResp.request().postDataJSON() as {
        entries?: { projectId?: string; costCodeId?: string; date?: string }[];
      };
      const submitBody = await submitResp.text();
      expect(
        submitResp.ok(),
        `time batch failed: ${submitResp.status()} project=${submitPayload?.entries?.[0]?.projectId} body=${submitBody}`
      ).toBeTruthy();

      const { page: pmPage } = pmCtx;
      await setActiveCompany(pmPage, companyId);
      await pmPage.goto('/time-tracking/approval');
      await pmPage.waitForLoadState('domcontentloaded');
      const submittedDate = submitPayload?.entries?.[0]?.date;
      const rangeStart = submittedDate ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const rangeEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      await pmPage.locator('input[type="date"]').nth(0).fill(rangeStart);
      await pmPage.locator('input[type="date"]').nth(1).fill(rangeEnd);
      await pmPage.getByRole('button', { name: /refresh queue/i }).click();
      await pmPage.waitForResponse(
        (r) => r.url().includes('/api/time-entries/review-queue') && r.ok(),
        { timeout: 20_000 }
      );
      await expect(pmPage.getByText(/submitted entries/i).first()).toBeVisible({ timeout: 10_000 });
      const entryCheckbox = pmPage.getByRole('checkbox', { name: /select demo user46/i }).first();
      await entryCheckbox.scrollIntoViewIfNeeded();
      await entryCheckbox.check();
      await pmPage.getByRole('button', { name: /mark selected approve/i }).click();
      await pmPage.getByRole('button', { name: /submit selected review/i }).click();
      await expect(pmPage.getByText(/approved|queue is clear/i).first()).toBeVisible({ timeout: 20_000 });
      console.log(`[${LIFECYCLE_NAMES[3]}] field mobile submit → PM approval OK`);
    } finally {
      await closeContext(fieldCtx.context);
      await closeContext(pmCtx.context);
    }
  });

  test('L3b Payroll: lock period, generate run, approve, export via API', async ({ request }) => {
    const result = await runPayrollE2e(request, payrollSession, companyId, {
      seedOvertime: true,
      pmSession,
      fieldSession,
      fieldEmail: PERSONAS.fieldEng.email,
    });
    expect(result.payrollRunId).toBeTruthy();
    expect(result.status).toMatch(/Exported|Approved|Processing/i);
    expect(result.totalOvertimeHours).toBeGreaterThan(0);
    expect(result.lines.some((l) => l.overtimeHours > 0)).toBeTruthy();
    console.log(
      `L3_EVIDENCE payrollRunId=${result.payrollRunId} lines=${JSON.stringify(result.lines)} ot=${result.totalOvertimeHours}`
    );
  });

  test('L3b Payroll UI: generate, approve, and export run in browser', async ({ browser, request }) => {
    await configurePayrollOvertimeForE2e(request, payrollSession, companyId);
    const payPeriodId = await ensurePayPeriodsForCompany(request, payrollSession, companyId);
    await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/unlock`, {
      headers: authHeaders(payrollSession, companyId),
    });
    await seedApprovedOvertimeTimeEntryForE2e(request, pmSession, fieldSession, {
      companyId,
      payPeriodId,
      fieldEmail: PERSONAS.fieldEng.email,
    });
    const lockResp = await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/lock`, {
      headers: authHeaders(payrollSession, companyId),
    });
    expect(lockResp.ok()).toBeTruthy();
    const { context, page } = await openAsPersona(browser, 'payrollManager', {
      companyId,
    });

    try {
      await setActiveCompany(page, companyId);
      await page.goto('/payroll/runs');
      await page.waitForLoadState('domcontentloaded');
      await page.locator('#pay-period-id').fill(payPeriodId);
      const generateResp = page.waitForResponse(
        (r) => r.url().includes('/api/payroll/runs/generate') && r.request().method() === 'POST',
        { timeout: 25_000 }
      );
      await page.getByRole('button', { name: /^generate$/i }).click();
      const generateResult = await generateResp;
      let runId: string;
      if (generateResult.ok()) {
        const runBody = await generateResult.json();
        runId = (runBody.id ?? runBody.Id) as string;
      } else {
        const genBody = await generateResult.text();
        expect(genBody).toContain('DUPLICATE_PAYROLL_RUN');
        const listResp = await request.get(
          `${API_BASE}/api/payroll/runs?payPeriodId=${payPeriodId}&page=1&pageSize=5`,
          { headers: authHeaders(payrollSession, companyId) }
        );
        expect(listResp.ok()).toBeTruthy();
        const listBody = await listResp.json();
        const items = listBody.items ?? listBody.Items ?? [];
        runId = (items[0]?.id ?? items[0]?.Id) as string;
      }
      expect(runId).toBeTruthy();

      await page.goto(`/payroll/runs/${runId}`);
      await page.waitForLoadState('domcontentloaded');

      const approveButton = page.getByRole('button', { name: /approve run/i });
      if (await approveButton.isVisible()) {
        const approveResp = page.waitForResponse(
          (r) => r.url().includes('/approve') && r.request().method() === 'POST',
          { timeout: 20_000 }
        );
        await approveButton.click();
        expect((await approveResp).ok()).toBeTruthy();
        await expect(page.getByText(/^approved$/i).first()).toBeVisible({ timeout: 15_000 });
      }

      const exportButton = page.getByRole('button', { name: /export run/i });
      if (await exportButton.isVisible()) {
        const exportResp = page.waitForResponse(
          (r) => r.url().includes('/export') && r.request().method() === 'POST',
          { timeout: 20_000 }
        );
        await exportButton.click();
        expect((await exportResp).ok()).toBeTruthy();
        await expect(page.getByText(/^exported$/i).first()).toBeVisible({ timeout: 15_000 });
      }

      const detailResp = await request.get(`${API_BASE}/api/payroll/runs/${runId}`, {
        headers: authHeaders(payrollSession, companyId),
      });
      expect(detailResp.ok()).toBeTruthy();
      const detail = await detailResp.json();
      const lines = detail.lines ?? detail.Lines ?? [];
      const totalOt = lines.reduce(
        (sum: number, l: { overtimeHours?: number; OvertimeHours?: number }) =>
          sum + Number(l.overtimeHours ?? l.OvertimeHours ?? 0),
        0
      );
      expect(totalOt).toBeGreaterThan(0);
      console.log(
        `L3_EVIDENCE payrollRunId=${runId} lines=${JSON.stringify(lines)} ot=${totalOt} via=browser`
      );
    } finally {
      await closeContext(context);
    }
  });

  // ── 4. Owner billing (PM → AR) ────────────────────────────────────
  test('L4 Owner billing: PM creates app, AR certifies via UI', async ({ browser }) => {
    const pmCtx = await openAsPersona(browser, 'pm', {
      companyId,
    });
    const arCtx = await openAsPersona(browser, 'arClerk', {
      companyId,
    });
    let appId = '';

    try {
      const { page: pmPage } = pmCtx;
      await setActiveCompany(pmPage, companyId);
      await pmPage.goto('/billing/applications');
      await pmPage.waitForLoadState('domcontentloaded');
      await dismissBlockingOverlays(pmPage);
      await pmPage.getByRole('button', { name: /new application/i }).click();
      const billingMonth = 5 + (parseInt(runTag.slice(-2), 36) % 6);
      const billingMonthStr = String(billingMonth).padStart(2, '0');
      const periodFrom = `2026-${billingMonthStr}-01`;
      const periodThrough = `2026-${billingMonthStr}-28`;
      await pmPage.getByLabel(/owner contract id/i).fill(billingPrereqs.ownerContractId);
      await pmPage.getByLabel(/sov id/i).fill(billingPrereqs.ownerScheduleOfValuesId);
      await pmPage.getByLabel(/period from/i).fill(periodFrom);
      await pmPage.getByLabel(/period through/i).fill(periodThrough);
      await pmPage.getByLabel(/application date/i).fill(periodThrough);
      const createResp = pmPage.waitForResponse(
        (r) => r.url().includes('/api/billing-applications') && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await pmPage.getByRole('button', { name: /^create$/i }).click();
      expect((await createResp).ok()).toBeTruthy();
      await expect(pmPage).toHaveURL(/\/billing\/applications\/[0-9a-f-]+/i, { timeout: 20_000 });
      appId = pmPage.url().split('/').pop()!;

      await pmPage.getByRole('button', { name: /submit for review/i }).click();
      await expect(pmPage.getByText('PmReview').first()).toBeVisible({ timeout: 15_000 });

      await pmPage.getByRole('button', { name: /^approve$/i }).click();
      await expect(pmPage.getByText('ReadyToSubmit').first()).toBeVisible({ timeout: 15_000 });

      await pmPage.getByRole('button', { name: /submit to owner/i }).click();
      await expect(pmPage.getByText('SubmittedToOwner').first()).toBeVisible({ timeout: 15_000 });

      const { page: arPage } = arCtx;
      await setActiveCompany(arPage, companyId);
      await arPage.goto(`/billing/applications/${appId}`);
      await arPage.waitForLoadState('domcontentloaded');
      await arPage.getByRole('button', { name: /architect certified/i }).click();
      await expect(arPage.getByText('ArchitectCertified').first()).toBeVisible({ timeout: 15_000 });

      await arPage.getByRole('button', { name: /mark payment due/i }).click();
      await expect(arPage.getByText('PaymentDue').first()).toBeVisible({ timeout: 15_000 });

      await arPage.getByRole('button', { name: /^mark paid$/i }).click();
      await expect(arPage.getByText('Paid').first()).toBeVisible({ timeout: 15_000 });
      console.log(
        `L4_EVIDENCE billingApplicationId=${appId} status=Paid via=browser`
      );
      console.log(`[${LIFECYCLE_NAMES[4]}] PM+AR UI billing → Paid OK`);
    } finally {
      await closeContext(pmCtx.context);
      await closeContext(arCtx.context);
    }
  });

  // ── 5. Sub pay app (PM → AP) ──────────────────────────────────────
  test('L5 Sub pay app: PM creates in UI, AP submits', async ({ browser }) => {
    const pmCtx = await openAsPersona(browser, 'pm', { companyId });
    const apCtx = await openAsPersona(browser, 'apClerk');
    const monthOffset = parseInt(runTag.slice(-2), 36) % 6;
    const periodStart = `2026-0${4 + monthOffset}-01`;
    const periodEnd = `2026-0${4 + monthOffset}-28`;
    const workAmount = String(Math.max(100, payAppPrereqs.maxWorkAmount));

    try {
      const { page: pmPage } = pmCtx;
      await pmPage.goto('/payment-applications');
      await pmPage.waitForLoadState('domcontentloaded');
      await pmPage.getByRole('button', { name: /new pay app/i }).click();
      const dialog = pmPage.getByRole('dialog', { name: /new payment application/i });
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await dialog.getByRole('combobox').click();
      await pmPage
        .getByRole('option', { name: new RegExp(payAppPrereqs.subcontractNumber, 'i') })
        .click();
      await dialog.locator('input[type="date"]').nth(0).fill(periodStart);
      await dialog.locator('input[type="date"]').nth(1).fill(periodEnd);
      await dialog.getByPlaceholder('0.00').first().fill(workAmount);
      const invNum = `INV-E2E-${runTag}`;
      await dialog.getByPlaceholder('INV-2026-001').fill(invNum);
      const createResp = pmPage.waitForResponse(
        (r) => r.url().includes('/api/paymentapplications') && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await dialog.getByRole('button', { name: /create pay app/i }).click();
      const createResult = await createResp;
      expect(createResult.ok()).toBeTruthy();
      const createdPayApp = await createResult.json();
      await expect(pmPage.getByText(/payment application created/i)).toBeVisible({ timeout: 15_000 });
      const payAppId = createdPayApp.id ?? createdPayApp.Id;
      expect(payAppId).toBeTruthy();
      await pmPage.goto(`/payment-applications/${payAppId}`);
      await expect(pmPage).toHaveURL(/\/payment-applications\/[0-9a-f-]+/i, { timeout: 15_000 });

      const { page: apPage } = apCtx;
      await apPage.goto(`/payment-applications/${payAppId}`);
      await apPage.waitForLoadState('domcontentloaded');
      await apPage.getByRole('button', { name: /^submit$/i }).click();
      const confirm = apPage.getByRole('button', { name: /^submit$/i }).last();
      if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirm.click();
      }
      await expect(
        apPage.locator('[class*="bg-blue-100"]').filter({ hasText: /^Submitted$/ })
      ).toBeVisible({ timeout: 15_000 });
      console.log(`[${LIFECYCLE_NAMES[5]}] PM create → AP submit OK`);
    } finally {
      await closeContext(pmCtx.context);
      await closeContext(apCtx.context);
    }
  });

  // ── 6. Change order (PM) ──────────────────────────────────────────
  test('L6 Change order: PM creates and advances Pending → Approved in UI', async ({ browser }) => {
    const { context, page } = await openAsPersona(browser, 'pm', {
      companyId,
    });
    const coNum = `CO-${runTag.replace(/[^a-zA-Z0-9]/g, '').slice(-18)}`;
    const coTitle = `E2E footing ${runTag}`;

    try {
      await setActiveCompany(page, companyId);
      await page.goto(`/contracts/${payAppPrereqs.subcontractId}/change-orders`);
      await page.waitForLoadState('domcontentloaded');
      await page.getByRole('button', { name: /new change order/i }).click();
      const createDialog = page.getByRole('dialog', { name: /create change order/i });
      await expect(createDialog).toBeVisible({ timeout: 10_000 });
      await createDialog.locator('#co-number').fill(coNum);
      await createDialog.locator('#co-title').fill(coTitle);
      await createDialog.locator('#co-description').fill(`Field condition ${runTag}`);
      await createDialog.locator('#co-amount').fill('5000');
      const createResp = page.waitForResponse(
        (r) => r.url().includes('/api/changeorders') && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await createDialog.getByRole('button', { name: /create change order/i }).click();
      const createResult = await createResp;
      expect(createResult.ok()).toBeTruthy();
      await expect(page.getByText(/change order created/i)).toBeVisible({ timeout: 10_000 });

      const row = page.locator('table tbody tr').filter({ hasText: coNum });
      await expect(row).toBeVisible({ timeout: 25_000 });
      await row.getByRole('button', { name: /edit change order/i }).click();
      let editDialog = page.getByRole('dialog', { name: /edit change order/i });
      await editDialog.locator('#co-status').click();
      await page.getByRole('option', { name: /under review/i }).click();
      await editDialog.getByRole('button', { name: /save changes/i }).click();
      await expect(page.getByText(/change order updated/i)).toBeVisible({ timeout: 10_000 });
      await expect(
        row.locator('[class*="bg-blue-100"]').filter({ hasText: /under review/i })
      ).toBeVisible({ timeout: 15_000 });

      await row.getByRole('button', { name: /edit change order/i }).click();
      editDialog = page.getByRole('dialog', { name: /edit change order/i });
      await editDialog.locator('#co-status').click();
      await page.getByRole('option', { name: /^approved$/i }).click();
      await editDialog.getByRole('button', { name: /save changes/i }).click();
      await expect(
        row.locator('[class*="bg-green-100"]').filter({ hasText: /^approved$/i })
      ).toBeVisible({ timeout: 15_000 });
      console.log(`[${LIFECYCLE_NAMES[6]}] PM UI → Approved OK`);
    } finally {
      await closeContext(context);
    }
  });

  test('L6b Owner change order: PM creates via API', async ({ request }) => {
    const ownerCo = await createOwnerChangeOrder(request, pmSession, pmProjectId, {
      runTag,
      companyId,
    });
    expect(ownerCo.id).toBeTruthy();
    console.log(
      `L6_EVIDENCE ownerChangeOrderId=${ownerCo.id} projectId=${pmProjectId} via=api`
    );
    console.log(`[${LIFECYCLE_NAMES[6]}] owner CO API create OK (${ownerCo.id})`);
  });

  // ── 7. RFI (PM) ───────────────────────────────────────────────────
  test('L7 RFI: PM creates, answers, and marks Answered in UI', async ({ browser }) => {
    const { context, page } = await openAsPersona(browser, 'pm', {
      companyId,
    });

    try {
      await setActiveCompany(page, companyId);
      await page.goto(`/rfis/new?projectId=${pmProjectId}`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('input[name="subject"]')).toBeVisible({ timeout: 15_000 });
      await page.locator('input[name="subject"]').fill(`E2E RFI ${runTag}`);
      await page.locator('textarea[name="question"]').fill('Clarify rebar spacing?');
      await expect(page.getByText(/RFI will be added to/i)).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: /create rfi/i }).click();
      await expect(page).toHaveURL(
        new RegExp(`/rfis/[0-9a-f-]+\\?projectId=${pmProjectId}`),
        { timeout: 20_000 }
      );

      await expect(page.getByRole('button', { name: /edit rfi/i })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('button', { name: /edit rfi/i }).click();
      await page.getByLabel(/^answer$/i).fill('Per spec section 03 30 00.');
      await page.getByRole('button', { name: /save changes/i }).click();
      await page.getByRole('button', { name: /mark answered/i }).click();
      await expectStatusVisible(page, /answered/i);
      console.log(`[${LIFECYCLE_NAMES[7]}] PM UI → Answered OK`);
    } finally {
      await closeContext(context);
    }
  });

  // ── 8. Submittal (PM) ─────────────────────────────────────────────
  test('L8 Submittal: PM creates Draft and advances to Submitted in UI', async ({ browser }) => {
    const { context, page } = await openAsPersona(browser, 'pm', {
      companyId,
    });
    const title = `E2E Submittal ${runTag}`;

    try {
      await setActiveCompany(page, companyId);
      await page.goto(`/projects/${pmProjectId}/submittals`);
      await page.waitForLoadState('domcontentloaded');
      await page.getByRole('button', { name: /new submittal/i }).click();
      await page.locator('#sub-title').fill(title);
      await page.locator('#sub-spec-code').fill('03 30 00');
      await page.getByRole('button', { name: /create submittal/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });
      const submittalRow = page.locator('table tbody tr').filter({ hasText: title });
      await expect(submittalRow).toBeVisible({ timeout: 15_000 });

      await filterTableBySearch(page, runTag);
      await submittalRow.getByRole('button', { name: /edit/i }).click();
      const editDialog = page.getByRole('dialog', { name: /edit submittal/i });
      await editDialog.locator('#sub-status').click();
      await page.getByRole('option', { name: /^submitted$/i }).click();
      await expect(page.getByRole('listbox')).not.toBeVisible({ timeout: 5_000 });
      const saveBtn = editDialog.getByRole('button', { name: /save changes/i });
      await saveBtn.evaluate((btn) => (btn as HTMLButtonElement).click());
      await expect(page.getByText(/submittal updated/i)).toBeVisible({ timeout: 15_000 });
      await expect(submittalRow.getByText(/^submitted$/i)).toBeVisible({ timeout: 15_000 });
      console.log(`[${LIFECYCLE_NAMES[8]}] PM UI → Submitted OK`);
    } finally {
      await closeContext(context);
    }
  });

  // ── 9. Vendor invoice (AP) ────────────────────────────────────────
  test('L9 Vendor invoice: AP creates and matches in UI', async ({ browser, request }) => {
    const { context, page } = await openAsPersona(browser, 'apClerk', {
      companyId,
    });
    const invNum = `VI-E2E-${runTag}`;

    try {
      await setActiveCompany(page, companyId);
      await page.goto('/procurement/invoices/new');
      await page.waitForLoadState('domcontentloaded');
      await page.locator('#vendorId').click();
      const vendorOption = page.getByRole('option').first();
      await expect(vendorOption).toBeVisible({ timeout: 15_000 });
      await vendorOption.click();

      const today = new Date().toISOString().slice(0, 10);
      const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      await page.getByLabel(/invoice number/i).fill(invNum);
      await page.getByLabel(/invoice date/i).fill(today);
      await page.getByLabel(/due date/i).fill(due);
      await page.getByLabel(/total amount/i).fill('1500');
      await page.getByRole('button', { name: /create invoice/i }).click();
      await expect(page).toHaveURL(/\/procurement\/invoices/, { timeout: 20_000 });
      const row = page.locator('table tbody tr').filter({ hasText: invNum });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await row.getByRole('button', { name: /^match$/i }).click();
      await expect(row.getByText(/matched|match/i).first()).toBeVisible({ timeout: 15_000 });

      const listResp = await request.get(
        `${API_BASE}/api/vendor-invoices?search=${encodeURIComponent(invNum)}&pageSize=5`,
        { headers: authHeaders(apSession, companyId) }
      );
      expect(listResp.ok()).toBeTruthy();
      const listBody = await listResp.json();
      const items = listBody.items ?? listBody.Items ?? [];
      const invoice = items.find(
        (i: { invoiceNumber?: string; InvoiceNumber?: string }) =>
          (i.invoiceNumber ?? i.InvoiceNumber) === invNum
      );
      expect(invoice).toBeTruthy();
      const invoiceId = (invoice.id ?? invoice.Id) as string;

      await row.getByRole('button', { name: /^approve$/i }).click();
      await expect(row.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });

      const detailResp = await request.get(`${API_BASE}/api/vendor-invoices/${invoiceId}`, {
        headers: authHeaders(apSession, companyId),
      });
      expect(detailResp.ok()).toBeTruthy();
      const detail = await detailResp.json();
      const accrualJeId = detail.accrualJournalEntryId ?? detail.AccrualJournalEntryId ?? null;
      console.log(
        `L9_EVIDENCE vendorInvoiceId=${invoiceId} accrualJournalEntryId=${accrualJeId ?? 'none'} via=browser`
      );

      const denied = await request.get(`${API_BASE}/api/vendor-invoices?page=1`, {
        headers: authHeaders(fieldSession),
      });
      expect(denied.status()).toBe(403);
      console.log(`[${LIFECYCLE_NAMES[9]}] AP UI match+approve OK, field-eng 403 OK`);
    } finally {
      await closeContext(context);
    }
  });

  // ── 10. Daily report (Field → PM) ─────────────────────────────────
  test('L10 Daily report: field creates, PM submit/approve/lock in UI', async ({ browser }) => {
    const fieldCtx = await openAsPersona(browser, 'fieldEng', {
      companyId,
    });
    const pmCtx = await openAsPersona(browser, 'pm', {
      companyId,
    });
    const title = `E2E Daily ${runTag}`;

    try {
      const { page: fieldPage } = fieldCtx;
      await setActiveCompany(fieldPage, companyId);
      await fieldPage.goto(`/projects/${projectId}/daily-reports`);
      await fieldPage.waitForLoadState('domcontentloaded');
      await fieldPage.getByRole('button', { name: /new report/i }).click();
      const tagDigits = runTag.replace(/\D/g, '');
      const dayOffset =
        1 +
        (parseInt(tagDigits.slice(-9) || String(Date.now()), 10) % 90);
      const reportDate = new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
      await fieldPage.locator('#report-date').fill(reportDate);
      await fieldPage.locator('#report-title').fill(title);
      await fieldPage.locator('#report-weather').fill('Clear');
      await fieldPage.locator('#report-work').fill(`E2E pour ${runTag}`);
      const createDialog = fieldPage.getByRole('dialog');
      const createResp = fieldPage.waitForResponse(
        (r) =>
          r.url().includes(`/api/projects/${projectId}/daily-reports`) &&
          r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      const createBtn = createDialog.getByRole('button', { name: /create report/i });
      await createBtn.evaluate((btn) => (btn as HTMLButtonElement).click());
      const createResult = await createResp;
      expect(
        createResult.ok(),
        `daily report create failed: ${createResult.status()} ${await createResult.text()}`
      ).toBeTruthy();
      await expect(fieldPage.getByText(/daily report created/i)).toBeVisible({ timeout: 10_000 });
      await expect(createDialog).not.toBeVisible({ timeout: 15_000 });
      const reportRow = fieldPage.locator('table tbody tr').filter({ hasText: runTag });
      await expect(reportRow).toBeVisible({ timeout: 15_000 });

      const { page: pmPage } = pmCtx;
      await setActiveCompany(pmPage, companyId);
      await pmPage.goto(`/projects/${projectId}/daily-reports`);
      await pmPage.waitForResponse(
        (r) => r.url().includes(`/api/projects/${projectId}/daily-reports`) && r.ok(),
        { timeout: 20_000 }
      );
      await pmPage.getByPlaceholder(/search title, weather, or work narrative/i).fill(runTag);
      const row = pmPage.locator('table tbody tr').filter({ hasText: runTag });
      await expect(row).toBeVisible({ timeout: 20_000 });

      await row.getByRole('button', { name: /submit report/i }).click();
      await expect(row.getByText(/^Submitted$/i)).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: /approve report/i }).click();
      await expect(row.getByText(/^Approved$/i)).toBeVisible({ timeout: 15_000 });
      await row.getByRole('button', { name: /lock report/i }).click();
      await expect(row.getByText(/^Locked$/i)).toBeVisible({ timeout: 15_000 });
      console.log(`[${LIFECYCLE_NAMES[10]}] field create → PM Locked OK`);
    } finally {
      await closeContext(fieldCtx.context);
      await closeContext(pmCtx.context);
    }
  });
});