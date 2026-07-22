import { describe, expect, it } from "vitest";
import {
  CO_LIST_EMPTY_DESCRIPTION,
  coMobileListUrl,
  formatCoAmount,
  isCoClosed,
  ownerCoMobileListUrl,
} from "./co-mobile-list";

describe("co-mobile-list (band 3.6)", () => {
  it("builds subcontract CO mobile list URL with view=mobile", () => {
    expect(coMobileListUrl("p1")).toContain("view=mobile");
    expect(coMobileListUrl("p1")).toContain("/api/changeorders");
    expect(coMobileListUrl("p1")).toContain("projectId=p1");
    expect(coMobileListUrl()).toContain("/api/changeorders");
  });

  it("builds owner CO mobile list URL", () => {
    expect(ownerCoMobileListUrl("p1")).toContain("owner-change-orders");
    expect(ownerCoMobileListUrl("p1")).toContain("view=mobile");
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
