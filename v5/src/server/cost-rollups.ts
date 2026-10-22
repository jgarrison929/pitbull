import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { costItems, progressClaims } from "@/db/schema";
import { rollupFromTotals, type Rollup } from "@/lib/ev";

/** Current Budget total (labor+material+equipment+sub). EV and portfolio read this. */
const cbTotalSql = sql`(
  ${costItems.cbLaborCents} + ${costItems.cbMaterialCents}
  + ${costItems.cbEquipmentCents} + ${costItems.cbSubCents}
)`;

/**
 * Units earn from claimed_installed / budget_qty, capped at BAC; milestones/PM %
 * from claimed_percent. Matches earnedCentsOf in lib/ev.
 */
const earnedSql = sql`
  case
    when ${costItems.evMethod} = 'units' and ${costItems.budgetQtyMilli} > 0
      then least(
        ${cbTotalSql},
        round(
          (${cbTotalSql}::numeric * ${costItems.claimedInstalledQtyMilli})
            / ${costItems.budgetQtyMilli}
        )::bigint
      )
    else round(
      (${cbTotalSql}::numeric * ${costItems.claimedPercentMilli}) / 1000
    )::bigint
  end`;

/**
 * Linear PV as-of a calendar date (UTC), matching plannedValueCents in lib/ev.
 * Pass asOfIso as YYYY-MM-DD.
 */
function plannedAsOfSql(asOfIso: string | ReturnType<typeof sql>) {
  const asOf = typeof asOfIso === "string" ? sql`${asOfIso}::date` : asOfIso;
  return sql`
    case
      when ${costItems.plannedFinishOn} <= ${costItems.plannedStartOn}
        then ${cbTotalSql}
      when ${asOf} <= ${costItems.plannedStartOn} then 0
      when ${asOf} >= ${costItems.plannedFinishOn}
        then ${cbTotalSql}
      else round(
        ${cbTotalSql}::numeric
          * (${asOf} - ${costItems.plannedStartOn})::numeric
          / (${costItems.plannedFinishOn} - ${costItems.plannedStartOn})::numeric
      )::bigint
    end`;
}

/**
 * Per-leaf EAC. Matches itemForecast in lib/ev:
 * current_budget → AC + (BAC − EV); average_performance → AC×BAC÷EV (else fallback).
 */
function eacSql(earned: ReturnType<typeof sql>) {
  return sql`
    case
      when ${costItems.forecastMethod} = 'average_performance'
        and (${earned}) > 0
        then round(
          (${costItems.lockedActualCents}::numeric * ${cbTotalSql})
            / (${earned})::numeric
        )::bigint
      else ${costItems.lockedActualCents} + (${cbTotalSql} - (${earned}))
    end`;
}

function toRollup(r: {
  budget_cents: number;
  planned_cents: number;
  earned_cents: number;
  actual_cents: number;
  eac_cents: number;
  etc_cents?: number;
  since_lock_actual_cents?: number;
  since_lock_planned_cents?: number;
}): Rollup {
  return rollupFromTotals({
    budgetCents: Number(r.budget_cents),
    plannedCents: Number(r.planned_cents),
    earnedCents: Number(r.earned_cents),
    actualCents: Number(r.actual_cents),
    eacCents: Number(r.eac_cents),
    etcCents: Number(r.etc_cents ?? Number(r.eac_cents) - Number(r.actual_cents)),
    sinceLockActualCents: Number(r.since_lock_actual_cents ?? 0),
    sinceLockPlannedCents: Number(r.since_lock_planned_cents ?? 0),
  });
}

/** ISO date (UTC) for an as-of Date. */
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Job EV roll-up in SQL over leaf cost codes only. Summary WBS rows are excluded;
 * their children carry the money. Target: &lt;500ms at 10k leaves.
 *
 * EV, AC, and PV share one cutoff = last locked period (or `asOf` when never locked).
 */
export async function jobRollupSql(
  companyId: string,
  jobId: string,
  asOf = new Date(),
): Promise<Rollup> {
  const db = requireDb();
  const todayIso = isoDay(asOf);
  const [lock] = await db.execute<{ locked_on: string | null }>(sql`
    select (${progressClaims.lockedAt} at time zone 'UTC')::date::text as locked_on
    from ${progressClaims}
    where ${progressClaims.companyId} = ${companyId}
      and ${progressClaims.jobId} = ${jobId}
      and ${progressClaims.status} = 'locked'
    order by ${progressClaims.lockedAt} desc
    limit 1`);
  const cutoffIso = lock?.locked_on ?? todayIso;
  const plannedCutoff = plannedAsOfSql(cutoffIso);
  const plannedLive = plannedAsOfSql(todayIso);
  const earned = earnedSql;
  const eac = eacSql(earned);
  const [r] = await db.execute<{
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
    eac_cents: number;
    etc_cents: number;
    since_lock_actual_cents: number;
    since_lock_planned_cents: number;
  }>(sql`
    select
      coalesce(sum(${cbTotalSql}), 0)::bigint as budget_cents,
      coalesce(sum(${plannedCutoff}), 0)::bigint as planned_cents,
      coalesce(sum(${earned}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.lockedActualCents}), 0)::bigint as actual_cents,
      coalesce(sum(${eac}), 0)::bigint as eac_cents,
      coalesce(sum(${eac} - ${costItems.lockedActualCents}), 0)::bigint as etc_cents,
      coalesce(sum(${costItems.actualCents} - ${costItems.lockedActualCents}), 0)::bigint
        as since_lock_actual_cents,
      coalesce(sum(${plannedLive} - ${plannedCutoff}), 0)::bigint
        as since_lock_planned_cents
    from ${costItems}
    where ${costItems.companyId} = ${companyId}
      and ${costItems.jobId} = ${jobId}
      and ${costItems.isLeaf} = true`);
  return toRollup(r);
}

/** Prefix roll-up: sum of leaves under a materialized path. */
export async function pathRollupSql(
  companyId: string,
  jobId: string,
  pathPrefix: string,
  asOf = new Date(),
): Promise<
  Pick<
    Rollup,
    | "budgetCents"
    | "earnedCents"
    | "actualCents"
    | "plannedCents"
    | "eacCents"
    | "etcCents"
  >
> {
  const db = requireDb();
  const todayIso = isoDay(asOf);
  const [lock] = await db.execute<{ locked_on: string | null }>(sql`
    select (${progressClaims.lockedAt} at time zone 'UTC')::date::text as locked_on
    from ${progressClaims}
    where ${progressClaims.companyId} = ${companyId}
      and ${progressClaims.jobId} = ${jobId}
      and ${progressClaims.status} = 'locked'
    order by ${progressClaims.lockedAt} desc
    limit 1`);
  const cutoffIso = lock?.locked_on ?? todayIso;
  const planned = plannedAsOfSql(cutoffIso);
  const earned = earnedSql;
  const eac = eacSql(earned);
  const [r] = await db.execute<{
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
    eac_cents: number;
  }>(sql`
    select
      coalesce(sum(${cbTotalSql}), 0)::bigint as budget_cents,
      coalesce(sum(${planned}), 0)::bigint as planned_cents,
      coalesce(sum(${earned}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.lockedActualCents}), 0)::bigint as actual_cents,
      coalesce(sum(${eac}), 0)::bigint as eac_cents
    from ${costItems}
    where ${costItems.companyId} = ${companyId}
      and ${costItems.jobId} = ${jobId}
      and ${costItems.isLeaf} = true
      and ${costItems.path} like ${pathPrefix + "%"}`);
  return {
    budgetCents: Number(r.budget_cents),
    plannedCents: Number(r.planned_cents),
    earnedCents: Number(r.earned_cents),
    actualCents: Number(r.actual_cents),
    eacCents: Number(r.eac_cents),
    etcCents: Number(r.eac_cents) - Number(r.actual_cents),
  };
}

/** Portfolio: leaf roll-ups grouped by job (no full WBS hydrate). */
export async function portfolioRollupsSql(
  companyId: string,
  asOf = new Date(),
) {
  const db = requireDb();
  const todayIso = isoDay(asOf);
  const plannedLive = plannedAsOfSql(todayIso);
  // Per-job cutoff = last lock date; fall back to today when never locked.
  const cutoffDate = sql`coalesce(locks.locked_on, ${todayIso}::date)`;
  const plannedCutoff = plannedAsOfSql(cutoffDate);
  const earned = earnedSql;
  const eac = eacSql(earned);
  return db.execute<{
    job_id: string;
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
    eac_cents: number;
    etc_cents: number;
    since_lock_actual_cents: number;
    since_lock_planned_cents: number;
  }>(sql`
    with locks as (
      select distinct on (${progressClaims.jobId})
        ${progressClaims.jobId} as job_id,
        (${progressClaims.lockedAt} at time zone 'UTC')::date as locked_on
      from ${progressClaims}
      where ${progressClaims.companyId} = ${companyId}
        and ${progressClaims.status} = 'locked'
      order by ${progressClaims.jobId}, ${progressClaims.lockedAt} desc
    )
    select
      ${costItems.jobId} as job_id,
      coalesce(sum(${cbTotalSql}), 0)::bigint as budget_cents,
      coalesce(sum(${plannedCutoff}), 0)::bigint as planned_cents,
      coalesce(sum(${earned}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.lockedActualCents}), 0)::bigint as actual_cents,
      coalesce(sum(${eac}), 0)::bigint as eac_cents,
      coalesce(sum(${eac} - ${costItems.lockedActualCents}), 0)::bigint as etc_cents,
      coalesce(sum(${costItems.actualCents} - ${costItems.lockedActualCents}), 0)::bigint
        as since_lock_actual_cents,
      coalesce(sum(${plannedLive} - ${plannedCutoff}), 0)::bigint
        as since_lock_planned_cents
    from ${costItems}
    left join locks on locks.job_id = ${costItems.jobId}
    where ${costItems.companyId} = ${companyId}
      and ${costItems.isLeaf} = true
    group by ${costItems.jobId}`);
}

/** Server-side cost-code search for comboboxes. Leaves only; trigram-friendly ILIKE. */
export async function searchCostItems(
  companyId: string,
  jobId: string,
  query: string,
  limit = 20,
) {
  const db = requireDb();
  const q = query.trim();
  if (!q) {
    return db
      .select({
        id: costItems.id,
        code: costItems.code,
        description: costItems.description,
        unit: costItems.unit,
      })
      .from(costItems)
      .where(
        sql`${costItems.companyId} = ${companyId}
          and ${costItems.jobId} = ${jobId}
          and ${costItems.isLeaf} = true`,
      )
      .orderBy(costItems.code)
      .limit(limit);
  }
  const safe = q.replace(/[%_]/g, "");
  const contains = `%${safe}%`;
  const prefix = `${safe}%`;
  // Prefix matches first so "07-03" surfaces 07-03-xxx, not 01-07-030… via %q%.
  return db
    .select({
      id: costItems.id,
      code: costItems.code,
      description: costItems.description,
      unit: costItems.unit,
    })
    .from(costItems)
    .where(
      sql`${costItems.companyId} = ${companyId}
        and ${costItems.jobId} = ${jobId}
        and ${costItems.isLeaf} = true
        and (${costItems.code} ilike ${contains} or ${costItems.description} ilike ${contains})`,
    )
    .orderBy(
      sql`(${costItems.code} ilike ${prefix}) desc`,
      costItems.code,
    )
    .limit(limit);
}
