import { describe, expect, it } from "vitest";
import {
  collapseSamePlanReports,
  reportedDayInSummary,
} from "@/lib/reported-day";

describe("reportedDayInSummary", () => {
  it("reads the day from a report summary", () => {
    expect(
      reportedDayInSummary(
        "Reported Culvert Crew A's work on I-5 Culverts for Tue, Oct 20: 110 man-hours pending.",
      ),
    ).toBe("Tue, Oct 20");
  });

  it("ignores the replay line and the return line", () => {
    expect(
      reportedDayInSummary(
        "Culvert Crew A's report for Tue, Oct 20 on I-5 Culverts was already saved.",
      ),
    ).toBeNull();
    expect(
      reportedDayInSummary(
        'Returned Culvert Crew A\'s report for Tue, Oct 20 on I-5 Culverts: "mark-out".',
      ),
    ).toBeNull();
  });
});

describe("collapseSamePlanReports", () => {
  const day = "Reported Culvert Crew A's work on I-5 Culverts for Tue, Oct 20: 12 CY.";
  const other =
    "Reported Bridge Crew 2's work on I-5 Culverts for Tue, Oct 20: 8 CY.";

  it("keeps the newest post of one plan and a second crew's same-day report", () => {
    const rows = collapseSamePlanReports([
      { id: "new", action: "dailyReport.post", summary: day, planId: "plan-a" },
      { id: "other", action: "dailyReport.post", summary: other, planId: "plan-b" },
      { id: "old", action: "dailyReport.post", summary: day, planId: "plan-a" },
      { id: "note", action: "dailyPlan.return", summary: "Returned it", planId: "plan-a" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["new", "other", "note"]);
  });

  it("does not hide a report that has no plan id", () => {
    const rows = collapseSamePlanReports([
      { id: "a", action: "dailyReport.post", summary: day, planId: "plan-a" },
      { id: "b", action: "dailyReport.post", summary: day, planId: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
