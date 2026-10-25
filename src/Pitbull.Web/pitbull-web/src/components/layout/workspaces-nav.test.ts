import { describe, expect, it } from "vitest";
import {
  workspaces,
  getProjectWorkspaceItems,
  getProjectWorkspaceNav,
  getWorkspaceLandingHref,
  detectWorkspaceFromPath,
  isMisplacedUnderPeople,
  getRoleDefaults,
  getAllNavItems,
  roleAllowsWorkspace,
} from "./workspaces";

describe("workspace nav model (2.12.0)", () => {
  const people = workspaces.find((w) => w.id === "people");
  const projectsGlobal = getProjectWorkspaceItems(null);

  it("People workspace excludes cost codes, projects, and contracts", () => {
    expect(people).toBeDefined();
    const hrefs = people!.items.map((i) => i.href);
    expect(hrefs).not.toContain("/cost-codes");
    expect(hrefs).not.toContain("/projects");
    expect(hrefs).not.toContain("/contracts");
    expect(hrefs.every((h) => !isMisplacedUnderPeople(h))).toBe(true);
  });

  it("People workspace is workforce + payroll + fleet", () => {
    const hrefs = people!.items.map((i) => i.href);
    expect(hrefs).toContain("/employees");
    expect(hrefs).toContain("/time-tracking");
    expect(hrefs).toContain("/payroll/runs");
    expect(hrefs).toContain("/equipment");
    expect(hrefs).toContain("/my-approvals");
  });

  it("People landing is employees, never cost-codes", () => {
    expect(getWorkspaceLandingHref("people")).toBe("/employees");
    expect(getWorkspaceLandingHref("people")).not.toBe("/cost-codes");
  });

  it("Cost codes live under Projects portfolio items", () => {
    const hrefs = projectsGlobal.map((i) => i.href);
    expect(hrefs).toContain("/cost-codes");
    expect(hrefs).toContain("/bids");
    expect(hrefs).toContain("/projects");
  });

  it("detectWorkspaceFromPath maps cost-codes to projects, not people", () => {
    expect(detectWorkspaceFromPath("/cost-codes")).toBe("projects");
    expect(detectWorkspaceFromPath("/employees")).toBe("people");
    expect(detectWorkspaceFromPath("/equipment")).toBe("people");
    expect(detectWorkspaceFromPath("/billing/aging")).toBe("finance");
    expect(detectWorkspaceFromPath("/procurement/invoices")).toBe("operations");
    expect(detectWorkspaceFromPath("/accounting/wip")).toBe("finance");
  });

  it("Finance landing is WIP (construction-first), not journal dump", () => {
    expect(getWorkspaceLandingHref("finance")).toBe("/accounting/wip");
  });

  it("role profiles seed favorites that resolve in getAllNavItems catalog", () => {
    const profiles = ["executive", "cfo", "projectManager", "estimator", "field", "Admin"] as const;
    const all = getAllNavItems(null);
    const allHrefs = new Set(all.map((i) => i.href));
    // Favorites may include field shortcuts not in static workspace lists
    const allowedExtra = new Set([
      "/daily-reports/mobile",
      "/time-tracking/crew-entry",
      "/rfis/new",
      "/sub-status",
      "/employees/new",
      "/employees/onboarding",
      "/accounting/journal-entries/new",
      "/procurement/invoices/new",
      "/bids/new",
    ]);
    for (const profile of profiles) {
      const favs = getRoleDefaults(["Manager"], profile).favorites;
      for (const href of favs) {
        const ok = allHrefs.has(href) || allowedExtra.has(href) || href === "/";
        expect(ok, `${profile} favorite ${href} should be navigable`).toBe(true);
      }
    }
  });

  it("People separators use Workforce / Payroll / Fleet labels", () => {
    const labels = (people!.separators ?? []).map((s) => s.label);
    expect(labels).toContain("Workforce");
    expect(labels).toContain("Payroll");
    expect(labels).toContain("Fleet");
    expect(labels).not.toContain("Day-1 Setup");
  });

  it("role-scopes workspaces: field has no finance/admin; CEO has no admin", () => {
    expect(roleAllowsWorkspace("finance", undefined, "field")).toBe(false);
    expect(roleAllowsWorkspace("admin", undefined, "field")).toBe(false);
    expect(roleAllowsWorkspace("projects", undefined, "field")).toBe(true);
    expect(roleAllowsWorkspace("admin", undefined, "executive")).toBe(false);
    expect(roleAllowsWorkspace("finance", undefined, "executive")).toBe(true);
    expect(roleAllowsWorkspace("projects", undefined, "estimator")).toBe(true);
    expect(roleAllowsWorkspace("people", undefined, "estimator")).toBe(false);
    expect(roleAllowsWorkspace("admin", undefined, "Admin")).toBe(true);
  });

  it("open project nav has Twin in primary (not buried under More)", () => {
    const nav = getProjectWorkspaceNav("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(nav.primary.length).toBeLessThanOrEqual(6);
    expect(nav.primary.length).toBeGreaterThanOrEqual(4);
    expect(nav.moreGroups.length).toBeGreaterThanOrEqual(2);
    const primaryHrefs = nav.primary.map((i) => i.href);
    expect(primaryHrefs.some((h) => h.endsWith("/site-walk"))).toBe(true);
    expect(primaryHrefs.some((h) => h.endsWith("/twin"))).toBe(true);
    expect(primaryHrefs.some((h) => h.endsWith("/rfis"))).toBe(true);
    // Job cost stays under More / Cost
    expect(primaryHrefs.some((h) => h.endsWith("/job-cost"))).toBe(false);
    const moreHrefs = nav.moreGroups.flatMap((g) => g.items.map((i) => i.href));
    expect(moreHrefs.some((h) => h.endsWith("/job-cost"))).toBe(true);
  });

  it("role favorites stay short (≤4)", () => {
    for (const profile of ["executive", "cfo", "projectManager", "estimator", "field"] as const) {
      const favs = getRoleDefaults(undefined, profile).favorites;
      expect(favs.length, profile).toBeLessThanOrEqual(4);
    }
  });
});
