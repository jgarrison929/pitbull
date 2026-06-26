import { APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5081';

export interface AuthSession {
  token: string;
  tenantId: string;
  userId: string;
  email: string;
}

function decodeJwtClaim(token: string, claim: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  let payload = parts[1];
  const pad = 4 - (payload.length % 4);
  if (pad < 4) payload += '='.repeat(pad);
  const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  return json[claim] ?? null;
}

const sessionCache = new Map<string, AuthSession>();

/** Cached per worker to avoid login rate limits during setup + beforeAll + specs. */
export async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<AuthSession> {
  const cached = sessionCache.get(email.toLowerCase());
  if (cached) return cached;

  const resp = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  const tenantId = decodeJwtClaim(body.token, 'tenant_id');
  if (!tenantId) throw new Error(`No tenant_id in JWT for ${email}`);
  const session: AuthSession = {
    token: body.token,
    tenantId,
    userId: body.userId,
    email,
  };
  sessionCache.set(email.toLowerCase(), session);
  return session;
}

export function authHeaders(
  session: AuthSession,
  companyId?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
    'X-Tenant-Id': session.tenantId,
    'Content-Type': 'application/json',
  };
  if (companyId) headers['X-Company-Id'] = companyId;
  return headers;
}

export async function getActiveCompanyId(
  request: APIRequestContext,
  session: AuthSession
): Promise<string | null> {
  const resp = await request.get(`${API_BASE}/api/auth/me`, { headers: authHeaders(session) });
  if (!resp.ok()) return null;
  const profile = await resp.json();
  return profile?.activeCompany?.id ?? profile?.ActiveCompany?.Id ?? null;
}

export async function getFirstActiveProjectId(
  request: APIRequestContext,
  session: AuthSession
): Promise<string> {
  const resp = await request.get(`${API_BASE}/api/projects?page=1&pageSize=25`, {
    headers: authHeaders(session),
  });
  if (!resp.ok()) throw new Error(`Projects list failed: ${resp.status()} ${await resp.text()}`);
  const body = await resp.json();
  const items = body.items ?? body.Items ?? [];
  const active = items.find((p: { status?: string; Status?: string }) => {
    const s = (p.status ?? p.Status ?? '').toString();
    return s === 'Active' || s === '1';
  });
  const pick = active ?? items[0];
  if (!pick?.id && !pick?.Id) throw new Error('No projects available for E2E');
  return pick.id ?? pick.Id;
}

/** Prefer a project the given persona can see in UI lists (company/RLS scoped). */
export async function getFirstProjectIdForPersona(
  request: APIRequestContext,
  session: AuthSession
): Promise<string> {
  return getFirstActiveProjectId(request, session);
}

export async function getEntityStatus(
  request: APIRequestContext,
  session: AuthSession,
  path: string,
  companyId?: string | null
): Promise<string> {
  const resp = await request.get(`${API_BASE}${path}`, { headers: authHeaders(session, companyId) });
  if (!resp.ok()) throw new Error(`GET ${path} failed: ${resp.status()}`);
  const body = await resp.json();
  return (body.status ?? body.Status ?? body.statusName ?? body.StatusName ?? '').toString();
}

export interface BillingPrereqs {
  ownerContractId: string;
  ownerScheduleOfValuesId: string;
}

export async function getDefaultCompanyId(
  request: APIRequestContext,
  session: AuthSession
): Promise<string | null> {
  const resp = await request.get(`${API_BASE}/api/companies/accessible`, {
    headers: authHeaders(session),
  });
  if (!resp.ok()) return null;
  const companies = await resp.json();
  const list = Array.isArray(companies) ? companies : companies.items ?? companies.Items ?? [];
  const defaultCo =
    list.find((c: { isDefault?: boolean; IsDefault?: boolean }) => c.isDefault || c.IsDefault) ??
    list[0];
  return defaultCo?.id ?? defaultCo?.Id ?? null;
}

/** Read-only discovery for billing UI tests (seed or prior setup). */
export async function discoverBillingPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null
): Promise<BillingPrereqs | null> {
  const resp = await request.get(`${API_BASE}/api/owner-contracts?page=1&pageSize=20`, {
    headers: authHeaders(session, companyId),
  });
  if (!resp.ok()) return null;
  const body = await resp.json();
  const contracts = body.items ?? body.Items ?? [];

  for (const contract of contracts) {
    const id = contract.id ?? contract.Id;
    if (!id) continue;
    const sovResp = await request.get(`${API_BASE}/api/owner-contracts/${id}/sov`, {
      headers: authHeaders(session, companyId),
    });
    if (!sovResp.ok()) continue;
    const sovData = await sovResp.json();
    const directId = sovData?.id ?? sovData?.Id;
    if (directId) {
      const st = (sovData.status ?? sovData.Status ?? '').toString();
      if (st === 'Active' || st === '1' || st === '') {
        return { ownerContractId: id, ownerScheduleOfValuesId: directId };
      }
    }
    const list = Array.isArray(sovData) ? sovData : sovData.items ?? sovData.Items ?? [];
    const active = list.find((s: { status?: string; Status?: string; isActive?: boolean }) => {
      const st = (s.status ?? s.Status ?? '').toString();
      return st === 'Active' || s.isActive === true;
    });
    const pick = active ?? list[0];
    const sovId = pick?.id ?? pick?.Id;
    if (sovId) return { ownerContractId: id, ownerScheduleOfValuesId: sovId };
  }
  return null;
}

export interface PayAppPrereqs {
  subcontractId: string;
  subcontractNumber: string;
  projectId: string;
  maxWorkAmount: number;
}

/** Picks a subcontract with remaining billing headroom (avoids OVERBILLING on smoke seed). */
export async function discoverPayAppPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  preferredProjectId?: string,
  companyId?: string | null
): Promise<PayAppPrereqs | null> {
  const resp = await request.get(`${API_BASE}/api/subcontracts?pageSize=100`, {
    headers: authHeaders(session, companyId),
  });
  if (!resp.ok()) return null;
  const body = await resp.json();
  const items = body.items ?? body.Items ?? [];

  const preferred = preferredProjectId
    ? items.filter(
        (s: { projectId?: string; ProjectId?: string }) =>
          (s.projectId ?? s.ProjectId) === preferredProjectId
      )
    : [];
  const preferredIds = new Set(
    preferred.map((s: { id?: string; Id?: string }) => s.id ?? s.Id).filter(Boolean)
  );
  const candidates = [
    ...preferred,
    ...items.filter((s: { id?: string; Id?: string }) => !preferredIds.has(s.id ?? s.Id)),
  ];

  for (const sub of candidates) {
    const id = sub.id ?? sub.Id;
    if (!id) continue;
    const currentValue = Number(sub.currentValue ?? sub.CurrentValue ?? 0);
    const paResp = await request.get(
      `${API_BASE}/api/paymentapplications?subcontractId=${id}&pageSize=100`,
      { headers: authHeaders(session, companyId) }
    );
    let billed = 0;
    if (paResp.ok()) {
      const paBody = await paResp.json();
      const pas = paBody.items ?? paBody.Items ?? [];
      billed = pas.reduce(
        (sum: number, pa: { totalCompletedAndStored?: number; TotalCompletedAndStored?: number }) =>
          sum + Number(pa.totalCompletedAndStored ?? pa.TotalCompletedAndStored ?? 0),
        0
      );
    }
    const remaining = currentValue - billed;
    if (remaining >= 100) {
      return {
        subcontractId: id,
        subcontractNumber: (sub.subcontractNumber ?? sub.SubcontractNumber ?? id).toString(),
        projectId: (sub.projectId ?? sub.ProjectId ?? '').toString(),
        maxWorkAmount: Math.min(10000, Math.floor(remaining * 0.1 * 100) / 100),
      };
    }
  }
  return null;
}

/** Ensures field persona can submit time against the chosen project (assignment + Active status). */
export async function ensureTimeTrackingPrereqs(
  request: APIRequestContext,
  pmSession: AuthSession,
  fieldEmail: string,
  projectId: string,
  companyId?: string | null
): Promise<void> {
  const headers = authHeaders(pmSession, companyId);

  const projResp = await request.get(`${API_BASE}/api/projects/${projectId}`, { headers });
  if (projResp.ok()) {
    const proj = await projResp.json();
    const status = (proj.status ?? proj.Status ?? '').toString();
    if (status !== 'Active' && status !== '1') {
      const updateBody = {
        id: projectId,
        name: proj.name ?? proj.Name,
        number: proj.number ?? proj.Number,
        description: proj.description ?? proj.Description ?? null,
        status: 'Active',
        type: proj.type ?? proj.Type ?? 'Commercial',
        address: proj.address ?? proj.Address ?? null,
        city: proj.city ?? proj.City ?? null,
        state: proj.state ?? proj.State ?? null,
        zipCode: proj.zipCode ?? proj.ZipCode ?? null,
        clientName: proj.clientName ?? proj.ClientName ?? null,
        clientContact: proj.clientContact ?? proj.ClientContact ?? null,
        clientEmail: proj.clientEmail ?? proj.ClientEmail ?? null,
        clientPhone: proj.clientPhone ?? proj.ClientPhone ?? null,
        startDate: proj.startDate ?? proj.StartDate ?? null,
        estimatedCompletionDate: proj.estimatedCompletionDate ?? proj.EstimatedCompletionDate ?? null,
        actualCompletionDate: proj.actualCompletionDate ?? proj.ActualCompletionDate ?? null,
        contractAmount: proj.contractAmount ?? proj.ContractAmount ?? 0,
        projectManagerId: proj.projectManagerId ?? proj.ProjectManagerId ?? null,
        superintendentId: proj.superintendentId ?? proj.SuperintendentId ?? null,
      };
      await request.put(`${API_BASE}/api/projects/${projectId}`, {
        headers,
        data: updateBody,
      });
    }
  }

  const empResp = await request.get(`${API_BASE}/api/employees?page=1&pageSize=200`, { headers });
  if (!empResp.ok()) return;
  const empBody = await empResp.json();
  const items = empBody.items ?? empBody.Items ?? [];
  const fieldEmployee = items.find(
    (e: { email?: string }) => (e.email ?? '').toLowerCase() === fieldEmail.toLowerCase()
  );
  if (!fieldEmployee?.id && !fieldEmployee?.Id) return;
  const employeeId = fieldEmployee.id ?? fieldEmployee.Id;

  const assignField = await request.post(`${API_BASE}/api/project-assignments`, {
    headers,
    data: {
      employeeId,
      projectId,
      role: 'Worker',
      startDate: '2025-01-01',
      notes: 'E2E field time entry',
    },
  });
  if (!assignField.ok() && assignField.status() !== 409) {
    console.warn(
      `ensureTimeTrackingPrereqs: field assignment failed ${assignField.status()} ${await assignField.text()}`
    );
  }

  const pmEmployee = items.find(
    (e: { email?: string }) => (e.email ?? '').toLowerCase() === pmSession.email.toLowerCase()
  );
  const pmEmployeeId = pmEmployee?.id ?? pmEmployee?.Id;
  if (pmEmployeeId) {
    const assignPm = await request.post(`${API_BASE}/api/project-assignments`, {
      headers,
      data: {
        employeeId: pmEmployeeId,
        projectId,
        role: 'Manager',
        startDate: '2025-01-01',
        notes: 'E2E PM approval queue',
      },
    });
    if (!assignPm.ok() && assignPm.status() !== 409) {
      console.warn(
        `ensureTimeTrackingPrereqs: PM assignment failed ${assignPm.status()} ${await assignPm.text()}`
      );
    }
  }
}

/** Ensures PM (and optionally field) employees are assigned to a project for PM-scoped creates. */
export async function ensurePmProjectAssignment(
  request: APIRequestContext,
  pmSession: AuthSession,
  projectId: string,
  companyId?: string | null,
  options?: { fieldEmail?: string }
): Promise<void> {
  const headers = authHeaders(pmSession, companyId);
  const empResp = await request.get(`${API_BASE}/api/employees?page=1&pageSize=200`, { headers });
  if (!empResp.ok()) return;
  const empBody = await empResp.json();
  const items = empBody.items ?? empBody.Items ?? [];

  const pmEmployee = items.find(
    (e: { email?: string }) => (e.email ?? '').toLowerCase() === pmSession.email.toLowerCase()
  );
  const pmEmployeeId = pmEmployee?.id ?? pmEmployee?.Id;
  if (pmEmployeeId) {
    const assignPm = await request.post(`${API_BASE}/api/project-assignments`, {
      headers,
      data: {
        employeeId: pmEmployeeId,
        projectId,
        role: 'Manager',
        startDate: '2025-01-01',
        notes: 'E2E PM project access',
      },
    });
    if (!assignPm.ok() && assignPm.status() !== 409) {
      console.warn(
        `ensurePmProjectAssignment: PM assignment failed ${assignPm.status()} ${await assignPm.text()}`
      );
    }
  }

  if (options?.fieldEmail) {
    const fieldEmployee = items.find(
      (e: { email?: string }) => (e.email ?? '').toLowerCase() === options.fieldEmail!.toLowerCase()
    );
    const fieldEmployeeId = fieldEmployee?.id ?? fieldEmployee?.Id;
    if (fieldEmployeeId) {
      const assignField = await request.post(`${API_BASE}/api/project-assignments`, {
        headers,
        data: {
          employeeId: fieldEmployeeId,
          projectId,
          role: 'Worker',
          startDate: '2025-01-01',
          notes: 'E2E field project access',
        },
      });
      if (!assignField.ok() && assignField.status() !== 409) {
        console.warn(
          `ensurePmProjectAssignment: field assignment failed ${assignField.status()} ${await assignField.text()}`
        );
      }
    }
  }
}

/** Ensures at least one vendor exists for AP invoice E2E (demo seed may omit vendors). */
export async function ensureVendorPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null,
  runTag?: string
): Promise<string | null> {
  const headers = authHeaders(session, companyId);
  const listResp = await request.get(`${API_BASE}/api/vendors?pageSize=5`, { headers });
  if (listResp.ok()) {
    const body = await listResp.json();
    const items = body.items ?? body.Items ?? [];
    if (items.length > 0) {
      return (items[0].id ?? items[0].Id) as string;
    }
  }

  const tag = runTag ?? Date.now().toString(36);
  const createResp = await request.post(`${API_BASE}/api/vendors`, {
    headers,
    data: {
      name: `E2E Vendor ${tag}`,
      code: `E2E-V-${tag}`.slice(0, 20),
      isActive: true,
    },
  });
  if (!createResp.ok()) {
    console.warn(
      `ensureVendorPrereqs: vendor create failed ${createResp.status()} ${await createResp.text()}`
    );
    return null;
  }
  const created = await createResp.json();
  return (created.id ?? created.Id) as string;
}

export async function discoverSubcontractId(
  request: APIRequestContext,
  session: AuthSession,
  projectId: string,
  companyId?: string | null
): Promise<string | null> {
  const prereqs = await discoverPayAppPrereqs(request, session, projectId, companyId);
  return prereqs?.subcontractId ?? null;
}

export interface ProjectWithPhasesResult {
  projectId: string;
  phaseCount: number;
}

/** Creates a project, assigns team members, and verifies phases endpoint (read-only API). */
export async function createProjectWithPhases(
  request: APIRequestContext,
  session: AuthSession,
  options: {
    runTag: string;
    companyId?: string | null;
    teamEmails?: string[];
    phaseNames?: string[];
    contractAmount?: number;
  }
): Promise<ProjectWithPhasesResult> {
  const headers = authHeaders(session, options.companyId);
  const suffix = options.runTag.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || Date.now().toString(36);
  const number = `E2E-PRJ-${suffix}`.slice(0, 16);

  const createResp = await request.post(`${API_BASE}/api/projects`, {
    headers,
    data: {
      name: `E2E Project ${options.runTag}`,
      number,
      type: 'Commercial',
      contractAmount: options.contractAmount ?? 250000,
      description: `E2E setup ${options.runTag}`,
      startDate: new Date().toISOString().slice(0, 10),
    },
  });
  if (!createResp.ok()) {
    throw new Error(
      `createProjectWithPhases failed: ${createResp.status()} ${await createResp.text()}`
    );
  }
  const created = await createResp.json();
  const projectId = (created.id ?? created.Id) as string;

  const empResp = await request.get(`${API_BASE}/api/employees?page=1&pageSize=200`, { headers });
  if (empResp.ok()) {
    const empBody = await empResp.json();
    const items = empBody.items ?? empBody.Items ?? [];
    const teamEmails = options.teamEmails ?? [session.email];
    for (const email of teamEmails) {
      const employee = items.find(
        (e: { email?: string }) => (e.email ?? '').toLowerCase() === email.toLowerCase()
      );
      const employeeId = employee?.id ?? employee?.Id;
      if (!employeeId) continue;
      const role = email.toLowerCase() === session.email.toLowerCase() ? 'Manager' : 'Worker';
      await request.post(`${API_BASE}/api/project-assignments`, {
        headers,
        data: {
          employeeId,
          projectId,
          role,
          startDate: '2025-01-01',
          notes: `E2E team ${options.runTag}`,
        },
      });
    }
  }

  const phasesResp = await request.get(`${API_BASE}/api/projects/${projectId}/phases`, { headers });
  let phaseCount = 0;
  if (phasesResp.ok()) {
    const phasesBody = await phasesResp.json();
    const list = Array.isArray(phasesBody) ? phasesBody : phasesBody.items ?? phasesBody.Items ?? [];
    phaseCount = list.length;
  }

  return { projectId, phaseCount };
}

/** Activates a project (PreConstruction → Active). Tries POST /activate, falls back to PUT status. */
export async function activateProject(
  request: APIRequestContext,
  session: AuthSession,
  projectId: string,
  companyId?: string | null
): Promise<void> {
  const headers = authHeaders(session, companyId);

  const activateResp = await request.post(`${API_BASE}/api/projects/${projectId}/activate`, {
    headers,
  });
  if (activateResp.ok()) return;

  const projResp = await request.get(`${API_BASE}/api/projects/${projectId}`, { headers });
  if (!projResp.ok()) {
    throw new Error(`activateProject: GET project failed ${projResp.status()} ${await projResp.text()}`);
  }
  const proj = await projResp.json();
  const updateResp = await request.put(`${API_BASE}/api/projects/${projectId}`, {
    headers,
    data: {
      id: projectId,
      name: proj.name ?? proj.Name,
      number: proj.number ?? proj.Number,
      description: proj.description ?? proj.Description ?? null,
      status: 'Active',
      type: proj.type ?? proj.Type ?? 'Commercial',
      address: proj.address ?? proj.Address ?? null,
      city: proj.city ?? proj.City ?? null,
      state: proj.state ?? proj.State ?? null,
      zipCode: proj.zipCode ?? proj.ZipCode ?? null,
      clientName: proj.clientName ?? proj.ClientName ?? null,
      clientContact: proj.clientContact ?? proj.ClientContact ?? null,
      clientEmail: proj.clientEmail ?? proj.ClientEmail ?? null,
      clientPhone: proj.clientPhone ?? proj.ClientPhone ?? null,
      startDate: proj.startDate ?? proj.StartDate ?? null,
      estimatedCompletionDate: proj.estimatedCompletionDate ?? proj.EstimatedCompletionDate ?? null,
      actualCompletionDate: proj.actualCompletionDate ?? proj.ActualCompletionDate ?? null,
      contractAmount: proj.contractAmount ?? proj.ContractAmount ?? 0,
      projectManagerId: proj.projectManagerId ?? proj.ProjectManagerId ?? null,
      superintendentId: proj.superintendentId ?? proj.SuperintendentId ?? null,
    },
  });
  if (!updateResp.ok()) {
    throw new Error(
      `activateProject PUT failed: ${updateResp.status()} ${await updateResp.text()}`
    );
  }
}

export interface PayrollE2eResult {
  payPeriodId: string;
  payrollRunId: string;
  status: string;
}

async function ensurePayPeriodsForCompany(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null
): Promise<string> {
  const headers = authHeaders(session, companyId);
  const current = await request.get(`${API_BASE}/api/pay-periods/current`, { headers });
  if (current.ok()) {
    const body = await current.json();
    return (body.id ?? body.Id) as string;
  }

  const ceoSession = await loginApi(request, 'ceo@demo.local', process.env.DEMO_PASSWORD ?? 'PitbullDemo2026!');
  const ceoHeaders = authHeaders(ceoSession, companyId);
  await request.put(`${API_BASE}/api/pay-periods/configuration`, {
    headers: ceoHeaders,
    data: {
      type: 0,
      weekStartDay: 1,
      enforcementEnabled: true,
      periodsToGenerateAhead: 8,
    },
  });
  await request.post(`${API_BASE}/api/pay-periods/generate`, {
    headers: ceoHeaders,
    data: {
      fromDate: new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10),
      periodsToGenerate: 30,
    },
  });

  const retry = await request.get(`${API_BASE}/api/pay-periods/current`, { headers });
  if (!retry.ok()) {
    throw new Error(`ensurePayPeriodsForCompany failed: ${retry.status()} ${await retry.text()}`);
  }
  const period = await retry.json();
  return (period.id ?? period.Id) as string;
}

/** Lock pay period → generate payroll run → approve → export (API path for L3b). */
export async function runPayrollE2e(
  request: APIRequestContext,
  payrollSession: AuthSession,
  companyId?: string | null
): Promise<PayrollE2eResult> {
  const headers = authHeaders(payrollSession, companyId);
  const payPeriodId = await ensurePayPeriodsForCompany(request, payrollSession, companyId);

  const lockResp = await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/lock`, { headers });
  if (!lockResp.ok()) {
    throw new Error(`runPayrollE2e lock failed: ${lockResp.status()} ${await lockResp.text()}`);
  }

  const runDate = new Date().toISOString().slice(0, 10);
  const generateResp = await request.post(`${API_BASE}/api/payroll/runs/generate`, {
    headers,
    data: { runDate, payPeriodId },
  });
  if (!generateResp.ok()) {
    throw new Error(
      `runPayrollE2e generate failed: ${generateResp.status()} ${await generateResp.text()}`
    );
  }
  const run = await generateResp.json();
  const payrollRunId = (run.id ?? run.Id) as string;

  const approveResp = await request.post(`${API_BASE}/api/payroll/runs/${payrollRunId}/approve`, {
    headers,
  });
  if (!approveResp.ok()) {
    throw new Error(
      `runPayrollE2e approve failed: ${approveResp.status()} ${await approveResp.text()}`
    );
  }

  const exportResp = await request.post(`${API_BASE}/api/payroll/runs/${payrollRunId}/export`, {
    headers,
  });
  if (!exportResp.ok()) {
    throw new Error(
      `runPayrollE2e export failed: ${exportResp.status()} ${await exportResp.text()}`
    );
  }
  const exported = await exportResp.json();
  const status = (exported.status ?? exported.Status ?? 'Exported').toString();

  return { payPeriodId, payrollRunId, status };
}

export interface OwnerChangeOrderResult {
  id: string;
}

/**
 * Creates an owner-scoped change order when the API is available.
 * Returns null when endpoint is not yet implemented (404).
 */
export async function createOwnerChangeOrder(
  request: APIRequestContext,
  session: AuthSession,
  projectId: string,
  options: { runTag: string; companyId?: string | null; amount?: number }
): Promise<OwnerChangeOrderResult | null> {
  const headers = authHeaders(session, options.companyId);
  const suffix = options.runTag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const payload = {
    projectId,
    changeOrderNumber: `OCO-E2E-${suffix}`,
    title: `E2E owner CO ${options.runTag}`,
    description: 'Owner-directed scope addition',
    amount: options.amount ?? 7500,
  };

  const paths = [
    `${API_BASE}/api/projects/${projectId}/owner-change-orders`,
    `${API_BASE}/api/owner-change-orders`,
  ];
  for (const path of paths) {
    const resp = await request.post(path, { headers, data: payload });
    if (resp.ok()) {
      const body = await resp.json();
      const id = body.id ?? body.Id;
      if (id) return { id: id as string };
    }
    if (resp.status() === 404) continue;
    console.warn(`createOwnerChangeOrder ${path}: ${resp.status()} ${await resp.text()}`);
  }
  return null;
}

/** Ensures billing UI prereqs exist; creates owner contract + SOV when seed lacks them. */
export async function ensureBillingPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null,
  runTag?: string
): Promise<BillingPrereqs | null> {
  const discovered = await discoverBillingPrereqs(request, session, companyId);
  if (discovered) return discovered;

  const headers = authHeaders(session, companyId);
  const tag = runTag ?? Date.now().toString(36);
  const suffix = tag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const projectId = await getFirstActiveProjectId(request, session);

  const ocResp = await request.post(`${API_BASE}/api/owner-contracts`, {
    headers,
    data: {
      projectId,
      contractNumber: `E2E-OC-${suffix}`,
      projectName: `E2E Billing ${tag}`,
      originalContractSum: 500000,
    },
  });
  if (!ocResp.ok()) {
    console.warn(`ensureBillingPrereqs: owner contract ${ocResp.status()} ${await ocResp.text()}`);
    return null;
  }
  const ownerContract = await ocResp.json();
  const ownerContractId = (ownerContract.id ?? ownerContract.Id) as string;

  const sovResp = await request.post(`${API_BASE}/api/owner-contracts/${ownerContractId}/sov`, {
    headers,
    data: { projectId, name: `E2E SOV ${tag}` },
  });
  if (!sovResp.ok()) return null;
  const sov = await sovResp.json();
  const sovId = (sov.id ?? sov.Id) as string;

  await request.post(`${API_BASE}/api/owner-contracts/sov/${sovId}/lines`, {
    headers,
    data: { itemNumber: '1', description: 'General', scheduledValue: 500000, sortOrder: 1 },
  });
  const activateResp = await request.post(`${API_BASE}/api/owner-contracts/sov/${sovId}/activate`, {
    headers,
  });
  if (!activateResp.ok()) return null;

  return { ownerContractId, ownerScheduleOfValuesId: sovId };
}

/** Discovers or creates a subcontract with billing headroom for pay-app E2E. */
export async function ensurePayAppPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  preferredProjectId?: string,
  companyId?: string | null,
  runTag?: string
): Promise<PayAppPrereqs | null> {
  const discovered = await discoverPayAppPrereqs(
    request,
    session,
    preferredProjectId,
    companyId
  );
  if (discovered) return discovered;

  const headers = authHeaders(session, companyId);
  const tag = runTag ?? Date.now().toString(36);
  const suffix = tag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const projectId = preferredProjectId ?? (await getFirstActiveProjectId(request, session));

  const scResp = await request.post(`${API_BASE}/api/subcontracts`, {
    headers,
    data: {
      projectId,
      subcontractNumber: `E2E-SC-${suffix}`,
      subcontractorName: `E2E Sub ${tag}`,
      scopeOfWork: 'E2E concrete scope',
      originalValue: 100000,
      retainagePercent: 10,
      startDate: '2025-01-01',
    },
  });
  if (!scResp.ok()) {
    console.warn(`ensurePayAppPrereqs: subcontract create ${scResp.status()} ${await scResp.text()}`);
    return null;
  }
  const subcontract = await scResp.json();
  const subcontractId = (subcontract.id ?? subcontract.Id) as string;
  const subcontractNumber = (
    subcontract.subcontractNumber ?? subcontract.SubcontractNumber ?? subcontractId
  ).toString();

  const signResp = await request.put(`${API_BASE}/api/subcontracts/${subcontractId}`, {
    headers,
    data: {
      id: subcontractId,
      subcontractNumber,
      subcontractorName: subcontract.subcontractorName ?? subcontract.SubcontractorName,
      scopeOfWork: subcontract.scopeOfWork ?? subcontract.ScopeOfWork ?? 'E2E scope',
      originalValue: subcontract.originalValue ?? subcontract.OriginalValue ?? 100000,
      retainagePercent: subcontract.retainagePercent ?? subcontract.RetainagePercent ?? 10,
      executionDate: new Date().toISOString(),
      status: 'Executed',
    },
  });
  if (!signResp.ok()) {
    console.warn(`ensurePayAppPrereqs: subcontract sign ${signResp.status()} ${await signResp.text()}`);
    return null;
  }

  return {
    subcontractId,
    subcontractNumber,
    projectId,
    maxWorkAmount: 10000,
  };
}