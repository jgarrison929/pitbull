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

/** True when GET /api/projects/{id} succeeds under the given company header (RLS-scoped). */
export async function isProjectVisibleUnderCompany(
  request: APIRequestContext,
  session: AuthSession,
  projectId: string,
  companyId: string
): Promise<boolean> {
  const resp = await request.get(`${API_BASE}/api/projects/${projectId}`, {
    headers: authHeaders(session, companyId),
  });
  return resp.ok();
}

export async function getFirstActiveProjectId(
  request: APIRequestContext,
  session: AuthSession,
  companyId: string
): Promise<string> {
  const resp = await request.get(`${API_BASE}/api/projects?page=1&pageSize=25`, {
    headers: authHeaders(session, companyId),
  });
  if (!resp.ok()) throw new Error(`Projects list failed: ${resp.status()} ${await resp.text()}`);
  const body = await resp.json();
  const items = body.items ?? body.Items ?? [];
  const active = items.find((p: { status?: string; Status?: string }) => {
    const s = (p.status ?? p.Status ?? '').toString();
    return s === 'Active' || s === '1';
  });
  const pick = active ?? items[0];
  if (!pick?.id && !pick?.Id) {
    throw new Error(`No projects available for E2E under company ${companyId}`);
  }
  return pick.id ?? pick.Id;
}

/** Prefer a project the given persona can see in UI lists (company/RLS scoped). */
export async function getFirstProjectIdForPersona(
  request: APIRequestContext,
  session: AuthSession,
  companyId: string
): Promise<string> {
  return getFirstActiveProjectId(request, session, companyId);
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

/** Demo seed employee numbers keyed by login email (fallback when paginated lists truncate). */
const DEMO_EMPLOYEE_NUMBERS: Record<string, string> = {
  'pm@demo.local': 'DEMO-PM',
  'field-eng@demo.local': 'DEMO-FE',
  'ar-clerk@demo.local': 'DEMO-ARC',
  'ap-clerk@demo.local': 'DEMO-APC',
  'mgr-payroll@demo.local': 'DEMO-MP',
  'estimator@demo.local': 'DEMO-EST',
};

/** Resolve an employee id by email without relying on the first page of an unfiltered list. */
async function resolveEmployeeIdByEmail(
  request: APIRequestContext,
  session: AuthSession,
  email: string,
  companyId?: string | null
): Promise<string | null> {
  const normalized = email.toLowerCase();
  const headers = authHeaders(session, companyId);
  const searchTerms = [email, DEMO_EMPLOYEE_NUMBERS[normalized]].filter(
    (term): term is string => Boolean(term)
  );

  for (const term of searchTerms) {
    const resp = await request.get(
      `${API_BASE}/api/employees?search=${encodeURIComponent(term)}&page=1&pageSize=50`,
      { headers }
    );
    if (!resp.ok()) continue;
    const body = await resp.json();
    const items = body.items ?? body.Items ?? [];
    const byEmail = items.find(
      (e: { email?: string; Email?: string }) =>
        (e.email ?? e.Email ?? '').toLowerCase() === normalized
    );
    const byEmailId = byEmail?.id ?? byEmail?.Id;
    if (byEmailId) return byEmailId;

    const demoNumber = DEMO_EMPLOYEE_NUMBERS[normalized];
    if (demoNumber) {
      const byNumber = items.find(
        (e: { employeeNumber?: string; EmployeeNumber?: string }) =>
          (e.employeeNumber ?? e.EmployeeNumber ?? '').toUpperCase() === demoNumber
      );
      const byNumberId = byNumber?.id ?? byNumber?.Id;
      if (byNumberId) return byNumberId;
    }
  }

  if (normalized === session.email.toLowerCase()) {
    const meResp = await request.get(`${API_BASE}/api/auth/me`, {
      headers: authHeaders(session),
    });
    if (meResp.ok()) {
      const me = await meResp.json();
      const id = me.employeeId ?? me.EmployeeId;
      if (id) return id;
    }
  }

  return null;
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

  const employeeId = await resolveEmployeeIdByEmail(request, pmSession, fieldEmail, companyId);
  if (!employeeId) return;

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
    throw new Error(
      `ensureTimeTrackingPrereqs: field assignment failed ${assignField.status()} ${await assignField.text()}`
    );
  }

  const pmEmployeeId = await resolveEmployeeIdByEmail(
    request,
    pmSession,
    pmSession.email,
    companyId
  );
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
      throw new Error(
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
  companyId: string,
  options?: { fieldEmail?: string }
): Promise<void> {
  if (!(await isProjectVisibleUnderCompany(request, pmSession, projectId, companyId))) {
    throw new Error(
      `ensurePmProjectAssignment: project ${projectId} not visible under company ${companyId}`
    );
  }
  const headers = authHeaders(pmSession, companyId);
  const pmEmployeeId = await resolveEmployeeIdByEmail(
    request,
    pmSession,
    pmSession.email,
    companyId
  );
  if (!pmEmployeeId) {
    throw new Error(`ensurePmProjectAssignment: no employee record for PM ${pmSession.email}`);
  }
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
    throw new Error(
      `ensurePmProjectAssignment: PM assignment failed ${assignPm.status()} ${await assignPm.text()}`
    );
  }

  if (options?.fieldEmail) {
    const fieldEmployeeId = await resolveEmployeeIdByEmail(
      request,
      pmSession,
      options.fieldEmail,
      companyId
    );
    if (!fieldEmployeeId) {
      throw new Error(`ensurePmProjectAssignment: no employee for ${options.fieldEmail}`);
    }
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
      throw new Error(
        `ensurePmProjectAssignment: field assignment failed ${assignField.status()} ${await assignField.text()}`
      );
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

/** Ensures GL accounts 5200/2000 exist for vendor-invoice accrual on approve (per company). */
export async function ensureGlAccountsForAp(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null
): Promise<void> {
  const headers = authHeaders(session, companyId);

  async function ensureAccount(
    number: string,
    name: string,
    accountType: number,
    normalBalance: number
  ): Promise<void> {
    const listResp = await request.get(
      `${API_BASE}/api/chart-of-accounts?search=${encodeURIComponent(number)}&pageSize=10`,
      { headers }
    );
    if (listResp.ok()) {
      const body = await listResp.json();
      const items = body.items ?? body.Items ?? [];
      if (
        items.some(
          (a: { accountNumber?: string; AccountNumber?: string }) =>
            (a.accountNumber ?? a.AccountNumber) === number
        )
      ) {
        return;
      }
    }
    const createResp = await request.post(`${API_BASE}/api/chart-of-accounts`, {
      headers,
      data: { accountNumber: number, accountName: name, accountType, normalBalance, isActive: true },
    });
    if (!createResp.ok()) {
      console.warn(
        `ensureGlAccountsForAp: ${number} create failed ${createResp.status()} ${await createResp.text()}`
      );
    }
  }

  await ensureAccount('5200', 'Materials', 5, 1);
  await ensureAccount('2000', 'Accounts Payable', 2, 2);
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

  const empResp = await request.get(`${API_BASE}/api/employees?page=1&pageSize=200`, { headers });
  const teamMembers: { employeeId: string; role: string; assignmentRole: number }[] = [];
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
      const isPm = email.toLowerCase() === session.email.toLowerCase();
      teamMembers.push({
        employeeId,
        role: isPm ? 'Project Manager' : 'Worker',
        assignmentRole: isPm ? 2 : 0,
      });
    }
  }

  const phaseNames = options.phaseNames ?? ['Foundation', 'Framing'];
  const phases = phaseNames.map((name, i) => ({
    name,
    costCode: `0${(i + 3) * 1000}`.slice(0, 5),
    budgetAmount: 0,
  }));

  const createResp = await request.post(`${API_BASE}/api/projects`, {
    headers,
    data: {
      name: `E2E Project ${options.runTag}`,
      number,
      type: 'Commercial',
      contractAmount: options.contractAmount ?? 250000,
      description: `E2E setup ${options.runTag}`,
      startDate: new Date().toISOString().slice(0, 10),
      phases,
      teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
    },
  });
  if (!createResp.ok()) {
    throw new Error(
      `createProjectWithPhases failed: ${createResp.status()} ${await createResp.text()}`
    );
  }
  const created = await createResp.json();
  const projectId = (created.id ?? created.Id) as string;

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

export interface PayrollE2eLine {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
}

export interface PayrollE2eResult {
  payPeriodId: string;
  payrollRunId: string;
  status: string;
  lines: PayrollE2eLine[];
  totalOvertimeHours: number;
}

export interface PayrollE2eOptions {
  seedOvertime?: boolean;
  pmSession?: AuthSession;
  fieldSession?: AuthSession;
  projectId?: string;
  fieldEmail?: string;
}

function parsePayrollLines(runBody: Record<string, unknown>): PayrollE2eLine[] {
  const rawLines = (runBody.lines ?? runBody.Lines ?? []) as Record<string, unknown>[];
  return rawLines.map((line) => ({
    employeeId: String(line.employeeId ?? line.EmployeeId ?? ''),
    regularHours: Number(line.regularHours ?? line.RegularHours ?? 0),
    overtimeHours: Number(line.overtimeHours ?? line.OvertimeHours ?? 0),
    doubletimeHours: Number(line.doubletimeHours ?? line.DoubletimeHours ?? 0),
  }));
}

/** Sets California OT thresholds (6h daily) on the active company for payroll derivation tests. */
export async function configurePayrollOvertimeForE2e(
  request: APIRequestContext,
  session: AuthSession,
  companyId?: string | null
): Promise<void> {
  const headers = authHeaders(session, companyId);
  const getResp = await request.get(`${API_BASE}/api/companies/settings/reports`, { headers });
  const base = getResp.ok() ? ((await getResp.json()) as Record<string, unknown>) : {};

  const putResp = await request.put(`${API_BASE}/api/companies/settings/reports`, {
    headers,
    data: {
      overtimeRules: 'California',
      overtimeEnabled: true,
      dailyOvertimeThreshold: 6,
      dailyDoubletimeThreshold: 10,
      weeklyOvertimeThreshold: 40,
      saturdayRule: base.saturdayRule ?? base.SaturdayRule ?? 'overtime',
      sundayRule: base.sundayRule ?? base.SundayRule ?? 'doubletime',
      holidayRule: base.holidayRule ?? base.HolidayRule ?? 'overtime',
      holidaysJson: base.holidaysJson ?? base.HolidaysJson ?? '[]',
      reportBrandingName: base.reportBrandingName ?? base.ReportBrandingName ?? '',
      reportLogoUrl: base.reportLogoUrl ?? base.ReportLogoUrl ?? '',
      fiscalYearStartMonth: base.fiscalYearStartMonth ?? base.FiscalYearStartMonth ?? 1,
    },
  });
  if (!putResp.ok()) {
    throw new Error(
      `configurePayrollOvertimeForE2e failed: ${putResp.status()} ${await putResp.text()}`
    );
  }
}

/** Creates a 10h approved time entry inside the pay period for OT derivation (California 6h threshold → 4h OT). */
export async function seedApprovedOvertimeTimeEntryForE2e(
  request: APIRequestContext,
  pmSession: AuthSession,
  fieldSession: AuthSession,
  options: {
    companyId?: string | null;
    payPeriodId: string;
    projectId?: string;
    fieldEmail?: string;
    regularHours?: number;
  }
): Promise<{ timeEntryId: string; entryDate: string }> {
  const pmHeaders = authHeaders(pmSession, options.companyId);
  const fieldHeaders = authHeaders(fieldSession, options.companyId);
  const fieldEmail = options.fieldEmail ?? fieldSession.email;

  const periodResp = await request.get(`${API_BASE}/api/pay-periods/${options.payPeriodId}`, {
    headers: pmHeaders,
  });
  if (!periodResp.ok()) {
    throw new Error(
      `seedApprovedOvertimeTimeEntry pay period lookup failed: ${periodResp.status()} ${await periodResp.text()}`
    );
  }
  const period = await periodResp.json();
  const periodStart = String(period.startDate ?? period.StartDate);
  const periodEnd = String(period.endDate ?? period.EndDate);
  const salt = process.env.E2E_RUN_TAG ?? Date.now().toString(36);
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const daySpan = Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
  const dayOffset = [...salt].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % daySpan;
  const entryDate = new Date(startMs + dayOffset * 86_400_000).toISOString().slice(0, 10);

  let projectId = options.projectId;
  if (!projectId) {
    if (!options.companyId) {
      throw new Error('seedApprovedOvertimeTimeEntry: companyId required when projectId omitted');
    }
    projectId = await getFirstActiveProjectId(request, pmSession, options.companyId);
  }
  await ensureTimeTrackingPrereqs(request, pmSession, fieldEmail, projectId, options.companyId);

  const empResp = await request.get(`${API_BASE}/api/employees?page=1&pageSize=200`, { headers: pmHeaders });
  if (!empResp.ok()) {
    throw new Error(`seedApprovedOvertimeTimeEntry employees failed: ${empResp.status()}`);
  }
  const empBody = await empResp.json();
  const employees = empBody.items ?? empBody.Items ?? [];
  const fieldEmployee = employees.find(
    (e: { email?: string }) => (e.email ?? '').toLowerCase() === fieldEmail.toLowerCase()
  );
  const employeeId = fieldEmployee?.id ?? fieldEmployee?.Id;
  if (!employeeId) {
    throw new Error(`seedApprovedOvertimeTimeEntry: no employee for ${fieldEmail}`);
  }

  const ccResp = await request.get(`${API_BASE}/api/cost-codes?page=1&pageSize=5`, { headers: pmHeaders });
  if (!ccResp.ok()) {
    throw new Error(`seedApprovedOvertimeTimeEntry cost codes failed: ${ccResp.status()}`);
  }
  const ccBody = await ccResp.json();
  const costCodes = ccBody.items ?? ccBody.Items ?? [];
  const costCodeId = costCodes[0]?.id ?? costCodes[0]?.Id;
  if (!costCodeId) {
    throw new Error('seedApprovedOvertimeTimeEntry: no cost codes available');
  }

  const batchResp = await request.post(`${API_BASE}/api/time-entries/batch`, {
    headers: fieldHeaders,
    data: {
      entries: [
        {
          date: entryDate,
          employeeId,
          projectId,
          costCodeId,
          regularHours: options.regularHours ?? 10,
          overtimeHours: 0,
          doubletimeHours: 0,
          description: 'E2E payroll OT seed',
        },
      ],
      isDraft: false,
      allowPartialSuccess: false,
    },
  });
  if (!batchResp.ok()) {
    const batchErr = await batchResp.text();
    if (batchResp.status() === 400 && batchErr.includes('DUPLICATE_ENTRY')) {
      return { timeEntryId: 'existing', entryDate };
    }
    throw new Error(`seedApprovedOvertimeTimeEntry batch failed: ${batchResp.status()} ${batchErr}`);
  }
  const batchBody = await batchResp.json();
  const results = batchBody.results ?? batchBody.Results ?? [];
  const timeEntryId = (results[0]?.timeEntryId ?? results[0]?.TimeEntryId) as string;
  if (!timeEntryId) {
    throw new Error(`seedApprovedOvertimeTimeEntry: no timeEntryId in batch response`);
  }

  const reviewResp = await request.post(`${API_BASE}/api/time-entries/review`, {
    headers: pmHeaders,
    data: {
      decisions: [{ timeEntryId, decision: 'Approve', comment: 'E2E payroll OT seed' }],
    },
  });
  if (!reviewResp.ok()) {
    throw new Error(
      `seedApprovedOvertimeTimeEntry review failed: ${reviewResp.status()} ${await reviewResp.text()}`
    );
  }

  return { timeEntryId, entryDate };
}

export async function ensurePayPeriodsForCompany(
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

/** Ensures pay periods exist and locks the current period for browser payroll tests. */
export async function prepareLockedPayPeriod(
  request: APIRequestContext,
  payrollSession: AuthSession,
  companyId?: string | null
): Promise<string> {
  const headers = authHeaders(payrollSession, companyId);
  const payPeriodId = await ensurePayPeriodsForCompany(request, payrollSession, companyId);
  const lockResp = await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/lock`, { headers });
  if (!lockResp.ok()) {
    throw new Error(
      `prepareLockedPayPeriod lock failed: ${lockResp.status()} ${await lockResp.text()}`
    );
  }
  return payPeriodId;
}

/** Lock pay period → generate payroll run → approve → export (API path for L3b). */
export async function runPayrollE2e(
  request: APIRequestContext,
  payrollSession: AuthSession,
  companyId?: string | null,
  options?: PayrollE2eOptions
): Promise<PayrollE2eResult> {
  const headers = authHeaders(payrollSession, companyId);
  const payPeriodId = await ensurePayPeriodsForCompany(request, payrollSession, companyId);

  if (options?.seedOvertime) {
    await configurePayrollOvertimeForE2e(request, payrollSession, companyId);
    if (!options.pmSession || !options.fieldSession) {
      throw new Error('runPayrollE2e seedOvertime requires pmSession and fieldSession');
    }
    await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/unlock`, { headers });
    await seedApprovedOvertimeTimeEntryForE2e(request, options.pmSession, options.fieldSession, {
      companyId,
      payPeriodId,
      projectId: options.projectId,
      fieldEmail: options.fieldEmail,
    });
  }

  const lockResp = await request.post(`${API_BASE}/api/pay-periods/${payPeriodId}/lock`, { headers });
  if (!lockResp.ok()) {
    throw new Error(`runPayrollE2e lock failed: ${lockResp.status()} ${await lockResp.text()}`);
  }

  const runDate = new Date().toISOString().slice(0, 10);
  let run: Record<string, unknown>;
  const generateResp = await request.post(`${API_BASE}/api/payroll/runs/generate`, {
    headers,
    data: { runDate, payPeriodId },
  });
  if (!generateResp.ok()) {
    const generateBody = await generateResp.text();
    if (
      generateResp.status() === 400 &&
      generateBody.includes('DUPLICATE_PAYROLL_RUN')
    ) {
      const listResp = await request.get(
        `${API_BASE}/api/payroll/runs?payPeriodId=${payPeriodId}&page=1&pageSize=5`,
        { headers }
      );
      if (!listResp.ok()) {
        throw new Error(
          `runPayrollE2e list existing run failed: ${listResp.status()} ${await listResp.text()}`
        );
      }
      const listBody = await listResp.json();
      const items = (listBody.items ?? listBody.Items ?? []) as Record<string, unknown>[];
      const existing = items[0];
      if (!existing) {
        throw new Error(`runPayrollE2e duplicate run but none listed for payPeriodId=${payPeriodId}`);
      }
      run = existing;
    } else {
      throw new Error(`runPayrollE2e generate failed: ${generateResp.status()} ${generateBody}`);
    }
  } else {
    run = (await generateResp.json()) as Record<string, unknown>;
  }
  const payrollRunId = (run.id ?? run.Id) as string;
  let status = (run.status ?? run.Status ?? run.statusName ?? run.StatusName ?? 'Processing').toString();

  if (!/approved|exported/i.test(status)) {
    const approveResp = await request.post(`${API_BASE}/api/payroll/runs/${payrollRunId}/approve`, {
      headers,
    });
    if (!approveResp.ok()) {
      throw new Error(
        `runPayrollE2e approve failed: ${approveResp.status()} ${await approveResp.text()}`
      );
    }
    const approved = (await approveResp.json()) as Record<string, unknown>;
    status = String(approved.status ?? approved.Status ?? 'Approved');
  }

  if (!/exported/i.test(status)) {
    const exportResp = await request.post(`${API_BASE}/api/payroll/runs/${payrollRunId}/export`, {
      headers,
    });
    if (!exportResp.ok()) {
      throw new Error(
        `runPayrollE2e export failed: ${exportResp.status()} ${await exportResp.text()}`
      );
    }
    const exported = await exportResp.json();
    status = (exported.status ?? exported.Status ?? 'Exported').toString();
  }

  const detailResp = await request.get(`${API_BASE}/api/payroll/runs/${payrollRunId}`, { headers });
  const detailBody = detailResp.ok()
    ? ((await detailResp.json()) as Record<string, unknown>)
    : (run as Record<string, unknown>);
  const lines = parsePayrollLines(detailBody);
  const totalOvertimeHours = lines.reduce((sum, l) => sum + l.overtimeHours, 0);

  return { payPeriodId, payrollRunId, status, lines, totalOvertimeHours };
}

export interface OwnerChangeOrderResult {
  id: string;
}

/** Creates an owner-scoped change order via POST /api/owner-change-orders (or project-scoped fallback). */
export async function createOwnerChangeOrder(
  request: APIRequestContext,
  session: AuthSession,
  projectId: string,
  options: { runTag: string; companyId?: string | null; amount?: number }
): Promise<OwnerChangeOrderResult> {
  const headers = authHeaders(session, options.companyId);
  const suffix = options.runTag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const payload = {
    projectId,
    number: `OCO-E2E-${suffix}`,
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
    throw new Error(`createOwnerChangeOrder ${path}: ${resp.status()} ${await resp.text()}`);
  }
  throw new Error('createOwnerChangeOrder: no endpoint succeeded');
}

/** Ensures billing UI prereqs exist; creates owner contract + SOV when seed lacks them. */
export async function ensureBillingPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  companyId: string,
  runTag?: string
): Promise<BillingPrereqs> {
  const discovered = await discoverBillingPrereqs(request, session, companyId);
  if (discovered) return discovered;

  const headers = authHeaders(session, companyId);
  const tag = runTag ?? Date.now().toString(36);
  const suffix = tag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const projectId = await getFirstActiveProjectId(request, session, companyId);

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
    throw new Error(
      `ensureBillingPrereqs: owner contract ${ocResp.status()} ${await ocResp.text()}`
    );
  }
  const ownerContract = await ocResp.json();
  const ownerContractId = (ownerContract.id ?? ownerContract.Id) as string;

  const sovResp = await request.post(`${API_BASE}/api/owner-contracts/${ownerContractId}/sov`, {
    headers,
    data: { projectId, name: `E2E SOV ${tag}` },
  });
  if (!sovResp.ok()) {
    throw new Error(`ensureBillingPrereqs: SOV create ${sovResp.status()} ${await sovResp.text()}`);
  }
  const sov = await sovResp.json();
  const sovId = (sov.id ?? sov.Id) as string;

  await request.post(`${API_BASE}/api/owner-contracts/sov/${sovId}/lines`, {
    headers,
    data: { itemNumber: '1', description: 'General', scheduledValue: 500000, sortOrder: 1 },
  });
  const activateResp = await request.post(`${API_BASE}/api/owner-contracts/sov/${sovId}/activate`, {
    headers,
  });
  if (!activateResp.ok()) {
    throw new Error(
      `ensureBillingPrereqs: SOV activate ${activateResp.status()} ${await activateResp.text()}`
    );
  }

  return { ownerContractId, ownerScheduleOfValuesId: sovId };
}

/** Discovers or creates a subcontract with billing headroom for pay-app E2E. */
export async function ensurePayAppPrereqs(
  request: APIRequestContext,
  session: AuthSession,
  preferredProjectId: string | undefined,
  companyId: string,
  runTag?: string
): Promise<PayAppPrereqs> {
  const discovered = await discoverPayAppPrereqs(
    request,
    session,
    preferredProjectId,
    companyId
  );
  if (
    discovered &&
    (await isProjectVisibleUnderCompany(request, session, discovered.projectId, companyId))
  ) {
    return discovered;
  }

  const headers = authHeaders(session, companyId);
  const tag = runTag ?? Date.now().toString(36);
  const suffix = tag.replace(/[^a-zA-Z0-9]/g, '').slice(-10);
  const projectId =
    preferredProjectId ?? (await getFirstActiveProjectId(request, session, companyId));

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
    throw new Error(
      `ensurePayAppPrereqs: subcontract create ${scResp.status()} ${await scResp.text()}`
    );
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
    throw new Error(
      `ensurePayAppPrereqs: subcontract sign ${signResp.status()} ${await signResp.text()}`
    );
  }

  return {
    subcontractId,
    subcontractNumber,
    projectId,
    maxWorkAmount: 10000,
  };
}