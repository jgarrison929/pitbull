import { describe, it, expect } from "vitest";
import {
  PLANS_ADMIN_CTA_CLASS,
  PLANS_MOBILE_SEARCH_INPUT_CLASS,
  PLANS_TOUCH_TARGET_PX,
  isPlansFieldModeViewport,
  meetsPlansTouchTarget,
} from "./plans-specs-mobile";
import { formatPlanRevisionLabel } from "./plan-revision-label";
import { buildPlansSpecsHref, resolveSiteWalkPlansFilter } from "./plans-specs-lookup";

/** 2.13.9 — vitest coverage near plans mobile layout helpers. */
describe("plans-specs mobile layout helpers (2.13.9)", () => {
  it("field mode, touch, admin hide, revision, and deep links stay coherent", () => {
    expect(isPlansFieldModeViewport(390)).toBe(true);
    expect(meetsPlansTouchTarget(PLANS_TOUCH_TARGET_PX)).toBe(true);
    expect(PLANS_ADMIN_CTA_CLASS).toMatch(/lg:/);
    expect(PLANS_MOBILE_SEARCH_INPUT_CLASS).toMatch(/min-h-\[48px\]/);
    expect(formatPlanRevisionLabel("Rev 1")).toBe("Rev 1");
    expect(formatPlanRevisionLabel(null)).toBeNull();
    const href = buildPlansSpecsHref("abc", {
      view: "plans",
      ...resolveSiteWalkPlansFilter({ sheet: "A-1" }),
    });
    expect(href).toContain("/projects/abc/plans-specs");
    expect(href).toContain("sheet=A-1");
  });
});
