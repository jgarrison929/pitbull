import { describe, expect, it } from "vitest";
import {
  COST_TYPE_LABELS,
  COST_TYPE_OPTIONS,
  CostType,
  costTypeLabel,
  isSelfPerformLabor,
  isSubRelatedCostType,
} from "./cost-type";

describe("CostType enum stability", () => {
  it("keeps wire values used by API / DB", () => {
    expect(CostType.Labor).toBe(1);
    expect(CostType.Material).toBe(2);
    expect(CostType.Equipment).toBe(3);
    expect(CostType.Subcontract).toBe(4);
    expect(CostType.Other).toBe(5);
    expect(CostType.Overhead).toBe(6);
    expect(CostType.SubLabor).toBe(7);
    expect(CostType.SubMaterial).toBe(8);
    expect(CostType.SubThirdParty).toBe(9);
  });
});

describe("costTypeLabel", () => {
  it("uses super-facing job-cost language", () => {
    expect(costTypeLabel(CostType.Labor)).toBe("Labor");
    expect(costTypeLabel(CostType.SubLabor)).toBe("Sub Labor");
    expect(costTypeLabel(CostType.SubMaterial)).toBe("Sub Material");
    expect(costTypeLabel(CostType.SubThirdParty)).toBe("Sub Third Party");
    expect(costTypeLabel(CostType.Overhead)).toBe("Overhead");
    expect(costTypeLabel(CostType.Subcontract)).toBe("Sub (general)");
  });

  it("accepts numeric wire values from API", () => {
    expect(costTypeLabel(7)).toBe("Sub Labor");
    expect(costTypeLabel("6")).toBe("Overhead");
  });
});

describe("isSubRelatedCostType", () => {
  it("groups legacy and split sub classes", () => {
    expect(isSubRelatedCostType(CostType.Subcontract)).toBe(true);
    expect(isSubRelatedCostType(CostType.SubLabor)).toBe(true);
    expect(isSubRelatedCostType(CostType.Labor)).toBe(false);
  });
});

describe("isSelfPerformLabor", () => {
  it("is only CostType.Labor for crew time pickers", () => {
    expect(isSelfPerformLabor(CostType.Labor)).toBe(true);
    expect(isSelfPerformLabor(CostType.SubLabor)).toBe(false);
  });
});

describe("COST_TYPE_OPTIONS", () => {
  it("includes every label key and puts sub splits before legacy Subcontract", () => {
    for (const t of Object.keys(COST_TYPE_LABELS).map(Number)) {
      expect(COST_TYPE_OPTIONS).toContain(t);
    }
    const subLab = COST_TYPE_OPTIONS.indexOf(CostType.SubLabor);
    const legacy = COST_TYPE_OPTIONS.indexOf(CostType.Subcontract);
    expect(subLab).toBeLessThan(legacy);
  });
});
