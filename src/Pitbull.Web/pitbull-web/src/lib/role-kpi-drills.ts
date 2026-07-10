/**
 * Pure URL builders for role-dashboard KPI drill-through.
 * Each destination encodes metric-specific filters so lists answer “why”.
 */

export type RoleKpiKey =
  | "activeProjects"
  | "billedToDate"
  | "unbilledBacklog"
  | "arApNet"
  | "arTotal"
  | "arOverdue"
  | "apTotal"
  | "apNearTerm"
  | "workforce"
  | "safetyYtd"
  | "compliance"
  | "complianceAttention"
  | "bidPipeline"
  | "openRfis"
  | "openChangeOrders"
  | "budgetAlert"
  | "budgetAlertStrict"
  | "pendingTimeApprovals"
  | "hoursThisWeek"
  | "estimatorProjects"
  | "viewRfis";

/** Build drill path for a named KPI. Pure — unit-tested without UI. */
export function roleKpiDrillHref(key: RoleKpiKey): string {
  switch (key) {
    case "activeProjects":
      return "/projects?status=active";
    case "billedToDate":
      // Progress apps that contribute to G702 billed-to-date (exclude pure drafts)
      return "/billing/applications?scope=progress";
    case "unbilledBacklog":
      return "/projects?unbilled=true&status=active";
    case "arApNet":
    case "arTotal":
      return "/billing/aging?focus=ar";
    case "arOverdue":
      return "/billing/aging?focus=ar&overdue=true";
    case "apTotal":
    case "apNearTerm":
      return "/billing/aging?focus=ap";
    case "workforce":
      return "/employees?isActive=true";
    case "safetyYtd":
      return "/reports/safety?period=ytd";
    case "compliance":
      return "/reports/compliance";
    case "complianceAttention":
      return "/reports/compliance?status=attention";
    case "bidPipeline":
      return "/bids?pipeline=open";
    case "openRfis":
      return "/rfis?status=open";
    case "openChangeOrders":
      return "/change-orders?status=open";
    case "budgetAlert":
      return "/projects?budgetAlert=true&budgetAlertPercent=75";
    case "budgetAlertStrict":
      return "/projects?budgetAlert=true&budgetAlertPercent=90";
    case "pendingTimeApprovals":
      return "/time-tracking/approval?status=pending";
    case "hoursThisWeek":
      // Must set view=entries so /time-tracking does not redirect to crew-entry
      return "/time-tracking?view=entries&period=thisWeek";
    case "estimatorProjects":
      return "/projects?status=active";
    case "viewRfis":
      return "/rfis?status=open";
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
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
} {
  const pctRaw = getParam(params, "budgetAlertPercent");
  const pct = pctRaw ? Number(pctRaw) : 75;

  return {
    status: getParam(params, "status"),
    unbilled: getParam(params, "unbilled") === "true",
    budgetAlert: getParam(params, "budgetAlert") === "true",
    budgetAlertPercent: Number.isFinite(pct) && pct > 0 ? pct : 75,
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
  // Stay on entries list when explicitly requested or when a period drill is present
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
