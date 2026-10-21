import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  costEntries,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  dailyPlans,
  milestoneLogs,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import { currentBudgetCents } from "@/lib/budget";
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
 * Pending (unapproved) qty and labor cents by cost item for `reported` plans on a job.
 * Used on the job page so foreman numbers show as pending until approve.
 */
export async function getApprovalPendingByCostItem(
  companyId: string,
  jobId: string,
): Promise<Record<string, { qtyMilli: number; cents: number }>> {
  const db = requireDb();
  const rows = await db
    .select({
      costItemId: dailyPlanLines.costItemId,
      reportedQtyMilli: dailyPlanLines.reportedQtyMilli,
      reportedHoursTenths: dailyPlanLines.reportedHoursTenths,
    })
    .from(dailyPlanLines)
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanLines.planId))
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        eq(dailyPlans.jobId, jobId),
        eq(dailyPlans.status, "reported"),
      ),
    );
  const out: Record<string, { qtyMilli: number; cents: number }> = {};
  for (const r of rows) {
    const mh = (r.reportedHoursTenths ?? 0) / 10;
    const qtyMilli = r.reportedQtyMilli ?? 0;
    const cur = out[r.costItemId] ?? { qtyMilli: 0, cents: 0 };
    cur.qtyMilli += qtyMilli;
    cur.cents += laborCents(mh, DEFAULT_LABOR_RATE_CENTS);
    out[r.costItemId] = cur;
  }
  return out;
}

/** Pending (unapproved) report values per plan line. */
export async function getReportedActualsForPlan(
  companyId: string,
  planId: string,
): Promise<Record<string, ReportLineActual>> {
  const db = requireDb();
  const lines = await db
    .select({
      id: dailyPlanLines.id,
      reportedQtyMilli: dailyPlanLines.reportedQtyMilli,
      reportedHoursTenths: dailyPlanLines.reportedHoursTenths,
    })
    .from(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        eq(dailyPlanLines.planId, planId),
      ),
    );
  const out: Record<string, ReportLineActual> = {};
  for (const l of lines) {
    if (l.reportedHoursTenths == null && l.reportedQtyMilli == null) continue;
    out[l.id] = {
      manHours: (l.reportedHoursTenths ?? 0) / 10,
      qtyMilli: l.reportedQtyMilli ?? 0,
    };
  }
  return out;
}

/**
 * Foreman report: store pending actuals on plan lines and move to `reported`.
 * Does **not** write cost_entries or installed qty — that happens on approve.
 * Allowed from `issued` (first report) or `reported` (amend before approve).
 */
export async function submitDailyReport(
  companyId: string,
  planId: string,
  actuals: Record<string, ReportLineActual> = {},
  now = new Date(),
) {
  const db = requireDb();
  const namedIds = Object.keys(actuals);
  if (!namedIds.length) {
    return { ok: false as const, reason: "no-lines" as const };
  }
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(dailyPlans)
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );
    if (!plan) return { ok: false as const, reason: "not-found" as const };
    if (plan.status !== "issued" && plan.status !== "reported") {
      return { ok: false as const, reason: "wrong-status" as const, status: plan.status };
    }

    const lines = await tx
      .select({ id: dailyPlanLines.id })
      .from(dailyPlanLines)
      .where(
        and(
          eq(dailyPlanLines.companyId, companyId),
          eq(dailyPlanLines.planId, planId),
          inArray(dailyPlanLines.id, namedIds),
        ),
      );

    let reportedMh = 0;
    let reportedQtyLines = 0;
    for (const { id } of lines) {
      const actual = actuals[id]!;
      const hoursTenths = Math.round(actual.manHours * 10);
      await tx
        .update(dailyPlanLines)
        .set({
          reportedHoursTenths: hoursTenths,
          reportedQtyMilli: actual.qtyMilli,
        })
        .where(
          and(
            eq(dailyPlanLines.id, id),
            eq(dailyPlanLines.companyId, companyId),
          ),
        );
      reportedMh += actual.manHours;
      if (actual.qtyMilli > 0) reportedQtyLines += 1;
    }

    await tx
      .update(dailyPlans)
      .set({
        status: "reported",
        returnReason: null,
        returnedAt: null,
      })
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );

    void now;
    return {
      ok: true as const,
      reportedMh,
      reportedQtyLines,
      lines: lines.length,
    };
  });
}

/**
 * @deprecated Use submitDailyReport — kept name for call-site clarity during M3.
 * Does not post cost; stores pending actuals only.
 */
export async function postDailyReport(
  companyId: string,
  planId: string,
  actuals: Record<string, ReportLineActual> = {},
  now = new Date(),
) {
  const result = await submitDailyReport(companyId, planId, actuals, now);
  if (!result.ok) {
    return { postedMh: 0, postedQtyLines: 0, lines: 0, ...result };
  }
  return {
    postedMh: result.reportedMh,
    postedQtyLines: result.reportedQtyLines,
    lines: result.lines,
    ok: true as const,
  };
}

/** Noon UTC on the plan's calendar date — cost entries carry the work day, not approve day. */
export function planDateAsTimestamp(planDate: string): Date {
  return new Date(`${planDate}T12:00:00.000Z`);
}

/**
 * Superintendent approve: post pending hours/qty to cost **once**, dated by plan date.
 * Concurrent double-approve is safe: only one transaction wins the status flip.
 */
export async function approveDailyReport(
  companyId: string,
  planId: string,
  userId: string,
  now = new Date(),
) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(dailyPlans)
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );
    if (!plan) return { ok: false as const, reason: "not-found" as const };
    if (plan.status === "approved") {
      return {
        ok: true as const,
        already: true as const,
        postedMh: 0,
        postedCents: 0,
        postedQtyMilli: 0,
        lines: 0,
      };
    }
    if (plan.status !== "reported") {
      return {
        ok: false as const,
        reason: "wrong-status" as const,
        status: plan.status,
      };
    }

    // Claim the approve: only one concurrent call flips reported → approved.
    const claimed = await tx
      .update(dailyPlans)
      .set({
        status: "approved",
        approvedAt: now,
        approvedById: userId,
        returnReason: null,
        returnedAt: null,
      })
      .where(
        and(
          eq(dailyPlans.id, planId),
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.status, "reported"),
        ),
      )
      .returning({ id: dailyPlans.id });
    if (!claimed.length) {
      // Lost the race — another approve already posted.
      return {
        ok: true as const,
        already: true as const,
        postedMh: 0,
        postedCents: 0,
        postedQtyMilli: 0,
        lines: 0,
      };
    }

    const entryAt = planDateAsTimestamp(plan.planDate);
    const rows = await tx
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
    let postedCents = 0;
    let postedQtyMilli = 0;
    const touchedItems = new Set<string>();

    for (const { line, item } of rows) {
      if (line.reportedHoursTenths == null && line.reportedQtyMilli == null) {
        continue;
      }
      const manHours = (line.reportedHoursTenths ?? 0) / 10;
      const qtyMilli = line.reportedQtyMilli ?? 0;

      // Guard: never double-insert for the same plan line.
      const prior = await tx
        .select({ id: costEntries.id })
        .from(costEntries)
        .where(
          and(
            eq(costEntries.companyId, companyId),
            eq(costEntries.sourcePlanLineId, line.id),
          ),
        )
        .limit(1);
      if (prior.length) continue;

      const amount = laborCents(manHours, DEFAULT_LABOR_RATE_CENTS);
      await tx.insert(costEntries).values({
        id: randomUUID(),
        companyId,
        costItemId: item.id,
        kind: "labor",
        hoursTenths: Math.round(manHours * 10),
        rateCents: DEFAULT_LABOR_RATE_CENTS,
        amountCents: amount,
        note:
          manHours > 0
            ? `Approved: ${line.activity}`
            : "approved-mh",
        sourcePlanLineId: line.id,
        at: entryAt,
      });
      postedMh += manHours;
      postedCents += amount;

      if (item.evMethod === "units") {
        if (qtyMilli !== 0) {
          await tx
            .update(costItems)
            .set({
              installedQtyMilli: sql`${costItems.installedQtyMilli} + ${qtyMilli}`,
            })
            .where(
              and(
                eq(costItems.id, item.id),
                eq(costItems.companyId, companyId),
              ),
            );
        }
        await tx.insert(costEntries).values({
          id: randomUUID(),
          companyId,
          costItemId: item.id,
          kind: "other",
          hoursTenths: qtyMilli,
          amountCents: 0,
          note: "approved-qty",
          sourcePlanLineId: line.id,
          at: entryAt,
        });
        postedQtyMilli += qtyMilli;
      }

      touchedItems.add(item.id);
    }

    for (const itemId of touchedItems) {
      await refreshCostItemActuals(tx, companyId, itemId, now);
    }

    return {
      ok: true as const,
      already: false as const,
      postedMh,
      postedCents,
      postedQtyMilli,
      lines: rows.length,
      planDate: plan.planDate,
    };
  });
}

/**
 * Superintendent return: send reported work back to the foreman with a reason.
 * Keeps reported values; posts nothing to cost.
 */
export async function returnDailyReport(
  companyId: string,
  planId: string,
  reason: string,
  now = new Date(),
) {
  const why = reason.trim();
  if (!why) return { ok: false as const, reason: "need-reason" as const };
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(dailyPlans)
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );
    if (!plan) return { ok: false as const, reason: "not-found" as const };
    if (plan.status !== "reported") {
      return {
        ok: false as const,
        reason: "wrong-status" as const,
        status: plan.status,
      };
    }
    await tx
      .update(dailyPlans)
      .set({
        status: "issued",
        returnReason: why,
        returnedAt: now,
      })
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );
    return { ok: true as const, returnReason: why };
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
    currentBudgetCents(item),
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
            currentBudgetCents(item),
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
