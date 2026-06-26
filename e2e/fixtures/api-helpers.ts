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

export async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<AuthSession> {
  const resp = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });
  if (!resp.ok()) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`);
  }
  const body = await resp.json();
  const tenantId = decodeJwtClaim(body.token, 'tenant_id');
  if (!tenantId) throw new Error(`No tenant_id in JWT for ${email}`);
  return { token: body.token, tenantId, userId: body.userId, email };
}

export function authHeaders(session: AuthSession): Record<string, string> {
  return {
    Authorization: `Bearer ${session.token}`,
    'X-Tenant-Id': session.tenantId,
    'Content-Type': 'application/json',
  };
}

export async function getFirstActiveProjectId(
  request: APIRequestContext,
  session: AuthSession
): Promise<string> {
  const resp = await request.get(`${API_BASE}/api/projects?page=1&pageSize=5`, {
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