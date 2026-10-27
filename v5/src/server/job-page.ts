import "server-only";
import { cache } from "react";
import { getDbQueryCount } from "@/db";
import { users } from "@/db/schema";
import { planDateToday } from "@/lib/plan-date";
import { listChangeOrders } from "@/server/change-orders";
import {
  getJob,
  getJobEvControls,
  getJobPagePlans,
} from "@/server/data";
import { jobChanges } from "@/server/job-changes";
import { jobPagePlanSurface } from "@/server/job-page-plans";
import { listCrews } from "@/server/plans";
import {
  draftClaimForJob,
  getApprovalPendingByCostItem,
  getReportedActualsForPlans,
} from "@/server/progress";
import { seedNow } from "@/server/seed-clock";

type Role = (typeof users.$inferSelect)["role"];

/**
 * Role gates for the job page — kept local so the route does not import the
 * full assistant action table (cold module graph under crawl burst).
 * Must stay aligned with `actions` roles in assistant/actions.ts.
 */
const ROLES = {
  updateLine: new Set<Role>(["foreman", "superintendent"]),
  createPlan: new Set<Role>(["superintendent"]),
  addRemove: new Set<Role>(["superintendent"]),
  report: new Set<Role>(["foreman", "superintendent"]),
  submit: new Set<Role>(["foreman", "superintendent"]),
  approveReport: new Set<Role>(["superintendent"]),
  returnReport: new Set<Role>(["superintendent"]),
  lock: new Set<Role>(["pm", "executive"]),
  approveEstimate: new Set<Role>(["pm", "executive"]),
  importCsv: new Set<Role>(["pm"]),
  evEdit: new Set<Role>(["pm", "superintendent", "executive"]),
  coCreate: new Set<Role>(["pm", "executive"]),
  coPrice: new Set<Role>(["pm", "executive"]),
  coApprove: new Set<Role>(["pm", "executive"]),
  coReject: new Set<Role>(["pm", "executive"]),
  coVoid: new Set<Role>(["pm", "executive"]),
} as const;

export type JobPageCaps = {
  canEdit: boolean;
  canCreatePlan: boolean;
  canAddRemove: boolean;
  canReport: boolean;
  canSubmit: boolean;
  canApproveReport: boolean;
  canReturn: boolean;
  canLock: boolean;
  canApprove: boolean;
  canImport: boolean;
  canEvEdit: boolean;
  coCan: {
    create: boolean;
    price: boolean;
    approve: boolean;
    reject: boolean;
    void: boolean;
  };
};

export function jobPageCaps(role: Role): JobPageCaps {
  return {
    canEdit: ROLES.updateLine.has(role),
    canCreatePlan: ROLES.createPlan.has(role),
    canAddRemove: ROLES.addRemove.has(role),
    canReport: ROLES.report.has(role),
    canSubmit: ROLES.submit.has(role),
    canApproveReport: ROLES.approveReport.has(role),
    canReturn: ROLES.returnReport.has(role),
    canLock: ROLES.lock.has(role),
    canApprove: ROLES.approveEstimate.has(role),
    canImport: ROLES.importCsv.has(role),
    canEvEdit: ROLES.evEdit.has(role),
    coCan: {
      create: ROLES.coCreate.has(role),
      price: ROLES.coPrice.has(role),
      approve: ROLES.coApprove.has(role),
      reject: ROLES.coReject.has(role),
      void: ROLES.coVoid.has(role),
    },
  };
}

/** Per-request cache so shell + page share one getJob when both hit. */
export const getJobCached = cache(getJob);

export type JobPageTiming = {
  dbMs: number;
  queries: number;
  totalMs: number;
};

/**
 * Full job-page data path. Session-free (companyId + role) so vitest can import
 * without next/headers. Overlaps reported-actuals with sibling fetches once
 * open plans resolve — removes the serial await that sat after Promise.all.
 */
export async function loadJobPage(
  companyId: string,
  number: string,
  role: Role,
) {
  const caps = jobPageCaps(role);
  const p = await getJobCached(companyId, number);
  if (!p) return null;

  const todayLA = planDateToday(seedNow());
  const pagePlansP = getJobPagePlans(companyId, p.job.id, todayLA);
  const siblingsP = Promise.all([
    // Same WRITES-filtered feed as before (via job-changes, not assistant/actions).
    jobChanges(companyId, p.job.number),
    caps.canLock
      ? draftClaimForJob(companyId, p.job.id)
      : Promise.resolve(null),
    caps.canEvEdit
      ? getJobEvControls(companyId, p.job.id)
      : Promise.resolve({ milestones: [], pmItems: [] }),
    getApprovalPendingByCostItem(companyId, p.job.id),
    listChangeOrders(companyId, p.job.number, {
      job: p.job,
      ledgerSums: {
        original: p.money.job.obCents,
        current: p.money.job.cbCents,
      },
      lockAt: p.lockAt,
    }),
    caps.canCreatePlan ? listCrews(companyId) : Promise.resolve([]),
  ]);

  const pagePlans = await pagePlansP;
  // Pre-surface open headers — JobNewPlanSlot receives this (same as main).
  const plans = pagePlans.openPlans;
  const { open: openPlans, today } = jobPagePlanSurface(plans);
  const historyPlans = pagePlans.historyPlans;
  const reportable = openPlans.filter(
    (pl) => pl.status === "issued" || pl.status === "reported",
  );
  const reportedP = getReportedActualsForPlans(
    companyId,
    reportable.map((pl) => pl.id),
  );

  const [
    [changes, draftClaim, evControls, approvalPending, coData, crewRows],
    reportedByPlan,
  ] = await Promise.all([siblingsP, reportedP]);

  return {
    p,
    caps,
    plans,
    openPlans,
    today,
    historyPlans,
    changes,
    draftClaim,
    evControls,
    approvalPending,
    coData,
    crewRows,
    reportedByPlan,
  };
}

export type JobPageData = NonNullable<Awaited<ReturnType<typeof loadJobPage>>>;

export async function timedLoadJobPage(
  companyId: string,
  number: string,
  role: Role,
) {
  const startedAt = performance.now();
  const q0 = getDbQueryCount();
  const data = await loadJobPage(companyId, number, role);
  const timing: JobPageTiming = {
    dbMs: Math.round(performance.now() - startedAt),
    queries: getDbQueryCount() - q0,
    totalMs: Math.round(performance.now() - startedAt),
  };
  if (process.env.V5_TIMING_LOG === "1") {
    console.info(
      `[v5-timing] ${JSON.stringify({
        route: `job:${number}`,
        ...timing,
        job: number,
        role,
      })}`,
    );
  }
  return { data, timing };
}
