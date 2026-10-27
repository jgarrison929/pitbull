import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costItemMilestones,
  costItems,
  crews,
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
import { isEstimateDraft } from "@/lib/portfolio";
import { overallStatus, type Status } from "@/lib/status";
import { planDateToday, timeZoneForJob } from "@/lib/plan-date";
import { portfolioRollupsSql } from "@/server/cost-rollups";
import { seedNow } from "@/server/seed-clock";

// The tenant boundary: every read takes the signed-in user's companyId and filters on it.

type ItemRow = typeof costItems.$inferSelect;

function rollupFromSql(r: Rollup): Rollup & { status: Status } {
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
  asOf = seedNow(),
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
    const draft = isEstimateDraft(job);
    const s = byJob.get(job.id);
    const r = rollupFromTotals({
      budgetCents: Number(s?.budget_cents ?? 0),
      plannedCents: Number(s?.planned_cents ?? 0),
      earnedCents: Number(s?.earned_cents ?? 0),
      actualCents: Number(s?.actual_cents ?? 0),
      eacCents: Number(s?.eac_cents ?? 0),
      etcCents: Number(s?.etc_cents ?? 0),
      sinceLockActualCents: Number(s?.since_lock_actual_cents ?? 0),
      sinceLockPlannedCents: Number(s?.since_lock_planned_cents ?? 0),
    });
    // Draft estimates are not active: no CPI/SPI/On-track, EAC shown as "—".
    if (draft) {
      return {
        job,
        lines: [] as CostLine[],
        ...r,
        cpi: null,
        spi: null,
        status: null as Status | null,
        estimateDraft: true as const,
      };
    }
    const withStatus = rollupFromSql(r);
    return {
      job,
      lines: [] as CostLine[],
      ...withStatus,
      estimateDraft: false as const,
    };
  });
  const active = portfolio.filter((p) => !p.estimateDraft);
  const totals = rollup(
    active.map((p) => ({
      ...p,
      // Synthetic single line per job for portfolio totals (active only).
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
    activeJobs: active,
    activeJobCount: active.length,
    totals,
    contractCents: active.reduce((s, p) => s + p.job.contractCents, 0),
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
  asOf = seedNow(),
) {
  const db = requireDb();
  // Job row, WBS, and last lock are independent when keyed by company+number —
  // overlap all three RTTs (avoids serial job-then-rest under crawl burst).
  const [jobRows, itemRows, lockRows] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, number)))
      .limit(1),
    db
      .select({ item: costItems })
      .from(costItems)
      .innerJoin(
        jobs,
        and(eq(jobs.id, costItems.jobId), eq(jobs.companyId, companyId)),
      )
      .where(
        and(eq(costItems.companyId, companyId), eq(jobs.number, number)),
      )
      .orderBy(asc(costItems.path)),
    db
      .select({ lockedAt: progressClaims.lockedAt })
      .from(progressClaims)
      .innerJoin(
        jobs,
        and(eq(jobs.id, progressClaims.jobId), eq(jobs.companyId, companyId)),
      )
      .where(
        and(
          eq(progressClaims.companyId, companyId),
          eq(jobs.number, number),
          eq(progressClaims.status, "locked"),
        ),
      )
      .orderBy(desc(progressClaims.lockedAt))
      .limit(1),
  ]);
  const job = jobRows[0];
  if (!job) return null;
  const items = itemRows.map((r) => r.item);
  const lockAt = lockRows[0]?.lockedAt ?? null;
  const cutoff = lockAt ?? asOf;
  const lines = leafLines(items, cutoff, asOf);
  // Prefer JS leaf rollup so claimed-installed / as-of PV match costLine exactly.
  const r = rollup(lines);
  const draft = isEstimateDraft(job);
  return {
    job,
    items,
    lines,
    /** Original, Current, and Estimate per WBS node and for the job, summed from leaves. */
    money: buildWbsMoney(items),
    lockAt,
    cutoff,
    ...r,
    ...(draft
      ? { cpi: null, spi: null, status: null as Status | null }
      : { status: overallStatus(r) as Status | null }),
    estimateDraft: draft,
  };
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJob>>>;

type PlanHeaderRow = {
  plan: typeof dailyPlans.$inferSelect;
  foreman: string;
  crew: string;
};

async function listPlanHeaders(
  companyId: string,
  jobId: string,
): Promise<PlanHeaderRow[]> {
  const db = requireDb();
  // crew_id is NOT NULL after 0019; name always comes from crews.
  return db
    .select({
      plan: dailyPlans,
      foreman: users.name,
      crew: crews.name,
    })
    .from(dailyPlans)
    .innerJoin(users, eq(users.id, dailyPlans.foremanId))
    .innerJoin(crews, eq(crews.id, dailyPlans.crewId))
    .where(
      and(eq(dailyPlans.companyId, companyId), eq(dailyPlans.jobId, jobId)),
    )
    .orderBy(asc(dailyPlans.planDate));
}

async function loadPlanLinesByPlanId(companyId: string, planIds: string[]) {
  if (planIds.length === 0) {
    return new Map<string, ReturnType<typeof planLine>[]>();
  }
  const db = requireDb();
  const lines = await db
    .select({ line: dailyPlanLines, item: costItems })
    .from(dailyPlanLines)
    .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        inArray(dailyPlanLines.planId, planIds),
      ),
    )
    .orderBy(asc(dailyPlanLines.sort));
  const linesByPlan = new Map<string, ReturnType<typeof planLine>[]>();
  for (const row of lines) {
    const mapped = planLine(row.line, row.item);
    const list = linesByPlan.get(row.line.planId);
    if (list) list.push(mapped);
    else linesByPlan.set(row.line.planId, [mapped]);
  }
  return linesByPlan;
}

export async function getPlansForJob(companyId: string, jobId: string) {
  const plans = await listPlanHeaders(companyId, jobId);
  // Fixed query count: one lines fetch for every plan on this job (not per-plan
  // and not company-wide). History length must not add round-trips.
  const linesByPlan = await loadPlanLinesByPlanId(
    companyId,
    plans.map(({ plan }) => plan.id),
  );
  return plans.map(({ plan, foreman, crew }) => ({
    ...plan,
    crew,
    foreman,
    lines: linesByPlan.get(plan.id) ?? [],
  }));
}

/** History rail row: counts only — no per-line payload. */
export type PlanHistorySummary = {
  id: string;
  planDate: string;
  crew: string;
  status: (typeof dailyPlans.$inferSelect)["status"];
  returnReason: string | null;
  lineCount: number;
  manHours: number;
};

/**
 * Job page plans: full lines for today/future cards only; past days as
 * aggregated history summaries so 30 days of field history does not ship
 * every line into the RSC payload (page budget / networkidle).
 */
async function historyPlanTotals(
  companyId: string,
  historyIds: string[],
): Promise<Map<string, { lineCount: number; manHours: number }>> {
  const totals = new Map<string, { lineCount: number; manHours: number }>();
  if (!historyIds.length) return totals;
  const db = requireDb();
  const rows = await db
    .select({
      planId: dailyPlanLines.planId,
      lineCount: sql<number>`count(*)::int`.mapWith(Number),
      // Same formula as planLine manHours: (workers * hoursTenths) / 10.
      manHours: sql<number>`(sum(${dailyPlanLines.workers} * ${dailyPlanLines.hoursTenths})::float8 / 10)`.mapWith(
        Number,
      ),
    })
    .from(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        inArray(dailyPlanLines.planId, historyIds),
      ),
    )
    .groupBy(dailyPlanLines.planId);
  for (const r of rows) {
    totals.set(r.planId, { lineCount: r.lineCount, manHours: r.manHours });
  }
  return totals;
}

export async function getJobPagePlans(
  companyId: string,
  jobId: string,
  todayLA: string = planDateToday(seedNow(), timeZoneForJob()),
): Promise<{
  openPlans: Awaited<ReturnType<typeof getPlansForJob>>;
  historyPlans: PlanHistorySummary[];
}> {
  const headers = await listPlanHeaders(companyId, jobId);
  const openHeaders = headers.filter(({ plan }) => plan.planDate >= todayLA);
  const historyHeaders = headers.filter(({ plan }) => plan.planDate < todayLA);

  // Open lines and history aggregates are independent once headers are known —
  // overlap the two RTTs (serial chain was a cold-path tax under crawl burst).
  const [linesByPlan, totals] = await Promise.all([
    loadPlanLinesByPlanId(
      companyId,
      openHeaders.map(({ plan }) => plan.id),
    ),
    historyPlanTotals(
      companyId,
      historyHeaders.map(({ plan }) => plan.id),
    ),
  ]);

  const openPlans = openHeaders.map(({ plan, foreman, crew }) => ({
    ...plan,
    crew,
    foreman,
    lines: linesByPlan.get(plan.id) ?? [],
  }));

  const historyPlans: PlanHistorySummary[] = historyHeaders
    .map(({ plan, crew }) => {
      const t = totals.get(plan.id) ?? { lineCount: 0, manHours: 0 };
      return {
        id: plan.id,
        planDate: plan.planDate,
        crew,
        status: plan.status,
        returnReason: plan.returnReason,
        lineCount: t.lineCount,
        manHours: t.manHours,
      };
    })
    .sort((a, b) => b.planDate.localeCompare(a.planDate));

  return {
    openPlans: openPlans.sort((a, b) => a.planDate.localeCompare(b.planDate)),
    historyPlans,
  };
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
  // Three independent reads — overlap RTTs; scope logs to this job's leaves.
  const [milestones, pmItems, logs] = await Promise.all([
    db
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
      .orderBy(asc(costItems.code), asc(costItemMilestones.sort)),
    db
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
      .orderBy(asc(costItems.code)),
    db
      .select({
        log: pmPercentLogs,
      })
      .from(pmPercentLogs)
      .innerJoin(costItems, eq(costItems.id, pmPercentLogs.costItemId))
      .where(
        and(
          eq(pmPercentLogs.companyId, companyId),
          eq(costItems.jobId, jobId),
        ),
      )
      .orderBy(desc(pmPercentLogs.at)),
  ]);

  return {
    milestones,
    pmItems: pmItems.map((p) => {
      // Latest PM percent log wins, including an explicit 0% entry.
      const latest = logs.find((l) => l.log.costItemId === p.costItemId)?.log;
      return {
        ...p,
        percentMilli: latest?.percentMilli ?? 0,
      };
    }),
  };
}
