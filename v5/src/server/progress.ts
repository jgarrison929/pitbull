import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  costEntries,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import {
  DEFAULT_LABOR_RATE_CENTS,
  laborCents,
  plannedValueCents,
  snapshotClaimPercent,
  type EvMethod,
} from "@/lib/ev";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * After a crew plan is submitted: post quantity into installed (units method) and
 * labor hours × rate into cost_entries, then refresh denormalized actuals.
 */
export async function postSubmittedPlan(
  companyId: string,
  planId: string,
  now = new Date(),
) {
  const db = requireDb();
  await db.transaction(async (tx) => {
    const lines = await tx
      .select({
        line: dailyPlanLines,
        item: costItems,
      })
      .from(dailyPlanLines)
      .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
      .where(
        and(
          eq(dailyPlanLines.companyId, companyId),
          eq(dailyPlanLines.planId, planId),
        ),
      );
    for (const { line, item } of lines) {
      const manHours = (line.workers * line.hoursTenths) / 10;
      const amount = laborCents(manHours, DEFAULT_LABOR_RATE_CENTS);
      if (amount > 0) {
        // Replace any prior post from this plan line so re-seed/reset stays clean;
        // submit is one-shot today, but keep the idempotent key.
        await tx
          .delete(costEntries)
          .where(
            and(
              eq(costEntries.companyId, companyId),
              eq(costEntries.sourcePlanLineId, line.id),
            ),
          );
        await tx.insert(costEntries).values({
          id: randomUUID(),
          companyId,
          costItemId: item.id,
          kind: "labor",
          hoursTenths: Math.round(manHours * 10),
          rateCents: DEFAULT_LABOR_RATE_CENTS,
          amountCents: amount,
          note: `Posted from ${line.activity}`,
          sourcePlanLineId: line.id,
          at: now,
        });
      }
      if (item.evMethod === "units" && line.qtyMilli > 0) {
        await tx
          .update(costItems)
          .set({
            installedQtyMilli: sql`${costItems.installedQtyMilli} + ${line.qtyMilli}`,
          })
          .where(
            and(eq(costItems.id, item.id), eq(costItems.companyId, companyId)),
          );
      }
      await refreshCostItemActuals(tx, companyId, item.id, now);
    }
  });
}

async function refreshCostItemActuals(
  tx: Tx,
  companyId: string,
  costItemId: string,
  asOf: Date,
) {
  const [sum] = await tx
    .select({
      total: sql<number>`coalesce(sum(${costEntries.amountCents}), 0)::bigint`,
    })
    .from(costEntries)
    .where(
      and(
        eq(costEntries.companyId, companyId),
        eq(costEntries.costItemId, costItemId),
      ),
    );
  const [item] = await tx
    .select()
    .from(costItems)
    .where(
      and(eq(costItems.id, costItemId), eq(costItems.companyId, companyId)),
    );
  if (!item) return;
  const plannedCents = plannedValueCents(
    item.budgetCents,
    item.plannedStartOn,
    item.plannedFinishOn,
    asOf,
  );
  await tx
    .update(costItems)
    .set({
      actualCents: Number(sum?.total ?? 0),
      plannedCents,
    })
    .where(eq(costItems.id, costItemId));
}

/**
 * Lock the open draft progress claim for a job: snapshot each line's percent from
 * its EV method, mark the claim locked, and copy those percents onto cost_items
 * (locked claims drive earned value).
 */
export async function lockProgressClaim(
  companyId: string,
  jobId: string,
  userId: string,
  now = new Date(),
) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .select()
      .from(progressClaims)
      .where(
        and(
          eq(progressClaims.companyId, companyId),
          eq(progressClaims.jobId, jobId),
          eq(progressClaims.status, "draft"),
        ),
      )
      .orderBy(desc(progressClaims.periodLabel))
      .limit(1);
    if (!claim) return { ok: false as const, reason: "no-draft" as const };

    const items = await tx
      .select()
      .from(costItems)
      .where(
        and(eq(costItems.companyId, companyId), eq(costItems.jobId, jobId)),
      )
      .orderBy(asc(costItems.code));

    const milestones = await tx
      .select()
      .from(costItemMilestones)
      .where(eq(costItemMilestones.companyId, companyId));

    const logs = await tx
      .select()
      .from(pmPercentLogs)
      .where(eq(pmPercentLogs.companyId, companyId))
      .orderBy(desc(pmPercentLogs.at));

    // Ensure claim lines exist for every cost item on the job.
    const existing = await tx
      .select()
      .from(progressClaimLines)
      .where(
        and(
          eq(progressClaimLines.companyId, companyId),
          eq(progressClaimLines.claimId, claim.id),
        ),
      );
    const byItem = new Map(existing.map((l) => [l.costItemId, l]));

    for (const item of items) {
      const ms = milestones.filter((m) => m.costItemId === item.id);
      const completeWeight = ms
        .filter((m) => m.complete)
        .reduce((s, m) => s + m.weightMilli, 0);
      const latestLog = logs.find((l) => l.costItemId === item.id);
      const snap = snapshotClaimPercent({
        method: item.evMethod as EvMethod,
        budgetQtyMilli: item.budgetQtyMilli,
        installedQtyMilli: item.installedQtyMilli,
        unit: item.unit,
        milestoneCompleteWeightMilli: completeWeight,
        pmPercentMilli: latestLog?.percentMilli ?? 0,
        milestones: ms.map((m) => ({
          name: m.name,
          weightMilli: m.weightMilli,
          complete: m.complete,
        })),
      });
      const derivation =
        item.evMethod === "pm_percent" && latestLog
          ? `${snap.derivation} — ${latestLog.reason}`
          : snap.derivation;
      const lockedDerivation = `${derivation} (locked ${claim.periodLabel})`;

      const row = byItem.get(item.id);
      if (row) {
        await tx
          .update(progressClaimLines)
          .set({
            claimedPercentMilli: snap.percentMilli,
            installedQtyMilli: item.installedQtyMilli,
            derivation,
          })
          .where(eq(progressClaimLines.id, row.id));
      } else {
        await tx.insert(progressClaimLines).values({
          id: randomUUID(),
          companyId,
          claimId: claim.id,
          costItemId: item.id,
          claimedPercentMilli: snap.percentMilli,
          installedQtyMilli: item.installedQtyMilli,
          derivation,
        });
      }

      await tx
        .update(costItems)
        .set({
          claimedPercentMilli: snap.percentMilli,
          earnDerivation: lockedDerivation,
          plannedCents: plannedValueCents(
            item.budgetCents,
            item.plannedStartOn,
            item.plannedFinishOn,
            now,
          ),
        })
        .where(eq(costItems.id, item.id));
    }

    await tx
      .update(progressClaims)
      .set({ status: "locked", lockedAt: now, lockedById: userId })
      .where(eq(progressClaims.id, claim.id));

    return {
      ok: true as const,
      claimId: claim.id,
      periodLabel: claim.periodLabel,
      lines: items.length,
    };
  });
}

/** True when this company still has a draft claim on the job (for UI). */
export async function draftClaimForJob(companyId: string, jobId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: progressClaims.id, periodLabel: progressClaims.periodLabel })
    .from(progressClaims)
    .where(
      and(
        eq(progressClaims.companyId, companyId),
        eq(progressClaims.jobId, jobId),
        eq(progressClaims.status, "draft"),
      ),
    )
    .limit(1);
  return row ?? null;
}
