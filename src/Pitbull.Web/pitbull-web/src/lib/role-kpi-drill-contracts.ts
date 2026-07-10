/**
 * Single source of truth: each KPI headline predicate ↔ drill URL ↔ consumer.
 * roleKpiDrillHref derives from this table; parity tests enforce semantics.
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

export interface RoleKpiDrillContract {
  key: RoleKpiKey;
  /** Where the headline number is computed (server / analytics). */
  headlineSource: string;
  /** Server predicate documented for humans + parity tests. */
  headlinePredicate: string;
  /** Path + query that must surface the contributing set. */
  href: string;
  /** Consumer page / parser that applies the filter. */
  consumer: string;
  /**
   * Expected filter semantics after parsing the href (for parity tests).
   * Keys are free-form; values are asserted by role-kpi-drill-parity.test.ts.
   */
  expectedSemantics: Record<string, string | boolean | number>;
}

/**
 * Contracts for every RoleKpiKey. Keep in sync with RoleDashboardSummaryService
 * and list-page consumers.
 */
export const ROLE_KPI_DRILL_CONTRACTS: Record<RoleKpiKey, RoleKpiDrillContract> = {
  activeProjects: {
    key: "activeProjects",
    headlineSource: "RoleDashboardSummaryService.ActiveProjectCount",
    headlinePredicate: "Project.Status != Completed",
    href: "/projects?excludeCompleted=true",
    consumer: "projects/page.tsx + parseProjectsDrillParams",
    expectedSemantics: { excludeCompleted: true },
  },
  billedToDate: {
    key: "billedToDate",
    headlineSource: "RoleDashboardSummaryService.BilledToDate",
    headlinePredicate: "Latest non-Draft/Void BillingApplication TotalCompletedAndStoredToDate",
    href: "/billing/applications?scope=progress",
    consumer: "billing/applications/page.tsx scope=progress",
    expectedSemantics: { scopeProgress: true },
  },
  unbilledBacklog: {
    key: "unbilledBacklog",
    headlineSource: "RoleDashboardSummaryService.UnbilledContractValue",
    headlinePredicate: "Portfolio (Status!=Completed) − billed; list projects with unbilled > 0",
    href: "/projects?unbilled=true&excludeCompleted=true",
    consumer: "projects/page.tsx unbilled + ProjectService UnbilledOnly",
    expectedSemantics: { unbilled: true, excludeCompleted: true },
  },
  arApNet: {
    key: "arApNet",
    headlineSource: "RoleDashboardSummaryService.ArApNetPosition",
    headlinePredicate: "AgingSummary.NetPosition (AR − AP)",
    href: "/billing/aging",
    consumer: "billing/aging/page.tsx focus=both",
    expectedSemantics: { focus: "both", overdueOnly: false },
  },
  arTotal: {
    key: "arTotal",
    headlineSource: "RoleDashboardSummaryService.ArTotal",
    headlinePredicate: "Aging AccountsReceivable.Total",
    href: "/billing/aging?focus=ar",
    consumer: "billing/aging/page.tsx parseAgingDrillParams",
    expectedSemantics: { focus: "ar", overdueOnly: false },
  },
  arOverdue: {
    key: "arOverdue",
    headlineSource: "RoleDashboardSummaryService.ArOverdue",
    headlinePredicate: "AR days31To60 + days61To90 + days90Plus",
    href: "/billing/aging?focus=ar&overdue=true",
    consumer: "billing/aging/page.tsx overdue line filter",
    expectedSemantics: { focus: "ar", overdueOnly: true },
  },
  apTotal: {
    key: "apTotal",
    headlineSource: "RoleDashboardSummaryService.ApTotal",
    headlinePredicate: "Aging AccountsPayable.Total",
    href: "/billing/aging?focus=ap",
    consumer: "billing/aging/page.tsx",
    expectedSemantics: { focus: "ap", overdueOnly: false },
  },
  apNearTerm: {
    key: "apNearTerm",
    headlineSource: "RoleDashboardSummaryService.ApDueNearTerm",
    headlinePredicate: "AP Current + Days1To30",
    href: "/billing/aging?focus=ap",
    consumer: "billing/aging/page.tsx",
    expectedSemantics: { focus: "ap", overdueOnly: false },
  },
  workforce: {
    key: "workforce",
    headlineSource: "RoleDashboardSummaryService.ActiveEmployeeCount",
    headlinePredicate: "Employee.IsActive",
    href: "/employees?isActive=true",
    consumer: "employees/page.tsx isActive filter",
    expectedSemantics: { isActive: "true" },
  },
  safetyYtd: {
    key: "safetyYtd",
    headlineSource: "RoleDashboardSummaryService.SafetyIncidentsYtd",
    headlinePredicate: "PmDailyReportSafetyIncident CreatedAt >= year start",
    href: "/reports/safety?period=ytd",
    consumer: "reports/safety/page.tsx",
    expectedSemantics: { period: "ytd" },
  },
  compliance: {
    key: "compliance",
    headlineSource: "RoleDashboardSummaryService.Compliance",
    headlinePredicate: "All ComplianceDocuments",
    href: "/reports/compliance",
    consumer: "reports/compliance/page.tsx",
    expectedSemantics: { unfiltered: true },
  },
  complianceAttention: {
    key: "complianceAttention",
    headlineSource: "RoleDashboardSummaryService.Compliance expiring+expired",
    headlinePredicate: "Status ExpiringSoon OR Expired",
    href: "/reports/compliance?status=attention",
    consumer: "reports/compliance/page.tsx status=attention",
    expectedSemantics: { status: "attention" },
  },
  bidPipeline: {
    key: "bidPipeline",
    headlineSource: "RoleDashboardSummaryService.OpenBidCount / BidPipelineValue",
    headlinePredicate: "Bid Status Draft OR Submitted",
    href: "/bids?pipeline=open",
    consumer: "bids/page.tsx pipeline=open",
    expectedSemantics: { pipelineOpen: true },
  },
  openRfis: {
    key: "openRfis",
    headlineSource: "RoleDashboardSummaryService.OpenRfiCount / DashboardAnalytics OpenRFIs",
    headlinePredicate: "Rfi.Status != Closed (Open + Answered)",
    href: "/rfis?status=notClosed",
    consumer: "rfis/page.tsx resolveRfiStatusParam notClosed",
    expectedSemantics: { rfiStatusMode: "notClosed" },
  },
  openChangeOrders: {
    key: "openChangeOrders",
    headlineSource: "RoleDashboardSummaryService.OpenChangeOrderCount",
    headlinePredicate: "ChangeOrder Status Pending OR UnderReview",
    href: "/change-orders?status=open",
    consumer: "change-orders/page.tsx status=open",
    expectedSemantics: { changeOrderOpen: true },
  },
  budgetAlert: {
    key: "budgetAlert",
    headlineSource: "DashboardAnalytics projectBudgetHealth percentUsed >= 75",
    headlinePredicate: "Labor spend % of contract >= 75",
    href: "/projects?budgetAlert=true&budgetAlertPercent=75",
    consumer: "projects/page.tsx + ProjectService BudgetAlert",
    expectedSemantics: { budgetAlert: true, budgetAlertPercent: 75 },
  },
  budgetAlertStrict: {
    key: "budgetAlertStrict",
    headlineSource: "Controller dashboard budgetAlerts percentUsed >= 90",
    headlinePredicate: "Labor spend % of contract >= 90",
    href: "/projects?budgetAlert=true&budgetAlertPercent=90",
    consumer: "projects/page.tsx + ProjectService BudgetAlert",
    expectedSemantics: { budgetAlert: true, budgetAlertPercent: 90 },
  },
  pendingTimeApprovals: {
    key: "pendingTimeApprovals",
    headlineSource: "DashboardAnalytics PendingApprovals (Submitted time)",
    headlinePredicate: "TimeEntry Status Submitted",
    href: "/time-tracking/approval?status=pending",
    consumer: "time-tracking/approval",
    expectedSemantics: { status: "pending" },
  },
  hoursThisWeek: {
    key: "hoursThisWeek",
    headlineSource: "DashboardAnalytics HoursThisWeek",
    headlinePredicate: "Time entries in current week",
    href: "/time-tracking?view=entries&period=thisWeek",
    consumer: "time-tracking/page.tsx parseTimeTrackingDrillParams",
    expectedSemantics: { viewEntries: true, periodThisWeek: true },
  },
  estimatorProjects: {
    key: "estimatorProjects",
    headlineSource: "DashboardAnalytics ActiveProjects (same portfolio set)",
    headlinePredicate: "Project.Status != Completed",
    href: "/projects?excludeCompleted=true",
    consumer: "projects/page.tsx excludeCompleted",
    expectedSemantics: { excludeCompleted: true },
  },
  viewRfis: {
    key: "viewRfis",
    headlineSource: "Same as openRfis (PM action)",
    headlinePredicate: "Rfi.Status != Closed",
    href: "/rfis?status=notClosed",
    consumer: "rfis/page.tsx",
    expectedSemantics: { rfiStatusMode: "notClosed" },
  },
};

export function contractHref(key: RoleKpiKey): string {
  return ROLE_KPI_DRILL_CONTRACTS[key].href;
}

export function allRoleKpiKeys(): RoleKpiKey[] {
  return Object.keys(ROLE_KPI_DRILL_CONTRACTS) as RoleKpiKey[];
}
