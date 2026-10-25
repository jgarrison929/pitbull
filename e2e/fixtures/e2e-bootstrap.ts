import { APIRequestContext } from '@playwright/test';
import { PERSONAS, DEMO_PASSWORD } from './roles';
import {
  loginApi,
  getDefaultCompanyId,
  getFirstActiveProjectId,
  ensureTimeTrackingPrereqs,
  ensurePayAppPrereqs,
  ensureBillingPrereqs,
  ensurePmProjectAssignment,
  ensureVendorPrereqs,
  ensureGlAccountsForAp,
  type AuthSession,
  type BillingPrereqs,
  type PayAppPrereqs,
} from './api-helpers';

export interface RoleWorkflowBootstrap {
  runTag: string;
  companyId: string;
  projectId: string;
  pmProjectId: string;
  billingPrereqs: BillingPrereqs;
  payAppPrereqs: PayAppPrereqs;
  pmSession: AuthSession;
  fieldSession: AuthSession;
  apSession: AuthSession;
  payrollSession: AuthSession;
}

/**
 * Single fail-fast bootstrap for role-workflows.spec.ts.
 * Uses one canonical companyId on every list/create/assign call.
 */
export async function bootstrapRoleWorkflowPrereqs(
  request: APIRequestContext
): Promise<RoleWorkflowBootstrap> {
  const runTag = process.env.E2E_RUN_TAG ?? Date.now().toString(36);

  const pmSession = await loginApi(request, PERSONAS.pm.email, DEMO_PASSWORD);
  const fieldSession = await loginApi(request, PERSONAS.fieldEng.email, DEMO_PASSWORD);
  const apSession = await loginApi(request, PERSONAS.apClerk.email, DEMO_PASSWORD);
  const payrollSession = await loginApi(request, PERSONAS.payrollManager.email, DEMO_PASSWORD);

  const companyId = await getDefaultCompanyId(request, pmSession);
  if (!companyId) {
    throw new Error('bootstrapRoleWorkflowPrereqs: PM has no default company');
  }

  const projectId = await getFirstActiveProjectId(request, pmSession, companyId);

  await ensureTimeTrackingPrereqs(
    request,
    pmSession,
    PERSONAS.fieldEng.email,
    projectId,
    companyId
  );

  const payAppPrereqs = await ensurePayAppPrereqs(
    request,
    pmSession,
    projectId,
    companyId,
    runTag
  );
  const billingPrereqs = await ensureBillingPrereqs(request, pmSession, companyId, runTag);

  const pmProjectId = payAppPrereqs.projectId;

  await ensurePmProjectAssignment(request, pmSession, pmProjectId, companyId, {
    fieldEmail: PERSONAS.fieldEng.email,
  });
  await ensurePmProjectAssignment(request, pmSession, projectId, companyId, {
    fieldEmail: PERSONAS.fieldEng.email,
  });

  await ensureVendorPrereqs(request, apSession, companyId, runTag);
  await ensureGlAccountsForAp(request, apSession, companyId);

  return {
    runTag,
    companyId,
    projectId,
    pmProjectId,
    billingPrereqs,
    payAppPrereqs,
    pmSession,
    fieldSession,
    apSession,
    payrollSession,
  };
}