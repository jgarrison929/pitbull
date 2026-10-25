import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costEntries,
  costItems,
  jobs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import type { CurvePoint, CurveResult } from "@/lib/curve";
import {
  earnedFromClaimLineSql,
  earnedSql,
  plannedAsOfSql,
} from "@/server/cost-rollup-exprs";
import { seedNow } from "@/server/seed-clock";

export type { CurvePoint, CurveResult } from "@/lib/curve";

/**
 * Fixed query budgets — must-fail tests go red if the curve walks leaves
 * day-by-day or opens an N+1. One CTE round-trip each.
 */
export const JOB_CURVE_QUERY_BUDGET = 1;
export const PORTFOLIO_CURVE_QUERY_BUDGET = 1;

/**
 * Soft cap on leaves that participate in a daily S-curve. Above this, the
 * series CTE is skipped (returns null / omits the job) so a 10k stress WBS
 * cannot cross-join days × leaves and stall the job page. Demo jobs stay well
 * under the cap; the stress fixture (99-010) is above it by design.
 */
export const JOB_CURVE_LEAF_BUDGET = 2_000;

function mapPoints(
  rows: {
    on: string;
    planned_cents: number;
    earned_cents: number | null;
    actual_cents: number | null;
  }[],
): CurvePoint[] {
  return rows.map((r) => ({
    on: r.on,
    plannedCents: Number(r.planned_cents),
    earnedCents: r.earned_cents == null ? null : Number(r.earned_cents),
    actualCents: r.actual_cents == null ? null : Number(r.actual_cents),
  }));
}

/**
 * Job S-curve: daily PV (linear Current Budget), EV (steps on lock dates),
 * AC (cumulative by cost-entry calendar date). EV/AC stop at the last lock.
 * Draft-estimate jobs return null (no curve section).
 */
export async function jobCurve(
  companyId: string,
  jobId: string,
  // Kept for API parity with jobRollupSql / seedNow callers; cutoff comes from locks.
  asOf = seedNow(),
): Promise<CurveResult | null> {
  void asOf;
  const db = requireDb();
  const plannedOnDay = plannedAsOfSql(sql`d.on`);
  const claimEarned = earnedFromClaimLineSql(
    sql`${progressClaimLines.claimedPercentMilli}`,
    sql`${progressClaimLines.installedQtyMilli}`,
  );

  const rows = await db.execute<{
    estimate_status: string;
    leaf_n: number;
    cutoff_on: string | null;
    on: string | null;
    planned_cents: number | null;
    earned_cents: number | null;
    actual_cents: number | null;
  }>(sql`
    with job as (
      select ${jobs.estimateStatus} as estimate_status
      from ${jobs}
      where ${jobs.companyId} = ${companyId}
        and ${jobs.id} = ${jobId}
      limit 1
    ),
    leaf_meta as (
      select count(*)::int as leaf_n
      from ${costItems}
      where ${costItems.companyId} = ${companyId}
        and ${costItems.jobId} = ${jobId}
        and ${costItems.isLeaf} = true
    ),
    bounds as (
      select
        min(${costItems.plannedStartOn}) as from_on,
        max(${costItems.plannedFinishOn}) as to_on
      from ${costItems}
      where ${costItems.companyId} = ${companyId}
        and ${costItems.jobId} = ${jobId}
        and ${costItems.isLeaf} = true
    ),
    lock as (
      select (${progressClaims.lockedAt} at time zone 'UTC')::date as cutoff_on
      from ${progressClaims}
      where ${progressClaims.companyId} = ${companyId}
        and ${progressClaims.jobId} = ${jobId}
        and ${progressClaims.status} = 'locked'
      order by ${progressClaims.lockedAt} desc
      limit 1
    ),
    locks as (
      select
        ${progressClaims.id} as claim_id,
        (${progressClaims.lockedAt} at time zone 'UTC')::date as locked_on
      from ${progressClaims}
      where ${progressClaims.companyId} = ${companyId}
        and ${progressClaims.jobId} = ${jobId}
        and ${progressClaims.status} = 'locked'
    ),
    lock_ev as (
      select
        l.locked_on,
        coalesce(sum(${claimEarned}), 0)::bigint as earned_cents
      from locks l
      join ${progressClaimLines}
        on ${progressClaimLines.claimId} = l.claim_id
       and ${progressClaimLines.companyId} = ${companyId}
      join ${costItems}
        on ${costItems.id} = ${progressClaimLines.costItemId}
       and ${costItems.isLeaf} = true
      group by l.locked_on
    ),
    -- Live tile EV at the latest lock (claim lines can lag Current Budget after a CO).
    tile_ev as (
      select coalesce(sum(${earnedSql}), 0)::bigint as earned_cents
      from ${costItems}
      where ${costItems.companyId} = ${companyId}
        and ${costItems.jobId} = ${jobId}
        and ${costItems.isLeaf} = true
    ),
    entry_days as (
      select
        (${costEntries.at} at time zone 'America/Los_Angeles')::date as on,
        coalesce(sum(${costEntries.amountCents}), 0)::bigint as day_cents
      from ${costEntries}
      join ${costItems}
        on ${costItems.id} = ${costEntries.costItemId}
      where ${costEntries.companyId} = ${companyId}
        and ${costItems.jobId} = ${jobId}
        and ${costItems.isLeaf} = true
        and ${costEntries.lockedInAt} is not null
      group by 1
    ),
    -- Empty when over the leaf budget so the days×leaves join never runs.
    days as (
      select gs::date as on
      from bounds b
      cross join leaf_meta lm
      cross join lateral generate_series(b.from_on, b.to_on, interval '1 day') gs
      where b.from_on is not null
        and b.to_on is not null
        and lm.leaf_n <= ${JOB_CURVE_LEAF_BUDGET}
    ),
    series as (
      select
        d.on,
        coalesce(sum(${plannedOnDay}), 0)::bigint as planned_cents,
        case
          when (select cutoff_on from lock) is null then null
          when d.on > (select cutoff_on from lock) then null
          when d.on = (select cutoff_on from lock)
            then (select earned_cents from tile_ev)
          else (
            select le.earned_cents
            from lock_ev le
            where le.locked_on <= d.on
            order by le.locked_on desc
            limit 1
          )
        end as earned_cents,
        case
          when (select cutoff_on from lock) is null then null
          when d.on > (select cutoff_on from lock) then null
          else (
            select coalesce(sum(ed.day_cents), 0)::bigint
            from entry_days ed
            where ed.on <= d.on
          )
        end as actual_cents
      from days d
      join ${costItems}
        on ${costItems.companyId} = ${companyId}
       and ${costItems.jobId} = ${jobId}
       and ${costItems.isLeaf} = true
      group by d.on
    )
    select
      (select estimate_status from job) as estimate_status,
      (select leaf_n from leaf_meta) as leaf_n,
      (select cutoff_on::text from lock) as cutoff_on,
      s.on::text as on,
      s.planned_cents,
      s.earned_cents,
      s.actual_cents
    from job
    left join series s on true
    order by s.on`);

  if (!rows.length) return null;
  const status = rows[0]!.estimate_status;
  if (status !== "approved") return null;
  // Oversize WBS: no chart (avoids days×leaves stall on the stress job).
  if (Number(rows[0]!.leaf_n) > JOB_CURVE_LEAF_BUDGET) return null;

  const cutoffOn = rows[0]!.cutoff_on;
  const points = mapPoints(
    rows
      .filter((r) => r.on != null)
      .map((r) => ({
        on: r.on!,
        planned_cents: Number(r.planned_cents ?? 0),
        earned_cents: r.earned_cents,
        actual_cents: r.actual_cents,
      })),
  );
  return { cutoffOn, points };
}

/**
 * Portfolio S-curve: sum of approved-estimate jobs only (26-010 draft stays out).
 * Cutoff is the latest lock among those jobs. At that date EV/AC/PV match the
 * portfolio tiles (each job contributes its locked totals).
 */
export async function portfolioCurve(
  companyId: string,
  // Kept for API parity with portfolioRollupsSql / seedNow callers.
  asOf = seedNow(),
): Promise<CurveResult> {
  void asOf;
  const db = requireDb();
  const plannedOnDay = plannedAsOfSql(sql`d.on`);
  const claimEarned = earnedFromClaimLineSql(
    sql`${progressClaimLines.claimedPercentMilli}`,
    sql`${progressClaimLines.installedQtyMilli}`,
  );

  const rows = await db.execute<{
    cutoff_on: string | null;
    on: string | null;
    planned_cents: number | null;
    earned_cents: number | null;
    actual_cents: number | null;
  }>(sql`
    with active_jobs as (
      select ${jobs.id} as job_id
      from ${jobs}
      where ${jobs.companyId} = ${companyId}
        and ${jobs.estimateStatus} = 'approved'
        -- Omit oversize WBS (stress 99-010) so portfolio curve stays O(demo).
        and (
          select count(*)::int
          from ${costItems}
          where ${costItems.companyId} = ${companyId}
            and ${costItems.jobId} = ${jobs.id}
            and ${costItems.isLeaf} = true
        ) <= ${JOB_CURVE_LEAF_BUDGET}
    ),
    bounds as (
      select
        min(${costItems.plannedStartOn}) as from_on,
        max(${costItems.plannedFinishOn}) as to_on
      from ${costItems}
      join active_jobs aj on aj.job_id = ${costItems.jobId}
      where ${costItems.companyId} = ${companyId}
        and ${costItems.isLeaf} = true
    ),
    job_cutoffs as (
      select distinct on (${progressClaims.jobId})
        ${progressClaims.jobId} as job_id,
        (${progressClaims.lockedAt} at time zone 'UTC')::date as cutoff_on
      from ${progressClaims}
      join active_jobs aj on aj.job_id = ${progressClaims.jobId}
      where ${progressClaims.companyId} = ${companyId}
        and ${progressClaims.status} = 'locked'
      order by ${progressClaims.jobId}, ${progressClaims.lockedAt} desc
    ),
    portfolio_cutoff as (
      select max(jc.cutoff_on) as cutoff_on from job_cutoffs jc
    ),
    locks as (
      select
        ${progressClaims.id} as claim_id,
        ${progressClaims.jobId} as job_id,
        (${progressClaims.lockedAt} at time zone 'UTC')::date as locked_on
      from ${progressClaims}
      join active_jobs aj on aj.job_id = ${progressClaims.jobId}
      where ${progressClaims.companyId} = ${companyId}
        and ${progressClaims.status} = 'locked'
    ),
    lock_ev as (
      select
        l.job_id,
        l.locked_on,
        coalesce(sum(${claimEarned}), 0)::bigint as earned_cents
      from locks l
      join ${progressClaimLines}
        on ${progressClaimLines.claimId} = l.claim_id
       and ${progressClaimLines.companyId} = ${companyId}
      join ${costItems}
        on ${costItems.id} = ${progressClaimLines.costItemId}
       and ${costItems.isLeaf} = true
      group by l.job_id, l.locked_on
    ),
    tile_ev as (
      select
        ${costItems.jobId} as job_id,
        coalesce(sum(${earnedSql}), 0)::bigint as earned_cents
      from ${costItems}
      join active_jobs aj on aj.job_id = ${costItems.jobId}
      where ${costItems.companyId} = ${companyId}
        and ${costItems.isLeaf} = true
      group by ${costItems.jobId}
    ),
    entry_days as (
      select
        ${costItems.jobId} as job_id,
        (${costEntries.at} at time zone 'America/Los_Angeles')::date as on,
        coalesce(sum(${costEntries.amountCents}), 0)::bigint as day_cents
      from ${costEntries}
      join ${costItems}
        on ${costItems.id} = ${costEntries.costItemId}
      join active_jobs aj on aj.job_id = ${costItems.jobId}
      where ${costEntries.companyId} = ${companyId}
        and ${costItems.isLeaf} = true
        and ${costEntries.lockedInAt} is not null
      group by 1, 2
    ),
    -- Pre-aggregate AC at each job's cutoff (for days after that job locked).
    job_locked_ac as (
      select
        jc.job_id,
        coalesce(sum(ed.day_cents), 0)::bigint as actual_cents
      from job_cutoffs jc
      left join entry_days ed
        on ed.job_id = jc.job_id and ed.on <= jc.cutoff_on
      group by jc.job_id
    ),
    days as (
      select gs::date as on
      from bounds b
      cross join lateral generate_series(b.from_on, b.to_on, interval '1 day') gs
      where b.from_on is not null and b.to_on is not null
    ),
    job_pv as (
      select
        d.on,
        ${costItems.jobId} as job_id,
        coalesce(sum(${plannedOnDay}), 0)::bigint as planned_cents
      from days d
      join ${costItems}
        on ${costItems.companyId} = ${companyId}
       and ${costItems.isLeaf} = true
      join active_jobs aj on aj.job_id = ${costItems.jobId}
      group by d.on, ${costItems.jobId}
    ),
    job_ev as (
      select
        d.on,
        aj.job_id,
        case
          when jc.cutoff_on is null then null::bigint
          when d.on > jc.cutoff_on then te.earned_cents
          when d.on = jc.cutoff_on then te.earned_cents
          else (
            select le.earned_cents
            from lock_ev le
            where le.job_id = aj.job_id and le.locked_on <= d.on
            order by le.locked_on desc
            limit 1
          )
        end as earned_cents
      from days d
      cross join active_jobs aj
      left join job_cutoffs jc on jc.job_id = aj.job_id
      left join tile_ev te on te.job_id = aj.job_id
    ),
    job_ac as (
      select
        d.on,
        aj.job_id,
        case
          when jc.cutoff_on is null then null::bigint
          when d.on > jc.cutoff_on then jla.actual_cents
          else (
            select coalesce(sum(ed.day_cents), 0)::bigint
            from entry_days ed
            where ed.job_id = aj.job_id and ed.on <= d.on
          )
        end as actual_cents
      from days d
      cross join active_jobs aj
      left join job_cutoffs jc on jc.job_id = aj.job_id
      left join job_locked_ac jla on jla.job_id = aj.job_id
    ),
    series as (
      select
        pv.on,
        coalesce(sum(pv.planned_cents), 0)::bigint as planned_cents,
        case
          when (select cutoff_on from portfolio_cutoff) is null then null
          when pv.on > (select cutoff_on from portfolio_cutoff) then null
          else coalesce(sum(ev.earned_cents), 0)::bigint
        end as earned_cents,
        case
          when (select cutoff_on from portfolio_cutoff) is null then null
          when pv.on > (select cutoff_on from portfolio_cutoff) then null
          else coalesce(sum(ac.actual_cents), 0)::bigint
        end as actual_cents
      from job_pv pv
      left join job_ev ev on ev.on = pv.on and ev.job_id = pv.job_id
      left join job_ac ac on ac.on = pv.on and ac.job_id = pv.job_id
      group by pv.on
    )
    select
      (select cutoff_on::text from portfolio_cutoff) as cutoff_on,
      s.on::text as on,
      s.planned_cents,
      s.earned_cents,
      s.actual_cents
    from series s
    order by s.on`);

  if (!rows.length) return { cutoffOn: null, points: [] };
  return {
    cutoffOn: rows[0]!.cutoff_on,
    points: mapPoints(
      rows
        .filter((r) => r.on != null)
        .map((r) => ({
          on: r.on!,
          planned_cents: Number(r.planned_cents ?? 0),
          earned_cents: r.earned_cents,
          actual_cents: r.actual_cents,
        })),
    ),
  };
}
