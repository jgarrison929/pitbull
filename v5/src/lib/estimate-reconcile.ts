// Estimate CSV → cost forest → reconcile plan. Pure: the server applies a plan inside one transaction.
// Keyed by cost code. A code already on the job keeps its id, a new code is inserted, a dropped code is removed.
// Import writes Current Estimate only; Original and Current Budget belong to Approve.

import {
  categoriesFromUnitCosts,
  categoryTotal,
  ceCategories,
  emptyCategories,
  manHoursMilli,
  valueSetColumns,
  type CostCategories,
} from "@/lib/budget";
import { mh, usdShort } from "@/lib/ev";

/** Domain cap, kept under next.config's 2 MB server-action body so multipart overhead still fits. */
export const MAX_CSV_CHARS = 1_500_000;

export const ESTIMATE_UNITS = [
  "AC",
  "CF",
  "CY",
  "DAY",
  "EA",
  "GAL",
  "HR",
  "LB",
  "LF",
  "LS",
  "MO",
  "SF",
  "SY",
  "TON",
] as const;

export const ESTIMATE_COLUMNS = [
  "code",
  "parent_code",
  "description",
  "unit",
  "qty",
  "mh_per_unit",
  "labor_unit",
  "material_unit",
  "equipment_unit",
  "sub_unit",
] as const;
type Column = (typeof ESTIMATE_COLUMNS)[number];

const MEASURES = [
  "unit",
  "qty",
  "mh_per_unit",
  "labor_unit",
  "material_unit",
  "equipment_unit",
  "sub_unit",
] as const satisfies readonly Column[];

const UNIT_COSTS = [
  ["labor_unit", "laborCents"],
  ["material_unit", "materialCents"],
  ["equipment_unit", "equipmentCents"],
  ["sub_unit", "subCents"],
] as const satisfies readonly (readonly [Column, keyof CostCategories])[];

/** `/` is the path separator, so it can never appear in a code. */
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

export type RowError = {
  /** Physical file line, 1-based, header = 1. 0 for a code the file left out. */
  line: number;
  column: Column | "header" | "file";
  code?: string;
  message: string;
};

/** One cost item as the estimate wants it. Summaries carry no unit, quantity, rate, or cost. */
export type EstimateItem = {
  code: string;
  parentCode: string | null;
  path: string;
  depth: number;
  isLeaf: boolean;
  description: string;
  unit: string;
  qtyMilli: number;
  mhPerUnitMilli: number;
  ce: CostCategories;
};

type ForestNode = EstimateItem & { line: number };

declare const forestBrand: unique symbol;
/** A validated tree. Only parseEstimateCsv makes one; its contents stay private to this module. */
export type CostForest = { readonly [forestBrand]: true };
const forests = new WeakMap<CostForest, readonly ForestNode[]>();

function nodesOf(forest: CostForest): readonly ForestNode[] {
  const nodes = forests.get(forest);
  if (!nodes) throw new Error("CostForest must come from parseEstimateCsv");
  return nodes;
}

export type EstimateTotals = {
  itemCount: number;
  leafCount: number;
  ceCents: number;
  categories: CostCategories;
  mhMilli: number;
};

export type ParseOutcome =
  | { ok: true; forest: CostForest }
  | { ok: false; errors: readonly RowError[] };

const COLUMN_ORDER: readonly string[] = ["file", "header", ...ESTIMATE_COLUMNS];
const byPosition = (a: RowError, b: RowError) =>
  a.line - b.line ||
  COLUMN_ORDER.indexOf(a.column) - COLUMN_ORDER.indexOf(b.column);
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const fail = (errors: RowError[]) =>
  ({ ok: false, errors: errors.sort(byPosition) }) as const;

/** Splits one physical line. A quote left open means a field tried to span lines. */
function splitCells(text: string): string[] | "open-quote" | "stray-quote" {
  const cells: string[] = [];
  let i = 0;
  for (;;) {
    let cell = "";
    if (text[i] === '"') {
      i++;
      for (;;) {
        if (i >= text.length) return "open-quote";
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        cell += text[i++];
      }
      if (i < text.length && text[i] !== ",") return "stray-quote";
    } else {
      const end = text.indexOf(",", i);
      cell = end === -1 ? text.slice(i) : text.slice(i, end);
      i = end === -1 ? text.length : end;
    }
    cells.push(cell);
    if (i >= text.length) return cells;
    i++;
  }
}

/**
 * Exact decimal → integer at a fixed scale (2 = cents, 3 = milli), by digits, never by float.
 * Extra fractional digits are refused unless they are zeros; nothing is rounded here.
 */
function scaled(raw: string, digits: 2 | 3): number | string {
  if (raw === "") return 0;
  const m = /^(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!m || (m[1] === "" && !m[2])) {
    if (raw.startsWith("=")) return "Formulas are not allowed. Enter the value.";
    return `Enter a plain number like ${digits === 2 ? "4.50" : "1200"}, with no $, commas, signs, or spaces.`;
  }
  const frac = m[2] ?? "";
  if (/[1-9]/.test(frac.slice(digits)))
    return `Use at most ${digits} decimal places.`;
  if (m[1].length > 12) return "That number is too large.";
  return (
    Number(m[1] || "0") * 10 ** digits +
    Number(frac.slice(0, digits).padEnd(digits, "0"))
  );
}

type Row = { line: number; cells: Record<Column, string> };

export function parseEstimateCsv(csv: string): ParseOutcome {
  if (csv.length > MAX_CSV_CHARS)
    return fail([
      {
        line: 0,
        column: "file",
        message: `The file is over ${MAX_CSV_CHARS.toLocaleString("en-US")} characters.`,
      },
    ]);
  const errors: RowError[] = [];
  const rows: Row[] = [];
  let sawHeader = false;
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const line = i + 1;
    const cells = splitCells(lines[i]);
    if (cells === "open-quote")
      return fail([
        {
          line,
          column: "file",
          message:
            "A quoted field is not closed on this line. Fields cannot contain line breaks.",
        },
      ]);
    if (!sawHeader) {
      sawHeader = true;
      const header =
        cells === "stray-quote"
          ? ""
          : cells.map((c) => c.trim().toLowerCase()).join(",");
      if (header !== ESTIMATE_COLUMNS.join(","))
        return fail([
          {
            line,
            column: "header",
            message: `The first line must be exactly: ${ESTIMATE_COLUMNS.join(",")}`,
          },
        ]);
      continue;
    }
    if (cells === "stray-quote") {
      errors.push({
        line,
        column: "file",
        message: "A closing quote must end its field.",
      });
      continue;
    }
    if (cells.length !== ESTIMATE_COLUMNS.length) {
      errors.push({
        line,
        column: "file",
        message: `Expected ${ESTIMATE_COLUMNS.length} columns, found ${cells.length}.`,
      });
      continue;
    }
    rows.push({
      line,
      cells: Object.fromEntries(
        ESTIMATE_COLUMNS.map((c, k) => [c, cells[k].trim()]),
      ) as Record<Column, string>,
    });
  }
  if (!sawHeader || (rows.length === 0 && errors.length === 0))
    return fail([
      { line: 0, column: "file", message: "The CSV has no cost items." },
    ]);

  const firstLine = new Map<string, number>();
  const unique: Row[] = [];
  for (const r of rows) {
    const code = r.cells.code;
    if (!CODE.test(code)) {
      errors.push({
        line: r.line,
        column: "code",
        code,
        message: code
          ? "A code is up to 40 letters, digits, '.', '_' or '-', starting with a letter or digit."
          : "Every row needs a code.",
      });
      continue;
    }
    const first = firstLine.get(code);
    if (first !== undefined) {
      errors.push({
        line: r.line,
        column: "code",
        code,
        message: `Code ${code} is already on line ${first}.`,
      });
      continue;
    }
    firstLine.set(code, r.line);
    unique.push(r);
  }

  const rowOf = new Map(unique.map((r) => [r.cells.code, r]));
  const parents = new Set(
    unique.map((r) => r.cells.parent_code).filter((p) => p !== ""),
  );

  const values = new Map<string, Omit<EstimateItem, "path" | "depth">>();
  for (const r of unique) {
    const c = r.cells;
    const err = (column: Column, message: string) =>
      errors.push({ line: r.line, column, code: c.code, message });
    if (!c.description) err("description", "A description is required.");
    else if (c.description.length > 500)
      err("description", "A description is at most 500 characters.");
    if (c.parent_code && !rowOf.has(c.parent_code))
      err("parent_code", `Parent ${c.parent_code} has no row in this file.`);
    const base = {
      code: c.code,
      parentCode: c.parent_code || null,
      description: c.description,
    };

    if (parents.has(c.code)) {
      const filled = MEASURES.find((m) => c[m] !== "");
      if (filled) err(filled, "Costs and quantities belong on leaf cost items.");
      values.set(c.code, {
        ...base,
        isLeaf: false,
        unit: "",
        qtyMilli: 0,
        mhPerUnitMilli: 0,
        ce: emptyCategories(),
      });
      continue;
    }

    const unit = c.unit.toUpperCase();
    if (!unit) err("unit", "A leaf needs a unit.");
    else if (!(ESTIMATE_UNITS as readonly string[]).includes(unit))
      err("unit", `Unit ${c.unit} is not on the unit list: ${ESTIMATE_UNITS.join(", ")}.`);
    const number = (column: Column, digits: 2 | 3) => {
      const v = scaled(c[column], digits);
      if (typeof v === "number") return v;
      err(column, v);
      return 0;
    };
    const qtyMilli = number("qty", 3);
    const mhPerUnitMilli = number("mh_per_unit", 3);
    const rates = emptyCategories();
    for (const [column, key] of UNIT_COSTS) {
      rates[key] = number(column, 2);
      if (!Number.isSafeInteger(qtyMilli * rates[key]))
        err(column, "Quantity × unit cost is too large to store exactly.");
    }
    values.set(c.code, {
      ...base,
      isLeaf: true,
      unit,
      qtyMilli,
      mhPerUnitMilli,
      ce: categoriesFromUnitCosts(qtyMilli, rates),
    });
  }

  // Parent links are by code, not file order. Walk each chain up to a placed node or a root.
  const placed = new Map<string, { path: string; depth: number }>();
  const looped = new Set<string>();
  for (const r of unique) {
    const chain: string[] = [];
    let at: string | null = r.cells.code;
    while (at && !placed.has(at) && rowOf.has(at) && !chain.includes(at)) {
      chain.push(at);
      at = rowOf.get(at)!.cells.parent_code || null;
    }
    if (at && chain.includes(at)) {
      const loop = chain.slice(chain.indexOf(at));
      for (const code of loop) {
        if (looped.has(code)) continue;
        looped.add(code);
        errors.push({
          line: rowOf.get(code)!.line,
          column: "parent_code",
          code,
          message: `Parent links loop: ${[...loop, loop[0]].join(" → ")}.`,
        });
      }
      continue;
    }
    if (at && !placed.has(at)) continue;
    let up = at ? placed.get(at)! : { path: "/", depth: -1 };
    for (let k = chain.length - 1; k >= 0; k--) {
      up = { path: `${up.path}${chain[k]}/`, depth: up.depth + 1 };
      placed.set(chain[k], up);
    }
  }

  if (errors.length) return fail(errors);
  const nodes: ForestNode[] = unique
    .map((r) => ({
      ...values.get(r.cells.code)!,
      ...placed.get(r.cells.code)!,
      line: r.line,
    }))
    .sort((a, b) => byCode(a.path, b.path));
  const forest = {} as CostForest;
  forests.set(forest, nodes);
  return { ok: true, forest };
}

function totalsOf(nodes: readonly EstimateItem[]): EstimateTotals {
  const categories = emptyCategories();
  let leafCount = 0;
  let mhMilli = 0;
  for (const n of nodes) {
    if (!n.isLeaf) continue;
    leafCount++;
    mhMilli += manHoursMilli(n.qtyMilli, n.mhPerUnitMilli);
    for (const k of Object.keys(categories) as (keyof CostCategories)[])
      categories[k] += n.ce[k];
  }
  return {
    itemCount: nodes.length,
    leafCount,
    ceCents: categoryTotal(categories),
    categories,
    mhMilli,
  };
}

export function forestTotals(forest: CostForest): EstimateTotals {
  return totalsOf(nodesOf(forest));
}

/** Field history that a cascade delete would destroy. */
export type HistoryKind =
  | "costEntries"
  | "planLines"
  | "milestones"
  | "pmPercentLogs"
  | "milestoneLogs";

const HISTORY_NAMES: Record<HistoryKind, readonly [string, string]> = {
  costEntries: ["cost entry", "cost entries"],
  planLines: ["daily plan line", "daily plan lines"],
  milestones: ["milestone", "milestones"],
  pmPercentLogs: ["PM percent log", "PM percent logs"],
  milestoneLogs: ["milestone log", "milestone logs"],
};

export type ExistingCostItem = EstimateItem & {
  id: string;
  /** Counts by kind; empty when nothing hangs off this id. */
  history: Partial<Record<HistoryKind, number>>;
};

type CostItemRow = {
  id: string;
  parentId: string | null;
  code: string;
  path: string;
  depth: number;
  isLeaf: boolean;
  description: string;
  unit: string;
  budgetQtyMilli: number;
  budgetMhPerUnitMilli: number;
  ceLaborCents: number;
  ceMaterialCents: number;
  ceEquipmentCents: number;
  ceSubCents: number;
};

/** One job's stored cost items as reconcileByCode compares them: parent ids become codes. */
export function existingCostItems(
  rows: readonly CostItemRow[],
  history: ReadonlyMap<string, ExistingCostItem["history"]> = new Map(),
): ExistingCostItem[] {
  const codeOf = new Map(rows.map((r) => [r.id, r.code]));
  return rows.map((r) => {
    const parentCode = r.parentId === null ? null : codeOf.get(r.parentId);
    if (parentCode === undefined)
      throw new Error(`corrupt cost item snapshot: ${r.code} has a parent off the job`);
    return {
      id: r.id,
      code: r.code,
      parentCode,
      path: r.path,
      depth: r.depth,
      isLeaf: r.isLeaf,
      description: r.description,
      unit: r.unit,
      qtyMilli: r.budgetQtyMilli,
      mhPerUnitMilli: r.budgetMhPerUnitMilli,
      ce: ceCategories(r),
      history: history.get(r.id) ?? {},
    };
  });
}

const historyText = (h: ExistingCostItem["history"]) =>
  (Object.entries(h) as [HistoryKind, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${HISTORY_NAMES[k][n === 1 ? 0 : 1]}`)
    .join(", ");

export type Change =
  | "parent"
  | "path"
  | "role"
  | "description"
  | "unit"
  | "qty"
  | "mh"
  | "ce";

const CHANGES: readonly (readonly [
  Change,
  (was: EstimateItem, want: EstimateItem) => boolean,
])[] = [
  ["parent", (a, b) => a.parentCode !== b.parentCode],
  ["path", (a, b) => a.path !== b.path || a.depth !== b.depth],
  ["role", (a, b) => a.isLeaf !== b.isLeaf],
  ["description", (a, b) => a.description !== b.description],
  ["unit", (a, b) => a.unit !== b.unit],
  ["qty", (a, b) => a.qtyMilli !== b.qtyMilli],
  ["mh", (a, b) => a.mhPerUnitMilli !== b.mhPerUnitMilli],
  [
    "ce",
    (a, b) =>
      a.ce.laborCents !== b.ce.laborCents ||
      a.ce.materialCents !== b.ce.materialCents ||
      a.ce.equipmentCents !== b.ce.equipmentCents ||
      a.ce.subCents !== b.ce.subCents,
  ],
];

/** Moves or flips that would orphan field history on an id. */
const MOVES: Partial<Record<Change, string>> = {
  parent: "move to a different parent",
  role: "switch between leaf and summary",
};

export type ReconcileStep =
  | ({ kind: "insert" } & EstimateItem)
  | ({ kind: "revise"; id: string; changed: readonly Change[] } & EstimateItem)
  | { kind: "remove"; id: string; code: string; depth: number };

export type ReconcilePlan = {
  /**
   * Apply in this order. Inserts and revises go shallow to deep so a parent exists before its child;
   * removes go deep to shallow so the parent_id cascade never takes a child the file kept.
   */
  steps: readonly ReconcileStep[];
  unchangedIds: readonly string[];
  totals: EstimateTotals;
};

export type ReconcileOutcome =
  | { ok: true; plan: ReconcilePlan }
  | { ok: false; errors: readonly RowError[] };

export function reconcileByCode(
  existing: readonly ExistingCostItem[],
  forest: CostForest,
): ReconcileOutcome {
  const nodes = nodesOf(forest);
  const was = new Map<string, ExistingCostItem>();
  for (const e of existing) {
    if (was.has(e.code) || e.code.includes("/"))
      throw new Error(`corrupt cost item snapshot at code ${e.code}`);
    was.set(e.code, e);
  }

  const errors: RowError[] = [];
  const writes: Extract<ReconcileStep, { kind: "insert" | "revise" }>[] = [];
  const unchangedIds: string[] = [];
  for (const { line, ...want } of nodes) {
    const e = was.get(want.code);
    if (!e) {
      writes.push({ kind: "insert", ...want });
      continue;
    }
    const changed = CHANGES.filter(([, differs]) => differs(e, want)).map(
      ([c]) => c,
    );
    if (!changed.length) {
      unchangedIds.push(e.id);
      continue;
    }
    const move = changed.find((c) => MOVES[c]);
    const history = historyText(e.history);
    if (move && history) {
      errors.push({
        line,
        column: move === "parent" ? "parent_code" : "code",
        code: e.code,
        message: `${e.code} has ${history}, so it cannot ${MOVES[move]}.`,
      });
      continue;
    }
    writes.push({ kind: "revise", id: e.id, changed, ...want });
  }

  const inFile = new Set(nodes.map((n) => n.code));
  const removes: Extract<ReconcileStep, { kind: "remove" }>[] = [];
  for (const e of existing) {
    if (inFile.has(e.code)) continue;
    const history = historyText(e.history);
    if (history) {
      errors.push({
        line: 0,
        column: "code",
        code: e.code,
        message: `${e.code} has ${history}, so the file cannot leave it out.`,
      });
      continue;
    }
    removes.push({ kind: "remove", id: e.id, code: e.code, depth: e.depth });
  }
  if (errors.length) return fail(errors);

  writes.sort((a, b) => a.depth - b.depth || byCode(a.code, b.code));
  removes.sort((a, b) => b.depth - a.depth || byCode(a.code, b.code));
  return {
    ok: true,
    plan: { steps: [...writes, ...removes], unchangedIds, totals: totalsOf(nodes) },
  };
}

/**
 * Columns for a newly inserted cost item, shared by import and the Harbor seed.
 * Current Estimate only: Original and Current Budget start at 0 until Approve.
 */
export function insertColumns(item: EstimateItem) {
  return {
    code: item.code,
    path: item.path,
    depth: item.depth,
    isLeaf: item.isLeaf,
    description: item.description,
    unit: item.unit,
    evMethod: "units" as const,
    forecastMethod: "current_budget" as const,
    budgetQtyMilli: item.qtyMilli,
    budgetMhPerUnitMilli: item.mhPerUnitMilli,
    installedQtyMilli: 0,
    claimedInstalledQtyMilli: 0,
    plannedCents: 0,
    actualCents: 0,
    lockedActualCents: 0,
    claimedPercentMilli: 0,
    earnDerivation: "",
    ...valueSetColumns(item.ce, "draft"),
  };
}

export type ImportResult =
  | {
      ok: true;
      jobNumber: string;
      shortName: string;
      inserted: number;
      revised: number;
      removed: number;
      unchanged: number;
      totals: EstimateTotals;
      /** Ids on the job before and after: revised plus unchanged. */
      preservedIds: readonly string[];
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "already_approved"
        | "locked_claim"
        | "invalid_csv"
        | "field_history";
      jobNumber: string;
      shortName?: string;
      errors: readonly RowError[];
    };

const SHOWN_ERRORS = 20;

/** The one sentence the rail, the job page, and the audit log show for an import. */
export function summarizeImport(r: ImportResult): string {
  if (r.ok) {
    const t = r.totals;
    return (
      `Imported the estimate on ${r.shortName}: Current Estimate ${usdShort(t.ceCents)} (${t.ceCents}¢) ` +
      `across ${t.leafCount} leaves, ${t.itemCount} cost items, ${mh(t.mhMilli)} MH. ` +
      `${r.revised} updated, ${r.inserted} added, ${r.removed} removed, ${r.unchanged} unchanged. ` +
      `Approve freezes it as Original Budget.`
    );
  }
  switch (r.reason) {
    case "not_found":
      return `There is no job ${r.jobNumber} in this sandbox.`;
    case "already_approved":
      return `${r.shortName}'s estimate is already approved. Original Budget is frozen — use a change order to revise Current Budget.`;
    case "locked_claim":
      return `${r.shortName} has a locked progress claim. Import wrote nothing.`;
    case "invalid_csv":
    case "field_history": {
      const n = r.errors.length;
      const listed = r.errors
        .slice(0, SHOWN_ERRORS)
        .map((e) =>
          e.line > 0 ? `line ${e.line} ${e.column}: ${e.message}` : e.message,
        )
        .join("; ");
      const more = n > SHOWN_ERRORS ? `; and ${n - SHOWN_ERRORS} more.` : "";
      return `Imported nothing on ${r.shortName}. ${n} ${n === 1 ? "error" : "errors"}: ${listed}${more}`;
    }
  }
}
