import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  approveTotalsGuard,
  buildWbsMoney,
  categoriesFromUnitCosts,
  categoryCostCents,
  categoryTotal,
  ceOnlyColumns,
  currentBudgetCents,
  ROUNDING_FIXTURE,
  roundHalfAwayFromZero,
  SHB_CSV,
  SHB_FIXTURE,
  valueSetColumns,
} from "./budget";
import {
  insertColumns,
  parseEstimateCsv,
  reconcileByCode,
} from "./estimate-reconcile";

/** SHB as cost-item rows, the way import or the seed writes them, frozen or not. */
function shbRows(mode: "draft" | "approved") {
  const parsed = parseEstimateCsv(SHB_CSV);
  if (!parsed.ok) throw new Error("SHB_CSV must parse");
  const diff = reconcileByCode([], parsed.forest);
  if (!diff.ok) throw new Error("SHB_CSV must plan");
  return diff.plan.steps.map((s) => {
    if (s.kind === "remove") throw new Error("unexpected remove");
    return {
      id: `id:${s.code}`,
      ...insertColumns(s),
      ...valueSetColumns(s.ce, mode),
    };
  });
}

describe("integer cents budget math", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfAwayFromZero(1.665)).toBe(2);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(-1.665)).toBe(-2);
    expect(roundHalfAwayFromZero(0.4)).toBe(0);
  });

  it("rounding fixture: qty 0.333 × $0.05 labor → 2 cents", () => {
    expect(
      categoryCostCents(
        ROUNDING_FIXTURE.qtyMilli,
        ROUNDING_FIXTURE.laborUnitCents,
      ),
    ).toBe(ROUNDING_FIXTURE.expectedLaborCents);
  });

  it("SHB fixture leaf totals match the hand-computed table", () => {
    let labor = 0;
    let material = 0;
    let equipment = 0;
    let sub = 0;
    let mh = 0;
    for (const leaf of SHB_FIXTURE.leaves) {
      const cats = categoriesFromUnitCosts(leaf.qtyMilli, leaf.units);
      expect(cats).toEqual({
        laborCents: leaf.expected.laborCents,
        materialCents: leaf.expected.materialCents,
        equipmentCents: leaf.expected.equipmentCents,
        subCents: leaf.expected.subCents,
      });
      expect(categoryTotal(cats)).toBe(leaf.expected.totalCents);
      labor += cats.laborCents;
      material += cats.materialCents;
      equipment += cats.equipmentCents;
      sub += cats.subCents;
      mh += leaf.expected.mhMilli;
    }
    expect(labor).toBe(SHB_FIXTURE.categories.laborCents);
    expect(material).toBe(SHB_FIXTURE.categories.materialCents);
    expect(equipment).toBe(SHB_FIXTURE.categories.equipmentCents);
    expect(sub).toBe(SHB_FIXTURE.categories.subCents);
    expect(labor + material + equipment + sub).toBe(SHB_FIXTURE.jobTotalCents);
    expect(mh).toBe(SHB_FIXTURE.jobMhMilli);
  });

  it("approve refuses when estimate and budget differ by one cent", () => {
    const ok = approveTotalsGuard(8_675_000, 8_675_000);
    expect(ok).toEqual({ ok: true });
    const bad = approveTotalsGuard(8_675_000, 8_674_999);
    expect(bad).toEqual({
      ok: false,
      estimateTotalCents: 8_675_000,
      budgetTotalCents: 8_674_999,
    });
  });

  it("draft value sets leave OB/CB at zero; approved freezes all three", () => {
    const cats = {
      laborCents: 100,
      materialCents: 200,
      equipmentCents: 0,
      subCents: 50,
    };
    const draft = valueSetColumns(cats, "draft");
    expect(draft.ceLaborCents).toBe(100);
    expect(draft.obLaborCents).toBe(0);
    expect(draft.cbMaterialCents).toBe(0);
    const approved = valueSetColumns(cats, "approved");
    expect(approved.obLaborCents).toBe(100);
    expect(approved.cbMaterialCents).toBe(200);
    expect(approved.ceSubCents).toBe(50);
  });

  it("revising an estimate writes Current Estimate columns and nothing else", () => {
    expect(
      ceOnlyColumns({ laborCents: 1, materialCents: 2, equipmentCents: 3, subCents: 4 }),
    ).toEqual({
      ceLaborCents: 1,
      ceMaterialCents: 2,
      ceEquipmentCents: 3,
      ceSubCents: 4,
    });
  });
});

describe("WBS money roll-ups", () => {
  it("check 2: summaries sum their leaves' money and MH; quantities do not roll up", () => {
    const rows = shbRows("draft");
    const { byId, job } = buildWbsMoney(rows);
    expect(byId["id:02"]).toMatchObject({ ceCents: 3_410_000, mhMilli: 124_000, qtyMilli: null });
    expect(byId["id:03"]).toMatchObject({ ceCents: 5_265_000, mhMilli: 180_000, qtyMilli: null });
    expect(byId["id:02-100"]).toMatchObject({ ceCents: 1_290_000, mhMilli: 60_000, qtyMilli: 1_200_000 });
    expect(job).toMatchObject({
      obCents: 0,
      cbCents: 0,
      ceCents: SHB_FIXTURE.jobTotalCents,
      ce: SHB_FIXTURE.categories,
      mhMilli: SHB_FIXTURE.jobMhMilli,
      qtyMilli: null,
    });
  });

  it("approved: Original, Current, and Estimate agree at every node; job Current equals the leaf sum", () => {
    const rows = shbRows("approved");
    const { byId, job } = buildWbsMoney(rows);
    for (const m of Object.values(byId)) {
      expect(m.obCents).toBe(m.ceCents);
      expect(m.cbCents).toBe(m.ceCents);
    }
    expect(job.cbCents).toBe(
      rows.filter((r) => r.isLeaf).reduce((s, r) => s + currentBudgetCents(r), 0),
    );
    expect(job.obCents).toBe(SHB_FIXTURE.jobTotalCents);
  });

  it("money stored on a summary row is not counted twice", () => {
    const rows = shbRows("draft").map((r) =>
      r.code === "02" ? { ...r, ceLaborCents: 999_999 } : r,
    );
    expect(buildWbsMoney(rows).byId["id:02"].ceCents).toBe(3_410_000);
    expect(buildWbsMoney(rows).job.ceCents).toBe(SHB_FIXTURE.jobTotalCents);
  });
});

describe("SHB fixture CSV does not drift", () => {
  it("matches the spec's CSV block and the e2e fixture file", () => {
    const spec = readFileSync(
      new URL("../../../docs/v5/intel/estimate-to-budget.md", import.meta.url),
      "utf8",
    );
    expect(spec).toContain("```csv\n" + SHB_CSV + "```");
    expect(
      readFileSync(new URL("../../tests/fixtures/shb-estimate.csv", import.meta.url), "utf8"),
    ).toBe(SHB_CSV);
  });
});
