import { describe, it, expect } from "vitest";
import { planOpenButtonLabel, planOpenDisabled, planCacheBadge, planUnavailableOfflineCopy } from "./plans-open-copy";

describe("plans-open-copy (3.2.5)", () => {
  it("disables open when offline and not cached", () => {
    expect(planOpenDisabled("not_cached", false)).toBe(true);
    expect(planOpenButtonLabel("not_cached", false)).toBe("Unavailable offline");
  });
  it("allows offline open when cached", () => {
    expect(planOpenDisabled("cached", false)).toBe(false);
    expect(planCacheBadge("cached")).toBe("On this device");
  });
  it("honest unavailable copy", () => {
    expect(planUnavailableOfflineCopy()).toMatch(/not saved on this device/i);
  });
});
