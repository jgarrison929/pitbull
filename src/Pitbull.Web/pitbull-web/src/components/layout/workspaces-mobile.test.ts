import { describe, expect, it } from "vitest";
import { getRoleDefaults } from "./workspaces";
import { isMobileTabActive } from "./nav-utils";

describe("role mobileTabs (shipped workspaces)", () => {
  it("every role profile returns 3–5 mobile tabs with href + icon", () => {
    const profiles = [
      "executive",
      "cfo",
      "projectManager",
      "estimator",
      "field",
      "Admin",
      "Manager",
    ];
    for (const profile of profiles) {
      const defaults = getRoleDefaults(["Manager"], profile);
      expect(defaults.mobileTabs.length).toBeGreaterThanOrEqual(3);
      expect(defaults.mobileTabs.length).toBeLessThanOrEqual(5);
      for (const tab of defaults.mobileTabs) {
        expect(tab.href.startsWith("/")).toBe(true);
        expect(tab.label.length).toBeGreaterThan(0);
        expect(tab.icon.length).toBeGreaterThan(0);
      }
    }
  });

  it("PM mobile tabs highlight nested project routes for Projects tab", () => {
    const tabs = getRoleDefaults(undefined, "projectManager").mobileTabs;
    const projects = tabs.find((t) => t.href === "/projects" || t.label === "Projects");
    expect(projects).toBeDefined();
    expect(isMobileTabActive("/projects/abc/daily-reports", projects!)).toBe(true);
  });

  it("default mobile tabs include Home and Time", () => {
    const tabs = getRoleDefaults().mobileTabs;
    const hrefs = tabs.map((t) => t.href);
    expect(hrefs).toContain("/");
    expect(hrefs.some((h) => h.includes("time-tracking") || h === "/time-tracking")).toBe(true);
  });
});
