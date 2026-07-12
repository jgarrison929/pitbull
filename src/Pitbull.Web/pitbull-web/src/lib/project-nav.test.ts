import { describe, expect, it } from "vitest";
import {
  getActiveProjectNavItem,
  getPrimaryProjectNavItems,
  getProjectNavItems,
  groupProjectNavItems,
  isProjectNavItemActive,
  shouldShowProjectSubNav,
} from "./project-nav";

const PID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("getProjectNavItems", () => {
  it("puts site walk first among primary field tiles", () => {
    const primary = getPrimaryProjectNavItems(PID);
    expect(primary.map((i) => i.id)).toEqual([
      "site-walk",
      "field-report",
      "plans",
      "schedule",
    ]);
    expect(primary[0]?.href).toContain("/site-walk");
  });

  it("includes RFIs, documents, and digital twin in the full catalog", () => {
    const ids = getProjectNavItems(PID).map((i) => i.id);
    expect(ids).toContain("rfis");
    expect(ids).toContain("documents");
    expect(ids).toContain("submittals");
    expect(ids).toContain("twin");
    const twin = getProjectNavItems(PID).find((i) => i.id === "twin")!;
    expect(twin.href).toBe(`/projects/${PID}/twin`);
  });
});

describe("isProjectNavItemActive", () => {
  it("matches overview only on exact project root", () => {
    const overview = getProjectNavItems(PID).find((i) => i.id === "overview")!;
    expect(isProjectNavItemActive(`/projects/${PID}`, overview, PID)).toBe(
      true
    );
    expect(
      isProjectNavItemActive(`/projects/${PID}/rfis`, overview, PID)
    ).toBe(false);
  });

  it("matches site walk under its path", () => {
    const walk = getProjectNavItems(PID).find((i) => i.id === "site-walk")!;
    expect(
      isProjectNavItemActive(`/projects/${PID}/site-walk`, walk, PID)
    ).toBe(true);
  });
});

describe("getActiveProjectNavItem", () => {
  it("resolves nested routes", () => {
    const active = getActiveProjectNavItem(`/projects/${PID}/rfis`, PID);
    expect(active?.id).toBe("rfis");
  });
});

describe("groupProjectNavItems", () => {
  it("groups without dropping items", () => {
    const items = getProjectNavItems(PID);
    const groups = groupProjectNavItems(items);
    const flat = groups.flatMap((g) => g.items);
    expect(flat).toHaveLength(items.length);
    expect(groups[0]?.group).toBe("field");
  });
});

describe("shouldShowProjectSubNav", () => {
  it("hides on print, shows on project pages", () => {
    expect(shouldShowProjectSubNav(`/projects/${PID}/print`)).toBe(false);
    expect(shouldShowProjectSubNav(`/projects/${PID}/site-walk`)).toBe(true);
    expect(shouldShowProjectSubNav("/projects")).toBe(false);
  });
});
