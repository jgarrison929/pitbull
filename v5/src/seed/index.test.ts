import { describe, expect, it } from "vitest";
import { costLine, plannedValueCents } from "@/lib/ev";
import { seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-000000000001";
const today = new Date("2026-10-19T00:00:00Z");
const rows = seed(company, today);

function jobIndex(number: string) {
  const job = rows.jobs.find((j) => j.number === number)!;
  const items = rows.costItems.filter((c) => c.jobId === job.id);
  const lines = items.map((c) =>
    costLine({
      ...c,
      claimedPercentMilli: c.claimedPercentMilli ?? 0,
      earnDerivation: c.earnDerivation ?? "",
      evMethod: c.evMethod ?? "units",
    }),
  );
  const sum = (f: (c: (typeof lines)[number]) => number) =>
    lines.reduce((s, c) => s + f(c), 0);
  return {
    earned: sum((c) => c.earnedCents),
    actual: sum((c) => c.actualCents),
    planned: sum((c) => c.plannedCents),
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

  it("builds actuals from cost entries and planned from schedule dates", () => {
    const byItem = new Map<string, number>();
    for (const e of rows.costEntries) {
      expect(e.at).toBeTruthy();
      byItem.set(e.costItemId, (byItem.get(e.costItemId) ?? 0) + e.amountCents);
    }
    for (const c of rows.costItems) {
      expect(byItem.get(c.id) ?? 0).toBe(c.actualCents);
      expect(c.plannedCents).toBe(
        plannedValueCents(
          c.budgetCents,
          c.plannedStartOn,
          c.plannedFinishOn,
          today,
        ),
      );
    }
  });

  it("tells the story without targeting exact CPI/SPI", () => {
    const sr99 = jobIndex("24-118");
    const cedar = jobIndex("25-031");
    const i5 = jobIndex("24-077");
    // Cedar: actuals clearly above earned (over cost).
    expect(cedar.actual).toBeGreaterThan(cedar.earned);
    // I-5: planned value ahead of earned (behind schedule).
    expect(i5.planned).toBeGreaterThan(i5.earned);
    // SR-99: actuals not wildly off earned (roughly healthy).
    const sr99Gap = Math.abs(sr99.actual - sr99.earned) / sr99.earned;
    expect(sr99Gap).toBeLessThan(0.08);
    for (const j of [sr99, cedar, i5]) expect(j.earned).toBeGreaterThan(0);
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
        c.claimedPercentMilli,
      ]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("keeps locked Period 1, draft Period 2, milestones and PM logs", () => {
    expect(rows.costEntries.length).toBeGreaterThan(0);
    expect(rows.progressClaims.some((c) => c.status === "locked")).toBe(true);
    expect(
      rows.progressClaims.some(
        (c) => c.status === "draft" && c.periodLabel === "Period 2",
      ),
    ).toBe(true);
    expect(rows.costItemMilestones.length).toBeGreaterThan(0);
    expect(rows.pmPercentLogs.length).toBeGreaterThan(0);
    for (const c of rows.costItems) {
      expect((c.earnDerivation ?? "").length).toBeGreaterThan(0);
      expect(["units", "milestones", "pm_percent"]).toContain(c.evMethod);
    }
  });
});
