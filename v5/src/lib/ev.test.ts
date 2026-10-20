import { describe, expect, it } from "vitest";
import { costLine, rollup } from "./ev";

const base = {
  code: "x",
  description: "x",
  unit: "CY",
  budgetMhPerUnitMilli: 0,
};

describe("earned value", () => {
  // Hand-computed: 600 of 1,000 CY on a $100,000 line earns $60,000; $75,000 spent gives CPI 0.80.
  const a = costLine({
    ...base,
    budgetQtyMilli: 1_000_000,
    installedQtyMilli: 600_000,
    budgetCents: 10_000_000,
    plannedCents: 5_000_000,
    actualCents: 7_500_000,
  });
  const b = costLine({
    ...base,
    budgetQtyMilli: 2_000,
    installedQtyMilli: 0,
    budgetCents: 4_000_000,
    plannedCents: 0,
    actualCents: 0,
  });

  it("earns budget times physical percent complete", () => {
    expect(a.earnedCents).toBe(6_000_000);
    expect(a.varianceCents).toBe(-1_500_000);
    expect(a.cpi).toBeCloseTo(0.8);
    expect(b.cpi).toBeNull();
  });

  it("rolls up to job indices and an EAC", () => {
    const r = rollup([a, b]);
    expect(r).toMatchObject({
      budgetCents: 14_000_000,
      earnedCents: 6_000_000,
      actualCents: 7_500_000,
      costVarianceCents: -1_500_000,
    });
    expect(r.cpi).toBeCloseTo(0.8);
    expect(r.spi).toBeCloseTo(1.2);
    expect(r.eacCents).toBe(17_500_000);
  });
});
