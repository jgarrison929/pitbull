import { describe, expect, it } from "vitest";
import {
  HELP_PM_CO_CONTRACTS_CARDS,
  PM_CO_CONTRACTS_HELP_SECTION_TITLE,
  pmCoContractsFaqItems,
} from "./help-pm-co-contracts";

describe("help-pm-co-contracts (3.5.8 / band 3.6)", () => {
  it("has CO and contracts cards with real routes", () => {
    expect(PM_CO_CONTRACTS_HELP_SECTION_TITLE.length).toBeGreaterThan(0);
    const hrefs = HELP_PM_CO_CONTRACTS_CARDS.map((c) => c.href);
    expect(hrefs).toContain("/change-orders");
    expect(hrefs).toContain("/contracts");
  });

  it("FAQ rejects commercial health invent", () => {
    const text = pmCoContractsFaqItems.map((f) => f.answer).join(" ").toLowerCase();
    expect(text).toMatch(/do not invent|not invent|no\./);
    expect(text).not.toMatch(/all clear health/);
  });
});
