import { describe, expect, it } from "vitest";
import { SHB_CSV, SHB_FIXTURE } from "./budget";
import {
  ESTIMATE_COLUMNS,
  forestTotals,
  importErrorLines,
  parseEstimateCsv,
  reconcileByCode,
  summarizeImport,
  type CostForest,
  type ExistingCostItem,
  type ReconcilePlan,
  type RowError,
} from "./estimate-reconcile";

const HEADER = ESTIMATE_COLUMNS.join(",");
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

function forest(text: string): CostForest {
  const p = parseEstimateCsv(text);
  if (!p.ok) throw new Error(p.errors.map((e) => `${e.line} ${e.column}: ${e.message}`).join("; "));
  return p.forest;
}

function errorsOf(text: string): readonly RowError[] {
  const p = parseEstimateCsv(text);
  if (p.ok) throw new Error("expected the CSV to be refused");
  return p.errors;
}

function plan(existing: readonly ExistingCostItem[], text: string): ReconcilePlan {
  const r = reconcileByCode(existing, forest(text));
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r.plan;
}

/** What the job holds after a plan is applied, with inserted ids named `new:<code>`. */
function applied(existing: readonly ExistingCostItem[], p: ReconcilePlan): ExistingCostItem[] {
  const rows = new Map(existing.map((e) => [e.id, e]));
  for (const s of p.steps) {
    if (s.kind === "remove") {
      rows.delete(s.id);
      continue;
    }
    const id = s.kind === "insert" ? `new:${s.code}` : s.id;
    rows.set(id, { ...s, id, history: rows.get(id)?.history ?? {} });
  }
  return [...rows.values()];
}

const kinds = (p: ReconcilePlan) => p.steps.map((s) => `${s.kind} ${s.code}`);

const shbOnEmptyJob = () => applied([], plan([], SHB_CSV));

/** Harbor as seeded before CSV import existed: summaries stored with unit LS. */
const harborWithLsSummaries = () =>
  shbOnEmptyJob().map((e) => (e.isLeaf ? e : { ...e, unit: "LS" }));

describe("parseEstimateCsv", () => {
  it("SHB fixture: 6 items, 4 leaves, $86,750.00, category split, 304 MH", () => {
    expect(forestTotals(forest(SHB_CSV))).toEqual({
      itemCount: 6,
      leafCount: 4,
      ceCents: SHB_FIXTURE.jobTotalCents,
      categories: SHB_FIXTURE.categories,
      mhMilli: SHB_FIXTURE.jobMhMilli,
    });
  });

  it("each leaf's Current Estimate matches the hand-computed table; summaries carry no money", () => {
    const items = new Map(
      plan([], SHB_CSV).steps.map((s) => [s.code, s] as const),
    );
    for (const leaf of SHB_FIXTURE.leaves) {
      const s = items.get(leaf.code)!;
      if (s.kind === "remove") throw new Error("unexpected remove");
      expect(s.ce).toEqual({
        laborCents: leaf.expected.laborCents,
        materialCents: leaf.expected.materialCents,
        equipmentCents: leaf.expected.equipmentCents,
        subCents: leaf.expected.subCents,
      });
      expect(s).toMatchObject({ unit: leaf.unit, qtyMilli: leaf.qtyMilli, isLeaf: true, depth: 1 });
    }
    expect(items.get("02")).toMatchObject({
      isLeaf: false,
      unit: "",
      qtyMilli: 0,
      path: "/02/",
      ce: { laborCents: 0, materialCents: 0, equipmentCents: 0, subCents: 0 },
    });
    expect(items.get("02-100")).toMatchObject({ path: "/02/02-100/", parentCode: "02" });
  });

  it("check 3: $ in a quantity and a duplicate code refuse the file with line and column", () => {
    const bad = SHB_CSV.replace("CY,800,", "CY,$800,").replace(
      "03-100,03,Footing concrete,CY,150,1.2,72.00,165.00,0,0\n",
      "03-100,03,Footing concrete,CY,150,1.2,72.00,165.00,0,0\n03-100,03,Footing concrete,CY,150,1.2,72.00,165.00,0,0\n",
    );
    const errors = errorsOf(bad);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({ line: 4, column: "qty", code: "02-200" });
    expect(errors[0].message).toMatch(/no \$/);
    expect(errors[1]).toMatchObject({ line: 7, column: "code", code: "03-100" });
    expect(errors[1].message).toBe("Code 03-100 is already on line 6.");
  });

  it("check 4: a unit cost on a summary is refused on that row", () => {
    const errors = errorsOf(SHB_CSV.replace("02,,Earthwork,,,,,,,", "02,,Earthwork,,,,10.00,,,"));
    expect(errors).toEqual([
      {
        line: 2,
        column: "labor_unit",
        code: "02",
        message: "Costs and quantities belong on leaf cost items.",
      },
    ]);
  });

  it("check 10: qty 0.333 × $0.05 labor is 2 cents; totals sum rounded categories", () => {
    const f = forest(csv("R-1,,Rounding case,EA,0.333,0,0.05,0.05,0,0"));
    expect(forestTotals(f)).toMatchObject({
      ceCents: 4,
      categories: { laborCents: 2, materialCents: 2, equipmentCents: 0, subCents: 0 },
    });
  });

  it("check 11: cy and CY are one unit; an unlisted unit refuses the file", () => {
    const steps = plan([], csv("A,,Cut,cy,1,0,1,0,0,0", "B,,Fill,CY,1,0,1,0,0,0")).steps;
    expect(steps.map((s) => s.kind !== "remove" && s.unit)).toEqual(["CY", "CY"]);
    const errors = errorsOf(csv("A,,Cut,CUYD,1,0,1,0,0,0"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 2, column: "unit" });
  });

  it("refuses digits past the scale instead of rounding them; trailing zeros are exact", () => {
    expect(errorsOf(csv("A,,x,EA,1,0,1.665,0,0,0"))[0]).toMatchObject({
      column: "labor_unit",
      message: "Use at most 2 decimal places.",
    });
    expect(errorsOf(csv("A,,x,EA,0.3334,0,1,0,0,0"))[0]).toMatchObject({ column: "qty" });
    expect(forestTotals(forest(csv("A,,x,EA,2.0000,0,4.500,0,0,0"))).ceCents).toBe(900);
  });

  it("refuses formulas, signs, and thousands separators", () => {
    expect(errorsOf(csv("A,,x,EA,=2*3,0,1,0,0,0"))[0].message).toMatch(/Formulas/);
    expect(errorsOf(csv("A,,x,EA,-2,0,1,0,0,0"))[0].column).toBe("qty");
    expect(errorsOf(csv('A,,x,EA,"1,200",0,1,0,0,0'))[0].column).toBe("qty");
  });

  it("blank numbers on a leaf are zero; a leaf still needs a unit", () => {
    expect(forestTotals(forest(csv("A,,Allowance,LS,,,,,,")))).toMatchObject({
      leafCount: 1,
      ceCents: 0,
      mhMilli: 0,
    });
    expect(errorsOf(csv("A,,Allowance,,1,0,1,0,0,0"))[0]).toMatchObject({
      column: "unit",
      message: "A leaf needs a unit.",
    });
  });

  it("refuses a parent loop, a missing parent, and a self-parent on every code involved", () => {
    const loop = errorsOf(csv("A,B,a,,,,,,,", "B,A,b,,,,,,,", "C,A,c,EA,1,0,0,0,0,0"));
    expect(loop.map((e) => [e.line, e.code])).toEqual([
      [2, "A"],
      [3, "B"],
    ]);
    expect(loop[0].message).toBe("Parent links loop: A → B → A.");
    expect(errorsOf(csv("A,Z,a,EA,1,0,0,0,0,0"))[0]).toMatchObject({
      column: "parent_code",
      message: "Parent Z has no row in this file.",
    });
    expect(errorsOf(csv("A,A,a,EA,1,0,0,0,0,0"))[0].message).toBe("Parent links loop: A → A.");
  });

  it("refuses a wrong header, an empty file, and a code with a slash", () => {
    expect(errorsOf("code,parent,description\nA,,x")).toEqual([
      expect.objectContaining({ line: 1, column: "header" }),
    ]);
    expect(errorsOf("")[0].message).toBe("The CSV has no cost items.");
    expect(errorsOf(`${HEADER}\n\n`)[0].message).toBe("The CSV has no cost items.");
    expect(errorsOf(csv("02/100,,x,EA,1,0,0,0,0,0"))[0].column).toBe("code");
    expect(errorsOf(csv("A,,,EA,1,0,0,0,0,0"))[0]).toMatchObject({
      column: "description",
      message: "A description is required.",
    });
  });

  it("reads quoted commas, a BOM, and CRLF; refuses a line break inside quotes", () => {
    const f = forest(`\uFEFF${HEADER}\r\nA,,"Pipe, 18 in",LF,10,0,2.00,0,0,0\r\n`);
    expect(plan([], `${HEADER}\nA,,"Pipe, 18 in",LF,10,0,2.00,0,0,0`).steps[0]).toMatchObject({
      description: "Pipe, 18 in",
    });
    expect(forestTotals(f).ceCents).toBe(2_000);
    expect(errorsOf(`${HEADER}\nA,,"Pipe\n18 in",LF,10,0,2.00,0,0,0`)).toEqual([
      expect.objectContaining({ line: 2, column: "file" }),
    ]);
  });

  it("a forest that did not come from the parser is refused", () => {
    expect(() => reconcileByCode([], {} as CostForest)).toThrow(/parseEstimateCsv/);
  });
});

describe("reconcileByCode", () => {
  it("an empty job gets inserts, parents before children", () => {
    expect(kinds(plan([], SHB_CSV))).toEqual([
      "insert 02",
      "insert 03",
      "insert 02-100",
      "insert 02-200",
      "insert 03-100",
      "insert 03-200",
    ]);
  });

  it("check 5: a second identical import is an empty plan with the same totals", () => {
    const job = shbOnEmptyJob();
    const again = plan(job, SHB_CSV);
    expect(again.steps).toEqual([]);
    expect(again.unchangedIds).toHaveLength(6);
    expect(again.totals.ceCents).toBe(SHB_FIXTURE.jobTotalCents);
  });

  it("Harbor with LS summaries: two unit revises keep their ids, four leaves unchanged", () => {
    const harbor = harborWithLsSummaries();
    const p = plan(harbor, SHB_CSV);
    expect(p.steps).toEqual([
      expect.objectContaining({ kind: "revise", code: "02", id: "new:02", changed: ["unit"] }),
      expect.objectContaining({ kind: "revise", code: "03", id: "new:03", changed: ["unit"] }),
    ]);
    expect(p.unchangedIds).toHaveLength(4);
    expect(plan(applied(harbor, p), SHB_CSV).steps).toEqual([]);
  });

  it("a quantity change revises that leaf in place", () => {
    const p = plan(shbOnEmptyJob(), SHB_CSV.replace("CY,1200,", "CY,1000,"));
    expect(p.steps).toEqual([
      expect.objectContaining({
        kind: "revise",
        id: "new:02-100",
        changed: ["qty", "ce"],
        ce: { laborCents: 450_000, materialCents: 0, equipmentCents: 625_000, subCents: 0 },
      }),
    ]);
    expect(p.totals.ceCents).toBe(8_460_000);
  });

  it("dropping a summary reparents its leaves before the summary is removed", () => {
    const flat = SHB_CSV.replace("02,,Earthwork,,,,,,,\n", "")
      .replace("02-100,02,", "02-100,,")
      .replace("02-200,02,", "02-200,,");
    const p = plan(shbOnEmptyJob(), flat);
    expect(kinds(p)).toEqual(["revise 02-100", "revise 02-200", "remove 02"]);
    expect(p.steps[0]).toMatchObject({ parentCode: null, path: "/02-100/", depth: 0, changed: ["parent", "path"] });
  });

  it("adding an ancestor inserts it before the leaf moves under it", () => {
    const flatJob = applied([], plan([], csv("02-100,,Excavation,CY,1200,0.05,4.50,0,6.25,0")));
    const p = plan(flatJob, csv("02,,Earthwork,,,,,,,", "02-100,02,Excavation,CY,1200,0.05,4.50,0,6.25,0"));
    expect(kinds(p)).toEqual(["insert 02", "revise 02-100"]);
    expect(p.steps[1]).toMatchObject({ id: "new:02-100", path: "/02/02-100/", depth: 1 });
  });

  it("removes go child first, then parent", () => {
    const p = plan(shbOnEmptyJob(), csv("02,,Earthwork,,,,,,,", "02-100,02,Excavation,CY,1200,0.05,4.50,0,6.25,0", "02-200,02,Structural backfill,CY,800,0.08,5.00,18.00,3.50,0"));
    expect(kinds(p)).toEqual(["remove 03-100", "remove 03-200", "remove 03"]);
  });

  it("a code with field history cannot be dropped or moved, but its values can change", () => {
    const job = shbOnEmptyJob().map((e) =>
      e.code === "02-100" ? { ...e, history: { costEntries: 2, planLines: 1 } } : e,
    );
    const dropped = reconcileByCode(job, forest(SHB_CSV.replace(/^02-100,.*\n/m, "")));
    expect(dropped).toEqual({
      ok: false,
      errors: [
        {
          line: 0,
          column: "code",
          code: "02-100",
          message: "02-100 has 2 cost entries, 1 daily plan line, so the file cannot leave it out.",
        },
      ],
    });
    const moved = reconcileByCode(job, forest(SHB_CSV.replace("02-100,02,", "02-100,03,")));
    expect(moved.ok).toBe(false);
    if (!moved.ok)
      expect(moved.errors[0]).toMatchObject({ line: 3, column: "parent_code", code: "02-100" });
    const renamed = plan(job, SHB_CSV.replace("Excavation", "Mass excavation"));
    expect(renamed.steps).toEqual([
      expect.objectContaining({ kind: "revise", id: "new:02-100", changed: ["description"] }),
    ]);
  });
});

describe("summarizeImport", () => {
  const totals = {
    itemCount: 6,
    leafCount: 4,
    ceCents: SHB_FIXTURE.jobTotalCents,
    categories: SHB_FIXTURE.categories,
    mhMilli: SHB_FIXTURE.jobMhMilli,
  };

  it("success names ordinary dollars and the change counts", () => {
    expect(
      summarizeImport({
        ok: true,
        jobNumber: "26-010",
        shortName: "Harbor Abutment",
        inserted: 0,
        revised: 1,
        removed: 0,
        unchanged: 5,
        totals,
        preservedIds: [],
      }),
    ).toBe(
      "Imported the estimate on Harbor Abutment: Current Estimate $86,750.00 across 4 leaves, 6 cost items, 304.0 MH. 1 updated, 0 added, 0 removed, 5 unchanged. Approve freezes it as Original Budget.",
    );
    expect(
      summarizeImport({
        ok: true,
        jobNumber: "26-010",
        shortName: "Harbor Abutment",
        inserted: 0,
        revised: 1,
        removed: 0,
        unchanged: 5,
        totals,
        preservedIds: [],
      }),
    ).not.toMatch(/¢/);
  });

  it("refusal summary points at the error list; lines are capped at 20", () => {
    const errors = Array.from({ length: 25 }, (_, i) => ({
      line: i + 2,
      column: "qty" as const,
      message: "Use at most 3 decimal places.",
    }));
    const s = summarizeImport({
      ok: false,
      reason: "invalid_csv",
      jobNumber: "26-010",
      shortName: "Harbor Abutment",
      errors,
    });
    expect(s).toBe(
      "Imported nothing on Harbor Abutment. 25 errors — see the list below. (5 more not listed).",
    );
    const lines = importErrorLines(errors);
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe("Line 2 · qty: Use at most 3 decimal places.");
    expect(lines.at(-1)).toMatch(/^Line 21 · qty:/);
  });
});
