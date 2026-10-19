import { describe, expect, it } from "vitest";
import { seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-000000000001";
const today = new Date("2026-10-19T00:00:00Z");
const rows = seed(company, today);

function jobIndex(number: string) {
  const job = rows.jobs.find((j) => j.number === number)!;
  const items = rows.costItems.filter((c) => c.jobId === job.id);
  const sum = (f: (c: (typeof items)[number]) => number) =>
    items.reduce((s, c) => s + f(c), 0);
  const ev = sum((c) =>
    Math.round((c.budgetCents * c.installedQtyMilli) / c.budgetQtyMilli),
  );
  return {
    ev,
    cpi: ev / sum((c) => c.actualCents),
    spi: ev / sum((c) => c.plannedCents),
    items,
  };
}

describe("seed", () => {
  it("is deterministic for the same company and day", () => {
    expect(seed(company, today)).toEqual(rows);
    expect(seedId(company, "x")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("gives each sandbox its own ids", () => {
    const other = seed("00000000-0000-4000-8000-000000000002", today);
    expect(other.jobs[0].id).not.toBe(rows.jobs[0].id);
  });

  it("tells the story: SR-99 on track, Cedar Creek over cost, I-5 behind schedule", () => {
    const sr99 = jobIndex("24-118");
    const cedar = jobIndex("25-031");
    const i5 = jobIndex("24-077");
    expect(Math.min(sr99.cpi, sr99.spi)).toBeGreaterThanOrEqual(0.98);
    expect(cedar.cpi).toBeLessThan(0.93);
    expect(cedar.spi).toBeGreaterThanOrEqual(0.98);
    expect(i5.spi).toBeLessThan(0.93);
    expect(i5.cpi).toBeGreaterThanOrEqual(0.98);
    for (const j of [sr99, cedar, i5]) expect(j.ev).toBeGreaterThan(0);
  });

  it("has tomorrow's draft plan for the foreman, on real cost items", () => {
    expect(rows.dailyPlans).toHaveLength(1);
    expect(rows.dailyPlans[0]).toMatchObject({
      planDate: "2026-10-20",
      status: "draft",
    });
    const ids = new Set(rows.costItems.map((c) => c.id));
    expect(rows.dailyPlanLines.every((l) => ids.has(l.costItemId))).toBe(true);
    expect(rows.users.map((u) => u.role)).toEqual([
      "executive",
      "pm",
      "superintendent",
      "foreman",
    ]);
  });

  it("stores money and quantities as integers", () => {
    for (const c of rows.costItems) {
      for (const v of [
        c.budgetCents,
        c.plannedCents,
        c.actualCents,
        c.budgetQtyMilli,
        c.installedQtyMilli,
      ]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });
});
