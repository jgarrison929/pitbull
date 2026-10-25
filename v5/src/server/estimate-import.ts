import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { requireDb, type Db } from "@/db";
import {
  costEntries,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  jobs,
  milestoneLogs,
  pmPercentLogs,
  progressClaims,
} from "@/db/schema";
import { buildWbsMoney, ceOnlyColumns } from "@/lib/budget";
import {
  existingCostItems,
  insertColumns,
  parseEstimateCsv,
  reconcileByCode,
  summarizeImport,
  type CostForest,
  type ExistingCostItem,
  type HistoryKind,
  type ImportResult,
  type ReconcilePlan,
  type ReconcileStep,
} from "@/lib/estimate-reconcile";
import { seedNow } from "@/server/seed-clock";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Job = typeof jobs.$inferSelect;
type CostItemRow = typeof costItems.$inferSelect;

/** Every table whose rows a cost item delete would cascade away. */
const HISTORY: Record<HistoryKind, PgTable & { costItemId: AnyPgColumn }> = {
  costEntries,
  planLines: dailyPlanLines,
  milestones: costItemMilestones,
  pmPercentLogs,
  milestoneLogs,
};

const BATCH = 500;

function chunks<T>(rows: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

/**
 * Planned dates for new items, since the CSV has none. A finish on or before the start would make
 * plannedValueCents report the whole budget as planned the day it is approved.
 */
function plannedSpan(before: readonly CostItemRow[], job: Job) {
  if (before.length === 0) {
    // Seed / CI calendar — never wall (empty WBS import would otherwise drift).
    const today = seedNow().toISOString().slice(0, 10);
    const finish = job.finishOn > today ? job.finishOn : addDays(today, 180);
    return { plannedStartOn: today, plannedFinishOn: finish };
  }
  const start = before.reduce(
    (m, r) => (r.plannedStartOn < m ? r.plannedStartOn : m),
    before[0].plannedStartOn,
  );
  const finish = before.reduce(
    (m, r) => (r.plannedFinishOn > m ? r.plannedFinishOn : m),
    before[0].plannedFinishOn,
  );
  return {
    plannedStartOn: start,
    plannedFinishOn: finish > start ? finish : addDays(start, 1),
  };
}

async function refusal(q: Db | Tx, job: Job): Promise<ImportResult | null> {
  const base = { ok: false, jobNumber: job.number, shortName: job.shortName, errors: [] } as const;
  if (job.estimateStatus === "approved") return { ...base, reason: "already_approved" };
  const [locked] = await q
    .select({ id: progressClaims.id })
    .from(progressClaims)
    .where(and(eq(progressClaims.jobId, job.id), eq(progressClaims.status, "locked")))
    .limit(1);
  return locked ? { ...base, reason: "locked_claim" } : null;
}

async function historyById(tx: Tx, companyId: string, jobId: string) {
  const jobItems = tx
    .select({ id: costItems.id })
    .from(costItems)
    .where(and(eq(costItems.companyId, companyId), eq(costItems.jobId, jobId)));
  const out = new Map<string, ExistingCostItem["history"]>();
  for (const [kind, table] of Object.entries(HISTORY) as [HistoryKind, (typeof HISTORY)[HistoryKind]][]) {
    const counts = await tx
      .select({ id: table.costItemId, n: sql<number>`count(*)::int` })
      .from(table)
      .where(inArray(table.costItemId, jobItems))
      .groupBy(table.costItemId);
    for (const { id, n } of counts) {
      const h = out.get(id as string) ?? {};
      h[kind] = n;
      out.set(id as string, h);
    }
  }
  return out;
}

/** Writes go shallow to deep, one batched insert per depth. Removes run last so a kept child is already reparented. */
async function applyPlan(
  tx: Tx,
  scope: { companyId: string; jobId: string; plannedStartOn: string; plannedFinishOn: string },
  plan: ReconcilePlan,
  before: readonly CostItemRow[],
) {
  const idOf = new Map(before.map((r) => [r.code, r.id]));
  const parentIdOf = (code: string | null) => {
    if (code === null) return null;
    const id = idOf.get(code);
    if (!id) throw new Error(`estimate import: parent ${code} has no id`);
    return id;
  };
  const writes = plan.steps.filter(
    (s): s is Exclude<ReconcileStep, { kind: "remove" }> => s.kind !== "remove",
  );
  for (let i = 0; i < writes.length; ) {
    const depth = writes[i].depth;
    const level: typeof writes = [];
    while (i < writes.length && writes[i].depth === depth) level.push(writes[i++]);
    const inserts = level.flatMap((s) => {
      if (s.kind !== "insert") return [];
      const id = randomUUID();
      idOf.set(s.code, id);
      return [
        {
          id,
          companyId: scope.companyId,
          jobId: scope.jobId,
          parentId: parentIdOf(s.parentCode),
          plannedStartOn: scope.plannedStartOn,
          plannedFinishOn: scope.plannedFinishOn,
          ...insertColumns(s),
        },
      ];
    });
    for (const rows of chunks(inserts)) await tx.insert(costItems).values(rows);
    for (const s of level) {
      if (s.kind !== "revise") continue;
      await tx
        .update(costItems)
        .set({
          parentId: parentIdOf(s.parentCode),
          path: s.path,
          depth: s.depth,
          isLeaf: s.isLeaf,
          description: s.description,
          unit: s.unit,
          budgetQtyMilli: s.qtyMilli,
          budgetMhPerUnitMilli: s.mhPerUnitMilli,
          ...ceOnlyColumns(s.ce),
        })
        .where(eq(costItems.id, s.id));
    }
  }
  const removeIds = plan.steps.flatMap((s) => (s.kind === "remove" ? [s.id] : []));
  for (const ids of chunks(removeIds)) {
    await tx
      .delete(costItems)
      .where(
        and(
          eq(costItems.companyId, scope.companyId),
          eq(costItems.jobId, scope.jobId),
          inArray(costItems.id, ids),
        ),
      );
  }
}

const budgetFreeze = (r: CostItemRow) =>
  [
    r.obLaborCents,
    r.obMaterialCents,
    r.obEquipmentCents,
    r.obSubCents,
    r.cbLaborCents,
    r.cbMaterialCents,
    r.cbEquipmentCents,
    r.cbSubCents,
  ].join(",");

/** Throws, rolling the transaction back, unless the stored tree is now exactly the file and budgets did not move. */
function assertApplied(
  before: readonly CostItemRow[],
  after: readonly CostItemRow[],
  forest: CostForest,
  plan: ReconcilePlan,
) {
  const again = reconcileByCode(existingCostItems(after), forest);
  if (!again.ok || again.plan.steps.length > 0)
    throw new Error("estimate import: stored cost items do not match the file");
  const money = buildWbsMoney(after).job;
  if (money.ceCents !== plan.totals.ceCents || money.mhMilli !== plan.totals.mhMilli)
    throw new Error("estimate import: stored totals do not match the file");
  const frozen = new Map(before.map((r) => [r.id, budgetFreeze(r)]));
  const zero = "0,0,0,0,0,0,0,0";
  for (const r of after) {
    if (budgetFreeze(r) !== (frozen.get(r.id) ?? zero))
      throw new Error(`estimate import: ${r.code} Original or Current Budget moved`);
  }
}

async function importInner(
  companyId: string,
  jobNumber: string,
  csv: string,
): Promise<ImportResult> {
  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!job) return { ok: false, reason: "not_found", jobNumber, errors: [] };
  const early = await refusal(db, job);
  if (early) return early;
  const parsed = parseEstimateCsv(csv);
  if (!parsed.ok)
    return {
      ok: false,
      reason: "invalid_csv",
      jobNumber: job.number,
      shortName: job.shortName,
      errors: parsed.errors,
    };

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(jobs).where(eq(jobs.id, job.id)).for("update");
    const late = await refusal(tx, current);
    if (late) return late;
    const scope = and(eq(costItems.companyId, companyId), eq(costItems.jobId, job.id));
    const before = await tx.select().from(costItems).where(scope);
    const existing = existingCostItems(before, await historyById(tx, companyId, job.id));
    const diff = reconcileByCode(existing, parsed.forest);
    if (!diff.ok)
      return {
        ok: false,
        reason: "field_history",
        jobNumber: job.number,
        shortName: job.shortName,
        errors: diff.errors,
      };
    const { plan } = diff;
    await applyPlan(
      tx,
      { companyId, jobId: job.id, ...plannedSpan(before, current) },
      plan,
      before,
    );
    assertApplied(before, await tx.select().from(costItems).where(scope), parsed.forest, plan);
    await tx.update(jobs).set({ estimateSource: "csv" }).where(eq(jobs.id, job.id));

    const count = (kind: ReconcileStep["kind"]) =>
      plan.steps.filter((s) => s.kind === kind).length;
    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      inserted: count("insert"),
      revised: count("revise"),
      removed: count("remove"),
      unchanged: plan.unchangedIds.length,
      totals: plan.totals,
      preservedIds: [
        ...plan.steps.flatMap((s) => (s.kind === "revise" ? [s.id] : [])),
        ...plan.unchangedIds,
      ],
    };
  });
}

/**
 * Replace a draft job's Current Estimate with a CSV, matched to existing cost items by code.
 * All or nothing. Never writes Original Budget, Current Budget, or the estimate status.
 */
export async function importEstimateCsv(
  companyId: string,
  jobNumber: string,
  csv: string,
): Promise<ImportResult & { summary: string }> {
  const result = await importInner(companyId, jobNumber, csv);
  return { ...result, summary: summarizeImport(result) };
}
