/**
 * Project sub-navigation catalog — single source for mobile hub + desktop strip.
 * Field surfaces (site walk, report, plans) rank first for supers on phone.
 */

import { buildFieldReportHref } from "@/lib/projects";

export type ProjectNavGroupId =
  | "field"
  | "coordination"
  | "documents"
  | "cost"
  | "overview";

export interface ProjectNavItem {
  id: string;
  label: string;
  /** Short label for dense grids */
  shortLabel?: string;
  href: string;
  group: ProjectNavGroupId;
  /** Shown as large touch tiles on mobile project hub */
  primary?: boolean;
  /** Icon key resolved in the UI component */
  icon:
    | "walk"
    | "report"
    | "plans"
    | "schedule"
    | "overview"
    | "rfi"
    | "submittal"
    | "docs"
    | "tasks"
    | "cost"
    | "punch"
    | "progress"
    | "ev"
    | "co"
    | "meetings"
    | "comms"
    | "narratives"
    | "daily";
}

export const PROJECT_NAV_GROUP_LABELS: Record<ProjectNavGroupId, string> = {
  field: "On the job",
  coordination: "Coordination",
  documents: "Documents",
  cost: "Cost & progress",
  overview: "Overview",
};

/** Ordered groups for "More on this job" sheet. */
export const PROJECT_NAV_GROUP_ORDER: ProjectNavGroupId[] = [
  "field",
  "coordination",
  "documents",
  "cost",
  "overview",
];

export function getProjectNavItems(projectId: string): ProjectNavItem[] {
  const base = `/projects/${projectId}`;
  return [
    {
      id: "site-walk",
      label: "Site walk",
      shortLabel: "Walk",
      href: `${base}/site-walk`,
      group: "field",
      primary: true,
      icon: "walk",
    },
    {
      id: "field-report",
      label: "Field report",
      shortLabel: "Report",
      href: buildFieldReportHref(projectId),
      group: "field",
      primary: true,
      icon: "report",
    },
    {
      id: "plans",
      label: "Plans & specs",
      shortLabel: "Plans",
      href: `${base}/plans-specs`,
      group: "documents",
      primary: true,
      icon: "plans",
    },
    {
      id: "schedule",
      label: "Schedule",
      shortLabel: "Schedule",
      href: `${base}/schedule`,
      group: "field",
      primary: true,
      icon: "schedule",
    },
    {
      id: "overview",
      label: "Overview",
      href: base,
      group: "overview",
      icon: "overview",
    },
    {
      id: "daily-reports",
      label: "Daily reports",
      href: `${base}/daily-reports`,
      group: "field",
      icon: "daily",
    },
    {
      id: "rfis",
      label: "RFIs",
      href: `${base}/rfis`,
      group: "coordination",
      icon: "rfi",
    },
    {
      id: "submittals",
      label: "Submittals",
      href: `${base}/submittals`,
      group: "coordination",
      icon: "submittal",
    },
    {
      id: "tasks",
      label: "Tasks",
      href: `${base}/tasks`,
      group: "coordination",
      icon: "tasks",
    },
    {
      id: "change-orders",
      label: "Change orders",
      href: `${base}/change-orders`,
      group: "coordination",
      icon: "co",
    },
    {
      id: "meetings",
      label: "Meetings",
      href: `${base}/meetings`,
      group: "coordination",
      icon: "meetings",
    },
    {
      id: "communications",
      label: "Communications",
      href: `${base}/communications`,
      group: "coordination",
      icon: "comms",
    },
    {
      id: "documents",
      label: "Documents",
      href: `${base}/documents`,
      group: "documents",
      icon: "docs",
    },
    {
      id: "punch-list",
      label: "Punch list",
      href: `${base}/punch-list`,
      group: "field",
      icon: "punch",
    },
    {
      id: "progress",
      label: "Progress",
      href: `${base}/progress`,
      group: "cost",
      icon: "progress",
    },
    {
      id: "job-cost",
      label: "Job cost",
      href: `${base}/job-cost`,
      group: "cost",
      icon: "cost",
    },
    {
      id: "projections",
      label: "Cost projections",
      href: `${base}/projections`,
      group: "cost",
      icon: "cost",
    },
    {
      id: "earned-value",
      label: "Earned value",
      href: `${base}/earned-value`,
      group: "cost",
      icon: "ev",
    },
    {
      id: "narratives",
      label: "Narratives",
      href: `${base}/narratives`,
      group: "overview",
      icon: "narratives",
    },
  ];
}

/** Primary tiles for mobile hub (order preserved from catalog). */
export function getPrimaryProjectNavItems(
  projectId: string
): ProjectNavItem[] {
  return getProjectNavItems(projectId).filter((i) => i.primary);
}

/**
 * Active nav match: overview is exact; others are path-prefix.
 * Field report lives outside /projects/[id] so match by query projectId.
 */
export function isProjectNavItemActive(
  pathname: string,
  item: ProjectNavItem,
  projectId: string
): boolean {
  if (item.id === "overview") {
    return pathname === `/projects/${projectId}`;
  }
  if (item.id === "field-report") {
    return (
      pathname.startsWith("/daily-reports/mobile") ||
      pathname === "/daily-reports/mobile"
    );
  }
  // Match route segment; avoid /plans matching /plans-specs incorrectly via loose startsWith
  const base = item.href.split("?")[0] ?? item.href;
  if (pathname === base) return true;
  return pathname.startsWith(`${base}/`);
}

export function getActiveProjectNavItem(
  pathname: string,
  projectId: string
): ProjectNavItem | undefined {
  const items = getProjectNavItems(projectId);
  // Prefer longest matching non-overview path
  const matches = items.filter((i) =>
    isProjectNavItemActive(pathname, i, projectId)
  );
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}

export function groupProjectNavItems(
  items: ProjectNavItem[]
): Array<{ group: ProjectNavGroupId; label: string; items: ProjectNavItem[] }> {
  return PROJECT_NAV_GROUP_ORDER.map((group) => ({
    group,
    label: PROJECT_NAV_GROUP_LABELS[group],
    items: items.filter((i) => i.group === group),
  })).filter((g) => g.items.length > 0);
}

/** Hide chrome on print routes. */
export function shouldShowProjectSubNav(pathname: string): boolean {
  if (pathname.includes("/print")) return false;
  return /^\/projects\/[a-f0-9-]+/i.test(pathname);
}
