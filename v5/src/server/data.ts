import "server-only";
import { cache } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costItemMilestones,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  pmPercentLogs,
  users,
} from "@/db/schema";
import { costLine, plannedValueCents, rollup } from "@/lib/ev";
import { overallStatus } from "@/lib/status";

// The tenant boundary: every read takes the signed-in user's companyId and filters on it.

/** PV advances by calendar date — recompute as-of today on every read. */
function lineAsOfToday(
  item: typeof costItems.$inferSelect,
  asOf: Date,
) {
  return costLine({
    ...item,
    plannedCents: plannedValueCents(
      item.budgetCents,
      item.plannedStartOn,
      item.plannedFinishOn,
      asOf,
    ),
  });
}

/** Cached per request, so the job strip and the page share one read. */
export const getPortfolio = cache(async function getPortfolio(
  companyId: string,
  asOf = new Date(),
) {
  const db = requireDb();
  const [jobRows, itemRows] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
      .orderBy(asc(jobs.number)),
    db
      .select()
      .from(costItems)
      .where(eq(costItems.companyId, companyId))
      .orderBy(asc(costItems.code)),
  ]);
  const portfolio = jobRows.map((job) => {
    const lines = itemRows
      .filter((i) => i.jobId === job.id)
      .map((i) => lineAsOfToday(i, asOf));
    const r = rollup(lines);
    return { job, lines, ...r, status: overallStatus(r) };
  });
  return {
    jobs: portfolio,
    totals: rollup(portfolio.flatMap((p) => p.lines)),
    contractCents: jobRows.reduce((s, j) => s + j.contractCents, 0),
  };
});

export type PortfolioJob = Awaited<
  ReturnType<typeof getPortfolio>
>["jobs"][number];

export async function getJob(companyId: string, number: string) {
  const { jobs: all } = await getPortfolio(companyId);
  return all.find((j) => j.job.number === number) ?? null;
}

export async function getPlansForJob(companyId: string, jobId: string) {
  const db = requireDb();
  const plans = await db
    .select({ plan: dailyPlans, foreman: users.name })
    .from(dailyPlans)
    .innerJoin(users, eq(users.id, dailyPlans.foremanId))
    .where(
      and(eq(dailyPlans.companyId, companyId), eq(dailyPlans.jobId, jobId)),
    )
    .orderBy(asc(dailyPlans.planDate));
  const lines = plans.length
    ? await db
        .select({ line: dailyPlanLines, item: costItems })
        .from(dailyPlanLines)
        .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
        .where(eq(dailyPlanLines.companyId, companyId))
        .orderBy(asc(dailyPlanLines.sort))
    : [];
  return plans.map(({ plan, foreman }) => ({
    ...plan,
    foreman,
    lines: lines
      .filter((l) => l.line.planId === plan.id)
      .map(({ line, item }) => planLine(line, item)),
  }));
}

export type PlanLine = ReturnType<typeof planLine>;
export function planLine(
  line: typeof dailyPlanLines.$inferSelect,
  item: typeof costItems.$inferSelect,
) {
  const manHours = (line.workers * line.hoursTenths) / 10;
  const planned = line.qtyMilli === 0 ? 0 : manHours / (line.qtyMilli / 1000);
  const budget = item.budgetMhPerUnitMilli / 1000;
  return {
    ...line,
    code: item.code,
    description: item.description,
    unit: item.unit,
    manHours,
    plannedRate: planned,
    budgetRate: budget,
    withinRate: budget === 0 || planned <= budget * 1.05,
  };
}

/** Milestones + latest PM percent logs for on-screen EV method controls. */
export async function getJobEvControls(companyId: string, jobId: string) {
  const db = requireDb();
  const milestones = await db
    .select({
      id: costItemMilestones.id,
      costItemId: costItemMilestones.costItemId,
      code: costItems.code,
      name: costItemMilestones.name,
      weightMilli: costItemMilestones.weightMilli,
      complete: costItemMilestones.complete,
    })
    .from(costItemMilestones)
    .innerJoin(costItems, eq(costItems.id, costItemMilestones.costItemId))
    .where(
      and(
        eq(costItemMilestones.companyId, companyId),
        eq(costItems.jobId, jobId),
      ),
    )
    .orderBy(asc(costItems.code), asc(costItemMilestones.sort));

  const pmItems = await db
    .select({
      costItemId: costItems.id,
      code: costItems.code,
      description: costItems.description,
    })
    .from(costItems)
    .where(
      and(
        eq(costItems.companyId, companyId),
        eq(costItems.jobId, jobId),
        eq(costItems.evMethod, "pm_percent"),
      ),
    )
    .orderBy(asc(costItems.code));

  const logs = await db
    .select()
    .from(pmPercentLogs)
    .where(eq(pmPercentLogs.companyId, companyId))
    .orderBy(desc(pmPercentLogs.at));

  return {
    milestones,
    pmItems: pmItems.map((p) => {
      // Latest PM percent log wins, including an explicit 0% entry.
      const latest = logs.find((l) => l.costItemId === p.costItemId);
      return {
        ...p,
        percentMilli: latest?.percentMilli ?? 0,
      };
    }),
  };
}
