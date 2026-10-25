import { describe, expect, it } from "vitest";
import {
  HELP_PM_RFI_SUBMITTAL_CARDS,
  PM_RFI_SUBMITTAL_HELP_SECTION_TITLE,
  pmRfiSubmittalFaqItems,
} from "./help-pm-rfi-submittal";

describe("help-pm-rfi-submittal (3.4.8)", () => {
  it("has RFI and Submittal cards with real routes", () => {
    expect(PM_RFI_SUBMITTAL_HELP_SECTION_TITLE.length).toBeGreaterThan(0);
    const hrefs = HELP_PM_RFI_SUBMITTAL_CARDS.map((c) => c.href);
    expect(hrefs).toContain("/rfis");
    expect(hrefs.some((h) => h.startsWith("/projects"))).toBe(true);
  });

  it("FAQ rejects invent health and offline overclaim", () => {
    const text = pmRfiSubmittalFaqItems.map((f) => f.answer).join(" ").toLowerCase();
    expect(text).toMatch(/do not invent|not invent|no\./);
    expect(text).not.toMatch(/works fully offline without/);
  });
});
