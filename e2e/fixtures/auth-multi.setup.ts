import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { PERSONAS, DEMO_PASSWORD } from './roles';
import { loginApi } from './api-helpers';
import { buildStorageState } from './storage-state';

const authDir = path.join(__dirname, '..', '.auth');

for (const persona of Object.values(PERSONAS)) {
  setup(`authenticate as ${persona.key}`, async ({ request }) => {
    // Stagger logins to stay under Development login rate limit (120/min).
    await new Promise((r) => setTimeout(r, 250));
    const authFile = path.join(authDir, `${persona.key}.json`);
    fs.mkdirSync(authDir, { recursive: true });

    const session = await loginApi(request, persona.email, DEMO_PASSWORD);
    const profileResp = await request.get(`${process.env.API_BASE_URL ?? 'http://localhost:5081'}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'X-Tenant-Id': session.tenantId,
      },
    });
    const profile = profileResp.ok() ? await profileResp.json() : null;
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:5081';
    const authHeaders = {
      Authorization: `Bearer ${session.token}`,
      'X-Tenant-Id': session.tenantId,
    };
    let activeCompanyId = profile?.activeCompany?.id ?? profile?.ActiveCompany?.Id ?? null;
    // Field workflows need the user's home company (e.g. Water Infra). Finance workflows
    // need the parent/default company where smoke subcontracts and owner contracts live.
    if (persona.key !== 'fieldEng') {
      const companiesResp = await request.get(`${apiBase}/api/companies/accessible`, {
        headers: authHeaders,
      });
      if (companiesResp.ok()) {
        const companies = await companiesResp.json();
        const list = Array.isArray(companies) ? companies : companies.items ?? [];
        const defaultCo = list.find((c: { isDefault?: boolean }) => c.isDefault) ?? list[0];
        if (defaultCo?.id) activeCompanyId = defaultCo.id;
      }
    }
    const state = buildStorageState(session.token, undefined, activeCompanyId);
    fs.writeFileSync(authFile, JSON.stringify(state, null, 2));
  });
}