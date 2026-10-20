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
      { job: "25-031" },
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
