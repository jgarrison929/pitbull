import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { actionRuns, users } from "@/db/schema";
import { CO_COMMANDS } from "@/lib/change-order";

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

/** The audit trail for one job: every write anyone in this sandbox made, newest first. */
export async function jobChanges(
  companyId: string,
  jobNumber: string,
  limit = 20,
  offset = 0,
) {
  const rows = await requireDb()
    .select({ run: actionRuns, userName: users.name, role: users.role })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(jobChangesWhere(companyId, jobNumber))
    .orderBy(desc(actionRuns.createdAt))
    .limit(limit)
    .offset(offset);
  return rows.map(({ run, userName, role }) => ({
    id: run.id,
    action: run.action,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    userName,
    role,
  }));
}

/** How many write actions are on this job's change list. */
export async function jobChangesCount(companyId: string, jobNumber: string) {
  const [row] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(actionRuns)
    .where(jobChangesWhere(companyId, jobNumber));
  return Number(row?.n ?? 0);
}
