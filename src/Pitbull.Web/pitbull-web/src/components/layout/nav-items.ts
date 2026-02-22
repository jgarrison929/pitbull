export interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  tooltip?: string;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
}

export interface ModuleGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Core nav — always visible at top of sidebar
export const coreNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Projects", href: "/projects", icon: "🏗️", requiredPermission: "Projects.View" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️", requiredPermission: "TimeTracking.View" },
  { label: "Approvals", href: "/time-tracking/approval", icon: "✅", requiredPermission: "TimeTracking.Approve" },
];

// Resources — always visible under "Resources" header
export const resourceItems: NavItem[] = [
  { label: "Employees", href: "/employees", icon: "👷", requiredPermission: "Employees.View" },
  { label: "Cost Codes", href: "/cost-codes", icon: "🏷️", requiredPermission: "Projects.View" },
  { label: "Equipment", href: "/equipment", icon: "🚜", requiredPermission: "Equipment.View" },
  { label: "Audit Trail", href: "/time-tracking/audit", icon: "📜", requiredPermission: "TimeTracking.View" },
];

// Module groups — pinnable, collapsible in "More Modules"
export const moduleGroups: ModuleGroup[] = [
  {
    id: "financial",
    label: "Financial",
    items: [
      { label: "Journal Entries", href: "/accounting/journal-entries", icon: "📓", requiredPermission: "Accounting.ViewGL" },
      { label: "Accounting Periods", href: "/accounting/periods", icon: "📆", requiredPermission: "Accounting.ManagePeriods" },
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈", requiredPermission: "Accounting.ViewGL" },
      { label: "Chart of Accounts", href: "/chart-of-accounts", icon: "🧾", requiredPermission: "Accounting.ViewGL" },
      { label: "Retention", href: "/accounting/retention", icon: "🔒", requiredPermission: "Billing.View" },
      { label: "Lien Waivers", href: "/accounting/lien-waivers", icon: "📋", requiredPermission: "Billing.LienWaivers" },
      { label: "Bank Reconciliation", href: "/accounting/bank-reconciliation", icon: "🏦", requiredPermission: "Accounting.ManageBankAccounts" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { label: "Owner Contracts", href: "/billing/contracts", icon: "📑", requiredPermission: "Billing.View" },
      { label: "Billing Applications", href: "/billing/applications", icon: "💰", requiredPermission: "Billing.View" },
      { label: "Aging Reports", href: "/billing/aging", icon: "📊", requiredPermission: "Billing.View" },
      { label: "Pay Apps", href: "/payment-applications", icon: "💵", requiredPermission: "Billing.View" },
      { label: "Bids", href: "/bids", icon: "📋", requiredPermission: "Bids.View" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    items: [
      { label: "Payroll Runs", href: "/payroll/runs", icon: "🧮", requiredPermission: "Payroll.View" },
      { label: "Certified Payroll", href: "/payroll/certified", icon: "📄", requiredPermission: "Payroll.View" },
      { label: "Wage Determinations", href: "/payroll/wage-determinations", icon: "📚", requiredPermission: "Payroll.View" },
      { label: "Payroll Reviews", href: "/payroll/reviews", icon: "✅", requiredPermission: "Payroll.Process" },
      { label: "Payroll Exports", href: "/payroll/exports", icon: "📤", requiredPermission: "Payroll.View" },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    items: [
      { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: "🧱", requiredPermission: "AP.View" },
      { label: "Vendor Invoices", href: "/procurement/invoices", icon: "🧾", requiredPermission: "AP.View" },
      { label: "Vendors", href: "/vendors", icon: "🏢", requiredPermission: "AP.View" },
      { label: "Customers", href: "/customers", icon: "🤝", requiredPermission: "AR.View" },
      { label: "Contracts", href: "/contracts", icon: "📄", requiredPermission: "Contracts.View" },
      { label: "Change Orders", href: "/change-orders", icon: "📝", requiredPermission: "Contracts.View" },
    ],
  },
];

export const DEFAULT_PINNED_GROUPS: string[] = ["financial"];

// Backward-compatible flat exports
export const mainNavItems: NavItem[] = [
  ...coreNavItems,
  ...resourceItems,
];

export const financialItems: NavItem[] = moduleGroups.flatMap((g) => g.items);

export function getProjectManagementItems(projectId: string | null): NavItem[] {
  const base = projectId ? `/projects/${projectId}` : null;
  return [
    { label: "Daily Reports", href: base ? `${base}/daily-reports` : "#", icon: "📝", disabled: !base, requiredPermission: "PM.DailyReports" },
    { label: "Tasks", href: base ? `${base}/tasks` : "#", icon: "✅", disabled: !base, requiredPermission: "Projects.View" },
    { label: "RFIs", href: base ? `${base}/rfis` : "#", icon: "❓", disabled: !base, requiredPermission: "PM.RFIs" },
    { label: "Submittals", href: base ? `${base}/submittals` : "#", icon: "📬", disabled: !base, requiredPermission: "PM.Submittals" },
    { label: "Job Cost", href: base ? `${base}/job-cost` : "#", icon: "💰", disabled: !base, requiredPermission: "Projects.View" },
    { label: "Progress", href: base ? `${base}/progress` : "#", icon: "📈", disabled: !base, requiredPermission: "Projects.View" },
    { label: "Cost Projections", href: base ? `${base}/projections` : "#", icon: "🔮", disabled: !base, requiredPermission: "Projects.View" },
    { label: "Schedule", href: base ? `${base}/schedule` : "#", icon: "📅", disabled: !base, requiredPermission: "PM.Schedule" },
    { label: "Punch List", href: base ? `${base}/punch-list` : "#", icon: "📋", disabled: !base, requiredPermission: "PM.PunchList" },
    { label: "Documents", href: base ? `${base}/documents` : "#", icon: "📁", disabled: !base, requiredPermission: "Documents.View" },
    { label: "Plans & Specs", href: base ? `${base}/plans-specs` : "#", icon: "📐", disabled: !base, requiredPermission: "Documents.View" },
    { label: "Communications", href: base ? `${base}/communications` : "#", icon: "💬", disabled: !base, requiredPermission: "Projects.View" },
    { label: "Meetings", href: base ? `${base}/meetings` : "#", icon: "🤝", disabled: !base, requiredPermission: "PM.Meetings" },
    { label: "Narratives", href: base ? `${base}/narratives` : "#", icon: "📖", disabled: !base, requiredPermission: "Projects.View" },
  ];
}

export const reportItems: NavItem[] = [
  { label: "Weekly Summary", href: "/reports/weekly-summary", icon: "📅", requiredPermission: "Reports.View" },
  { label: "Labor Cost", href: "/reports/labor-cost", icon: "💰", requiredPermission: "Reports.View" },
  { label: "Project Profitability", href: "/reports/project-profitability", icon: "📈", requiredPermission: "Reports.View" },
  { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊", requiredPermission: "Reports.View" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤", requiredPermission: "Reports.Export" },
  { label: "Equipment Utilization", href: "/reports/equipment", icon: "🔧", requiredPermission: "Reports.View" },
];

export const helpItems: NavItem[] = [
  { label: "Help Center", href: "/help", icon: "❓" },
];

export const settingsItems: NavItem[] = [
  { label: "Preferences", href: "/settings", icon: "⚙️" },
  { label: "Notifications", href: "/settings/notifications", icon: "🔔" },
  { label: "Overtime Rules", href: "/settings/overtime", icon: "⏰" },
  { label: "Timecards", href: "/settings/time-tracking", icon: "🕐" },
  { label: "Projects", href: "/settings/projects", icon: "🏗️" },
  { label: "Contracts", href: "/settings/contracts", icon: "📄" },
  { label: "Bids", href: "/settings/bids", icon: "📋" },
  { label: "RFIs", href: "/settings/rfis", icon: "❓" },
  { label: "Reports", href: "/settings/reports", icon: "📊" },
  { label: "Company Setup", href: "/settings/company/setup", icon: "🧙" },
];

export const adminItems: NavItem[] = [
  { label: "Company Settings", href: "/admin/company", icon: "🏢", requiredPermission: "Admin.Settings" },
  { label: "Companies", href: "/admin/companies", icon: "🏛️", requiredPermission: "Admin.Companies" },
  { label: "Users", href: "/admin/users", icon: "👥", requiredPermission: "Admin.Users" },
  { label: "Data Import", href: "/admin/data-import", icon: "🗂️", requiredPermission: "Admin.DataImport" },
  { label: "Integrations", href: "/admin/integrations", icon: "🔗", requiredPermission: "Admin.Settings" },
  { label: "Pay Periods", href: "/admin/pay-periods", icon: "📅", requiredPermission: "Payroll.Process" },
  { label: "Compliance", href: "/admin/compliance", icon: "✅", requiredPermission: "Admin.Settings" },
  { label: "Roles & Permissions", href: "/admin/roles", icon: "🛡️", requiredPermission: "Admin.Roles" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜", requiredPermission: "SystemAdmin.AuditLogs" },
  { label: "AI Settings", href: "/admin/ai-settings", icon: "🤖", requiredPermission: "AI.Settings" },
  { label: "AI Usage", href: "/admin/ai-usage", icon: "📊", requiredPermission: "AI.Settings" },
  { label: "API Keys", href: "/admin/api-keys", icon: "🔑", requiredPermission: "SystemAdmin.APIKeys" },
  { label: "System Health", href: "/admin/system-health", icon: "💚", requiredPermission: "SystemAdmin.Health" },
  { label: "Health Dashboard", href: "/admin/health", icon: "📡", requiredPermission: "SystemAdmin.Health" },
  { label: "Secrets", href: "/admin/secrets", icon: "🔐", requiredPermission: "Admin.Settings" },
  { label: "Feedback Inbox", href: "/admin/feedback", icon: "💬", requiredPermission: "Admin.Settings" },
];
