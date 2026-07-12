import { describe, it, expect } from "vitest";
import {
  PLANS_ADMIN_BLOCK_CLASS,
  PLANS_ADMIN_CTA_CLASS,
  PLANS_MOBILE_SEARCH_INPUT_CLASS,
  PLANS_TOUCH_TARGET_PX,
  isPlansFieldModeViewport,
  meetsPlansTouchTarget,
} from "./plans-specs-mobile";

describe("plans-specs-mobile (2.13.4–2.13.5)", () => {
  it("treats phone 390 as field mode and desktop 1280 as admin-capable", () => {
    expect(isPlansFieldModeViewport(390)).toBe(true);
    expect(isPlansFieldModeViewport(1023)).toBe(true);
    expect(isPlansFieldModeViewport(1024)).toBe(false);
  });

  it("exports admin-only visibility classes for lg+ CRUD", () => {
    expect(PLANS_ADMIN_CTA_CLASS).toContain("hidden");
    expect(PLANS_ADMIN_CTA_CLASS).toContain("lg:");
    expect(PLANS_ADMIN_BLOCK_CLASS).toContain("hidden");
    expect(PLANS_ADMIN_BLOCK_CLASS).toContain("lg:");
  });

  it("enforces 44px touch targets for plan controls", () => {
    expect(PLANS_TOUCH_TARGET_PX).toBe(44);
    expect(meetsPlansTouchTarget(44)).toBe(true);
    expect(meetsPlansTouchTarget(43)).toBe(false);
    expect(PLANS_MOBILE_SEARCH_INPUT_CLASS).toMatch(/min-h-\[48px\]/);
  });
});