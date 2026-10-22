import { describe, expect, it } from "vitest";
import {
  approveTotalsGuard,
  categoriesFromUnitCosts,
  categoryCostCents,
  categoryTotal,
  ROUNDING_FIXTURE,
  roundHalfAwayFromZero,
  SHB_FIXTURE,
  valueSetColumns,
} from "./budget";

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
});
