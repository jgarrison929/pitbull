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
  {
    number: "26-010",
    name: "Harbor Side Abutment — Phase 1",
    shortName: "Harbor Abutment",
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
    [
      "Plan today on 25-031 for Bridge Crew 2",
      "dailyPlan.create",
      { job: "25-031", date: "today", crew: "Bridge Crew 2" },
    ],
    [
      // Part E: unknown job must stay on create (Couldn't create plan), not show.
      "Plan today on 99-999 for Bridge Crew 2",
      "dailyPlan.create",
      { job: "99-999", date: "today", crew: "Bridge Crew 2" },
    ],
    [
      "Plan today on 99-999",
      "dailyPlan.create",
      { job: "99-999", date: "today" },
    ],
    [
      "Plan tomorrow on 99-999",
      "dailyPlan.create",
      { job: "99-999", date: "tomorrow" },
    ],
    [
      "plan today on 99-999 for culvert crew a",
      "dailyPlan.create",
      { job: "99-999", date: "today", crew: "culvert crew a" },
    ],
    // Known job without crew still shows (unchanged).
    [
      "Plan tomorrow on 24-077",
      "dailyPlan.show",
      { job: "24-077" },
    ],
    [
      "Add 04-210 to today's plan on 25-031: 12 CY, 3 workers, 8 hours",
      "dailyPlan.addLine",
      {
        job: "25-031",
        costCode: "04-210",
        date: "today",
        qty: "12",
        workers: "3",
        hours: "8",
      },
    ],
    [
      "Add 04-210 to today's Bridge Crew 2 plan on 25-031: 12 CY, 3 workers, 8 hours",
      "dailyPlan.addLine",
      {
        job: "25-031",
        costCode: "04-210",
        date: "today",
        crew: "Bridge Crew 2",
        qty: "12",
        workers: "3",
        hours: "8",
      },
    ],
    [
      "Remove 04-210 from today's Bridge Crew 2 plan on 25-031",
      "dailyPlan.removeLine",
      {
        job: "25-031",
        costCode: "04-210",
        date: "today",
        crew: "Bridge Crew 2",
      },
    ],
    ["Submit tomorrow's plan", "dailyPlan.submit", { date: "tomorrow" }],
    ["send the plan for cedar", "dailyPlan.submit", { job: "25-031" }],
    ["submit the plan for 99-999", "dailyPlan.submit", { job: "99-999" }],
    [
      "Approve the daily report for Cedar Creek",
      "dailyPlan.approve",
      { job: "25-031" },
    ],
    [
      "Approve today's report on 25-031",
      "dailyPlan.approve",
      { job: "25-031", date: "today" },
    ],
    [
      "Approve today's Bridge Crew 2 report on 25-031",
      "dailyPlan.approve",
      { job: "25-031", date: "today", crew: "Bridge Crew 2" },
    ],
    [
      "Return the report for Cedar Creek because Recount pour 3",
      "dailyPlan.return",
      { job: "25-031", reason: "Recount pour 3" },
    ],
    [
      "Return today's report for Cedar Creek because Recount pour 3",
      "dailyPlan.return",
      { job: "25-031", date: "today", reason: "Recount pour 3" },
    ],
    [
      "Return the report for Cedar Creek",
      "dailyPlan.return",
      { job: "25-031", reason: "" },
    ],
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
      "we worked -5 hours on the pour for Cedar Creek",
      "dailyReport.post",
      {
        job: "25-031",
        actuals: [{ manHours: -5 }],
        lineRef: "we worked -5 hours on the pour for Cedar Creek",
      },
    ],
    [
      "we worked NaN hours on the pour for Cedar Creek",
      "dailyReport.post",
      {
        job: "25-031",
        actuals: [{ manHours: Number.NaN }],
        lineRef: "we worked NaN hours on the pour for Cedar Creek",
      },
    ],
    [
      "we worked Infinity hours on the pour for Cedar Creek",
      "dailyReport.post",
      {
        job: "25-031",
        actuals: [{ manHours: Number.NaN }],
        lineRef: "we worked Infinity hours on the pour for Cedar Creek",
      },
    ],
    [
      "Lock the progress claim on 25-031",
      "progressClaim.lock",
      { job: "25-031" },
    ],
    [
      "Import the estimate CSV for Harbor Abutment",
      "estimate.importCsv",
      { job: "26-010" },
    ],
    [
      "import estimate for 26-010",
      "estimate.importCsv",
      { job: "26-010" },
    ],
    [
      "Approve the estimate on Harbor Abutment",
      "estimate.approve",
      { job: "26-010" },
    ],
    [
      "approve estimate for 26-010",
      "estimate.approve",
      { job: "26-010" },
    ],
    [
      "Approve change order CO-001 on 25-031",
      "changeOrder.approve",
      { job: "25-031", changeOrder: "CO-001" },
    ],
    [
      "Approve change order CO-001 on Cedar Creek",
      "changeOrder.approve",
      { job: "25-031", changeOrder: "CO-001" },
    ],
    [
      "Reject CO-001 on Cedar Creek because Owner declined",
      "changeOrder.reject",
      { job: "25-031", changeOrder: "CO-001", reason: "Owner declined" },
    ],
    [
      "Void PCO-2 on 24-118 because duplicate",
      "changeOrder.void",
      { job: "24-118", changeOrder: "PCO-2", reason: "duplicate" },
    ],
    [
      "Raise a change order on 25-031: Owner-added retaining wall, north approach",
      "changeOrder.create",
      {
        job: "25-031",
        title: "Owner-added retaining wall, north approach",
      },
    ],
    [
      "Raise a change order on Cedar Creek: Added guardrail at the east approach",
      "changeOrder.create",
      {
        job: "25-031",
        title: "Added guardrail at the east approach",
      },
    ],
    [
      "Price CO-001 on 25-031: new 91-100 Retaining wall LS labor 18,500 material 23,250 equipment 6,100 sub 12,150; 04-210 material -2,000 qty 10",
      "changeOrder.price",
      {
        job: "25-031",
        changeOrder: "CO-001",
        coLines: [
          {
            code: "91-100",
            description: "Retaining wall",
            unit: "LS",
            labor: "18,500",
            material: "23,250",
            equipment: "6,100",
            sub: "12,150",
          },
          {
            code: "04-210",
            material: "-2,000",
            qty: "10",
          },
        ],
      },
    ],
    [
      "Show change orders on Cedar Creek",
      "changeOrder.show",
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
      "Set 04-210 on 25-031 to average performance",
      "costItem.setForecastMethod",
      {
        job: "25-031",
        costCode: "04-210",
        lineRef: "Set 04-210 on 25-031 to average performance",
        forecastMethod: "average_performance",
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
