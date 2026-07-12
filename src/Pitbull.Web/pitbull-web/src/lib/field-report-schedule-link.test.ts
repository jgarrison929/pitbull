import { describe, it, expect } from "vitest";
import { buildFieldReportWithActivityHref } from "./field-report-schedule-link";
import { buildProgressDraftHref } from "./progress-deep-link";

describe("field report schedule activity deep link (2.15.0)", () => {
  it("carries activity into field report and progress hrefs", () => {
    const fr = buildFieldReportWithActivityHref("p1", {
      activityId: "a1",
      activityName: "Pour",
    });
    expect(fr).toContain("/daily-reports/mobile");
    expect(fr).toContain("activityId=a1");
    expect(buildProgressDraftHref("p1", { activityId: "a1" })).toContain(
      "activityId=a1"
    );
  });
});
