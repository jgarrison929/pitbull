import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CONTENT_COLUMN,
  MOBILE_FAB_POSITION,
  MOBILE_MAIN_BOTTOM_CLEARANCE,
  MOBILE_VERSION_BADGE_OFFSET,
} from "./mobile-shell";

/**
 * Contract tests: dashboard chrome must keep using shared clearance tokens so
 * bottom nav, FAB, and version badge stay aligned across releases.
 */
describe("mobile-shell tokens", () => {
  it("main clearance includes safe-area and lg reset", () => {
    expect(MOBILE_MAIN_BOTTOM_CLEARANCE).toContain("safe-area-inset-bottom");
    expect(MOBILE_MAIN_BOTTOM_CLEARANCE).toContain("lg:pb-6");
    expect(MOBILE_MAIN_BOTTOM_CLEARANCE).toMatch(/pb-\[calc\(/);
  });

  it("FAB is lg-hidden and sits above bottom nav clearance", () => {
    expect(MOBILE_FAB_POSITION).toContain("lg:hidden");
    expect(MOBILE_FAB_POSITION).toContain("fixed");
    expect(MOBILE_FAB_POSITION).toContain("safe-area-inset-bottom");
    expect(MOBILE_FAB_POSITION).toContain("bottom-[calc(");
  });

  it("version badge lifts on max-lg viewports", () => {
    expect(MOBILE_VERSION_BADGE_OFFSET).toContain("max-lg:bottom-");
    expect(MOBILE_VERSION_BADGE_OFFSET).toContain("safe-area-inset-bottom");
  });

  it("content column prevents horizontal page blowout", () => {
    expect(DASHBOARD_CONTENT_COLUMN).toContain("min-w-0");
    expect(DASHBOARD_CONTENT_COLUMN).toContain("overflow-x-hidden");
  });
});
