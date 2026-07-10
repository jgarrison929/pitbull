/**
 * Pure URL builders for role-dashboard KPI drill-through.
 * Hrefs are defined in role-kpi-drill-contracts (headline predicate parity).
 */

import { contractHref, type RoleKpiKey } from "./role-kpi-drill-contracts";

export type { RoleKpiKey };

/** Build drill path for a named KPI from the contract table. */
export function roleKpiDrillHref(key: RoleKpiKey): string {
  return contractHref(key);
}

function getParam(
  params: URLSearchParams | Record<string, string | null | undefined>,
  k: string
): string | null {
  return params instanceof URLSearchParams ? params.get(k) : (params[k] ?? null);
}

/** Parse projects list drill flags from a query string (for tests + page). */
export function parseProjectsDrillParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): {
  status: string | null;
  unbilled: boolean;
  budgetAlert: boolean;
  budgetAlertPercent: number;
  excludeCompleted: boolean;
} {
  const pctRaw = getParam(params, "budgetAlertPercent");
  const pct = pctRaw ? Number(pctRaw) : 75;
  const status = getParam(params, "status");
  const excludeCompleted =
    getParam(params, "excludeCompleted") === "true" ||
    (status?.toLowerCase() === "notcompleted");

  return {
    status,
    unbilled: getParam(params, "unbilled") === "true",
    budgetAlert: getParam(params, "budgetAlert") === "true",
    budgetAlertPercent: Number.isFinite(pct) && pct > 0 ? pct : 75,
    excludeCompleted,
  };
}

export type AgingFocus = "ar" | "ap" | "both";

/** Parse aging report drill flags (focus=ar|ap, overdue=true for 31+ days). */
export function parseAgingDrillParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): { focus: AgingFocus; overdueOnly: boolean } {
  const focusRaw = (getParam(params, "focus") ?? "").toLowerCase();
  const focus: AgingFocus =
    focusRaw === "ar" || focusRaw === "ap" ? focusRaw : "both";
  return {
    focus,
    overdueOnly: getParam(params, "overdue") === "true",
  };
}

/** True when a line has any balance in 31–60 / 61–90 / 90+ buckets. */
export function agingLineHasOverdue31Plus(line: {
  days31To60: number;
  days61To90: number;
  days90Plus: number;
}): boolean {
  return (
    (line.days31To60 ?? 0) + (line.days61To90 ?? 0) + (line.days90Plus ?? 0) > 0
  );
}

/** Monday-start ISO date range for “this week” (UTC calendar week for API filters). */
export function thisWeekDateRangeUtc(now = new Date()): {
  startDate: string;
  endDate: string;
} {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { startDate: iso(monday), endDate: iso(sunday) };
}

/** Parse time-tracking list drill flags. */
export function parseTimeTrackingDrillParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): {
  viewEntries: boolean;
  periodThisWeek: boolean;
  startDate: string | null;
  endDate: string | null;
} {
  const view = getParam(params, "view");
  const period = (getParam(params, "period") ?? "").toLowerCase();
  const periodThisWeek = period === "thisweek";
  const viewEntries = view === "entries" || periodThisWeek;
  let startDate = getParam(params, "startDate");
  let endDate = getParam(params, "endDate");
  if (periodThisWeek && !startDate && !endDate) {
    const range = thisWeekDateRangeUtc();
    startDate = range.startDate;
    endDate = range.endDate;
  }
  return { viewEntries, periodThisWeek, startDate, endDate };
}

/** RFI status drill: single enum, notClosed (= Open+Answered), or all. */
export type RfiStatusMode = "all" | "single" | "notClosed";

export function parseRfiDrillParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): { mode: RfiStatusMode; statusCode: string | null } {
  const raw = getParam(params, "status");
  if (!raw) return { mode: "all", statusCode: null };
  const lower = raw.toLowerCase();
  if (lower === "notclosed" || lower === "openoranswered") {
    return { mode: "notClosed", statusCode: null };
  }
  const map: Record<string, string> = {
    open: "0",
    answered: "1",
    closed: "2",
  };
  if (map[lower]) return { mode: "single", statusCode: map[lower] };
  if (["0", "1", "2"].includes(raw)) return { mode: "single", statusCode: raw };
  return { mode: "all", statusCode: null };
}

/** Matches RoleDashboardSummary OpenRfiCount: Status != Closed. */
export function rfiMatchesNotClosed(status: number): boolean {
  // 0 Open, 1 Answered, 2 Closed
  return status !== 2;
}
