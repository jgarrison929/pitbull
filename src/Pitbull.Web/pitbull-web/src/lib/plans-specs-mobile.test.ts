import { describe, it, expect } from "vitest";
import {
  PLANS_ADMIN_BLOCK_CLASS,
  PLANS_ADMIN_CTA_CLASS,
  isPlansFieldModeViewport,
} from "./plans-specs-mobile";

describe("plans-specs-mobile (2.13.4)", () => {
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
});
