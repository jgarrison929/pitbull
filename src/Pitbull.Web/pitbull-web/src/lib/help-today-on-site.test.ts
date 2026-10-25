import { describe, it, expect } from "vitest";
import {
  HELP_TODAY_ON_SITE_CARDS,
  TODAY_ON_SITE_HELP_SECTION_TITLE,
  helpTodayOnSiteCardIds,
  todayOnSiteFaqItems,
} from "./help-today-on-site";

describe("help-today-on-site (3.3.6)", () => {
  it("includes glance, site walk, and truth cards", () => {
    const ids = helpTodayOnSiteCardIds();
    expect(ids).toContain("today-glance");
    expect(ids).toContain("today-site-walk");
    expect(ids).toContain("today-truth");
    expect(HELP_TODAY_ON_SITE_CARDS.every((c) => c.steps.length >= 2)).toBe(true);
  });

  it("labels activity not health and avoids portfolio KPI language", () => {
    expect(TODAY_ON_SITE_HELP_SECTION_TITLE.toLowerCase()).not.toContain("health");
    const blob = [
      ...HELP_TODAY_ON_SITE_CARDS.flatMap((c) => [c.title, ...c.steps]),
      ...todayOnSiteFaqItems.flatMap((f) => [f.question, f.answer]),
    ]
      .join(" ")
      .toLowerCase();
    expect(blob).toContain("field activity");
    expect(blob).toContain("empty");
    // Must explicitly reject health/portfolio framing
    expect(blob).toMatch(/not a health|never.*health|not.*health score/i);
    expect(blob).toMatch(/no portfolio|never.*portfolio|portfolio rollup/i);
  });

  it("FAQ answers stay truthful about single API path", () => {
    expect(todayOnSiteFaqItems.length).toBeGreaterThanOrEqual(2);
    const answers = todayOnSiteFaqItems.map((f) => f.answer).join(" ");
    expect(answers).toMatch(/today-on-site|same project API/i);
  });
});
