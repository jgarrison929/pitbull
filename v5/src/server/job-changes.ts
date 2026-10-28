import "server-only";

import { cache } from "react";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { actionRuns, users } from "@/db/schema";
import { CO_COMMANDS } from "@/lib/change-order";
import { collapseSamePlanReports } from "@/lib/reported-day";

/**
 * Action names with `writes: true` in assistant/actions — kept as a static list
 * so the job page can load the change feed without importing the full action
 * table (TTFB). Sync-tested against `actions` in job-changes.test.ts.
 */
export const WRITE_ACTIONS = [
  "dailyPlan.create",
  "dailyPlan.addLine",
  "dailyPlan.removeLine",
  "dailyPlan.updateLine",
  "dailyPlan.submit",
  "dailyPlan.approve",
  "dailyPlan.return",
  "dailyReport.post",
  "progressClaim.lock",
  "estimate.importCsv",
  "estimate.approve",
  "costItem.setPmPercent",
  "costItem.setMilestone",
  "costItem.setForecastMethod",
  ...CO_COMMANDS.map((c) => `changeOrder.${c}` as const),
] as const;

function jobChangesWhere(companyId: string, jobNumber: string) {
  return and(
    eq(actionRuns.companyId, companyId),
    sql`${actionRuns.args}->>'job' = ${jobNumber}`,
    sql`${actionRuns.action} in (${sql.join(
      WRITE_ACTIONS.map((w) => sql`${w}`),
      sql`, `,
    )})`,
  );
}

function planIdOf(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const planId = (args as { planId?: unknown }).planId;
  return typeof planId === "string" && planId.length > 0 ? planId : null;
}

type JobChangeRow = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
  userName: string;
  role: string;
  planId: string | null;
};

/** Newest first, with a same plan+day re-report collapsed to the latest post. */
const loadJobChanges = cache(async function loadJobChanges(
  companyId: string,
  jobNumber: string,
): Promise<JobChangeRow[]> {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(jobChangesWhere(companyId, jobNumber))
    .orderBy(desc(actionRuns.createdAt));
  const mapped = rows.map(({ run, userName, role }) => ({
    id: run.id,
    action: run.action,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
    planId: planIdOf(run.args),
  }));
  return collapseSamePlanReports(mapped);
});

/** The audit trail for one job: every write anyone in this sandbox made, newest first. */
export async function jobChanges(
  companyId: string,
  jobNumber: string,
  limit = 20,
  offset = 0,
) {
  const all = await loadJobChanges(companyId, jobNumber);
  return all.slice(offset, offset + limit);
}

/** How many change rows are shown after same plan+day reports collapse. */
export async function jobChangesCount(companyId: string, jobNumber: string) {
  const all = await loadJobChanges(companyId, jobNumber);
  return all.length;
}
