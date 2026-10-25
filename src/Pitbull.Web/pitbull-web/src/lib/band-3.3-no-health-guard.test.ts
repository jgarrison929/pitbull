import { describe, it, expect } from "vitest";
import { formatTodayOnSiteSummary, todayOnSiteEmptyCopy } from "./today-on-site";
import { SITE_WALK_TODAY_ON_SITE_HINT } from "./site-walk-today-on-site";

/** Residual buffer 3.3.8 — guard against health/portfolio framing regressions */
describe("band-3.3 residual honesty (3.3.8)", () => {
  it("empty copy and summary never say health", () => {
    const empty = todayOnSiteEmptyCopy(false).toLowerCase();
    expect(empty).toContain("field activity");
    expect(empty).not.toContain("health");
    const summary = formatTodayOnSiteSummary({
      projectId: "p1",
      dayUtc: "2026-07-15",
      dailyReportCount: 1,
      photoCount: 2,
      openRfiCount: 0,
      label: "Today's field activity",
    }).toLowerCase();
    expect(summary).not.toContain("health");
    expect(summary).not.toContain("portfolio");
  });

  it("site walk hint insists on same API path", () => {
    expect(SITE_WALK_TODAY_ON_SITE_HINT.toLowerCase()).toMatch(/same.*api|no second/);
  });
});
