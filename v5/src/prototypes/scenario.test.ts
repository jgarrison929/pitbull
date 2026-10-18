import { describe, expect, it } from "vitest";
import {
  actions,
  costCodes,
  costRow,
  dailyPlan,
  focusJobId,
  health,
  jobMetrics,
  jobs,
  planCheck,
} from "./scenario";

describe("demo scenario", () => {
  const focus = jobs.find((j) => j.id === focusJobId)!;
  const rows = costCodes.map(costRow);

  it("rolls the focus job's EV and actuals up from its cost codes", () => {
    expect(rows.reduce((s, r) => s + r.earned, 0)).toBe(focus.ev);
    expect(rows.reduce((s, r) => s + r.actualCost, 0)).toBe(focus.ac);
    expect(rows.reduce((s, r) => s + r.budgetCost, 0)).toBe(focus.budget);
  });

  it("tells the intended story: one job ahead, one over cost, one behind schedule", () => {
    const [sr99, cedar, i5] = jobs.map(jobMetrics);
    expect(health(Math.min(sr99.cpi, sr99.spi))).toBe("on-track");
    expect(health(cedar.cpi)).toBe("at-risk");
    expect(health(i5.spi)).toBe("at-risk");
    expect(i5.cpi).toBeGreaterThan(1);
  });

  it("ranks the worst cost variance first, the cofferdam", () => {
    expect(actions["job.costVariance"](focusJobId)[0].code).toBe("07-410");
  });

  it("checks every plan line against its budgeted unit rate", () => {
    const checks = dailyPlan.lines.map(planCheck);
    expect(checks.map((c) => c.manHours)).toEqual([60, 40, 10]);
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
