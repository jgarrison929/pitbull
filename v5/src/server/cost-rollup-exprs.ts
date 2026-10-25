/**
 * Single source of truth for Current Budget / EV / PV SQL fragments (intel D11).
 *
 * `cost-rollups.ts` (tile roll-ups) and `curve.ts` (S-curve) both import from
 * here. The EV CASE is written once in `earnedFromSql`; live-tile and claim-line
 * EV are the same function on different percent/qty columns.
 */
import { sql } from "drizzle-orm";
import { costItems } from "@/db/schema";

/** Current Budget total (labor+material+equipment+sub). EV and portfolio read this. */
export const cbTotalSql = sql`(
  ${costItems.cbLaborCents} + ${costItems.cbMaterialCents}
  + ${costItems.cbEquipmentCents} + ${costItems.cbSubCents}
)`;

type SqlFrag = ReturnType<typeof sql>;

/**
 * EV CASE once: units → min(CB, rounded CB × installed / budget_qty);
 * else → rounded CB × claimed_percent / 1000. Matches earnedCentsOf in lib/ev.
 */
export function earnedFromSql(
  claimedPercentMilli: SqlFrag,
  installedQtyMilli: SqlFrag,
) {
  return sql`
    case
      when ${costItems.evMethod} = 'units' and ${costItems.budgetQtyMilli} > 0
        then least(
          ${cbTotalSql},
          round(
            (${cbTotalSql}::numeric * ${installedQtyMilli})
              / ${costItems.budgetQtyMilli}
          )::bigint
        )
      else round(
        (${cbTotalSql}::numeric * ${claimedPercentMilli}) / 1000
      )::bigint
    end`;
}

/** Live-tile EV on the leaf's claimed_* columns. */
export const earnedSql = earnedFromSql(
  sql`${costItems.claimedPercentMilli}`,
  sql`${costItems.claimedInstalledQtyMilli}`,
);

/**
 * EV from a progress-claim line snapshot + the leaf's Current Budget.
 * Same CASE as earnedSql; percent/qty come from the claim line.
 */
export function earnedFromClaimLineSql(
  claimedPercentMilli: SqlFrag,
  installedQtyMilli: SqlFrag,
) {
  return earnedFromSql(claimedPercentMilli, installedQtyMilli);
}

/**
 * Linear PV as-of a calendar date (UTC), matching plannedValueCents in lib/ev.
 * Pass asOfIso as YYYY-MM-DD.
 */
export function plannedAsOfSql(asOfIso: string | SqlFrag) {
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
