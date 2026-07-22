import { describe, expect, it } from "vitest";
import {
  CO_LIST_EMPTY_DESCRIPTION,
  coMobileListUrl,
  formatCoAmount,
  isCoClosed,
} from "./co-mobile-list";

describe("co-mobile-list (band 3.6)", () => {
  it("builds mobile list URL", () => {
    expect(coMobileListUrl("p1")).toContain("view=mobile");
    expect(coMobileListUrl()).toContain("owner-change-orders");
  });

  it("formats amount or em dash", () => {
    expect(formatCoAmount(null)).toBe("—");
    expect(formatCoAmount(1200)).toMatch(/\$/);
  });

  it("empty copy rejects health framing", () => {
    expect(CO_LIST_EMPTY_DESCRIPTION.toLowerCase()).toMatch(/not a commercial health/);
  });

  it("closed statuses are terminal", () => {
    expect(isCoClosed("Approved")).toBe(true);
    expect(isCoClosed("Pending")).toBe(false);
  });
});
