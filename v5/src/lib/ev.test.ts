import { describe, expect, it } from "vitest";
import { forecastMethodEnum } from "@/db/schema";
import {
  costLine,
  earnedCentsOf,
  earnedMhMilliOf,
  formatInstalledByUnit,
  idx,
  itemForecast,
  plannedValueCents,
  rollup,
  rollupFromTotals,
  sCurvePoints,
  snapshotClaimPercent,
} from "./ev";

const base = {
  code: "x",
  description: "x",
  unit: "CY",
  budgetMhPerUnitMilli: 0,
  evMethod: "units" as const,
  forecastMethod: "current_budget" as const,
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

describe("04-210 seed fixture (hand-computed)", () => {
  // Budget $868,000 · 620 CY · 248 CY claimed · AC $538,728
  // EV = 868000 × 248/620 = $347,200
  const pour = {
    ...base,
    code: "04-210",
    description: "Pier column concrete",
    budgetQtyMilli: 620_000,
    installedQtyMilli: 248_000,
    claimedInstalledQtyMilli: 248_000,
    budgetCents: 86_800_000,
    plannedCents: 34_720_000,
    actualCents: 53_872_800,
    budgetMhPerUnitMilli: 1_600, // 1.600 MH/CY
    claimedPercentMilli: 400,
  };

  it("units earn exact fraction, not 0.1% rounded percent", () => {
    // 290/620 of $868,000 = $406,000 (not 46.8% → $406,224)
    expect(
      earnedCentsOf({
        ...pour,
        claimedInstalledQtyMilli: 290_000,
        claimedPercentMilli: 468,
      }),
    ).toBe(40_600_000);
  });

  it("check 1: Current Budget EAC = AC + (BAC − EV)", () => {
    // EAC = 538728 + 1400×372 = 1,059,528; ETC = 520,800
    const f = itemForecast({
      forecastMethod: "current_budget",
      budgetCents: pour.budgetCents,
      earnedCents: 34_720_000,
      actualCents: pour.actualCents,
    });
    expect(f.eacCents).toBe(105_952_800);
    expect(f.etcCents).toBe(52_080_000);
    expect(f.forecastFallback).toBe(false);
  });

  it("check 2: Average Performance EAC = AC × BAC ÷ EV", () => {
    // EAC = 538728 × 620 ÷ 248 = 1,346,820; ETC = 808,092
    const f = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: pour.budgetCents,
      earnedCents: 34_720_000,
      actualCents: pour.actualCents,
    });
    expect(f.eacCents).toBe(134_682_000);
    expect(f.etcCents).toBe(80_809_200);
  });

  it("check 3: job EAC is the sum of item EACs", () => {
    const a = costLine({
      ...pour,
      forecastMethod: "average_performance",
    });
    const b = costLine({
      ...base,
      code: "B",
      budgetQtyMilli: 0,
      installedQtyMilli: 0,
      claimedInstalledQtyMilli: 0,
      budgetCents: 90_000_000,
      plannedCents: 0,
      actualCents: 0,
      claimedPercentMilli: 0,
      forecastMethod: "average_performance",
      evMethod: "pm_percent",
    });
    const r = rollup([a, b]);
    // 1,346,820 + 900,000 = 2,246,820 (not BAC÷CPI = 2,743,292.35)
    expect(a.eacCents).toBe(134_682_000);
    expect(b.eacCents).toBe(90_000_000);
    expect(r.eacCents).toBe(224_682_000);
  });

  it("check 4: no progress on Average Performance falls back to Current Budget", () => {
    const f = itemForecast({
      forecastMethod: "average_performance",
      budgetCents: 90_000_000,
      earnedCents: 0,
      actualCents: 0,
    });
    expect(f.eacCents).toBe(90_000_000);
    expect(f.forecastFallback).toBe(true);
    expect(f.forecastDerivation).toMatch(/fell back/);
  });

  it("check 5: earned man-hours and productivity", () => {
    // 248 CY × 1.600 = 396.8 MH; actual 420.0 → productivity 0.94, G/L −23.2
    const earned = earnedMhMilliOf(pour);
    expect(earned).toBe(396_800);
    const actualMhMilli = 420_000;
    const productivity = earned / actualMhMilli;
    expect(productivity).toBeCloseTo(0.9452, 3);
    expect((earned - actualMhMilli) / 1000).toBeCloseTo(-23.2, 5);
  });

  it("live installed above the claim does not raise earned until lock", () => {
    const line = costLine({
      ...pour,
      installedQtyMilli: 290_000,
      claimedInstalledQtyMilli: 248_000,
    });
    expect(line.earnedCents).toBe(34_720_000);
  });
});

describe("check 7: D1 one cutoff — on-plan SPI is 1.00", () => {
  // Budget $100,000 · planned 2026-10-01 → 2026-10-11 · locked 2026-10-06 at 50%
  // Read on 2026-10-09: EV and PV both at lock date → $50,000, SPI 1.00
  it("PV and EV share the lock date so SPI stays 1.0 when on plan", () => {
    const bac = 10_000_000;
    const lockAsOf = new Date("2026-10-06T00:00:00Z");
    const readAsOf = new Date("2026-10-09T00:00:00Z");
    const pvAtLock = plannedValueCents(
      bac,
      "2026-10-01",
      "2026-10-11",
      lockAsOf,
    );
    const pvToday = plannedValueCents(
      bac,
      "2026-10-01",
      "2026-10-11",
      readAsOf,
    );
    expect(pvAtLock).toBe(5_000_000);
    expect(pvToday).toBe(8_000_000); // what main wrongly used for SPI

    const line = costLine({
      ...base,
      budgetQtyMilli: 100_000,
      installedQtyMilli: 50_000,
      claimedInstalledQtyMilli: 50_000,
      budgetCents: bac,
      plannedCents: pvAtLock,
      livePlannedCents: pvToday,
      actualCents: 5_000_000,
      claimedPercentMilli: 500,
    });
    expect(line.earnedCents).toBe(5_000_000);
    expect(line.spi).toBeCloseTo(1.0);
    expect(line.sinceLockPlannedCents).toBe(3_000_000);
  });
});

describe("check 10: D4 EV never exceeds BAC", () => {
  it("caps units EV at budget when installed exceeds qty", () => {
    // 700 CY on 620 CY budget → EV = BAC, over = 80 CY
    const line = costLine({
      ...base,
      budgetQtyMilli: 620_000,
      installedQtyMilli: 700_000,
      claimedInstalledQtyMilli: 700_000,
      budgetCents: 86_800_000,
      plannedCents: 86_800_000,
      actualCents: 53_872_800,
      claimedPercentMilli: 1000,
      budgetMhPerUnitMilli: 1_600,
    });
    expect(line.earnedCents).toBe(86_800_000);
    expect(line.percent).toBe(1);
    expect(line.overBudgetQtyMilli).toBe(80_000);
  });
});

describe("earned value from locked claim percent", () => {
  // Hand-computed: locked 60% on a $100,000 line earns $60,000; $75,000 spent gives CPI 0.80.
  const a = costLine({
    ...base,
    budgetQtyMilli: 1_000_000,
    installedQtyMilli: 600_000,
    claimedInstalledQtyMilli: 600_000,
    budgetCents: 10_000_000,
    plannedCents: 5_000_000,
    actualCents: 7_500_000,
    claimedPercentMilli: 600,
  });
  const b = costLine({
    ...base,
    budgetQtyMilli: 2_000,
    installedQtyMilli: 0,
    claimedInstalledQtyMilli: 0,
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

  it("rolls up to job indices; EAC is sum of item forecasts", () => {
    // a current_budget: EAC = 7.5M + (10M − 6M) = 11.5M
    // b current_budget: EAC = 0 + (4M − 0) = 4M
    // job EAC = 15.5M (not BAC÷CPI = 14M/0.8 = 17.5M)
    const r = rollup([a, b]);
    expect(r).toMatchObject({
      budgetCents: 14_000_000,
      earnedCents: 6_000_000,
      actualCents: 7_500_000,
      costVarianceCents: -1_500_000,
    });
    expect(r.cpi).toBeCloseTo(0.8);
    expect(r.spi).toBeCloseTo(1.2);
    expect(a.eacCents).toBe(11_500_000);
    expect(b.eacCents).toBe(4_000_000);
    expect(r.eacCents).toBe(15_500_000);
    expect(r.etcCents).toBe(8_000_000);
  });

  it("roll-up equals the sum of lines", () => {
    const r = rollup([a, b]);
    expect(r.earnedCents).toBe(a.earnedCents + b.earnedCents);
    expect(r.actualCents).toBe(a.actualCents + b.actualCents);
    expect(r.plannedCents).toBe(a.plannedCents + b.plannedCents);
    expect(r.budgetCents).toBe(a.budgetCents + b.budgetCents);
    expect(r.eacCents).toBe(a.eacCents + b.eacCents);
  });
});

describe("check 6: S-curve totals", () => {
  it("last cumulative PV equals BAC when the window covers every finish", () => {
    const items = [
      {
        budgetCents: 10_000_000,
        plannedStartOn: "2026-10-01",
        plannedFinishOn: "2026-10-11",
        earnedCents: 5_000_000,
        actualCents: 4_000_000,
      },
      {
        budgetCents: 5_000_000,
        plannedStartOn: "2026-10-01",
        plannedFinishOn: "2026-10-06",
        earnedCents: 5_000_000,
        actualCents: 5_500_000,
      },
    ];
    const pts = sCurvePoints(items, "2026-10-01", "2026-10-11");
    expect(pts.at(-1)?.plannedCents).toBe(15_000_000);
    expect(pts.at(-1)?.earnedCents).toBe(10_000_000);
    expect(pts.at(-1)?.actualCents).toBe(9_500_000);
    // Midpoint PV for first item alone at day 6 = half of 10M; second finished.
    const day6 = pts.find((p) => p.on === "2026-10-06");
    expect(day6?.plannedCents).toBe(5_000_000 + 5_000_000);
  });
});

describe("since lock figures", () => {
  it("separates live actual and PV advance from the cutoff", () => {
    const line = costLine({
      ...base,
      budgetQtyMilli: 100_000,
      installedQtyMilli: 60_000,
      claimedInstalledQtyMilli: 50_000,
      budgetCents: 10_000_000,
      plannedCents: 5_000_000,
      livePlannedCents: 8_000_000,
      actualCents: 4_000_000,
      liveActualCents: 4_500_000,
      claimedPercentMilli: 500,
    });
    expect(line.actualCents).toBe(4_000_000);
    expect(line.sinceLockActualCents).toBe(500_000);
    expect(line.sinceLockPlannedCents).toBe(3_000_000);
    expect(line.cpi).toBeCloseTo(1.25); // EV 5M / AC 4M at cutoff
  });
});

describe("honesty: never sum installed qty across units", () => {
  it("lists CY, LB, and DAY separately — not 8,513", () => {
    // Bug: 12 CY + 8,500 LB + 1 DAY was shown as "8,513 installed".
    const text = formatInstalledByUnit({
      CY: 12_000,
      LB: 8_500_000,
      DAY: 1_000,
    });
    expect(text).not.toMatch(/8,?513/);
    // Units listed separately (sorted); never one summed quantity.
    expect(text).toBe("12 CY, 1 DAY, 8,500 LB installed");
  });
});

describe("honesty: zero-budget CPI/SPI", () => {
  it("shows em dash, not 1.00, when budget is $0", () => {
    const r = rollupFromTotals({
      budgetCents: 0,
      plannedCents: 0,
      earnedCents: 0,
      actualCents: 0,
      eacCents: 0,
    });
    expect(r.cpi).toBeNull();
    expect(r.spi).toBeNull();
    expect(idx(r.cpi)).toBe("—");
    expect(idx(r.spi)).toBe("—");
  });
});

describe("honesty: forecast method", () => {
  it("current_budget and average_performance are both selectable", () => {
    expect(forecastMethodEnum.enumValues).toEqual([
      "current_budget",
      "average_performance",
    ]);
  });
});
