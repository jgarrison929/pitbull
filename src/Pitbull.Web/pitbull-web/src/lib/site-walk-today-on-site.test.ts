import { describe, it, expect } from "vitest";
import { siteWalkTodayOnSiteEnabled, SITE_WALK_TODAY_ON_SITE_HINT } from "./site-walk-today-on-site";
describe("site-walk today-on-site (3.3.4)", () => {
  it("shares API not second aggregation", () => {
    expect(siteWalkTodayOnSiteEnabled()).toBe(true);
    expect(SITE_WALK_TODAY_ON_SITE_HINT).toMatch(/same project API/i);
  });
});
