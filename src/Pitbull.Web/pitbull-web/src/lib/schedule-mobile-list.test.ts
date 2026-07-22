import { describe, expect, it } from "vitest";
import {
  criticalLabel,
  formatFloatDays,
  SCHEDULE_MOBILE_EMPTY,
  scheduleActivitiesMobileUrl,
} from "./schedule-mobile-list";

describe("schedule-mobile-list (band 3.7)", () => {
  it("URL requests mobile view", () => {
    expect(scheduleActivitiesMobileUrl("p", "s")).toContain("view=mobile");
  });

  it("float null stays insufficient — no invent", () => {
    expect(formatFloatDays(null)).toMatch(/insufficient/i);
    expect(formatFloatDays(3)).toBe("3d float");
  });

  it("critical unknown when null", () => {
    expect(criticalLabel(null)).toBe("Critical unknown");
    expect(criticalLabel(true)).toBe("Critical");
  });

  it("empty is not on-track health", () => {
    expect(SCHEDULE_MOBILE_EMPTY.toLowerCase()).not.toMatch(/on track health|all clear/);
  });
});
