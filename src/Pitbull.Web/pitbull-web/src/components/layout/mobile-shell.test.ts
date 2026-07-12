import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CONTENT_COLUMN,
  FIELD_REPORT_MOBILE_PATH,
  isFieldReportMobilePath,
  MOBILE_FAB_POSITION,
  MOBILE_FIELD_WIZARD_ACTION_BAR,
  MOBILE_MAIN_BOTTOM_CLEARANCE,
  MOBILE_PWA_PROMPT_POSITION,
  MOBILE_VERSION_BADGE_OFFSET,
} from "./mobile-shell";

/**
 * Contract tests: dashboard chrome must keep using shared clearance tokens so
 * bottom nav, FAB, field wizard, PWA prompt, and version badge stay aligned.
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

  it("field wizard action bar pins to true bottom with safe-area (nav hidden)", () => {
    expect(MOBILE_FIELD_WIZARD_ACTION_BAR).toContain("fixed");
    expect(MOBILE_FIELD_WIZARD_ACTION_BAR).toContain("bottom-0");
    expect(MOBILE_FIELD_WIZARD_ACTION_BAR).toContain("safe-area-inset-bottom");
    // Must not stack a second bottom-16 band (that fought MobileBottomNav).
    expect(MOBILE_FIELD_WIZARD_ACTION_BAR).not.toContain("bottom-16");
  });

  it("PWA prompt clears bottom nav + safe-area on phone, bottom-4 on lg+", () => {
    expect(MOBILE_PWA_PROMPT_POSITION).toContain("fixed");
    expect(MOBILE_PWA_PROMPT_POSITION).toContain("safe-area-inset-bottom");
    expect(MOBILE_PWA_PROMPT_POSITION).toContain("bottom-[calc(");
    expect(MOBILE_PWA_PROMPT_POSITION).toContain("lg:bottom-4");
    expect(MOBILE_PWA_PROMPT_POSITION).not.toMatch(
      /(?:^|\s)bottom-4(?:\s|$)/
    );
  });

  it("isFieldReportMobilePath detects wizard route for nav hide", () => {
    expect(FIELD_REPORT_MOBILE_PATH).toBe("/daily-reports/mobile");
    expect(isFieldReportMobilePath("/daily-reports/mobile")).toBe(true);
    expect(isFieldReportMobilePath("/daily-reports/mobile?projectId=abc")).toBe(
      true
    );
    expect(isFieldReportMobilePath("/time-tracking/mobile")).toBe(false);
    expect(isFieldReportMobilePath("/")).toBe(false);
    expect(isFieldReportMobilePath(null)).toBe(false);
  });
});
