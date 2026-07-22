import { describe, expect, it } from "vitest";
import {
  SOV_PHONE_GLANCE_NOTE,
  SUBCONTRACT_LIST_EMPTY_DESCRIPTION,
  subcontractMobileListUrl,
  subcontractSovHref,
} from "./subcontract-mobile-list";

describe("subcontract-mobile-list (band 3.6 / 3.5.6–3.5.7)", () => {
  it("builds mobile list URL with view=mobile", () => {
    expect(subcontractMobileListUrl("p1")).toContain("view=mobile");
    expect(subcontractMobileListUrl("p1")).toContain("/api/subcontracts");
    expect(subcontractMobileListUrl("p1")).toContain("projectId=p1");
  });

  it("empty copy rejects commercial health", () => {
    expect(SUBCONTRACT_LIST_EMPTY_DESCRIPTION.toLowerCase()).toMatch(/not a commercial health/);
  });

  it("SOV phone note is read-only", () => {
    expect(SOV_PHONE_GLANCE_NOTE.toLowerCase()).toMatch(/read-only|desktop/);
    expect(subcontractSovHref("abc")).toBe("/contracts/abc/sov");
  });
});
