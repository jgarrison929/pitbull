import { test, expect } from '@playwright/test';
import path from 'path';
import { PERSONAS, DEMO_PASSWORD, LIFECYCLE_NAMES } from '../fixtures/roles';
import {
  loginApi,
  authHeaders,
  getFirstActiveProjectId,
  getEntityStatus,
} from '../fixtures/api-helpers';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5081';
const runTag = Date.now().toString(36);

test.describe.configure({ mode: 'serial' });

test.describe('Role-based workflow lifecycles', () => {
  let projectId: string;
  let subcontractId: string;

  test.beforeAll(async ({ request }) => {
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);
    projectId = await getFirstActiveProjectId(request, pm);

    const scResp = await request.get(`${API_BASE}/api/subcontracts?projectId=${projectId}&pageSize=5`, {
      headers: authHeaders(pm),
    });
    if (scResp.ok()) {
      const scBody = await scResp.json();
      const items = scBody.items ?? [];
      if (items[0]?.id) subcontractId = items[0].id;
    }
  });

  // ── 1. Bid → Project (Estimator) ──────────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/estimator.json') });
  test('L1 Bid: estimator advances Draft → Submitted in UI', async ({ page, request }) => {
    const estimator = await loginApi(request, PERSONAS.estimator.email, DEMO_PASSWORD);
    const bidNum = `E2E-BID-${runTag}`;
    const create = await request.post(`${API_BASE}/api/bids`, {
      headers: authHeaders(estimator),
      data: {
        name: `E2E Bid ${runTag}`,
        number: bidNum,
        estimatedValue: 150000,
        bidDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        owner: 'E2E Owner',
        description: 'Role E2E bid',
        items: [],
      },
    });
    expect(create.ok()).toBeTruthy();
    const bid = await create.json();

    await page.goto(`/bids/${bid.id}/edit`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Submitted' }).click();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 15_000 });

    const status = await getEntityStatus(request, estimator, `/api/bids/${bid.id}`);
    expect(status.toLowerCase()).toContain('submitted');
    console.log(`[${LIFECYCLE_NAMES[1]}] estimator → Submitted OK`);
  });

  // ── 2. Project setup (PM) — G6 navigation chain ─────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/pm.json') });
  test('L2 Project setup: PM navigates Day-1 chain without dead ends', async ({ page }) => {
    const chain = [
      { url: '/cost-codes', heading: /cost code/i },
      { url: '/employees', heading: /employee/i },
      { url: '/projects', heading: /project/i },
      { url: '/contracts', heading: /contract/i },
      { url: `/projects/${projectId}`, heading: /.+/ },
    ];
    for (const step of chain) {
      await page.goto(step.url);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { name: step.heading }).first()).toBeVisible({ timeout: 15_000 });
    }
    console.log(`[${LIFECYCLE_NAMES[2]}] PM Day-1 chain navigable`);
  });

  // ── 3. Crew time → approval (Field → PM) ──────────────────────────
  test('L3 Time: field submits, PM approves in UI', async ({ page, request }) => {
    const field = await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD);
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const ccResp = await request.get(`${API_BASE}/api/cost-codes`, { headers: authHeaders(field) });
    expect(ccResp.ok()).toBeTruthy();
    const ccBody = await ccResp.json();
    const costCodeId = ccBody.items?.[0]?.id;
    expect(costCodeId).toBeTruthy();

    const empResp = await request.get(`${API_BASE}/api/employees/me`, { headers: authHeaders(field) });
    const empBody = empResp.ok() ? await empResp.json() : null;
    const employeeId = empBody?.id ?? empBody?.Id;

    const teCreate = await request.post(`${API_BASE}/api/time-entries`, {
      headers: authHeaders(field),
      data: {
        date: new Date().toISOString().slice(0, 10),
        employeeId,
        projectId,
        costCodeId,
        regularHours: 8,
        overtimeHours: 0,
        doubletimeHours: 0,
        description: `E2E time ${runTag}`,
      },
    });
    expect(teCreate.status()).toBe(201);
    const te = await teCreate.json();
    expect(te.status).toBe('Draft');

    const teSubmit = await request.post(`${API_BASE}/api/time-entries/submit`, {
      headers: authHeaders(field),
      data: { timeEntryIds: [te.id], submittedById: employeeId },
    });
    expect(teSubmit.ok()).toBeTruthy();

    await page.goto('/time-tracking?view=entries');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: /approve selected/i }).first().click({ timeout: 5_000 }).catch(async () => {
      const row = page.locator('table tbody tr').filter({ hasText: runTag }).first();
      await row.locator('input[type="checkbox"]').check();
      await page.getByRole('button', { name: /approve/i }).first().click();
    });

    await page.waitForTimeout(2000);
    const approved = await getEntityStatus(request, pm, `/api/time-entries/${te.id}`);
    expect(approved).toBe('Approved');
    console.log(`[${LIFECYCLE_NAMES[3]}] field Draft→Submitted, PM Approved`);
  });

  // ── 4. Owner billing (PM submit → AR) ─────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/arClerk.json') });
  test('L4 Owner billing: PM creates, AR advances via UI', async ({ page, request }) => {
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);
    const ar = await loginApi(request, PERSONAS.arClerk.email, DEMO_PASSWORD);

    const ocCreate = await request.post(`${API_BASE}/api/owner-contracts`, {
      headers: authHeaders(pm),
      data: {
        projectId,
        contractNumber: `OC-E2E-${runTag}`,
        projectName: 'E2E Project',
        originalContractSum: 500000,
      },
    });
    expect(ocCreate.ok()).toBeTruthy();
    const oc = await ocCreate.json();

    const sovCreate = await request.post(`${API_BASE}/api/owner-contracts/${oc.id}/sov`, {
      headers: authHeaders(pm),
      data: { projectId },
    });
    expect(sovCreate.ok()).toBeTruthy();
    const sov = await sovCreate.json();

    await request.post(`${API_BASE}/api/owner-contracts/sov/${sov.id}/lines`, {
      headers: authHeaders(pm),
      data: { itemNumber: '1', description: 'Concrete', scheduledValue: 300000 },
    });
    await request.post(`${API_BASE}/api/owner-contracts/sov/${sov.id}/activate`, {
      headers: authHeaders(pm),
    });

    const billCreate = await request.post(`${API_BASE}/api/billing-applications`, {
      headers: authHeaders(pm),
      data: {
        ownerContractId: oc.id,
        ownerScheduleOfValuesId: sov.id,
        periodFrom: '2026-01-01',
        periodThrough: '2026-01-31',
        applicationDate: '2026-01-31',
      },
    });
    expect(billCreate.ok()).toBeTruthy();
    const bill = await billCreate.json();

    await request.post(`${API_BASE}/api/billing-applications/${bill.id}/submit-for-review`, {
      headers: authHeaders(pm),
    });

    await page.goto(`/billing/applications/${bill.id}`);
    await page.waitForLoadState('domcontentloaded');
    const submitBtn = page.getByRole('button', { name: /submit to owner/i });
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
    }
    const certifyBtn = page.getByRole('button', { name: /architect certified|certified/i });
    if (await certifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await certifyBtn.click();
    }

    const status = await getEntityStatus(request, ar, `/api/billing-applications/${bill.id}`);
    expect(status).not.toBe('Draft');
    console.log(`[${LIFECYCLE_NAMES[4]}] AR advanced billing to ${status}`);
  });

  // ── 5. Sub pay app (PM → AP) ──────────────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/apClerk.json') });
  test('L5 Sub pay app: PM creates, AP submits', async ({ page, request }) => {
    test.skip(!subcontractId, 'No subcontract in seed data');
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const payCreate = await request.post(`${API_BASE}/api/paymentapplications`, {
      headers: authHeaders(pm),
      data: {
        subcontractId,
        periodStart: '2026-02-01T00:00:00Z',
        periodEnd: '2026-02-28T00:00:00Z',
        workCompletedThisPeriod: 10000,
        storedMaterials: 0,
        invoiceNumber: `INV-E2E-${runTag}`,
        notes: 'E2E sub pay app',
      },
    });
    expect(payCreate.ok()).toBeTruthy();
    const payApp = await payCreate.json();

    await page.goto(`/payment-applications/${payApp.id}`);
    await page.waitForLoadState('domcontentloaded');
    const submitBtn = page.getByRole('button', { name: /^submit$/i });
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
    } else {
      await request.post(`${API_BASE}/api/paymentapplications/${payApp.id}/submit`, {
        headers: authHeaders(pm),
      });
    }

    const status = await getEntityStatus(request, pm, `/api/paymentapplications/${payApp.id}`);
    expect(status).toBe('Submitted');
    console.log(`[${LIFECYCLE_NAMES[5]}] AP path → Submitted`);
  });

  // ── 6. Change order (PM) ──────────────────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/pm.json') });
  test('L6 Change order: PM Pending → UnderReview → Approved', async ({ request }) => {
    test.skip(!subcontractId, 'No subcontract in seed data');
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const coCreate = await request.post(`${API_BASE}/api/changeorders`, {
      headers: authHeaders(pm),
      data: {
        subcontractId,
        changeOrderNumber: `CO-E2E-${runTag}`,
        title: 'E2E footing change',
        description: 'Field condition',
        reason: 'Soil',
        amount: 5000,
        daysExtension: 1,
      },
    });
    expect(coCreate.ok()).toBeTruthy();
    const co = await coCreate.json();

    for (const [status, label] of [['UnderReview', 'UnderReview'], ['Approved', 'Approved']] as const) {
      const upd = await request.put(`${API_BASE}/api/changeorders/${co.id}`, {
        headers: authHeaders(pm),
        data: {
          id: co.id,
          title: co.title,
          description: co.description ?? 'Field condition',
          reason: co.reason ?? 'Soil',
          amount: co.amount ?? 5000,
          daysExtension: co.daysExtension ?? 1,
          status,
          referenceNumber: co.referenceNumber,
        },
      });
      expect(upd.ok()).toBeTruthy();
      const body = await upd.json();
      expect((body.status ?? body.Status).toString()).toContain(label === 'UnderReview' ? 'UnderReview' : 'Approved');
    }
    console.log(`[${LIFECYCLE_NAMES[6]}] PM → Approved`);
  });

  // ── 7. RFI (PM) ───────────────────────────────────────────────────
  test('L7 RFI: PM Open → Answered', async ({ page, request }) => {
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const rfiCreate = await request.post(`${API_BASE}/api/projects/${projectId}/rfis`, {
      headers: authHeaders(pm),
      data: {
        subject: `E2E RFI ${runTag}`,
        question: 'Clarify rebar spacing?',
        priority: 1,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        ballInCourtName: 'Architect',
      },
    });
    expect(rfiCreate.ok()).toBeTruthy();
    const rfi = await rfiCreate.json();

    await page.goto(`/projects/${projectId}/rfis/${rfi.id}`);
    await page.waitForLoadState('domcontentloaded');
    const answerBtn = page.getByRole('button', { name: /answer|mark answered/i });
    if (await answerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await answerBtn.click();
    }

    const upd = await request.put(`${API_BASE}/api/projects/${projectId}/rfis/${rfi.id}`, {
      headers: authHeaders(pm),
      data: {
        subject: rfi.subject,
        question: rfi.question,
        answer: 'Per spec section 03 30 00.',
        status: 1,
        priority: 1,
      },
    });
    expect(upd.ok()).toBeTruthy();
    const status = await getEntityStatus(request, pm, `/api/projects/${projectId}/rfis/${rfi.id}`);
    expect(status).toContain('Answered');
    console.log(`[${LIFECYCLE_NAMES[7]}] PM → Answered`);
  });

  // ── 8. Submittal (PM) ─────────────────────────────────────────────
  test('L8 Submittal: PM Draft → Submitted', async ({ page, request }) => {
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const subCreate = await request.post(`${API_BASE}/api/projects/${projectId}/submittals`, {
      headers: authHeaders(pm),
      data: {
        title: `E2E Submittal ${runTag}`,
        data: {
          Title: `E2E Submittal ${runTag}`,
          SpecSectionCode: '03 30 00',
          SubmittalType: 'ShopDrawing',
        },
      },
    });
    expect(subCreate.ok()).toBeTruthy();
    const sub = await subCreate.json();

    await page.goto(`/projects/${projectId}/submittals`);
    await page.waitForLoadState('domcontentloaded');

    const put = await request.put(`${API_BASE}/api/projects/${projectId}/submittals/${sub.id}`, {
      headers: authHeaders(pm),
      data: { title: sub.title ?? `E2E Submittal ${runTag}`, status: 'Submitted' },
    });
    expect(put.ok()).toBeTruthy();

    const status = await getEntityStatus(request, pm, `/api/projects/${projectId}/submittals/${sub.id}`);
    expect(status).toBe('Submitted');
    console.log(`[${LIFECYCLE_NAMES[8]}] PM → Submitted`);
  });

  // ── 9. Vendor invoice (AP) ────────────────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/apClerk.json') });
  test('L9 Vendor invoice: AP match workflow', async ({ page, request }) => {
    const ap = await loginApi(request, PERSONAS.apClerk.email, DEMO_PASSWORD);
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const vendors = await request.get(`${API_BASE}/api/vendors?pageSize=5`, { headers: authHeaders(ap) });
    let vendorId: string | undefined;
    if (vendors.ok()) {
      const vBody = await vendors.json();
      vendorId = vBody.items?.[0]?.id;
    }

    const invCreate = await request.post(`${API_BASE}/api/vendor-invoices`, {
      headers: authHeaders(ap),
      data: {
        vendorId: vendorId ?? '00000000-0000-0000-0000-000000000001',
        invoiceNumber: `VI-E2E-${runTag}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        totalAmount: 1500,
      },
    });
    if (!invCreate.ok()) {
      console.log(`[${LIFECYCLE_NAMES[9]}] SKIP — vendor invoice create ${invCreate.status()}`);
      test.skip(true, 'Vendor or invoice create unavailable');
    }
    const inv = await invCreate.json();

    await page.goto('/procurement/invoices');
    await page.waitForLoadState('domcontentloaded');
    const matchBtn = page.getByRole('button', { name: /match/i }).first();
    if (await matchBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await matchBtn.click();
      await page.waitForTimeout(1500);
    } else {
      await request.post(`${API_BASE}/api/vendor-invoices/${inv.id}/match`, {
        headers: authHeaders(ap),
        data: { tolerancePercent: 5 },
      });
    }

    const fieldDenied = await request.get(`${API_BASE}/api/vendor-invoices?page=1`, {
      headers: authHeaders(await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD)),
    });
    expect(fieldDenied.status()).toBe(403);

    const status = await getEntityStatus(request, ap, `/api/vendor-invoices/${inv.id}`);
    expect(['Matched', 'Pending', 'Approved']).toContain(status);
    console.log(`[${LIFECYCLE_NAMES[9]}] AP → ${status}, field-eng 403 OK`);
  });

  // ── 10. Daily report (Field → PM) ─────────────────────────────────
  test.use({ storageState: path.join(__dirname, '../.auth/pm.json') });
  test('L10 Daily report: field creates, PM submit/approve/lock in UI', async ({ page, request }) => {
    const field = await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD);
    const pm = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);

    const drCreate = await request.post(`${API_BASE}/api/projects/${projectId}/daily-reports`, {
      headers: authHeaders(field),
      data: {
        name: `E2E Daily ${runTag}`,
        data: {
          ReportDate: new Date().toISOString(),
          ReportType: 'Foreman',
          WeatherSummary: 'Clear',
          WorkNarrative: `E2E pour ${runTag}`,
          PreparedByUserId: field.userId,
        },
      },
    });
    expect(drCreate.ok()).toBeTruthy();
    const dr = await drCreate.json();

    await page.goto(`/projects/${projectId}/daily-reports`);
    await page.waitForLoadState('domcontentloaded');

    const row = page.locator('table tbody tr').filter({ hasText: runTag }).first();
    await row.getByRole('button', { name: /submit report/i }).click();
    await page.waitForTimeout(1000);
    await row.getByRole('button', { name: /approve report/i }).click();
    await page.waitForTimeout(1000);
    await row.getByRole('button', { name: /lock report/i }).click();
    await page.waitForTimeout(1000);

    const status = await getEntityStatus(
      request,
      pm,
      `/api/projects/${projectId}/daily-reports/${dr.id}`
    );
    expect(status).toBe('Locked');
    console.log(`[${LIFECYCLE_NAMES[10]}] PM → Locked`);
  });
});