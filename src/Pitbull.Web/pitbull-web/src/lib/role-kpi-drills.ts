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
      return "/time-tracking?period=thisWeek";
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

/** Parse projects list drill flags from a query string (for tests + page). */
export function parseProjectsDrillParams(
  params: URLSearchParams | Record<string, string | null | undefined>
): {
  status: string | null;
  unbilled: boolean;
  budgetAlert: boolean;
  budgetAlertPercent: number;
} {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) : (params[k] ?? null);

  const pctRaw = get("budgetAlertPercent");
  const pct = pctRaw ? Number(pctRaw) : 75;

  return {
    status: get("status"),
    unbilled: get("unbilled") === "true",
    budgetAlert: get("budgetAlert") === "true",
    budgetAlertPercent: Number.isFinite(pct) && pct > 0 ? pct : 75,
  };
}
