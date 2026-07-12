import { describe, expect, it } from "vitest";
import {
  COST_NOT_ALLOCATED_BANNER,
  shouldShowCostNotAllocatedBanner,
} from "./twin-cost-banner";

describe("twin-cost-banner (2.17.8)", () => {
  it("exposes honest not-allocated copy", () => {
    expect(COST_NOT_ALLOCATED_BANNER).toMatch(/not allocated/i);
    expect(COST_NOT_ALLOCATED_BANNER).toMatch(/no fake cost heat/i);
  });

  it("shows only in cost mode when all insufficient", () => {
    expect(shouldShowCostNotAllocatedBanner("rfi", [])).toBe(false);
    expect(shouldShowCostNotAllocatedBanner("cost", null)).toBe(true);
    expect(
      shouldShowCostNotAllocatedBanner("cost", [
        { band: "InsufficientData" },
        { band: "InsufficientData" },
      ])
    ).toBe(true);
    expect(
      shouldShowCostNotAllocatedBanner("cost", [
        { band: "InsufficientData" },
        { band: "Watch" },
      ])
    ).toBe(false);
  });
});
