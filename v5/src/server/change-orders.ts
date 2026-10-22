import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, max, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireDb, type Db } from "@/db";
import {
  changeOrderEvents,
  changeOrderLines,
  changeOrders,
  costItems,
  jobs,
  users,
} from "@/db/schema";
import { categoryTotal, emptyCategories, type CostCategories } from "@/lib/budget";
import {
  availableCommands,
  coLabel,
  coTotalCents,
  decide,
  describePlanRefusal,
  parseCoLines,
  planApproval,
  planRefusalField,
  resolveCoLines,
  sameCoLines,
  type ApprovalPlan,
  type BudgetItem,
  type BudgetMove,
  type CoActor,
  type CoCommand,
  type CoCommandName,
  type CoCommandResult,
  type CoHeader,
  type CoJobRef,
  type CoLine,
  type CoRefusal,
  type CoStatus,
  type ParsedCoLine,
  type PlanRefusal,
} from "@/lib/change-order";

// The only writer of change_orders, change_order_lines, change_order_events, and of change-order
// moves to cost_items.cb_*. No role check here: run() owns roles; the actor is recorded, not checked.

export type JobChangeOrders = {
  job: CoJobRef & { estimateApproved: boolean };
  ledger: {
    /** Σ Original Budget over leaves. Never moves after the estimate is approved. */
    originalCents: number;
    /** Σ lines of approved change orders. */
    approvedChangesCents: number;
    /** Σ Current Budget over leaves. */
    currentCents: number;
    /** Σ lines of priced change orders: exposure only, never in Current Budget or EAC. */
    pendingCents: number;
    /** original + approved === current, computed from rows, not assumed. */
    reconciled: boolean;
  };
  changeOrders: ChangeOrderView[];
};

export type ChangeOrderView = CoHeader & {
  reason: string;
  totalCents: number;
  createdAt: string;
  lines: {
    sort: number;
    code: string;
    description: string;
    unit: string;
    /** The line adds a new cost item (created at approve). */
    created: boolean;
    parentCode: string | null;
    delta: CostCategories;
    totalCents: number;
    qtyDeltaMilli: number;
    note: string;
  }[];
  history: {
    command: CoCommandName;
    from: CoStatus | null;
    to: CoStatus;
    revision: number;
    actorName: string;
    actorRole: string;
    reason: string;
    totalCents: number;
    cbDeltaCents: number | null;
    eacDeltaCents: number | null;
    at: string;
  }[];
  /** Legal next commands. The page intersects these with what the signed-in role may run. */
  commands: CoCommandName[];
  /** Priced only: what approve would move right now, or why it would be refused. */
  preview: { ok: true; move: BudgetMove } | { ok: false; why: string } | null;
};

const parentItems = alias(costItems, "parent_items");

const TITLE_MAX = 120;
const REASON_MAX = 200;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;
type JobRow = typeof jobs.$inferSelect;
type CoRow = typeof changeOrders.$inferSelect;
type LineRow = typeof changeOrderLines.$inferSelect;
type ItemRow = typeof costItems.$inferSelect;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const jobRef = (j: JobRow): CoJobRef => ({ number: j.number, shortName: j.shortName });
const header = (co: CoRow): CoHeader => ({
  id: co.id,
  number: co.number,
  label: coLabel(co.number),
  title: co.title,
  status: co.status,
  revision: co.revision,
});

class Refused {
  constructor(
    readonly refusal: CoRefusal,
    readonly errors?: Record<string, string>,
  ) {}
}

/**
 * Run one change-order command for a job, all-or-nothing in one transaction.
 *   lock the job row → every CO command on a job runs one at a time (numbering, new codes, approve vs re-price)
 *   the estimate must be approved (approveEstimate rewrites Current Budget)
 *   create: next number, insert, event
 *   other:  lock the CO row → decide(status, command) → effect (may refuse; then nothing is written) → event
 * A repeated approve/reject/void is refused as `already` and writes nothing. Pricing identical lines is `unchanged`.
 */
export async function changeOrderCommand(
  companyId: string,
  actor: CoActor,
  jobNumber: string,
  command: CoCommand,
  now = new Date(),
): Promise<CoCommandResult> {
  const seen: { job?: JobRow; co?: CoRow } = {};
  try {
    return await requireDb().transaction(async (tx) => {
      const job = await lockJob(tx, companyId, jobNumber);
      if (!job) throw new Refused({ kind: "job_not_found", number: jobNumber });
      seen.job = job;
      if (job.estimateStatus !== "approved")
        throw new Refused({ kind: "estimate_not_approved" });

      if (command.kind === "create") {
        const title = command.title.trim();
        const reason = command.reason.trim();
        if (!title) throw new Refused({ kind: "title_required" }, { title: "Give the change order a title." });
        if (title.length > TITLE_MAX)
          throw new Refused({ kind: "too_long", field: "title", max: TITLE_MAX }, { title: `Keep the title under ${TITLE_MAX} characters.` });
        if (reason.length > REASON_MAX)
          throw new Refused({ kind: "too_long", field: "reason", max: REASON_MAX }, { reason: `Keep the reason under ${REASON_MAX} characters.` });
        const [{ last }] = await tx
          .select({ last: max(changeOrders.number) })
          .from(changeOrders)
          .where(eq(changeOrders.jobId, job.id));
        const [inserted] = await tx
          .insert(changeOrders)
          .values({
            id: randomUUID(),
            companyId,
            jobId: job.id,
            number: (last ?? 0) + 1,
            title,
            reason,
            status: "draft",
            revision: 0,
          })
          .returning();
        seen.co = inserted;
        const after = await commit(tx, null, inserted, "draft", "create", actor, {
          revision: 0,
          reason,
          totalCents: 0,
          move: null,
        });
        return { ...done(job, after, null, { reason, totalCents: 0, lineCount: 0 }), command: "create", move: null };
      }

      const co = await lockChangeOrder(tx, companyId, job.id, command.co);
      if (!co) throw new Refused({ kind: "co_not_found", ref: command.co });
      seen.co = co;
      const d = decide(co.status, command.kind);
      if (d.kind === "already") throw new Refused({ kind: "already", status: d.status });
      if (d.kind === "illegal")
        throw new Refused({ kind: "illegal", from: d.from, allowed: d.allowed });
      const from = co.status;

      switch (command.kind) {
        case "price": {
          const parsed = parseCoLines(command.lines);
          if (!parsed.ok) throw new Refused({ kind: "invalid_lines" }, parsed.errors);
          const lines = await resolveLines(tx, job, parsed.lines);
          const ctx = await loadBudgetItems(tx, job, lines, { lock: false });
          const dry = planApproval({ ...ctx, today: isoDay(now), jobFinishOn: job.finishOn }, lines);
          if (!dry.ok) throw planRefused(dry.refusal);
          const totalCents = coTotalCents(lines);
          const stored = await loadLines(tx, co.id);
          if (co.status === "priced" && sameCoLines(stored.lines, lines))
            return {
              ...done(job, co, from, { reason: "", totalCents, lineCount: lines.length, unchanged: true }),
              command: "price",
              move: null,
            };
          await tx.delete(changeOrderLines).where(eq(changeOrderLines.changeOrderId, co.id));
          await tx.insert(changeOrderLines).values(lines.map((l, sort) => lineRow(companyId, co.id, { ...l, sort })));
          const after = await commit(tx, from, co, "priced", "price", actor, {
            revision: co.revision + 1,
            reason: "",
            totalCents,
            move: null,
          });
          return { ...done(job, after, from, { reason: "", totalCents, lineCount: lines.length }), command: "price", move: null };
        }
        case "approve": {
          if (command.expectRevision !== undefined && command.expectRevision !== co.revision)
            throw new Refused({ kind: "stale_revision", saw: command.expectRevision, current: co.revision });
          const { rows, lines } = await loadLines(tx, co.id);
          const ctx = await loadBudgetItems(tx, job, lines, { lock: true });
          const r = planApproval({ ...ctx, today: isoDay(now), jobFinishOn: job.finishOn }, lines);
          if (!r.ok) throw planRefused(r.refusal);
          const before = await obImage(tx, job.id, r.plan.writes.map((w) => w.costItemId));
          const created = await writeApproval(tx, companyId, job, co, rows, r.plan);
          const totalCents = coTotalCents(lines);
          const after = await commit(tx, from, co, "approved", "approve", actor, {
            revision: co.revision,
            reason: "",
            totalCents,
            move: r.plan.move,
          });
          await verifyApproval(tx, job.id, before, created, [
            ...r.plan.writes.map((w) => w.costItemId),
            ...created,
          ]);
          return { ...done(job, after, from, { reason: "", totalCents, lineCount: lines.length }), command: "approve", move: r.plan.move };
        }
        case "reject":
        case "void": {
          const reason = command.reason.trim();
          if (!reason) throw new Refused({ kind: "reason_required" }, { reason: "Say why." });
          if (reason.length > REASON_MAX)
            throw new Refused({ kind: "too_long", field: "reason", max: REASON_MAX }, { reason: `Keep the reason under ${REASON_MAX} characters.` });
          const { lines } = await loadLines(tx, co.id);
          const totalCents = coTotalCents(lines);
          const after = await commit(tx, from, co, d.to, command.kind, actor, {
            revision: co.revision,
            reason,
            totalCents,
            move: null,
          });
          return { ...done(job, after, from, { reason, totalCents, lineCount: lines.length }), command: command.kind, move: null };
        }
      }
    });
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    return {
      ok: false,
      command: command.kind,
      job: seen.job ? jobRef(seen.job) : null,
      co: seen.co ? header(seen.co) : null,
      refusal: e.refusal,
      ...(e.errors ? { errors: e.errors } : {}),
    };
  }
}

function done(
  job: JobRow,
  co: CoRow,
  from: CoStatus | null,
  r: { reason: string; totalCents: number; lineCount: number; unchanged?: boolean },
) {
  return {
    ok: true as const,
    job: jobRef(job),
    co: header(co),
    from,
    to: co.status,
    reason: r.reason,
    totalCents: r.totalCents,
    lineCount: r.lineCount,
    unchanged: r.unchanged ?? false,
  };
}

function planRefused(refusal: PlanRefusal) {
  const field = planRefusalField(refusal);
  return new Refused(refusal, field ? { [field]: describePlanRefusal(refusal) } : undefined);
}

async function lockJob(tx: Tx, companyId: string, jobNumber: string) {
  const [row] = await tx
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1)
    .for("update");
  return row ?? null;
}

async function lockChangeOrder(
  tx: Tx,
  companyId: string,
  jobId: string,
  ref: { number: number } | { id: string },
) {
  const [row] = await tx
    .select()
    .from(changeOrders)
    .where(
      and(
        eq(changeOrders.companyId, companyId),
        eq(changeOrders.jobId, jobId),
        "id" in ref ? eq(changeOrders.id, ref.id) : eq(changeOrders.number, ref.number),
      ),
    )
    .limit(1)
    .for("update");
  return row ?? null;
}

const lineCategories = (r: LineRow): CostCategories => ({
  laborCents: r.laborCents,
  materialCents: r.materialCents,
  equipmentCents: r.equipmentCents,
  subCents: r.subCents,
});

function toCoLine(r: LineRow): CoLine {
  return {
    sort: r.sort,
    target:
      r.newCode !== null
        ? {
            kind: "new",
            code: r.newCode,
            description: r.newDescription ?? "",
            unit: r.newUnit ?? "",
            parentId: r.newParentId,
          }
        : { kind: "existing", costItemId: r.costItemId! },
    delta: lineCategories(r),
    qtyDeltaMilli: r.qtyDeltaMilli,
    note: r.note,
  };
}

async function loadLines(q: Q, coId: string) {
  const rows = await q
    .select()
    .from(changeOrderLines)
    .where(eq(changeOrderLines.changeOrderId, coId))
    .orderBy(asc(changeOrderLines.sort));
  return { rows, lines: rows.map(toCoLine) };
}

function lineRow(companyId: string, changeOrderId: string, l: CoLine) {
  const t = l.target;
  return {
    id: randomUUID(),
    companyId,
    changeOrderId,
    sort: l.sort,
    costItemId: t.kind === "existing" ? t.costItemId : null,
    newCode: t.kind === "new" ? t.code : null,
    newDescription: t.kind === "new" ? t.description : null,
    newUnit: t.kind === "new" ? t.unit : null,
    newParentId: t.kind === "new" ? t.parentId : null,
    laborCents: l.delta.laborCents,
    materialCents: l.delta.materialCents,
    equipmentCents: l.delta.equipmentCents,
    subCents: l.delta.subCents,
    qtyDeltaMilli: l.qtyDeltaMilli,
    note: l.note,
  };
}

/** Resolve parsed rows against only the cost items they name (by id or code), so a 10k-code job is not loaded. */
async function resolveLines(tx: Tx, job: JobRow, parsed: ParsedCoLine[]) {
  const ids = parsed.flatMap((p) => (p.ref.kind === "id" ? [p.ref.costItemId] : []));
  const codes = parsed.flatMap((p) =>
    p.ref.kind === "code"
      ? [p.ref.code]
      : p.ref.kind === "new"
        ? [p.ref.code, ...(p.ref.parentCode ? [p.ref.parentCode] : [])]
        : [],
  );
  const named = [
    ...(ids.length ? [inArray(costItems.id, ids.filter(isUuid))] : []),
    ...(codes.length ? [inArray(costItems.code, codes)] : []),
  ];
  const onJob = named.length
    ? await tx
        .select({ id: costItems.id, code: costItems.code, isLeaf: costItems.isLeaf })
        .from(costItems)
        .where(and(eq(costItems.companyId, job.companyId), eq(costItems.jobId, job.id), or(...named)))
    : [];
  const r = resolveCoLines(parsed, onJob);
  if (!r.ok) throw new Refused({ kind: "invalid_lines" }, r.errors);
  return r.lines;
}

const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const cbOf = (i: ItemRow): CostCategories => ({
  laborCents: i.cbLaborCents,
  materialCents: i.cbMaterialCents,
  equipmentCents: i.cbEquipmentCents,
  subCents: i.cbSubCents,
});

const obOf = (i: Pick<ItemRow, "obLaborCents" | "obMaterialCents" | "obEquipmentCents" | "obSubCents">): CostCategories => ({
  laborCents: i.obLaborCents,
  materialCents: i.obMaterialCents,
  equipmentCents: i.obEquipmentCents,
  subCents: i.obSubCents,
});

function budgetItem(i: ItemRow): BudgetItem {
  return {
    id: i.id,
    code: i.code,
    path: i.path,
    depth: i.depth,
    isLeaf: i.isLeaf,
    cb: cbOf(i),
    budgetQtyMilli: i.budgetQtyMilli,
    evMethod: i.evMethod,
    forecastMethod: i.forecastMethod,
    claimedInstalledQtyMilli: i.claimedInstalledQtyMilli,
    claimedPercentMilli: i.claimedPercentMilli,
    lockedActualCents: i.lockedActualCents,
    plannedStartOn: i.plannedStartOn,
    plannedFinishOn: i.plannedFinishOn,
  };
}

/** Target leaves and new-line parents (ordered by id, FOR UPDATE on approve), and which new codes already exist. */
async function loadBudgetItems(
  q: Q,
  job: Pick<JobRow, "id" | "companyId">,
  lines: readonly CoLine[],
  opts: { lock: boolean },
) {
  const ids = [
    ...new Set(
      lines.flatMap((l) =>
        l.target.kind === "existing"
          ? [l.target.costItemId]
          : l.target.parentId
            ? [l.target.parentId]
            : [],
      ),
    ),
  ];
  const newCodes = lines.flatMap((l) => (l.target.kind === "new" ? [l.target.code] : []));
  const scope = and(eq(costItems.companyId, job.companyId), eq(costItems.jobId, job.id));
  const select = () =>
    q.select().from(costItems).where(and(scope, inArray(costItems.id, ids))).orderBy(asc(costItems.id));
  const rows = ids.length ? await (opts.lock ? select().for("update") : select()) : [];
  const taken = newCodes.length
    ? await q
        .select({ code: costItems.code })
        .from(costItems)
        .where(and(scope, inArray(costItems.code, newCodes)))
    : [];
  return {
    items: new Map(rows.map((r) => [r.id, budgetItem(r)])),
    codesOnJob: new Set(taken.map((t) => t.code)),
  };
}

/** Writes the plan verbatim and links each new-item line to the leaf it created. Returns the new leaf ids. */
async function writeApproval(
  tx: Tx,
  companyId: string,
  job: JobRow,
  co: CoRow,
  lineRows: LineRow[],
  plan: ApprovalPlan,
) {
  for (const w of plan.writes)
    await tx
      .update(costItems)
      .set({
        cbLaborCents: w.cbLaborCents,
        cbMaterialCents: w.cbMaterialCents,
        cbEquipmentCents: w.cbEquipmentCents,
        cbSubCents: w.cbSubCents,
        budgetQtyMilli: w.budgetQtyMilli,
        plannedCents: w.plannedCents,
      })
      .where(and(eq(costItems.id, w.costItemId), eq(costItems.jobId, job.id)));
  const created: string[] = [];
  for (const leaf of plan.inserts) {
    const { sort, ...cols } = leaf;
    const id = randomUUID();
    await tx.insert(costItems).values({
      ...cols,
      id,
      companyId,
      jobId: job.id,
      isLeaf: true,
      installedQtyMilli: 0,
      claimedInstalledQtyMilli: 0,
      actualCents: 0,
      lockedActualCents: 0,
      claimedPercentMilli: 0,
      budgetMhPerUnitMilli: 0,
      earnDerivation: `Added by ${coLabel(co.number)}; nothing claimed yet.`,
    });
    const line = lineRows.find((r) => r.sort === sort)!;
    await tx
      .update(changeOrderLines)
      .set({ costItemId: id })
      .where(eq(changeOrderLines.id, line.id));
    created.push(id);
  }
  return created;
}

type ObImage = { items: Map<string, CostCategories>; total: CostCategories };

/** Original Budget per touched item, and summed over the whole job. */
async function obImage(tx: Tx, jobId: string, itemIds: string[]): Promise<ObImage> {
  const rows = itemIds.length
    ? await tx
        .select({
          id: costItems.id,
          obLaborCents: costItems.obLaborCents,
          obMaterialCents: costItems.obMaterialCents,
          obEquipmentCents: costItems.obEquipmentCents,
          obSubCents: costItems.obSubCents,
        })
        .from(costItems)
        .where(and(eq(costItems.jobId, jobId), inArray(costItems.id, itemIds)))
    : [];
  const [t] = await tx
    .select({
      obLaborCents: sql<number>`coalesce(sum(${costItems.obLaborCents}), 0)`.mapWith(Number),
      obMaterialCents: sql<number>`coalesce(sum(${costItems.obMaterialCents}), 0)`.mapWith(Number),
      obEquipmentCents: sql<number>`coalesce(sum(${costItems.obEquipmentCents}), 0)`.mapWith(Number),
      obSubCents: sql<number>`coalesce(sum(${costItems.obSubCents}), 0)`.mapWith(Number),
    })
    .from(costItems)
    .where(eq(costItems.jobId, jobId));
  return { items: new Map(rows.map((r) => [r.id, obOf(r)])), total: obOf(t) };
}

const sameCategories = (a: CostCategories, b: CostCategories) =>
  a.laborCents === b.laborCents &&
  a.materialCents === b.materialCents &&
  a.equipmentCents === b.equipmentCents &&
  a.subCents === b.subCents;

/**
 * Post-write checks in the same transaction; a mismatch throws and rolls the whole approval back.
 *   Original Budget: every existing item's ob_* and the job's Σ ob_* are byte-identical; new leaves are all 0.
 *   Current Budget:  for each touched item and category, cb − ob = Σ lines of approved change orders on it.
 */
async function verifyApproval(
  tx: Tx,
  jobId: string,
  before: ObImage,
  created: string[],
  touched: string[],
) {
  const after = await obImage(tx, jobId, [...before.items.keys(), ...created]);
  const problems: string[] = [];
  for (const [id, ob] of before.items)
    if (!sameCategories(ob, after.items.get(id) ?? emptyCategories()))
      problems.push(`ob moved on ${id}`);
  for (const id of created) {
    const ob = after.items.get(id);
    if (!ob || !sameCategories(ob, emptyCategories())) problems.push(`new leaf ${id} has ob ≠ 0`);
  }
  if (!sameCategories(before.total, after.total)) problems.push("job Σ ob moved");

  const approvedSum = (col: typeof changeOrderLines.laborCents) =>
    sql<number>`coalesce(sum(${col}) filter (where ${changeOrders.status} = 'approved'), 0)`.mapWith(Number);
  const rows = await tx
    .select({
      id: costItems.id,
      code: costItems.code,
      dl: sql<number>`${costItems.cbLaborCents} - ${costItems.obLaborCents}`.mapWith(Number),
      dm: sql<number>`${costItems.cbMaterialCents} - ${costItems.obMaterialCents}`.mapWith(Number),
      de: sql<number>`${costItems.cbEquipmentCents} - ${costItems.obEquipmentCents}`.mapWith(Number),
      ds: sql<number>`${costItems.cbSubCents} - ${costItems.obSubCents}`.mapWith(Number),
      al: approvedSum(changeOrderLines.laborCents),
      am: approvedSum(changeOrderLines.materialCents),
      ae: approvedSum(changeOrderLines.equipmentCents),
      as: approvedSum(changeOrderLines.subCents),
    })
    .from(costItems)
    .leftJoin(changeOrderLines, eq(changeOrderLines.costItemId, costItems.id))
    .leftJoin(changeOrders, eq(changeOrders.id, changeOrderLines.changeOrderId))
    .where(inArray(costItems.id, touched))
    .groupBy(costItems.id);
  if (rows.length !== new Set(touched).size) problems.push("touched item missing");
  for (const r of rows)
    if (r.dl !== r.al || r.dm !== r.am || r.de !== r.ae || r.ds !== r.as)
      problems.push(`${r.code}: cb − ob ≠ Σ approved lines`);
  if (problems.length)
    throw new Error(`change-order approve failed its post-write check: ${problems.join("; ")}`);
}

/** The only writer of change_orders.status/revision and of change_order_events. */
async function commit(
  tx: Tx,
  from: CoStatus | null,
  co: CoRow,
  to: CoStatus,
  command: CoCommandName,
  actor: CoActor,
  extra: { revision: number; reason: string; totalCents: number; move: BudgetMove | null },
): Promise<CoRow> {
  const [after] =
    from === null
      ? [co]
      : await tx
          .update(changeOrders)
          .set({ status: to, revision: extra.revision })
          .where(eq(changeOrders.id, co.id))
          .returning();
  await tx.insert(changeOrderEvents).values({
    companyId: co.companyId,
    changeOrderId: co.id,
    command,
    fromStatus: from,
    toStatus: to,
    revision: extra.revision,
    actorId: actor.userId,
    actorRole: actor.role,
    reason: extra.reason,
    totalCents: extra.totalCents,
    cbDeltaCents: extra.move?.cbDeltaCents ?? null,
    eacDeltaCents: extra.move?.eacDeltaCents ?? null,
  });
  return after;
}

/** Everything the job page and changeOrder.show read. Null when the job is not in this company. */
export async function listChangeOrders(
  companyId: string,
  jobNumber: string,
  now = new Date(),
): Promise<JobChangeOrders | null> {
  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!job) return null;

  const cos = await db
    .select()
    .from(changeOrders)
    .where(and(eq(changeOrders.companyId, companyId), eq(changeOrders.jobId, job.id)))
    .orderBy(desc(changeOrders.number));
  const coIds = cos.map((c) => c.id);
  const lineRows = coIds.length
    ? await db
        .select({
          line: changeOrderLines,
          code: costItems.code,
          description: costItems.description,
          unit: costItems.unit,
          parentCode: parentItems.code,
        })
        .from(changeOrderLines)
        .leftJoin(costItems, eq(costItems.id, changeOrderLines.costItemId))
        .leftJoin(parentItems, eq(parentItems.id, changeOrderLines.newParentId))
        .where(inArray(changeOrderLines.changeOrderId, coIds))
        .orderBy(asc(changeOrderLines.sort))
    : [];
  const events = coIds.length
    ? await db
        .select({ e: changeOrderEvents, actorName: users.name })
        .from(changeOrderEvents)
        .leftJoin(users, eq(users.id, changeOrderEvents.actorId))
        .where(inArray(changeOrderEvents.changeOrderId, coIds))
        .orderBy(asc(changeOrderEvents.at))
    : [];

  const [sums] = await db
    .select({
      original: sql<number>`coalesce(sum(${costItems.obLaborCents} + ${costItems.obMaterialCents} + ${costItems.obEquipmentCents} + ${costItems.obSubCents}), 0)`.mapWith(Number),
      current: sql<number>`coalesce(sum(${costItems.cbLaborCents} + ${costItems.cbMaterialCents} + ${costItems.cbEquipmentCents} + ${costItems.cbSubCents}), 0)`.mapWith(Number),
    })
    .from(costItems)
    .where(and(eq(costItems.companyId, companyId), eq(costItems.jobId, job.id), eq(costItems.isLeaf, true)));

  const byCo = new Map<string, typeof lineRows>();
  for (const r of lineRows) byCo.set(r.line.changeOrderId, [...(byCo.get(r.line.changeOrderId) ?? []), r]);
  const totalOf = (coId: string) =>
    (byCo.get(coId) ?? []).reduce((s, r) => s + categoryTotal(lineCategories(r.line)), 0);

  const today = isoDay(now);
  const views: ChangeOrderView[] = [];
  for (const co of cos) {
    const rows = byCo.get(co.id) ?? [];
    let preview: ChangeOrderView["preview"] = null;
    if (co.status === "priced") {
      const lines = rows.map((r) => toCoLine(r.line));
      const ctx = await loadBudgetItems(db, job, lines, { lock: false });
      const p = planApproval({ ...ctx, today, jobFinishOn: job.finishOn }, lines);
      preview = p.ok ? { ok: true, move: p.plan.move } : { ok: false, why: describePlanRefusal(p.refusal) };
    }
    views.push({
      ...header(co),
      reason: co.reason,
      totalCents: totalOf(co.id),
      createdAt: co.createdAt.toISOString(),
      lines: rows.map(({ line, code, description, unit, parentCode }) => ({
        sort: line.sort,
        code: line.newCode ?? code ?? "",
        description: line.newDescription ?? description ?? "",
        unit: line.newUnit ?? unit ?? "",
        created: line.newCode !== null,
        parentCode: line.newCode !== null ? parentCode : null,
        delta: lineCategories(line),
        totalCents: categoryTotal(lineCategories(line)),
        qtyDeltaMilli: line.qtyDeltaMilli,
        note: line.note,
      })),
      history: events
        .filter(({ e }) => e.changeOrderId === co.id)
        .map(({ e, actorName }) => ({
          command: e.command,
          from: e.fromStatus,
          to: e.toStatus,
          revision: e.revision,
          actorName: actorName ?? "Removed user",
          actorRole: e.actorRole,
          reason: e.reason,
          totalCents: e.totalCents,
          cbDeltaCents: e.cbDeltaCents,
          eacDeltaCents: e.eacDeltaCents,
          at: e.at.toISOString(),
        })),
      commands: availableCommands(co.status),
      preview,
    });
  }

  const approvedChangesCents = cos
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + totalOf(c.id), 0);
  const pendingCents = cos
    .filter((c) => c.status === "priced")
    .reduce((s, c) => s + totalOf(c.id), 0);
  return {
    job: { ...jobRef(job), estimateApproved: job.estimateStatus === "approved" },
    ledger: {
      originalCents: sums.original,
      approvedChangesCents,
      currentCents: sums.current,
      pendingCents,
      reconciled: sums.original + approvedChangesCents === sums.current,
    },
    changeOrders: views,
  };
}
