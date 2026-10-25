import { describe, it, expect } from "vitest";
import { todayOnSiteEmptyCopy, formatTodayOnSiteSummary } from "./today-on-site";

describe("today-on-site client (3.3.2)", () => {
  it("honest empty copy", () => {
    expect(todayOnSiteEmptyCopy(false)).toMatch(/No field activity/i);
    expect(todayOnSiteEmptyCopy(true)).toBe("");
  });
  it("formats summary without health language", () => {
    const s = formatTodayOnSiteSummary({
      projectId: "p",
      dayUtc: "2026-07-15",
      dailyReportCount: 1,
      photoCount: 2,
      openRfiCount: 0,
      label: "Today's field activity",
    });
    expect(s).toMatch(/field activity/i);
    expect(s.toLowerCase()).not.toContain("health");
  });
});
