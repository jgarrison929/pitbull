import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  costEntries,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  milestoneLogs,
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

/** Per-line actuals for a daily report. Omitted lines fall back to the plan. */
export type ReportLineActual = {
  manHours: number;
  qtyMilli: number;
};

/**
 * Last posted report values per plan line (from cost_entries), if any.
 * Used to pre-fill the report form so a second click cannot silently revert to plan.
 */
export async function getReportedActualsForPlan(
  companyId: string,
  planId: string,
): Promise<Record<string, ReportLineActual>> {
  const db = requireDb();
  const lines = await db
    .select({ id: dailyPlanLines.id })
    .from(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        eq(dailyPlanLines.planId, planId),
      ),
    );
  if (!lines.length) return {};
  const ids = lines.map((l) => l.id);
  const entries = await db
    .select()
    .from(costEntries)
    .where(
      and(
        eq(costEntries.companyId, companyId),
        inArray(costEntries.sourcePlanLineId, ids),
      ),
    );
  const out: Record<string, ReportLineActual> = {};
  for (const e of entries) {
    if (!e.sourcePlanLineId) continue;
    const hours = e.hoursTenths ?? 0;
    const cur = out[e.sourcePlanLineId] ?? { manHours: 0, qtyMilli: 0 };
    if (e.note === "reported-qty") {
      // Marker persists even at 0 milli so a rain-day report prefills zeros.
      cur.qtyMilli = hours;
    } else if (e.kind === "labor" || e.note === "reported-mh") {
      cur.manHours = hours / 10;
    }
    out[e.sourcePlanLineId] = cur;
  }
  return out;
}

/**
 * Foreman's daily report: post *actual* hours × rate into cost_entries and
 * quantity into installed (units method). The submitted plan is not modified.
 * Idempotent: re-reporting the same plan replaces prior entries for those lines.
 * Entries are dated `now` (report day), not the plan date.
 */
export async function postDailyReport(
  companyId: string,
  planId: string,
  actuals: Record<string, ReportLineActual> = {},
  now = new Date(),
) {
  const db = requireDb();
  return db.transaction(async (tx) => {
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

    let postedMh = 0;
    let postedQtyLines = 0;

    for (const { line, item } of lines) {
      const planMh = (line.workers * line.hoursTenths) / 10;
      const actual = actuals[line.id];
      const manHours = actual?.manHours ?? planMh;
      const qtyMilli = actual?.qtyMilli ?? line.qtyMilli;

      const prior = await tx
        .select()
        .from(costEntries)
        .where(
          and(
            eq(costEntries.companyId, companyId),
            eq(costEntries.sourcePlanLineId, line.id),
          ),
        );
      const prevQty = Number(
        prior.find((p) => p.note === "reported-qty")?.hoursTenths ?? 0,
      );

      await tx
        .delete(costEntries)
        .where(
          and(
            eq(costEntries.companyId, companyId),
            eq(costEntries.sourcePlanLineId, line.id),
          ),
        );

      // Always persist a labor row (incl. 0 MH) so prefill can show zeros after a
      // rain-day report — otherwise the form falls back to the plan on reload.
      const amount = laborCents(manHours, DEFAULT_LABOR_RATE_CENTS);
      await tx.insert(costEntries).values({
        id: randomUUID(),
        companyId,
        costItemId: item.id,
        kind: "labor",
        hoursTenths: Math.round(manHours * 10),
        rateCents: DEFAULT_LABOR_RATE_CENTS,
        amountCents: amount,
        note: manHours > 0 ? `Reported: ${line.activity}` : "reported-mh",
        sourcePlanLineId: line.id,
        at: now,
      });
      postedMh += manHours;

      // Replace installed qty for this plan line (incl. reporting 0): always
      // apply delta = new − prior so re-reports never double-add.
      if (item.evMethod === "units") {
        const delta = qtyMilli - prevQty;
        if (delta !== 0) {
          await tx
            .update(costItems)
            .set({
              installedQtyMilli: sql`${costItems.installedQtyMilli} + ${delta}`,
            })
            .where(
              and(
                eq(costItems.id, item.id),
                eq(costItems.companyId, companyId),
              ),
            );
        }
        // Qty marker always written (incl. 0) so getReportedActuals sees the report.
        await tx.insert(costEntries).values({
          id: randomUUID(),
          companyId,
          costItemId: item.id,
          kind: "other",
          hoursTenths: qtyMilli,
          amountCents: 0,
          note: "reported-qty",
          sourcePlanLineId: line.id,
          at: now,
        });
        if (qtyMilli > 0) postedQtyLines += 1;
      }

      await refreshCostItemActuals(tx, companyId, item.id, now);
    }

    return { postedMh, postedQtyLines, lines: lines.length };
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
 * its EV method, mark the claim locked, copy onto cost_items, and open the next draft.
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
          claimedInstalledQtyMilli:
            item.evMethod === "units" ? item.installedQtyMilli : 0,
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

    const nextLabel = nextPeriodLabel(claim.periodLabel);
    const nextId = randomUUID();
    await tx.insert(progressClaims).values({
      id: nextId,
      companyId,
      jobId,
      periodLabel: nextLabel,
      status: "draft",
      lockedAt: null,
      lockedById: null,
    });
    for (const item of items) {
      await tx.insert(progressClaimLines).values({
        id: randomUUID(),
        companyId,
        claimId: nextId,
        costItemId: item.id,
        claimedPercentMilli: item.claimedPercentMilli,
        installedQtyMilli: item.installedQtyMilli,
        derivation: "Draft — will refresh from field on lock",
      });
    }

    return {
      ok: true as const,
      claimId: claim.id,
      periodLabel: claim.periodLabel,
      nextPeriodLabel: nextLabel,
      lines: items.length,
    };
  });
}

function nextPeriodLabel(current: string) {
  const m = current.match(/Period\s+(\d+)/i);
  const n = m ? Number(m[1]) + 1 : 2;
  return `Period ${n}`;
}

/** Draft claim on the job, if any (for Lock button). */
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

/** Record a PM percent-complete entry (who/why). Latest log is the working percent. */
export async function setPmPercent(
  companyId: string,
  costItemId: string,
  userId: string,
  percentMilli: number,
  reason: string,
  now = new Date(),
) {
  const db = requireDb();
  const clamped = Math.max(0, Math.min(1000, Math.round(percentMilli)));
  const why = reason.trim();
  if (!why) return { ok: false as const, reason: "need-reason" as const };
  const [item] = await db
    .select()
    .from(costItems)
    .where(
      and(eq(costItems.id, costItemId), eq(costItems.companyId, companyId)),
    );
  if (!item) return { ok: false as const, reason: "not-found" as const };
  if (item.evMethod !== "pm_percent")
    return { ok: false as const, reason: "wrong-method" as const };
  await db.insert(pmPercentLogs).values({
    id: randomUUID(),
    companyId,
    costItemId,
    userId,
    percentMilli: clamped,
    reason: why,
    at: now,
  });
  return {
    ok: true as const,
    percentMilli: clamped,
    code: item.code,
    description: item.description,
  };
}

/** Set a milestone complete/open and record who/why on its own milestone_logs row. */
export async function setMilestoneComplete(
  companyId: string,
  milestoneId: string,
  complete: boolean,
  userId: string,
  reason?: string,
) {
  const db = requireDb();
  const [row] = await db
    .select({
      ms: costItemMilestones,
      item: costItems,
    })
    .from(costItemMilestones)
    .innerJoin(costItems, eq(costItems.id, costItemMilestones.costItemId))
    .where(
      and(
        eq(costItemMilestones.id, milestoneId),
        eq(costItemMilestones.companyId, companyId),
      ),
    );
  if (!row) return { ok: false as const, reason: "not-found" as const };
  if (row.item.evMethod !== "milestones")
    return { ok: false as const, reason: "wrong-method" as const };
  await db
    .update(costItemMilestones)
    .set({ complete })
    .where(eq(costItemMilestones.id, milestoneId));
  const why =
    reason?.trim() ||
    (complete ? "Marked complete" : "Marked incomplete");
  await db.insert(milestoneLogs).values({
    id: randomUUID(),
    companyId,
    milestoneId,
    costItemId: row.item.id,
    userId,
    complete,
    reason: why,
    at: new Date(),
  });
  return {
    ok: true as const,
    code: row.item.code,
    name: row.ms.name,
    complete,
  };
}
