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
  progressClaims,
  users,
} from "@/db/schema";
import { buildWbsMoney, currentBudgetCents } from "@/lib/budget";
import {
  costLine,
  plannedValueCents,
  rollup,
  rollupFromTotals,
  type CostLine,
  type ForecastMethod,
  type Rollup,
} from "@/lib/ev";
import { overallStatus } from "@/lib/status";
import { portfolioRollupsSql } from "@/server/cost-rollups";

// The tenant boundary: every read takes the signed-in user's companyId and filters on it.

type ItemRow = typeof costItems.$inferSelect;

function rollupFromSql(r: Rollup) {
  return { ...r, status: overallStatus(r) };
}

/** Last locked period date for a job (UTC calendar day), or null if never locked. */
export async function lastLockDate(
  companyId: string,
  jobId: string,
): Promise<Date | null> {
  const db = requireDb();
  const [row] = await db
    .select({ lockedAt: progressClaims.lockedAt })
    .from(progressClaims)
    .where(
      and(
        eq(progressClaims.companyId, companyId),
        eq(progressClaims.jobId, jobId),
        eq(progressClaims.status, "locked"),
      ),
    )
    .orderBy(desc(progressClaims.lockedAt))
    .limit(1);
  return row?.lockedAt ?? null;
}

/**
 * Map a cost-item row to EV input at one cutoff.
 * budgetCents = Current Budget. AC/PV/EV use the last lock; live deltas are separate.
 */
function toCostLineInput(
  item: ItemRow,
  cutoff: Date,
  readAsOf: Date,
) {
  const budgetCents = currentBudgetCents(item);
  const lockedActual = item.lockedActualCents ?? 0;
  return {
    id: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    budgetQtyMilli: item.budgetQtyMilli,
    installedQtyMilli: item.installedQtyMilli,
    claimedInstalledQtyMilli: item.claimedInstalledQtyMilli ?? 0,
    budgetCents,
    plannedCents: plannedValueCents(
      budgetCents,
      item.plannedStartOn,
      item.plannedFinishOn,
      cutoff,
    ),
    livePlannedCents: plannedValueCents(
      budgetCents,
      item.plannedStartOn,
      item.plannedFinishOn,
      readAsOf,
    ),
    actualCents: lockedActual,
    liveActualCents: item.actualCents,
    budgetMhPerUnitMilli: item.budgetMhPerUnitMilli,
    claimedPercentMilli: item.claimedPercentMilli ?? 0,
    evMethod: item.evMethod,
    forecastMethod: (item.forecastMethod ??
      "current_budget") as ForecastMethod,
    earnDerivation: item.earnDerivation,
  };
}

function lineAtCutoff(item: ItemRow, cutoff: Date, readAsOf: Date) {
  return costLine(toCostLineInput(item, cutoff, readAsOf));
}

/** Leaf lines only, for EV math and plan-line pickers. */
function leafLines(items: ItemRow[], cutoff: Date, readAsOf: Date) {
  return items
    .filter((i) => i.isLeaf)
    .map((i) => lineAtCutoff(i, cutoff, readAsOf));
}

/**
 * Portfolio: jobs + SQL leaf roll-ups. Does not hydrate every cost item into memory
 * (required once a company can hold a 10k-code stress job).
 */
export const getPortfolio = cache(async function getPortfolio(
  companyId: string,
  asOf = new Date(),
) {
  const db = requireDb();
  const jobRows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.companyId, companyId))
    .orderBy(asc(jobs.number));

  const sums = await portfolioRollupsSql(companyId, asOf);
  const byJob = new Map(sums.map((s) => [s.job_id, s]));
  const portfolio = jobRows.map((job) => {
    const s = byJob.get(job.id);
    const r = rollupFromSql(
      rollupFromTotals({
        budgetCents: Number(s?.budget_cents ?? 0),
        plannedCents: Number(s?.planned_cents ?? 0),
        earnedCents: Number(s?.earned_cents ?? 0),
        actualCents: Number(s?.actual_cents ?? 0),
        eacCents: Number(s?.eac_cents ?? 0),
        etcCents: Number(s?.etc_cents ?? 0),
        sinceLockActualCents: Number(s?.since_lock_actual_cents ?? 0),
        sinceLockPlannedCents: Number(s?.since_lock_planned_cents ?? 0),
      }),
    );
    return {
      job,
      /** Empty on portfolio; call getJob for the tree. */
      lines: [] as CostLine[],
      ...r,
    };
  });
  const totals = rollup(
    portfolio.map((p) => ({
      ...p,
      // Synthetic single line per job for portfolio totals.
      code: p.job.number,
      description: p.job.name,
      unit: "LS",
      budgetQtyMilli: 0,
      installedQtyMilli: 0,
      claimedInstalledQtyMilli: 0,
      budgetMhPerUnitMilli: 0,
      claimedPercentMilli: Math.round(p.percent * 1000),
      evMethod: "units" as const,
      forecastMethod: "current_budget" as const,
      earnDerivation: "",
      percent: p.percent,
      earnedCents: p.earnedCents,
      varianceCents: p.costVarianceCents,
      scheduleVarianceCents: p.scheduleVarianceCents,
      cpi: p.cpi,
      spi: p.spi,
      budgetCents: p.budgetCents,
      plannedCents: p.plannedCents,
      actualCents: p.actualCents,
      eacCents: p.eacCents,
      etcCents: p.etcCents,
      overBudgetQtyMilli: 0,
      earnedMhMilli: 0,
      forecastFallback: false,
      forecastDerivation: "",
      sinceLockActualCents: p.sinceLockActualCents,
      sinceLockPlannedCents: p.sinceLockPlannedCents,
    })),
  );
  return {
    jobs: portfolio,
    totals,
    contractCents: jobRows.reduce((s, j) => s + j.contractCents, 0),
  };
});

export type PortfolioJob = Awaited<
  ReturnType<typeof getPortfolio>
>["jobs"][number];

/** Job id only — for search/typeahead paths that must not hydrate the WBS. */
export async function resolveJobId(companyId: string, number: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, number)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * One job with its full WBS (ordered by path) and leaf EV lines.
 * Job-scoped reads — does not pull other jobs' cost items.
 * EV/AC/PV share the last lock date; live changes since lock are on each line.
 */
export async function getJob(
  companyId: string,
  number: string,
  asOf = new Date(),
) {
  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, number)))
    .limit(1);
  if (!job) return null;
  const lockAt = await lastLockDate(companyId, job.id);
  const cutoff = lockAt ?? asOf;
  const items = await db
    .select()
    .from(costItems)
    .where(
      and(eq(costItems.companyId, companyId), eq(costItems.jobId, job.id)),
    )
    .orderBy(asc(costItems.path));
  const lines = leafLines(items, cutoff, asOf);
  // Prefer JS leaf rollup so claimed-installed / as-of PV match costLine exactly.
  const r = rollup(lines);
  return {
    job,
    items,
    lines,
    /** Original, Current, and Estimate per WBS node and for the job, summed from leaves. */
    money: buildWbsMoney(items),
    lockAt,
    cutoff,
    ...r,
    status: overallStatus(r),
  };
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;

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

/** Leaf cost-code options for a job (capped) — prefer searchCostItems for large WBS. */
export async function listLeafCostOptions(
  companyId: string,
  jobId: string,
  limit = 50,
) {
  const db = requireDb();
  return db
    .select({
      id: costItems.id,
      code: costItems.code,
      description: costItems.description,
      unit: costItems.unit,
    })
    .from(costItems)
    .where(
      and(
        eq(costItems.companyId, companyId),
        eq(costItems.jobId, jobId),
        eq(costItems.isLeaf, true),
      ),
    )
    .orderBy(asc(costItems.code))
    .limit(limit);
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
        eq(costItems.isLeaf, true),
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
        eq(costItems.isLeaf, true),
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
