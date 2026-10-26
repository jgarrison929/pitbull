import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costEntries,
  costItems,
  crews,
  dailyPlanLines,
  dailyPlans,
  jobs,
  progressClaims,
  users,
} from "@/db/schema";
import { currentBudgetCents } from "@/lib/budget";
import {
  earnedMhMilliOf,
  itemForecast,
  type ForecastMethod,
} from "@/lib/ev";
import {
  entryInLockSnapshot,
  laborMhMilliByLock,
  pathRollupSql,
} from "@/server/cost-rollups";
import { getDbQueryCount } from "@/db";
import { seedNow } from "@/server/seed-clock";

export type CostEntryRow =
  | {
      id: string;
      kind: "labor";
      at: string;
      crew: string | null;
      manHours: number;
      rateCents: number | null;
      amountCents: number;
      approverName: string | null;
      planId: string | null;
      note: string;
      /** True when this row is not in the lock snapshot (pending the next lock). */
      sinceLock: boolean;
    }
  | {
      id: string;
      kind: "other";
      at: string;
      note: string;
      amountCents: number;
      sinceLock: boolean;
    };

/** Internal approve marker — not shown on the cost-item table. */
function isApprovedQtyMarker(entry: {
  kind: string;
  note: string;
  amountCents: number;
}) {
  return (
    entry.kind === "other" &&
    entry.note === "approved-qty" &&
    entry.amountCents === 0
  );
}

/**
 * Cost item drill-down. Posted dollars are the rollup lock snapshot
 * (`locked_actual_cents`). A row is pending only when `entryInLockSnapshot`
 * says it was not stamped into that snapshot — never by comparing its date.
 * Actual MH uses the same predicate.
 *
 * Query shape (fixed count, independent reads overlapped after job+item):
 *   1) job ⋈ leaf item
 *   2) last lock (period label + cutoff)
 *   3) path rollup ∥ cost entries ∥ labor MH-by-lock
 */
export async function getCostItemPage(
  companyId: string,
  jobNumber: string,
  code: string,
  asOf = seedNow(),
) {
  const db = requireDb();
  // Job ⋈ leaf + last lock in one round-trip (was job+item then serial lock).
  const [row] = await db
    .select({
      job: jobs,
      item: costItems,
      periodLabel: progressClaims.periodLabel,
      lockedOn: sql<string | null>`(${progressClaims.lockedAt} at time zone 'UTC')::date::text`,
    })
    .from(jobs)
    .innerJoin(
      costItems,
      and(
        eq(costItems.jobId, jobs.id),
        eq(costItems.companyId, companyId),
        eq(costItems.code, code),
        eq(costItems.isLeaf, true),
      ),
    )
    .leftJoin(
      progressClaims,
      and(
        eq(progressClaims.jobId, jobs.id),
        eq(progressClaims.companyId, companyId),
        eq(progressClaims.status, "locked"),
        // Distinct-on style: only the latest lock — correlated via subquery.
        sql`${progressClaims.id} = (
          select pc.id from progress_claims pc
          where pc.job_id = ${jobs.id}
            and pc.company_id = ${companyId}
            and pc.status = 'locked'
          order by pc.locked_at desc
          limit 1
        )`,
      ),
    )
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!row) return null;
  const { job, item } = row;
  const periodLabel = row.periodLabel ?? null;
  const cutoffIso = row.lockedOn ?? null;

  const budgetCents = currentBudgetCents(item);
  const earnedMhMilli = earnedMhMilliOf({
    code: item.code,
    description: item.description,
    unit: item.unit,
    evMethod: item.evMethod,
    budgetQtyMilli: item.budgetQtyMilli,
    installedQtyMilli: item.installedQtyMilli,
    budgetCents,
    plannedCents: 0,
    actualCents: 0,
    claimedInstalledQtyMilli: item.claimedInstalledQtyMilli ?? 0,
    claimedPercentMilli: item.claimedPercentMilli ?? 0,
    budgetMhPerUnitMilli: item.budgetMhPerUnitMilli,
    forecastMethod: (item.forecastMethod ??
      "current_budget") as ForecastMethod,
    earnDerivation: item.earnDerivation,
  });

  // Rollup / entries / MH split are independent once we have item + cutoff.
  const [rollup, entryRows, mhSplit] = await Promise.all([
    pathRollupSql(companyId, job.id, item.path, asOf, cutoffIso),
    db
      .select({
        entry: costEntries,
        planId: dailyPlans.id,
        crew: crews.name,
        approverName: users.name,
      })
      .from(costEntries)
      .leftJoin(
        dailyPlanLines,
        and(
          eq(dailyPlanLines.id, costEntries.sourcePlanLineId),
          eq(dailyPlanLines.companyId, companyId),
        ),
      )
      .leftJoin(
        dailyPlans,
        and(
          eq(dailyPlans.id, dailyPlanLines.planId),
          eq(dailyPlans.companyId, companyId),
        ),
      )
      .leftJoin(crews, eq(crews.id, dailyPlans.crewId))
      .leftJoin(
        users,
        and(
          eq(users.id, dailyPlans.approvedById),
          eq(users.companyId, companyId),
        ),
      )
      .where(
        and(
          eq(costEntries.companyId, companyId),
          eq(costEntries.costItemId, item.id),
        ),
      )
      .orderBy(desc(costEntries.at), desc(costEntries.id)),
    laborMhMilliByLock(companyId, item.id),
  ]);

  const entries: CostEntryRow[] = [];
  for (const { entry, planId, crew, approverName } of entryRows) {
    if (isApprovedQtyMarker(entry)) continue;
    const atIso = entry.at.toISOString();
    const sinceLock = !entryInLockSnapshot(entry.lockedInAt);
    if (entry.kind === "labor") {
      entries.push({
        id: entry.id,
        kind: "labor",
        at: atIso,
        crew: crew ?? null,
        manHours: (entry.hoursTenths ?? 0) / 10,
        rateCents: entry.rateCents,
        amountCents: entry.amountCents,
        approverName: approverName ?? null,
        planId: planId ?? null,
        note: entry.note,
        sinceLock,
      });
    } else {
      entries.push({
        id: entry.id,
        kind: "other",
        at: atIso,
        note: entry.note,
        amountCents: entry.amountCents,
        sinceLock,
      });
    }
  }

  /** Posted MH uses the lock-snapshot predicate in cost-rollups (not entry dates). */
  const actualMhMilli = mhSplit.lockedMhMilli;
  const pendingMhMilli = mhSplit.pendingMhMilli;

  /** Posted total — rollup AC (locked snapshot). Pending dollars are live − locked. */
  const postedTotalCents = rollup.actualCents;
  const sinceLockCents = Math.max(0, item.actualCents - rollup.actualCents);

  const forecastMethod = (item.forecastMethod ??
    "current_budget") as ForecastMethod;
  const forecast = itemForecast({
    forecastMethod,
    budgetCents: rollup.budgetCents,
    earnedCents: rollup.earnedCents,
    actualCents: rollup.actualCents,
  });

  return {
    job: {
      id: job.id,
      number: job.number,
      name: job.name,
      shortName: job.shortName,
    },
    item: {
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      evMethod: item.evMethod,
      budgetQtyMilli: item.budgetQtyMilli,
      installedQtyMilli: item.installedQtyMilli,
      claimedInstalledQtyMilli: item.claimedInstalledQtyMilli ?? 0,
      claimedPercentMilli: item.claimedPercentMilli ?? 0,
      forecastMethod,
    },
    forecast,
    rollup,
    periodLabel,
    earnedMhMilli,
    actualMhMilli,
    pendingMhMilli,
    entries,
    /** @deprecated use postedTotalCents — kept equal to rollup AC. */
    entriesTotalCents: postedTotalCents,
    postedTotalCents,
    sinceLockCents,
    hasDailyReportLabor: entries.some(
      (e) => e.kind === "labor" && e.planId != null,
    ),
    hasLaborEntries: entries.some((e) => e.kind === "labor"),
  };
}

export type CostItemPage = NonNullable<
  Awaited<ReturnType<typeof getCostItemPage>>
>;

export type CostItemRouteTiming = {
  dbMs: number;
  queries: number;
  totalMs: number;
};

/**
 * Wall-clock getCostItemPage with query count. Kept free of `requireUser` /
 * next/headers so vitest importers of getCostItemPage do not pull the session
 * graph (Verify #60 hang in unknown-job.test.ts under LA / merged runs).
 * `dbMs` is real await time — not V5_DB_LATENCY_MS.
 */
export async function timedGetCostItemPage(
  companyId: string,
  jobNumber: string,
  code: string,
) {
  const startedAt = performance.now();
  const q0 = getDbQueryCount();
  const data = await getCostItemPage(companyId, jobNumber, code);
  const timing: CostItemRouteTiming = {
    dbMs: Math.round(performance.now() - startedAt),
    queries: getDbQueryCount() - q0,
    totalMs: Math.round(performance.now() - startedAt),
  };
  if (process.env.V5_TIMING_LOG === "1") {
    console.info(
      `[v5-timing] ${JSON.stringify({
        route: `cost-item:${jobNumber}/${code}`,
        ...timing,
        job: jobNumber,
        code,
        entries: data?.entries.length ?? 0,
      })}`,
    );
  }
  return { data, timing };
}

/** Resolve a plan id that posted labor for this cost item (for crawl / tests). */
export async function firstLaborPlanIdForCostItem(
  companyId: string,
  costItemId: string,
) {
  const db = requireDb();
  const [row] = await db
    .select({ planId: dailyPlans.id })
    .from(costEntries)
    .innerJoin(
      dailyPlanLines,
      eq(dailyPlanLines.id, costEntries.sourcePlanLineId),
    )
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanLines.planId))
    .where(
      and(
        eq(costEntries.companyId, companyId),
        eq(costEntries.costItemId, costItemId),
        eq(costEntries.kind, "labor"),
        isNotNull(costEntries.sourcePlanLineId),
      ),
    )
    .orderBy(asc(costEntries.at))
    .limit(1);
  return row?.planId ?? null;
}
