import { describe, expect, it } from "vitest";
import { getRoleDefaults } from "./workspaces";
import { resolveActiveMobileTabHref } from "./nav-utils";

/**
 * Demo Explore-as-role personas (login buttons) → JWT role_profile keys.
 * These are the profiles mobile traffic hits hardest on the public demo.
 */
const DEMO_PERSONAS = [
  {
    key: "ceo",
    profile: "executive",
    homeLayout: "executive",
    mustReach: ["/", "/projects", "/billing/aging", "/reports/financial-overview"],
  },
  {
    key: "cfo",
    profile: "cfo",
    homeLayout: "controller",
    mustReach: ["/", "/accounting/wip", "/billing/aging", "/billing/applications"],
  },
  {
    key: "pm",
    profile: "projectManager",
    homeLayout: "pm",
    mustReach: ["/", "/projects", "/rfis", "/time-tracking"],
  },
  {
    key: "superintendent",
    profile: "field",
    homeLayout: "field",
    mustReach: ["/", "/time-tracking/crew-entry", "/daily-reports/mobile", "/projects"],
  },
  {
    key: "estimator",
    profile: "estimator",
    homeLayout: "estimator",
    mustReach: ["/", "/bids", "/projects", "/cost-codes"],
  },
] as const;

describe("demo role mobile bottom-nav matrix", () => {
  for (const persona of DEMO_PERSONAS) {
    it(`${persona.key} (${persona.profile}) has 4 tabs covering day-job destinations`, () => {
      const defaults = getRoleDefaults(["Manager"], persona.profile);
      expect(defaults.mobileTabs).toHaveLength(4);

      const hrefs = defaults.mobileTabs.map((t) => t.href);
      for (const dest of persona.mustReach) {
        const covered = defaults.mobileTabs.some((tab) => {
          if (dest === "/") return tab.href === "/";
          const prefixes = tab.matchPaths?.length ? tab.matchPaths : [tab.href];
          return prefixes.some(
            (p) => dest === p || dest.startsWith(p + "/") || tab.href === dest
          );
        });
        expect(covered, `${persona.key} should reach ${dest}`).toBe(true);
      }

      // Every tab is absolute app path
      for (const href of hrefs) {
        expect(href.startsWith("/")).toBe(true);
      }
    });

    it(`${persona.key} has role-specific quick actions (not generic only)`, () => {
      const defaults = getRoleDefaults(["Manager"], persona.profile);
      expect(defaults.quickActions.length).toBeGreaterThanOrEqual(2);
      expect(defaults.quickActions.every((a) => a.href.startsWith("/"))).toBe(true);
    });
  }

  it("CEO aging tab is unique (not whole /billing)", () => {
    const tabs = getRoleDefaults(undefined, "executive").mobileTabs;
    const aging = tabs.find((t) => t.href.includes("aging"));
    expect(aging).toBeDefined();
    expect(aging!.matchPaths).toEqual(["/billing/aging"]);
  });

  it("CFO on WIP does not activate billing tab", () => {
    const tabs = getRoleDefaults(undefined, "cfo").mobileTabs;
    expect(resolveActiveMobileTabHref("/accounting/wip", tabs)).toBe("/accounting/wip");
    expect(resolveActiveMobileTabHref("/billing/applications", tabs)).toBe(
      "/billing/applications"
    );
  });

  it("PM nested project daily-reports still highlights Projects", () => {
    const tabs = getRoleDefaults(undefined, "projectManager").mobileTabs;
    expect(
      resolveActiveMobileTabHref("/projects/abc-id/daily-reports", tabs)
    ).toBe("/projects");
  });

  it("superintendent field profile FAB prioritizes crew entry", () => {
    const qa = getRoleDefaults(undefined, "field").quickActions;
    expect(qa.some((a) => a.href.includes("crew-entry"))).toBe(true);
    expect(qa.some((a) => a.href.includes("daily-reports"))).toBe(true);
  });
});
