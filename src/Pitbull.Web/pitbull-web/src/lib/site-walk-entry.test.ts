import { describe, it, expect } from "vitest";
import { buildSiteWalkHref, SITE_WALK_ENTRY_LABEL } from "./site-walk";

describe("site walk entry (2.14.3)", () => {
  it("uses unified Today on this job label and real site-walk path", () => {
    expect(SITE_WALK_ENTRY_LABEL).toBe("Today on this job");
    expect(buildSiteWalkHref("p1")).toBe("/projects/p1/site-walk");
  });
});
