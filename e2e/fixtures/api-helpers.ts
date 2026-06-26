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
  path: string
): Promise<string> {
  const resp = await request.get(`${API_BASE}${path}`, { headers: authHeaders(session) });
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