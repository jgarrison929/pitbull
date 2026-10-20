import "server-only";
import { sql } from "drizzle-orm";
import { requireDb } from "@/db";
import { costItems } from "@/db/schema";
import type { Rollup } from "@/lib/ev";

/**
 * Units earn from claimed_installed / budget_qty (main EV); milestones/PM % from
 * claimed_percent. Matches earnedCentsOf in lib/ev.
 */
/** Per-leaf earned cents — round() matches Math.round in earnedCentsOf. */
const earnedSql = sql`
  case
    when ${costItems.evMethod} = 'units' and ${costItems.budgetQtyMilli} > 0
      then round(
        (${costItems.budgetCents}::numeric * ${costItems.claimedInstalledQtyMilli})
          / ${costItems.budgetQtyMilli}
      )::bigint
    else round(
      (${costItems.budgetCents}::numeric * ${costItems.claimedPercentMilli}) / 1000
    )::bigint
  end`;

/**
 * Linear PV as-of a calendar date (UTC), matching plannedValueCents in lib/ev.
 * Pass asOfIso as YYYY-MM-DD.
 */
function plannedAsOfSql(asOfIso: string) {
  return sql`
    case
      when ${costItems.plannedFinishOn} <= ${costItems.plannedStartOn}
        then ${costItems.budgetCents}
      when ${asOfIso}::date <= ${costItems.plannedStartOn} then 0
      when ${asOfIso}::date >= ${costItems.plannedFinishOn}
        then ${costItems.budgetCents}
      else round(
        ${costItems.budgetCents}::numeric
          * (${asOfIso}::date - ${costItems.plannedStartOn})::numeric
          / (${costItems.plannedFinishOn} - ${costItems.plannedStartOn})::numeric
      )::bigint
    end`;
}

function toRollup(r: {
  budget_cents: number;
  planned_cents: number;
  earned_cents: number;
  actual_cents: number;
}): Rollup {
  const budgetCents = Number(r.budget_cents);
  const plannedCents = Number(r.planned_cents);
  const earnedCents = Number(r.earned_cents);
  const actualCents = Number(r.actual_cents);
  const cpi = actualCents === 0 ? 1 : earnedCents / actualCents;
  return {
    budgetCents,
    plannedCents,
    earnedCents,
    actualCents,
    costVarianceCents: earnedCents - actualCents,
    scheduleVarianceCents: earnedCents - plannedCents,
    percent: budgetCents === 0 ? 0 : earnedCents / budgetCents,
    cpi,
    spi: plannedCents === 0 ? 1 : earnedCents / plannedCents,
    eacCents: Math.round(budgetCents / cpi),
  };
}

/**
 * Job EV roll-up in SQL over leaf cost codes only. Summary WBS rows are excluded;
 * their children carry the money. Target: &lt;500ms at 10k leaves.
 */
export async function jobRollupSql(
  companyId: string,
  jobId: string,
  asOf = new Date(),
): Promise<Rollup> {
  const db = requireDb();
  const asOfIso = asOf.toISOString().slice(0, 10);
  const planned = plannedAsOfSql(asOfIso);
  const [r] = await db.execute<{
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
  }>(sql`
    select
      coalesce(sum(${costItems.budgetCents}), 0)::bigint as budget_cents,
      coalesce(sum(${planned}), 0)::bigint as planned_cents,
      coalesce(sum(${earnedSql}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.actualCents}), 0)::bigint as actual_cents
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
  Pick<Rollup, "budgetCents" | "earnedCents" | "actualCents" | "plannedCents">
> {
  const db = requireDb();
  const asOfIso = asOf.toISOString().slice(0, 10);
  const planned = plannedAsOfSql(asOfIso);
  const [r] = await db.execute<{
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
  }>(sql`
    select
      coalesce(sum(${costItems.budgetCents}), 0)::bigint as budget_cents,
      coalesce(sum(${planned}), 0)::bigint as planned_cents,
      coalesce(sum(${earnedSql}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.actualCents}), 0)::bigint as actual_cents
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
  };
}

/** Portfolio: leaf roll-ups grouped by job (no full WBS hydrate). */
export async function portfolioRollupsSql(
  companyId: string,
  asOf = new Date(),
) {
  const db = requireDb();
  const asOfIso = asOf.toISOString().slice(0, 10);
  const planned = plannedAsOfSql(asOfIso);
  return db.execute<{
    job_id: string;
    budget_cents: number;
    planned_cents: number;
    earned_cents: number;
    actual_cents: number;
  }>(sql`
    select
      ${costItems.jobId} as job_id,
      coalesce(sum(${costItems.budgetCents}), 0)::bigint as budget_cents,
      coalesce(sum(${planned}), 0)::bigint as planned_cents,
      coalesce(sum(${earnedSql}), 0)::bigint as earned_cents,
      coalesce(sum(${costItems.actualCents}), 0)::bigint as actual_cents
    from ${costItems}
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
