import { describe, expect, it } from "vitest";
import {
  costLine,
  plannedValueCents,
  rollup,
  snapshotClaimPercent,
} from "./ev";

const base = {
  code: "x",
  description: "x",
  unit: "CY",
  budgetMhPerUnitMilli: 0,
  evMethod: "units" as const,
  earnDerivation: "test",
};

describe("earned value methods", () => {
  it("units complete: installed / budget", () => {
    const snap = snapshotClaimPercent({
      method: "units",
      budgetQtyMilli: 1_000_000,
      installedQtyMilli: 600_000,
      unit: "CY",
      milestoneCompleteWeightMilli: 0,
      pmPercentMilli: 0,
    });
    expect(snap.percentMilli).toBe(600);
    expect(snap.derivation).toMatch(/600 of 1,000 CY/);
  });

  it("weighted milestones: sum of completed weights", () => {
    const milestones = [
      { name: "Mobilization in", weightMilli: 500, complete: true },
      { name: "Mobilization complete", weightMilli: 500, complete: false },
    ];
    const snap = snapshotClaimPercent({
      method: "milestones",
      budgetQtyMilli: 1000,
      installedQtyMilli: 0,
      unit: "LS",
      milestoneCompleteWeightMilli: 500,
      pmPercentMilli: 0,
      milestones,
    });
    expect(snap.percentMilli).toBe(500);
    expect(snap.derivation).toMatch(/Mobilization in 50% ✓/);
    expect(snap.derivation).toMatch(/→ 50%/);
  });

  it("PM percent complete uses the logged percent", () => {
    const snap = snapshotClaimPercent({
      method: "pm_percent",
      budgetQtyMilli: 1000,
      installedQtyMilli: 0,
      unit: "LS",
      milestoneCompleteWeightMilli: 0,
      pmPercentMilli: 350,
    });
    expect(snap.percentMilli).toBe(350);
    expect(snap.derivation).toBe("PM percent complete: 35%");
  });
});

describe("planned value", () => {
  it("ramps linearly between start and finish", () => {
    expect(
      plannedValueCents(
        10_000_000,
        "2026-01-01",
        "2026-01-11",
        new Date("2026-01-01T00:00:00Z"),
      ),
    ).toBe(0);
    expect(
      plannedValueCents(
        10_000_000,
        "2026-01-01",
        "2026-01-11",
        new Date("2026-01-06T00:00:00Z"),
      ),
    ).toBe(5_000_000);
    expect(
      plannedValueCents(
        10_000_000,
        "2026-01-01",
        "2026-01-11",
        new Date("2026-01-11T00:00:00Z"),
      ),
    ).toBe(10_000_000);
  });
});

describe("earned value from exact quantities", () => {
  // 290 of 620 CY on $868,000 → $406,000 exactly (not 46.8% → $406,224).
  it("units earn from installed/budget, not 0.1% rounded percent", () => {
    const pour = costLine({
      ...base,
      budgetQtyMilli: 620_000,
      installedQtyMilli: 290_000,
      budgetCents: 86_800_000,
      plannedCents: 86_800_000,
      actualCents: 40_000_000,
      claimedPercentMilli: 468, // would wrongly yield $406,224 if used alone
    });
    expect(pour.earnedCents).toBe(40_600_000);
  });
});

describe("earned value from locked claim percent", () => {
  // Hand-computed: locked 60% on a $100,000 line earns $60,000; $75,000 spent gives CPI 0.80.
  const a = costLine({
    ...base,
    budgetQtyMilli: 1_000_000,
    installedQtyMilli: 600_000,
    budgetCents: 10_000_000,
    plannedCents: 5_000_000,
    actualCents: 7_500_000,
    claimedPercentMilli: 600,
  });
  const b = costLine({
    ...base,
    budgetQtyMilli: 2_000,
    installedQtyMilli: 0,
    budgetCents: 4_000_000,
    plannedCents: 0,
    actualCents: 0,
    claimedPercentMilli: 0,
    evMethod: "milestones",
    earnDerivation: "milestones: none",
  });

  it("earns budget times locked claim percent", () => {
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

  it("roll-up equals the sum of lines", () => {
    const r = rollup([a, b]);
    expect(r.earnedCents).toBe(a.earnedCents + b.earnedCents);
    expect(r.actualCents).toBe(a.actualCents + b.actualCents);
    expect(r.plannedCents).toBe(a.plannedCents + b.plannedCents);
    expect(r.budgetCents).toBe(a.budgetCents + b.budgetCents);
  });
});
