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
