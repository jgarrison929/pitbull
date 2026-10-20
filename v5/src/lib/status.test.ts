import { describe, expect, it } from "vitest";
import { costLine, rollup } from "./ev";
import { indexStatus, overallStatus, varianceStatus } from "./status";
import { seed } from "@/seed";

describe("status rule", () => {
  it("Mobilization on Cedar Creek is amber, not green: CPI 0.98 with a $13K overrun", () => {
    // 1 of 1 LS installed on a $640,000 budget earns $640,000; $653,000 spent.
    const mob = costLine({
      code: "02-100",
      description: "Mobilization",
      unit: "LS",
      budgetQtyMilli: 1000,
      installedQtyMilli: 1000,
      budgetCents: 64_000_000,
      plannedCents: 64_000_000,
      actualCents: 65_300_000,
      budgetMhPerUnitMilli: 0,
      claimedPercentMilli: 1000,
      evMethod: "milestones",
      earnDerivation: "weighted milestones: both complete",
    });
    expect(mob.varianceCents).toBe(-1_300_000);
    expect(mob.cpi).toBeCloseTo(0.98, 2);
    expect(varianceStatus(mob.cpi, mob.varianceCents)).toBe("watch");
  });

  it("grades the index at the shown two decimals", () => {
    expect(indexStatus(1.0)).toBe("on-track");
    expect(indexStatus(0.996)).toBe("on-track");
    expect(indexStatus(0.994)).toBe("watch");
    expect(indexStatus(0.95)).toBe("watch");
    expect(indexStatus(0.949)).toBe("watch"); // shows as 0.95
    expect(indexStatus(0.944)).toBe("at-risk");
  });

  it("never shows green on lost money, even when the index rounds to 1.00", () => {
    expect(varianceStatus(0.998, -50_00)).toBe("watch");
    expect(varianceStatus(1.04, 1_000_00)).toBe("on-track");
    expect(varianceStatus(0.9, -1)).toBe("at-risk");
    expect(varianceStatus(null, 0)).toBeNull();
  });

  it("a job takes the worse of cost and schedule", () => {
    expect(
      overallStatus({
        cpi: 1.04,
        spi: 0.94,
        costVarianceCents: 1,
        scheduleVarianceCents: -1,
      }),
    ).toBe("at-risk");
    expect(
      overallStatus({
        cpi: 1.01,
        spi: 1.0,
        costVarianceCents: 5,
        scheduleVarianceCents: 0,
      }),
    ).toBe("on-track");
  });
});

describe("roll-ups equal the sum of their lines, for the seed", () => {
  const rows = seed(
    "00000000-0000-4000-8000-000000000000",
    new Date("2026-10-19T15:00:00Z"),
  );
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const jobs = rows.jobs.map((j) => {
    const lines = rows.costItems
      .filter((c) => c.jobId === j.id)
      .map((c) =>
        costLine({
          ...c,
          claimedPercentMilli: c.claimedPercentMilli ?? 0,
          earnDerivation: c.earnDerivation ?? "",
          evMethod: c.evMethod ?? "units",
        }),
      );
    return { j, lines, r: rollup(lines) };
  });

  it.each(jobs.map((x) => [x.j.number, x] as const))(
    "job %s",
    (_n, { lines, r }) => {
      expect(r.budgetCents).toBe(sum(lines.map((l) => l.budgetCents)));
      expect(r.plannedCents).toBe(sum(lines.map((l) => l.plannedCents)));
      expect(r.earnedCents).toBe(sum(lines.map((l) => l.earnedCents)));
      expect(r.actualCents).toBe(sum(lines.map((l) => l.actualCents)));
      expect(r.costVarianceCents).toBe(sum(lines.map((l) => l.varianceCents)));
      expect(r.scheduleVarianceCents).toBe(
        sum(lines.map((l) => l.scheduleVarianceCents)),
      );
      expect(r.cpi).toBeCloseTo(r.earnedCents / r.actualCents, 10);
      expect(r.spi).toBeCloseTo(r.earnedCents / r.plannedCents, 10);
      expect(r.percent).toBeCloseTo(r.earnedCents / r.budgetCents, 10);
    },
  );

  it("the portfolio equals the sum of its jobs", () => {
    const all = rollup(jobs.flatMap((x) => x.lines));
    for (const k of [
      "budgetCents",
      "plannedCents",
      "earnedCents",
      "actualCents",
      "costVarianceCents",
      "scheduleVarianceCents",
    ] as const)
      expect(all[k]).toBe(sum(jobs.map((x) => x.r[k])));
  });

  it("every line is internally consistent", () => {
    for (const x of jobs)
      for (const l of x.lines) {
        expect(l.installedQtyMilli).toBeLessThanOrEqual(l.budgetQtyMilli);
        expect(l.earnedCents).toBeLessThanOrEqual(l.budgetCents);
        expect(l.plannedCents).toBeLessThanOrEqual(l.budgetCents);
        expect(l.actualCents).toBeGreaterThanOrEqual(0);
        // Installed qty only tracks the units method; milestones/PM % can have actuals with 0 installed.
        if (l.evMethod === "units" && l.installedQtyMilli === 0)
          expect(l.claimedPercentMilli).toBe(0);
        if (l.unit === "EA" || l.unit === "MO")
          expect(l.installedQtyMilli % 1000).toBe(0);
      }
  });
});
