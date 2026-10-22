// Change orders: state machine, line parsing, and exact budget/forecast planning. Pure, no IO.
// server/change-orders.ts is the only caller that writes.
// Schema import is type-only: the pgEnum value lists are the root, and nothing from drizzle ships to the client.
import type { coCommandEnum, coStatusEnum, roleEnum } from "@/db/schema";
import type { JobArgs } from "@/lib/assistant/route";
import {
  categoryTotal,
  emptyCategories,
  type CostCategories,
} from "@/lib/budget";
import {
  earnedCentsOf,
  itemForecast,
  plannedValueCents,
  qty,
  usdCents,
  type EvMethod,
  type ForecastMethod,
} from "@/lib/ev";

export type CoStatus = (typeof coStatusEnum.enumValues)[number];
export type CoCommandName = (typeof coCommandEnum.enumValues)[number];
export type CoRole = (typeof roleEnum.enumValues)[number];

/** The only definition of legal moves. `from: [null]` means the change order does not exist yet. */
export const CO_TRANSITIONS = {
  create: { from: [null], to: "draft" },
  price: { from: ["draft", "priced"], to: "priced" },
  approve: { from: ["priced"], to: "approved" },
  reject: { from: ["priced"], to: "rejected" },
  void: { from: ["draft", "priced"], to: "voided" },
} as const satisfies Record<
  CoCommandName,
  { from: readonly (CoStatus | null)[]; to: CoStatus }
>;

export const CO_COMMANDS = Object.keys(CO_TRANSITIONS) as CoCommandName[];

const fromOf = (c: CoCommandName): readonly (CoStatus | null)[] =>
  CO_TRANSITIONS[c].from;

/** Statuses with no outgoing command. change_order_events_decision_uq lists the same set. */
export const TERMINAL_STATUSES: readonly CoStatus[] = [
  ...new Set(CO_COMMANDS.map((c) => CO_TRANSITIONS[c].to)),
].filter((s) => !CO_COMMANDS.some((c) => fromOf(c).includes(s)));

/** Commands legal from a status, in CO_COMMANDS order. The screen renders buttons from this. */
export function availableCommands(status: CoStatus): CoCommandName[] {
  return CO_COMMANDS.filter((c) => fromOf(c).includes(status));
}

export type Decision =
  | { kind: "go"; from: CoStatus | null; to: CoStatus }
  /** Repeating a terminal command (approve twice): a no-op, never a second effect. */
  | { kind: "already"; status: CoStatus }
  | {
      kind: "illegal";
      from: CoStatus | null;
      allowed: readonly CoCommandName[];
    };

export function decide(
  from: CoStatus | null,
  command: CoCommandName,
): Decision {
  const to = CO_TRANSITIONS[command].to;
  if (fromOf(command).includes(from)) return { kind: "go", from, to };
  if (from !== null && from === to && TERMINAL_STATUSES.includes(from))
    return { kind: "already", status: from };
  return {
    kind: "illegal",
    from,
    allowed: from === null ? ["create"] : availableCommands(from),
  };
}

// References and money

export type CoRef = { number: number } | { id: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "CO-3", "co 003", "PCO-3", "#3", "3", or a uuid from the screen. Null when it is none of those. */
export function parseCoRef(s: string | undefined): CoRef | null {
  const t = (s ?? "").trim();
  if (UUID.test(t)) return { id: t.toLowerCase() };
  const m = t.match(/^(?:p?co[-\s]?|#)?0*(\d{1,6})$/i);
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? { number: n } : null;
}

export const coLabel = (n: number) => `CO-${String(n).padStart(3, "0")}`;

const MAX_CENTS = 100_000_000_000;
const MAX_QTY_MILLI = 1_000_000_000_000;

/** Signed decimal string → integer in `places` decimals by string math (no float multiply). */
function parseScaled(
  s: string | undefined,
  places: number,
): { ok: true; value: number } | { ok: false; reason: "shape" | "places" } {
  const t = (s ?? "").trim().replace(/−/g, "-").replace(/[\s,$]/g, "");
  if (t === "") return { ok: true, value: 0 };
  const m = t.match(/^([+-])?(\d+)(?:\.(\d*))?$/);
  if (!m) return { ok: false, reason: "shape" };
  const frac = m[3] ?? "";
  if (frac.length > places) return { ok: false, reason: "places" };
  const value = Number(m[2]) * 10 ** places + Number(frac.padEnd(places, "0"));
  return { ok: true, value: m[1] === "-" ? 0 - value : value };
}

/** "18,500", "$18,500.00", "-1,250.5" → integer cents. At most 2 decimals; |value| ≤ $1,000,000,000.00. Blank → 0. */
export function parseDollarsToCents(
  s: string | undefined,
): { ok: true; cents: number } | { ok: false; error: string } {
  const r = parseScaled(s, 2);
  if (!r.ok)
    return {
      ok: false,
      error:
        r.reason === "places"
          ? "Use whole cents, at most two decimals."
          : `"${(s ?? "").trim()}" is not a dollar amount. Use digits like 18,500 or -1,250.50.`,
    };
  if (Math.abs(r.value) > MAX_CENTS)
    return { ok: false, error: "Keep each amount within $1,000,000,000.00." };
  return { ok: true, cents: r.value };
}

/** "50", "-12.5" → thousandths. At most 3 decimals. Blank → 0. */
export function parseQtyToMilli(
  s: string | undefined,
): { ok: true; milli: number } | { ok: false; error: string } {
  const r = parseScaled(s, 3);
  if (!r.ok || Math.abs(r.value) > MAX_QTY_MILLI)
    return {
      ok: false,
      error: `"${(s ?? "").trim()}" is not a quantity. Use a number like 50 or -12.5.`,
    };
  return { ok: true, milli: r.value };
}

// Lines

export type CostCategory = "labor" | "material" | "equipment" | "sub";

const CATEGORIES = [
  ["labor", "laborCents"],
  ["material", "materialCents"],
  ["equipment", "equipmentCents"],
  ["sub", "subCents"],
] as const satisfies readonly (readonly [CostCategory, keyof CostCategories])[];

/**
 * A line as a form row or the assistant sends it: strings, signed amounts in dollars.
 *   costItemId                  → that existing cost item
 *   code, no description        → the existing cost item with that code
 *   code + description + unit   → a new cost item (optionally under parentCode)
 */
export type CoLineInput = {
  costItemId?: string;
  code?: string;
  description?: string;
  unit?: string;
  parentCode?: string;
  labor?: string;
  material?: string;
  equipment?: string;
  sub?: string;
  qty?: string;
  note?: string;
};

const LINE_INPUT_FIELDS = [
  "costItemId",
  "code",
  "description",
  "unit",
  "parentCode",
  "labor",
  "material",
  "equipment",
  "sub",
  "qty",
  "note",
] as const satisfies readonly (keyof CoLineInput)[];

/** Parsed amounts; the target is not yet resolved against the job. `sort` is the input row. */
export type ParsedCoLine = {
  sort: number;
  ref:
    | { kind: "id"; costItemId: string }
    | { kind: "code"; code: string }
    | {
        kind: "new";
        code: string;
        description: string;
        unit: string;
        parentCode: string | null;
      };
  delta: CostCategories;
  qtyDeltaMilli: number;
  note: string;
};

/** Resolved against the job. This is what is stored and what approve applies. */
export type CoLine = {
  sort: number;
  target:
    | { kind: "existing"; costItemId: string }
    | {
        kind: "new";
        code: string;
        description: string;
        unit: string;
        parentId: string | null;
      };
  delta: CostCategories;
  qtyDeltaMilli: number;
  note: string;
};

type FieldErrors = Record<string, string>;
type Parsed<T> = { ok: true; lines: T[] } | { ok: false; errors: FieldErrors };

const CODE = /^[A-Za-z0-9][A-Za-z0-9.-]{0,23}$/;
const blank = (v: string | undefined) => !v || !v.trim();
const lineKey = (sort: number, field: string) => `lines.${sort}.${field}`;

/** Parse form or assistant rows. Fully blank rows are ignored. Errors are keyed "lines.<row>.<field>". */
export function parseCoLines(
  input: readonly CoLineInput[],
): Parsed<ParsedCoLine> {
  const errors: FieldErrors = {};
  const lines: ParsedCoLine[] = [];
  input.forEach((row, sort) => {
    if (LINE_INPUT_FIELDS.every((f) => blank(row[f]))) return;
    const key = (f: string) => lineKey(sort, f);
    const before = Object.keys(errors).length;

    const delta = emptyCategories();
    for (const [cat, k] of CATEGORIES) {
      const r = parseDollarsToCents(row[cat]);
      if (r.ok) delta[k] = r.cents;
      else errors[key(cat)] = r.error;
    }
    const q = parseQtyToMilli(row.qty);
    if (!q.ok) errors[key("qty")] = q.error;
    const qtyDeltaMilli = q.ok ? q.milli : 0;
    const note = (row.note ?? "").trim();
    if (note.length > 200) errors[key("note")] = "Keep the note under 200 characters.";

    const code = (row.code ?? "").trim();
    const description = (row.description ?? "").trim();
    const unit = (row.unit ?? "").trim().toUpperCase();
    let ref: ParsedCoLine["ref"] | null = null;
    if (!blank(row.costItemId))
      ref = { kind: "id", costItemId: row.costItemId!.trim() };
    else if (!code)
      errors[key("code")] =
        "Pick a cost code, or give a new code with a description and unit.";
    else if (!CODE.test(code)) errors[key("code")] = `"${code}" is not a cost code.`;
    else if (!description) ref = { kind: "code", code };
    else if (description.length > 120)
      errors[key("description")] = "Keep the description under 120 characters.";
    else if (!/^[A-Z]{1,6}$/.test(unit))
      errors[key("unit")] = "A new cost item needs a unit, like LS or CY.";
    else
      ref = {
        kind: "new",
        code,
        description,
        unit,
        parentCode: (row.parentCode ?? "").trim() || null,
      };

    if (
      Object.keys(errors).length === before &&
      CATEGORIES.every(([, k]) => delta[k] === 0) &&
      qtyDeltaMilli === 0
    )
      errors[key("labor")] = "Enter at least one amount or a quantity change.";

    if (ref && Object.keys(errors).length === before)
      lines.push({ sort, ref, delta, qtyDeltaMilli, note });
  });
  if (!lines.length && !Object.keys(errors).length)
    errors.lines = "Add at least one line.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, lines };
}

/** A cost item on the job, as resolution needs it. */
export type JobItemRef = { id: string; code: string; isLeaf: boolean };

/** Resolve parsed rows against the job's cost items (id or code). One line per target per CO. */
export function resolveCoLines(
  parsed: readonly ParsedCoLine[],
  onJob: readonly JobItemRef[],
): Parsed<CoLine> {
  const byId = new Map(onJob.map((i) => [i.id, i]));
  const byCode = new Map(onJob.map((i) => [i.code, i]));
  const errors: FieldErrors = {};
  const lines: CoLine[] = [];
  const seen = new Map<string, number>();
  const claim = (target: string, sort: number, label: string) => {
    const prior = seen.get(target);
    if (prior !== undefined) {
      errors[lineKey(sort, "code")] = `${label} is already on line ${prior + 1}.`;
      return false;
    }
    seen.set(target, sort);
    return true;
  };
  for (const p of parsed) {
    const { sort, delta, qtyDeltaMilli, note } = p;
    if (p.ref.kind === "new") {
      const { code, description, unit, parentCode } = p.ref;
      if (byCode.has(code)) {
        errors[lineKey(sort, "code")] =
          `${code} is already on this job. Leave the description blank to revise it.`;
        continue;
      }
      const parent = parentCode ? byCode.get(parentCode) : undefined;
      if (parentCode && (!parent || parent.isLeaf)) {
        errors[lineKey(sort, "parentCode")] =
          `${parentCode} is not a summary code on this job.`;
        continue;
      }
      if (!claim(`new:${code}`, sort, code)) continue;
      lines.push({
        sort,
        target: { kind: "new", code, description, unit, parentId: parent?.id ?? null },
        delta,
        qtyDeltaMilli,
        note,
      });
      continue;
    }
    const item =
      p.ref.kind === "id" ? byId.get(p.ref.costItemId) : byCode.get(p.ref.code);
    if (!item) {
      errors[lineKey(sort, "code")] =
        p.ref.kind === "id"
          ? "That cost item isn't on this job."
          : `No cost item ${p.ref.code} on this job. To add one, give a description and unit.`;
      continue;
    }
    if (!item.isLeaf) {
      errors[lineKey(sort, "code")] =
        `${item.code} is a summary row. Pick a cost item under it.`;
      continue;
    }
    if (!claim(`id:${item.id}`, sort, item.code)) continue;
    lines.push({
      sort,
      target: { kind: "existing", costItemId: item.id },
      delta,
      qtyDeltaMilli,
      note,
    });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, lines };
}

export const lineTotalCents = (l: { delta: CostCategories }) =>
  categoryTotal(l.delta);
export const coTotalCents = (lines: readonly { delta: CostCategories }[]) =>
  lines.reduce((s, l) => s + lineTotalCents(l), 0);

const lineIdentity = (l: CoLine) =>
  [
    l.target.kind === "existing"
      ? l.target.costItemId
      : `${l.target.code}|${l.target.description}|${l.target.unit}|${l.target.parentId ?? ""}`,
    l.delta.laborCents,
    l.delta.materialCents,
    l.delta.equipmentCents,
    l.delta.subCents,
    l.qtyDeltaMilli,
    l.note,
  ].join("\u0000");

/** Same targets, amounts, and notes in the same order. Re-pricing with these is a no-op. */
export const sameCoLines = (a: readonly CoLine[], b: readonly CoLine[]) =>
  a.length === b.length &&
  a.every((l, i) => lineIdentity(l) === lineIdentity(b[i]!));

// Approval planning (exact CB / EAC / PV)

/** Cost-item fields approve reads (FOR UPDATE) to plan exact moves. */
export type BudgetItem = {
  id: string;
  code: string;
  path: string;
  depth: number;
  isLeaf: boolean;
  cb: CostCategories;
  budgetQtyMilli: number;
  evMethod: EvMethod;
  forecastMethod: ForecastMethod;
  claimedInstalledQtyMilli: number;
  claimedPercentMilli: number;
  lockedActualCents: number;
  plannedStartOn: string;
  plannedFinishOn: string;
};

/** What approve may write to an existing leaf. There is no ob_* or ce_* key on this type. */
export type CbWrite = {
  costItemId: string;
  cbLaborCents: number;
  cbMaterialCents: number;
  cbEquipmentCents: number;
  cbSubCents: number;
  budgetQtyMilli: number;
  /** Denormalized PV refreshed as of the approval day (same rule as lock). */
  plannedCents: number;
};

/** A leaf approve inserts. OB and CE are the literal 0; CB is the line's delta. */
export type NewLeaf = {
  sort: number;
  code: string;
  description: string;
  unit: string;
  parentId: string | null;
  path: string;
  depth: number;
  obLaborCents: 0;
  obMaterialCents: 0;
  obEquipmentCents: 0;
  obSubCents: 0;
  ceLaborCents: 0;
  ceMaterialCents: 0;
  ceEquipmentCents: 0;
  ceSubCents: 0;
  cbLaborCents: number;
  cbMaterialCents: number;
  cbEquipmentCents: number;
  cbSubCents: number;
  budgetQtyMilli: number;
  evMethod: "units" | "pm_percent";
  forecastMethod: "current_budget";
  /** Approval day, so PV at the last lock stays 0. */
  plannedStartOn: string;
  plannedFinishOn: string;
  plannedCents: number;
};

/** Exact job-level moves. EAC is a sum of per-leaf forecasts, so Σ touched-item deltas is exact. */
export type BudgetMove = {
  cbDeltaCents: number;
  eacDeltaCents: number;
  items: {
    code: string;
    created: boolean;
    cbDeltaCents: number;
    eacDeltaCents: number;
  }[];
};

export type ApprovalPlan = {
  writes: CbWrite[];
  inserts: NewLeaf[];
  move: BudgetMove;
};

/** `line` is the line's sort (its input row), so a refusal maps back to a form field. */
export type PlanRefusal =
  | { kind: "empty" }
  | { kind: "item_missing"; line: number; costItemId: string }
  | { kind: "not_a_leaf"; line: number; code: string }
  | { kind: "parent_not_summary"; line: number; code: string }
  | { kind: "code_taken"; line: number; code: string }
  | {
      kind: "negative_budget";
      line: number;
      code: string;
      category: CostCategory | "qty";
      after: number;
    };

function firstNegative(
  c: CostCategories,
  qtyMilli: number,
): { category: CostCategory | "qty"; after: number } | null {
  for (const [cat, k] of CATEGORIES)
    if (c[k] < 0) return { category: cat, after: c[k] };
  return qtyMilli < 0 ? { category: "qty", after: qtyMilli } : null;
}

const addCategories = (a: CostCategories, b: CostCategories): CostCategories => ({
  laborCents: a.laborCents + b.laborCents,
  materialCents: a.materialCents + b.materialCents,
  equipmentCents: a.equipmentCents + b.equipmentCents,
  subCents: a.subCents + b.subCents,
});

/** Per-item EAC with the same functions getJob uses, at a given CB and budget quantity. */
function eacOf(item: BudgetItem, cb: CostCategories, budgetQtyMilli: number) {
  const budgetCents = categoryTotal(cb);
  const earnedCents = earnedCentsOf({
    evMethod: item.evMethod,
    budgetQtyMilli,
    budgetCents,
    claimedInstalledQtyMilli: item.claimedInstalledQtyMilli,
    claimedPercentMilli: item.claimedPercentMilli,
  });
  return itemForecast({
    forecastMethod: item.forecastMethod,
    budgetCents,
    earnedCents,
    actualCents: item.lockedActualCents,
  }).eacCents;
}

/**
 * Plan an approval against the current item rows. Price runs it as a dry run on unlocked rows
 * (early refusal and the on-screen preview); approve runs it on FOR UPDATE rows and writes the plan verbatim.
 *   existing: cb' = cb + Δ per category, qty' = qty + qtyΔ; refuse if any ends below 0.
 *   new:      code not on the job; parent (if any) is a summary row. OB = CE = 0, CB = Δ,
 *             forecast current_budget, start = today, finish = job finish.
 *   EAC delta per item = forecast(after) − forecast(before).
 */
export function planApproval(
  ctx: {
    /** Every existing target leaf and every new-line parent, by id. */
    items: ReadonlyMap<string, BudgetItem>;
    codesOnJob: ReadonlySet<string>;
    /** YYYY-MM-DD (UTC) */
    today: string;
    jobFinishOn: string;
  },
  lines: readonly CoLine[],
): { ok: true; plan: ApprovalPlan } | { ok: false; refusal: PlanRefusal } {
  if (!lines.length) return { ok: false, refusal: { kind: "empty" } };
  const asOf = new Date(`${ctx.today}T00:00:00Z`);
  const plan: ApprovalPlan = {
    writes: [],
    inserts: [],
    move: { cbDeltaCents: 0, eacDeltaCents: 0, items: [] },
  };
  for (const line of lines) {
    const at = line.sort;
    const cbDeltaCents = lineTotalCents(line);
    if (line.target.kind === "existing") {
      const item = ctx.items.get(line.target.costItemId);
      if (!item)
        return {
          ok: false,
          refusal: { kind: "item_missing", line: at, costItemId: line.target.costItemId },
        };
      if (!item.isLeaf)
        return { ok: false, refusal: { kind: "not_a_leaf", line: at, code: item.code } };
      const cb = addCategories(item.cb, line.delta);
      const budgetQtyMilli = item.budgetQtyMilli + line.qtyDeltaMilli;
      const negative = firstNegative(cb, budgetQtyMilli);
      if (negative)
        return {
          ok: false,
          refusal: { kind: "negative_budget", line: at, code: item.code, ...negative },
        };
      plan.writes.push({
        costItemId: item.id,
        cbLaborCents: cb.laborCents,
        cbMaterialCents: cb.materialCents,
        cbEquipmentCents: cb.equipmentCents,
        cbSubCents: cb.subCents,
        budgetQtyMilli,
        plannedCents: plannedValueCents(
          categoryTotal(cb),
          item.plannedStartOn,
          item.plannedFinishOn,
          asOf,
        ),
      });
      plan.move.items.push({
        code: item.code,
        created: false,
        cbDeltaCents,
        eacDeltaCents:
          eacOf(item, cb, budgetQtyMilli) - eacOf(item, item.cb, item.budgetQtyMilli),
      });
      continue;
    }
    const t = line.target;
    if (ctx.codesOnJob.has(t.code))
      return { ok: false, refusal: { kind: "code_taken", line: at, code: t.code } };
    const parent = t.parentId ? ctx.items.get(t.parentId) : undefined;
    if (t.parentId && (!parent || parent.isLeaf))
      return {
        ok: false,
        refusal: { kind: "parent_not_summary", line: at, code: parent?.code ?? t.code },
      };
    const negative = firstNegative(line.delta, line.qtyDeltaMilli);
    if (negative)
      return {
        ok: false,
        refusal: { kind: "negative_budget", line: at, code: t.code, ...negative },
      };
    const finish = ctx.jobFinishOn > ctx.today ? ctx.jobFinishOn : ctx.today;
    plan.inserts.push({
      sort: line.sort,
      code: t.code,
      description: t.description,
      unit: t.unit,
      parentId: parent?.id ?? null,
      path: parent ? `${parent.path}${t.code}/` : `/${t.code}/`,
      depth: parent ? parent.depth + 1 : 0,
      obLaborCents: 0,
      obMaterialCents: 0,
      obEquipmentCents: 0,
      obSubCents: 0,
      ceLaborCents: 0,
      ceMaterialCents: 0,
      ceEquipmentCents: 0,
      ceSubCents: 0,
      cbLaborCents: line.delta.laborCents,
      cbMaterialCents: line.delta.materialCents,
      cbEquipmentCents: line.delta.equipmentCents,
      cbSubCents: line.delta.subCents,
      budgetQtyMilli: line.qtyDeltaMilli,
      evMethod: line.qtyDeltaMilli > 0 ? "units" : "pm_percent",
      forecastMethod: "current_budget",
      plannedStartOn: ctx.today,
      plannedFinishOn: finish,
      plannedCents: plannedValueCents(cbDeltaCents, ctx.today, finish, asOf),
    });
    plan.move.items.push({
      code: t.code,
      created: true,
      cbDeltaCents,
      eacDeltaCents: itemForecast({
        forecastMethod: "current_budget",
        budgetCents: cbDeltaCents,
        earnedCents: 0,
        actualCents: 0,
      }).eacCents,
    });
  }
  for (const i of plan.move.items) {
    plan.move.cbDeltaCents += i.cbDeltaCents;
    plan.move.eacDeltaCents += i.eacDeltaCents;
  }
  return { ok: true, plan };
}

/** The form field a plan refusal belongs to. */
export function planRefusalField(r: PlanRefusal): string | null {
  switch (r.kind) {
    case "empty":
      return null;
    case "negative_budget":
      return lineKey(r.line, r.category);
    case "parent_not_summary":
      return lineKey(r.line, "parentCode");
    default:
      return lineKey(r.line, "code");
  }
}

export function describePlanRefusal(r: PlanRefusal): string {
  switch (r.kind) {
    case "empty":
      return "It has no lines. Price it first.";
    case "item_missing":
      return `The cost item on line ${r.line + 1} is no longer on this job.`;
    case "not_a_leaf":
      return `${r.code} is a summary row. Change orders revise the cost items under it.`;
    case "parent_not_summary":
      return `${r.code} is not a summary code on this job.`;
    case "code_taken":
      return `${r.code} is already on this job. A new cost item needs a new code.`;
    case "negative_budget":
      return r.category === "qty"
        ? `${r.code} budget quantity would end at ${qty(r.after)}. A change order can't take it below zero.`
        : `${r.code} ${r.category} would end at ${usdCents(r.after)}. A change order can't take Current Budget below zero.`;
  }
}

// Commands and results (the domain's public vocabulary)

export type CoActor = { userId: string; role: CoRole };

type ArgsByCommand<T extends Record<CoCommandName, object>> = T;
type CoCommandArgs = ArgsByCommand<{
  create: { title: string; reason: string };
  /** The full line set; replaces the change order's lines. */
  price: { co: CoRef; lines: readonly CoLineInput[] };
  /** expectRevision: the revision the screen rendered. Stale → refused, nothing written. */
  approve: { co: CoRef; expectRevision?: number };
  reject: { co: CoRef; reason: string };
  void: { co: CoRef; reason: string };
}>;

/** One variant per command in the DB enum. */
export type CoCommand = {
  [K in CoCommandName]: { kind: K } & CoCommandArgs[K];
}[CoCommandName];

export type CoHeader = {
  id: string;
  number: number;
  label: string;
  title: string;
  status: CoStatus;
  revision: number;
};
export type CoJobRef = { number: string; shortName: string };

export type CoRefusal =
  | { kind: "job_not_found"; number: string }
  | { kind: "estimate_not_approved" }
  | { kind: "co_not_found"; ref: CoRef }
  | {
      kind: "illegal";
      from: CoStatus | null;
      allowed: readonly CoCommandName[];
    }
  | { kind: "already"; status: CoStatus }
  | { kind: "stale_revision"; saw: number; current: number }
  | { kind: "title_required" }
  | { kind: "reason_required" }
  | { kind: "too_long"; field: "title" | "reason"; max: number }
  | { kind: "invalid_lines" }
  | PlanRefusal;

type CoDone = {
  ok: true;
  job: CoJobRef;
  /** After the command. */
  co: CoHeader;
  from: CoStatus | null;
  to: CoStatus;
  reason: string;
  totalCents: number;
  lineCount: number;
  /** Price with identical lines on a priced CO: no event, no revision bump. */
  unchanged: boolean;
} & (
  | { command: "approve"; move: BudgetMove }
  | { command: Exclude<CoCommandName, "approve">; move: null }
);

export type CoCommandResult =
  | CoDone
  | {
      ok: false;
      command: CoCommandName;
      job: CoJobRef | null;
      co: CoHeader | null;
      refusal: CoRefusal;
      errors?: Record<string, string>;
    };

/** JobArgs (assistant or form) → CoCommand, or a question back when the change order isn't named. */
export function coCommandFromArgs(
  name: CoCommandName,
  args: JobArgs,
): CoCommand | { ask: string } {
  if (name === "create")
    return { kind: "create", title: args.title ?? "", reason: args.reason ?? "" };
  const co = parseCoRef(args.changeOrder);
  if (!co) return { ask: "Which change order? Say its number, like CO-001." };
  switch (name) {
    case "price":
      if (!args.coLines?.length)
        return {
          ask: "Price it per cost code, like: Price CO-001 on 25-031: new 91-100 Retaining wall LS labor 18,500 material 23,250.",
        };
      return { kind: "price", co, lines: args.coLines };
    case "approve": {
      if (args.revision === undefined) return { kind: "approve", co };
      const expectRevision = Number(args.revision);
      return Number.isInteger(expectRevision)
        ? { kind: "approve", co, expectRevision }
        : { ask: "That approve button is out of date. Reload the job page and try again." };
    }
    case "reject":
      return { kind: "reject", co, reason: args.reason ?? "" };
    case "void":
      return { kind: "void", co, reason: args.reason ?? "" };
  }
}

const signedUsd = (cents: number) => `${cents > 0 ? "+" : ""}${usdCents(cents)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const statusWord = (s: CoStatus) => (s === "draft" ? "a draft" : s);

function describeApproval(on: string, revision: number, move: BudgetMove) {
  const parts = [
    `Approved ${on} (rev ${revision}): Current Budget ${signedUsd(move.cbDeltaCents)}, EAC ${signedUsd(move.eacDeltaCents)}.`,
  ];
  const created = move.items.filter((i) => i.created).map((i) => i.code);
  if (created.length)
    parts.push(`New cost ${created.length === 1 ? "item" : "items"} ${created.join(", ")}.`);
  const differ = move.items.filter((i) => i.eacDeltaCents !== i.cbDeltaCents);
  if (differ.length)
    parts.push(
      `EAC moves by a different amount where work is already earned or forecast by performance: ${differ
        .map((i) => `${i.code} budget ${signedUsd(i.cbDeltaCents)}, EAC ${signedUsd(i.eacDeltaCents)}`)
        .join("; ")}.`,
    );
  parts.push("Original Budget unchanged.");
  return parts.join(" ");
}

/** The one place change-order prose lives: assistant summary, form result, and the job change feed. */
export function describeCoResult(r: CoCommandResult): string {
  const on = r.co && r.job ? `${r.co.label} on ${r.job.shortName}` : "";
  if (r.ok) {
    switch (r.command) {
      case "create":
        return `Raised ${on}: "${r.co.title}". Draft. Price it per cost item; nothing moves until an executive approves it.`;
      case "price":
        return r.unchanged
          ? `${on} already has those lines (rev ${r.co.revision}, ${usdCents(r.totalCents)}). Nothing changed.`
          : `Priced ${on} (rev ${r.co.revision}): ${usdCents(r.totalCents)} across ${plural(r.lineCount, "line")}. Pending executive approval, not in Current Budget or EAC.`;
      case "approve":
        return describeApproval(on, r.co.revision, r.move);
      case "reject":
        return `Rejected ${on}: "${r.reason}". Nothing moved.`;
      case "void":
        return `Voided ${on}: "${r.reason}". Nothing moved.`;
    }
  }
  const f = r.refusal;
  const job = r.job?.shortName ?? "this job";
  switch (f.kind) {
    case "job_not_found":
      return `There is no job ${f.number} in this sandbox.`;
    case "estimate_not_approved":
      return `${job}'s estimate is still a draft. Approve the estimate first; a change order revises an approved Current Budget.`;
    case "co_not_found":
      return `There is no ${"number" in f.ref ? coLabel(f.ref.number) : "such change order"} on ${job}.`;
    case "illegal":
      return f.from && TERMINAL_STATUSES.includes(f.from)
        ? `${on} is ${f.from} and final. Raise a new change order to correct it.`
        : `Can't ${r.command} ${on}: it is ${f.from ? statusWord(f.from) : "missing"}. Next: ${f.allowed.join(" or ")}.`;
    case "already":
      return f.status === "approved"
        ? `${on} is already approved. Current Budget was not moved again.`
        : `${on} is already ${f.status}. Nothing moved.`;
    case "stale_revision":
      return `${on} was re-priced (now rev ${f.current}) after this page showed rev ${f.saw}. Review the new lines, then approve.`;
    case "title_required":
      return `A change order needs a title. Say what changed, like "Raise a change order on 25-031: Added guardrail at the east approach".`;
    case "reason_required":
      return `${r.command === "reject" ? "Rejecting" : "Voiding"} ${on} needs a reason. Add "because …".`;
    case "too_long":
      return `Keep the ${f.field} under ${f.max} characters.`;
    case "invalid_lines":
      return `${on} was not priced. ${Object.values(r.errors ?? {}).slice(0, 3).join(" ")}`;
    default:
      return `${on} can't be ${r.command === "approve" ? "approved" : "priced"}. ${describePlanRefusal(f)}`;
  }
}
