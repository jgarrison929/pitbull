import { describe, expect, it } from "vitest";
import {
  HELP_PM_SCHEDULE_CARDS,
  PM_SCHEDULE_HELP_SECTION_TITLE,
  pmScheduleFaqItems,
} from "./help-pm-schedule";

describe("help-pm-schedule (3.6.8 / band 3.7)", () => {
  it("has look-ahead and CPM cards with real routes", () => {
    expect(PM_SCHEDULE_HELP_SECTION_TITLE.length).toBeGreaterThan(0);
    const hrefs = HELP_PM_SCHEDULE_CARDS.map((c) => c.href);
    expect(hrefs.every((h) => h.startsWith("/projects"))).toBe(true);
  });

  it("FAQ rejects SPI/CPI invent and fake on-track", () => {
    const text = pmScheduleFaqItems.map((f) => f.answer).join(" ").toLowerCase();
    expect(text).toMatch(/do not invent|not invent|insufficient/);
    expect(text).not.toMatch(/always on track/);
  });
});
