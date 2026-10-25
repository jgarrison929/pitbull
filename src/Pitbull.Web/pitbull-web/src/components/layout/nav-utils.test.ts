import { describe, expect, it } from "vitest";
import {
  findActiveHref,
  isMobileTabActive,
  resolveActiveMobileTabHref,
} from "./nav-utils";
import type { NavItem } from "./nav-items";

describe("isMobileTabActive", () => {
  it("matches home only on exact /", () => {
    expect(isMobileTabActive("/", { href: "/" })).toBe(true);
    expect(isMobileTabActive("/projects", { href: "/" })).toBe(false);
  });

  it("uses matchPaths prefixes for nested routes", () => {
    const tab = {
      href: "/time-tracking",
      matchPaths: ["/time-tracking"],
    };
    expect(isMobileTabActive("/time-tracking", tab)).toBe(true);
    expect(isMobileTabActive("/time-tracking/crew-entry", tab)).toBe(true);
    expect(isMobileTabActive("/projects", tab)).toBe(false);
  });

  it("falls back to href prefix when matchPaths omitted", () => {
    expect(isMobileTabActive("/projects/abc/tasks", { href: "/projects" })).toBe(true);
    expect(isMobileTabActive("/project-management", { href: "/projects" })).toBe(false);
  });

  it("does not treat /project-management as /projects", () => {
    const tab = { href: "/projects", matchPaths: ["/projects"] };
    expect(isMobileTabActive("/project-management", tab)).toBe(false);
    expect(isMobileTabActive("/projects", tab)).toBe(true);
  });

  it("does not treat /reports as active for home matchPaths only", () => {
    const home = { href: "/", matchPaths: ["/"] };
    expect(isMobileTabActive("/reports/weekly-summary", home)).toBe(false);
  });
});

describe("findActiveHref", () => {
  const items: NavItem[] = [
    { label: "Home", href: "/", icon: "🏠" },
    { label: "Settings", href: "/settings", icon: "⚙️" },
    { label: "Notifications", href: "/settings/notifications", icon: "🔔" },
    { label: "Projects", href: "/projects", icon: "🏗️" },
  ];

  it("prefers exact match", () => {
    expect(findActiveHref("/settings/notifications", items)).toBe("/settings/notifications");
  });

  it("prefers longest prefix for nested paths", () => {
    expect(findActiveHref("/settings/company", items)).toBe("/settings");
  });

  it("returns / only for dashboard root", () => {
    expect(findActiveHref("/", items)).toBe("/");
  });
});

describe("resolveActiveMobileTabHref", () => {
  const cfoTabs = [
    { href: "/", matchPaths: ["/"] },
    { href: "/accounting/wip", matchPaths: ["/accounting/wip"] },
    { href: "/accounting/journal-entries", matchPaths: ["/accounting"] },
    { href: "/billing/aging", matchPaths: ["/billing/aging"] },
  ];

  it("picks longest match so WIP wins over broad /accounting", () => {
    expect(resolveActiveMobileTabHref("/accounting/wip", cfoTabs)).toBe("/accounting/wip");
    expect(resolveActiveMobileTabHref("/accounting/wip/xyz", cfoTabs)).toBe(
      "/accounting/wip"
    );
  });

  it("picks home only on exact /", () => {
    expect(resolveActiveMobileTabHref("/", cfoTabs)).toBe("/");
  });
});
