import { describe, expect, it } from "vitest";
import { examples, route } from "./route";

const jobs = [
  {
    number: "24-118",
    name: "SR-99 / Airport Way Interchange",
    shortName: "SR-99 Interchange",
  },
  {
    number: "25-031",
    name: "Cedar Creek Bridge Replacement",
    shortName: "Cedar Creek Bridge",
  },
  {
    number: "24-077",
    name: "I-5 Culvert & Drainage Rehab",
    shortName: "I-5 Culverts",
  },
];

describe("assistant router", () => {
  it.each([
    ["How is the portfolio doing?", "portfolio.summary", {}],
    ["Why is Cedar Creek over budget?", "job.costVariance", { job: "25-031" }],
    ["cost variance on 24-077", "job.costVariance", { job: "24-077" }],
    ["what's the SR 99 number", "job.costVariance", { job: "24-118" }],
    [
      "Show tomorrow's plan for Cedar Creek",
      "dailyPlan.show",
      { job: "25-031" },
    ],
    ["Submit tomorrow's plan", "dailyPlan.submit", {}],
    ["send the plan for cedar", "dailyPlan.submit", { job: "25-031" }],
    ["submit the plan for 99-999", "dailyPlan.submit", { job: "99-999" }],
    [
      "Report today's work on Cedar Creek",
      "dailyReport.post",
      { job: "25-031", lineRef: "Report today's work on Cedar Creek" },
    ],
    [
      "we poured 38 CY with 72 hours on 04-210",
      "dailyReport.post",
      {
        actuals: [{ costCode: "04-210", qty: 38, manHours: 72 }],
        lineRef: "we poured 38 CY with 72 hours on 04-210",
      },
    ],
    [
      "we poured 38 CY with 72 hours on the pour for Cedar Creek",
      "dailyReport.post",
      {
        job: "25-031",
        actuals: [{ qty: 38, manHours: 72 }],
        lineRef:
          "we poured 38 CY with 72 hours on the pour for Cedar Creek",
      },
    ],
    [
      "we tied 9000 LB with 45 hours on the cage for Cedar Creek",
      "dailyReport.post",
      {
        job: "25-031",
        actuals: [{ qty: 9000, manHours: 45 }],
        lineRef: "we tied 9000 LB with 45 hours on the cage for Cedar Creek",
      },
    ],
    [
      "Lock the progress claim on 25-031",
      "progressClaim.lock",
      { job: "25-031" },
    ],
    [
      "change the pour to 80 man-hours",
      "dailyPlan.updateLine",
      {
        lineRef: "change the pour to 80 man-hours",
        change: { manHours: "80" },
      },
    ],
    [
      "set 04-310 to 5 workers",
      "dailyPlan.updateLine",
      { lineRef: "set 04-310 to 5 workers", change: { workers: "5" } },
    ],
    [
      "make the cage 9,000 lb on cedar",
      "dailyPlan.updateLine",
      {
        job: "25-031",
        lineRef: "make the cage 9,000 lb on cedar",
        change: { qty: "9,000" },
      },
    ],
    [
      "add a note to the pour: crane at 6am",
      "dailyPlan.updateLine",
      {
        lineRef: "add a note to the pour: crane at 6am",
        change: { notes: "crane at 6am" },
      },
    ],
    [
      "Set 08-100 to 50% complete because field walk",
      "costItem.setPmPercent",
      {
        costCode: "08-100",
        lineRef: "Set 08-100 to 50% complete because field walk",
        percent: "50",
        reason: "field walk",
      },
    ],
    [
      "Set traffic control to 55% complete on 25-031 because night shift",
      "costItem.setPmPercent",
      {
        job: "25-031",
        lineRef:
          "Set traffic control to 55% complete on 25-031 because night shift",
        percent: "55",
        reason: "night shift",
      },
    ],
    [
      "Set Cedar Creek traffic control to 50% because walkthrough",
      "costItem.setPmPercent",
      {
        job: "25-031",
        lineRef:
          "Set Cedar Creek traffic control to 50% because walkthrough",
        percent: "50",
        reason: "walkthrough",
      },
    ],
    [
      "Mark Mobilization complete milestone open on 25-031 because punch list",
      "costItem.setMilestone",
      {
        job: "25-031",
        lineRef:
          "Mark Mobilization complete milestone open on 25-031 because punch list",
        complete: false,
        reason: "punch list",
      },
    ],
    [
      "Complete milestone Mobilization in on Cedar Creek because staged",
      "costItem.setMilestone",
      {
        job: "25-031",
        lineRef:
          "Complete milestone Mobilization in on Cedar Creek because staged",
        complete: true,
        reason: "staged",
      },
    ],
  ])("%s → %s", (prompt, action, args) => {
    expect(route(prompt, jobs)).toEqual({ action, args });
  });

  it("returns null when nothing matches, so the UI can offer examples", () => {
    expect(route("order pizza", jobs)).toBeNull();
  });

  it("every suggested example routes to an action", () => {
    for (const e of examples) expect(route(e, jobs)).not.toBeNull();
  });
});
