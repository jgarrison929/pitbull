import { describe, it, expect } from "vitest";
import { shouldShowSiteWalkTwinLink } from "./site-walk-twin-link";

describe("shouldShowSiteWalkTwinLink (2.14.7)", () => {
  it("shows twin only when digitalTwin flag is on", () => {
    expect(shouldShowSiteWalkTwinLink(true)).toBe(true);
    expect(shouldShowSiteWalkTwinLink(false)).toBe(false);
  });
});
