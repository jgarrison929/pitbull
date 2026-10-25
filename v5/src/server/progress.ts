import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  costEntries,
  costItemMilestones,
  costItems,
  crews,
  dailyPlanLines,
  dailyPlans,
  milestoneLogs,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import { currentBudgetCents } from "@/lib/budget";
import {
  laborCents,
  plannedValueCents,
  snapshotClaimPercent,
  type EvMethod,
} from "@/lib/ev";
import {
  recordPlanEvent,
  type PlanActor,
} from "@/server/plan-events";
import { laborRateForPlan, planLaborRateCentsSql } from "@/server/plans";
import { getSeedClock } from "@/server/seed-clock";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type { PlanActor };

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
      // INNER JOIN crews: crew_id is required after 0019.
      rateCents: planLaborRateCentsSql,
    })
    .from(dailyPlanLines)
    .innerJoin(dailyPlans, eq(dailyPlans.id, dailyPlanLines.planId))
    .innerJoin(crews, eq(crews.id, dailyPlans.crewId))
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
    cur.cents += laborCents(mh, r.rateCents);
    out[r.costItemId] = cur;
  }
  return out;
}

/** Pending (unapproved) report values per plan line. */
export async function getReportedActualsForPlan(
  companyId: string,
  planId: string,
): Promise<Record<string, ReportLineActual>> {
  const byPlan = await getReportedActualsForPlans(companyId, [planId]);
  return byPlan[planId] ?? {};
}

/**
 * Pending report values for many plans in one query (job page open rail).
 * Query count stays fixed when several issued/reported plans are open.
 */
export async function getReportedActualsForPlans(
  companyId: string,
  planIds: string[],
): Promise<Record<string, Record<string, ReportLineActual>>> {
  const out: Record<string, Record<string, ReportLineActual>> = {};
  for (const id of planIds) out[id] = {};
  if (!planIds.length) return out;
  const db = requireDb();
  const lines = await db
    .select({
      id: dailyPlanLines.id,
      planId: dailyPlanLines.planId,
      reportedQtyMilli: dailyPlanLines.reportedQtyMilli,
      reportedHoursTenths: dailyPlanLines.reportedHoursTenths,
    })
    .from(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        inArray(dailyPlanLines.planId, planIds),
      ),
    );
  for (const l of lines) {
    if (l.reportedHoursTenths == null && l.reportedQtyMilli == null) continue;
    const bucket = out[l.planId] ?? (out[l.planId] = {});
    bucket[l.id] = {
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
  actor: PlanActor,
  now = getSeedClock(),
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
        reportedAt: now,
      })
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );

    await recordPlanEvent(tx, {
      companyId,
      planId,
      kind: "reported",
      actor,
      at: now,
    });

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
  actor: PlanActor,
  now = getSeedClock(),
) {
  const result = await submitDailyReport(companyId, planId, actuals, actor, now);
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
  actor: PlanActor,
  now = getSeedClock(),
) {
  const db = requireDb();
  const userId = actor.userId;
  if (!userId) return { ok: false as const, reason: "not-found" as const };
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
        rateCents: 0,
        postedQtyByUnit: {} as Record<string, number>,
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
        rateCents: 0,
        postedQtyByUnit: {} as Record<string, number>,
        lines: 0,
      };
    }

    await recordPlanEvent(tx, {
      companyId,
      planId,
      kind: "approved",
      actor,
      at: now,
    });

    const rateCents = await laborRateForPlan(tx, planId);
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
    const postedQtyByUnit: Record<string, number> = {};
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

      const amount = laborCents(manHours, rateCents);
      await tx.insert(costEntries).values({
        id: randomUUID(),
        companyId,
        costItemId: item.id,
        kind: "labor",
        hoursTenths: Math.round(manHours * 10),
        rateCents,
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
          postedQtyByUnit[item.unit] =
            (postedQtyByUnit[item.unit] ?? 0) + qtyMilli;
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
      rateCents,
      postedQtyByUnit,
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
  actor: PlanActor,
  now = getSeedClock(),
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
    await recordPlanEvent(tx, {
      companyId,
      planId,
      kind: "returned",
      actor,
      detail: why,
      at: now,
    });
    return { ok: true as const, returnReason: why };
  });
}

/**
 * Issue a draft plan to the field. Updates submitted_at and appends a submitted event.
 */
export async function issueDailyPlan(
  companyId: string,
  planId: string,
  actor: PlanActor,
  now = getSeedClock(),
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
    if (plan.status !== "draft") {
      return {
        ok: false as const,
        reason: "wrong-status" as const,
        status: plan.status,
      };
    }
    await tx
      .update(dailyPlans)
      .set({ status: "issued", submittedAt: now })
      .where(
        and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
      );
    await recordPlanEvent(tx, {
      companyId,
      planId,
      kind: "submitted",
      actor,
      at: now,
    });
    return { ok: true as const };
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
  now = getSeedClock(),
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
    /** Fresh snaps keyed by cost item — next draft must use these, not pre-lock rows. */
    const lockedSnaps = new Map<
      string,
      { percentMilli: number; installedQtyMilli: number }
    >();

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
      const claimedInstalled =
        item.evMethod === "units" ? item.installedQtyMilli : 0;
      lockedSnaps.set(item.id, {
        percentMilli: snap.percentMilli,
        installedQtyMilli: claimedInstalled,
      });

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
          claimedInstalledQtyMilli: claimedInstalled,
          // Freeze AC at this lock so CPI/EAC share one cutoff with EV and PV.
          lockedActualCents: item.actualCents,
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

    // Same transaction as lockedActualCents: stamp every cost entry that
    // exists now. Later approves stay null until the next lock.
    const itemIds = items.map((i) => i.id);
    if (itemIds.length) {
      await tx
        .update(costEntries)
        .set({ lockedInAt: now })
        .where(
          and(
            eq(costEntries.companyId, companyId),
            isNull(costEntries.lockedInAt),
            inArray(costEntries.costItemId, itemIds),
          ),
        );
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
      const snap = lockedSnaps.get(item.id)!;
      await tx.insert(progressClaimLines).values({
        id: randomUUID(),
        companyId,
        claimId: nextId,
        costItemId: item.id,
        claimedPercentMilli: snap.percentMilli,
        installedQtyMilli: snap.installedQtyMilli,
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
  now = getSeedClock(),
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
    at: getSeedClock(),
  });
  return {
    ok: true as const,
    code: row.item.code,
    name: row.ms.name,
    complete,
  };
}

export type SetForecastMethod = "current_budget" | "average_performance";

export function parseForecastMethod(
  raw: string | undefined | null,
): SetForecastMethod | null {
  if (!raw) return null;
  const n = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (n === "current_budget" || n === "currentbudget") return "current_budget";
  if (
    n === "average_performance" ||
    n === "averageperformance" ||
    n === "avg_performance" ||
    n === "avgperformance"
  ) {
    return "average_performance";
  }
  // Spoken forms without underscores.
  const spoken = raw.trim().toLowerCase();
  if (spoken === "current budget") return "current_budget";
  if (spoken === "average performance") return "average_performance";
  return null;
}

export function forecastMethodLabel(m: SetForecastMethod) {
  return m === "average_performance"
    ? "Average Performance"
    : "Current Budget";
}

/** Set a leaf cost item's EAC forecast method. PM-owned; change is audited via run(). */
export async function setForecastMethod(
  companyId: string,
  costItemId: string,
  method: SetForecastMethod,
) {
  const db = requireDb();
  const [item] = await db
    .select()
    .from(costItems)
    .where(
      and(eq(costItems.id, costItemId), eq(costItems.companyId, companyId)),
    );
  if (!item) return { ok: false as const, reason: "not-found" as const };
  if (!item.isLeaf)
    return { ok: false as const, reason: "not-leaf" as const };
  const previous = (item.forecastMethod ??
    "current_budget") as SetForecastMethod;
  if (previous === method) {
    return {
      ok: true as const,
      code: item.code,
      description: item.description,
      method,
      previous,
      unchanged: true as const,
    };
  }
  await db
    .update(costItems)
    .set({ forecastMethod: method })
    .where(
      and(eq(costItems.id, costItemId), eq(costItems.companyId, companyId)),
    );
  return {
    ok: true as const,
    code: item.code,
    description: item.description,
    method,
    previous,
    unchanged: false as const,
  };
}
