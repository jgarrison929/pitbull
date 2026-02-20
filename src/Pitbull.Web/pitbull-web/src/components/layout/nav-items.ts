export interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
  tooltip?: string;
}

export interface ModuleGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Core nav — always visible at top of sidebar
export const coreNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Projects", href: "/projects", icon: "🏗️" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
  { label: "Approvals", href: "/time-tracking/approval", icon: "✅" },
];

// Resources — always visible under "Resources" header
export const resourceItems: NavItem[] = [
  { label: "Employees", href: "/employees", icon: "👷" },
  { label: "Cost Codes", href: "/cost-codes", icon: "🏷️" },
  { label: "Equipment", href: "/equipment", icon: "🚜" },
  { label: "Audit Trail", href: "/time-tracking/audit", icon: "📜" },
];

// Module groups — pinnable, collapsible in "More Modules"
export const moduleGroups: ModuleGroup[] = [
  {
    id: "financial",
    label: "Financial",
    items: [
      { label: "Journal Entries", href: "/accounting/journal-entries", icon: "📓" },
      { label: "Accounting Periods", href: "/accounting/periods", icon: "📆" },
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "Chart of Accounts", href: "/chart-of-accounts", icon: "🧾" },
      { label: "Retention", href: "/accounting/retention", icon: "🔒" },
      { label: "Lien Waivers", href: "/accounting/lien-waivers", icon: "📋" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { label: "Owner Contracts", href: "/billing/contracts", icon: "📑" },
      { label: "Billing Applications", href: "/billing/applications", icon: "💰" },
      { label: "Aging Reports", href: "/billing/aging", icon: "📊" },
      { label: "Pay Apps", href: "/payment-applications", icon: "💵" },
      { label: "Bids", href: "/bids", icon: "📋" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    items: [
      { label: "Payroll Runs", href: "/payroll/runs", icon: "🧮" },
      { label: "Certified Payroll", href: "/payroll/certified", icon: "📄" },
      { label: "Wage Determinations", href: "/payroll/wage-determinations", icon: "📚" },
      { label: "Payroll Reviews", href: "/payroll/reviews", icon: "✅" },
      { label: "Payroll Exports", href: "/payroll/exports", icon: "📤" },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    items: [
      { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: "🧱" },
      { label: "Vendor Invoices", href: "/procurement/invoices", icon: "🧾" },
      { label: "Vendors", href: "/vendors", icon: "🏢" },
      { label: "Customers", href: "/customers", icon: "🤝" },
      { label: "Contracts", href: "/contracts", icon: "📄" },
      { label: "Change Orders", href: "/change-orders", icon: "📝" },
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
    { label: "Daily Reports", href: base ? `${base}/daily-reports` : "#", icon: "📝", disabled: !base },
    { label: "Tasks", href: base ? `${base}/tasks` : "#", icon: "✅", disabled: !base },
    { label: "RFIs", href: base ? `${base}/rfis` : "#", icon: "❓", disabled: !base },
    { label: "Submittals", href: base ? `${base}/submittals` : "#", icon: "📬", disabled: !base },
    { label: "Job Cost", href: base ? `${base}/job-cost` : "#", icon: "💰", disabled: !base },
    { label: "Progress", href: base ? `${base}/progress` : "#", icon: "📈", disabled: !base },
    { label: "Projections", href: base ? `${base}/projections` : "#", icon: "🔮", disabled: !base },
    { label: "Schedule", href: base ? `${base}/schedule` : "#", icon: "📅", disabled: !base },
    { label: "Documents", href: base ? `${base}/documents` : "#", icon: "📁", disabled: !base },
    { label: "Plans & Specs", href: base ? `${base}/plans-specs` : "#", icon: "📐", disabled: !base },
    { label: "Communications", href: base ? `${base}/communications` : "#", icon: "💬", disabled: !base },
    { label: "Meetings", href: base ? `${base}/meetings` : "#", icon: "🤝", disabled: !base },
    { label: "Narratives", href: base ? `${base}/narratives` : "#", icon: "📖", disabled: !base },
  ];
}

export const reportItems: NavItem[] = [
  { label: "Weekly Summary", href: "/reports/weekly-summary", icon: "📅" },
  { label: "Labor Cost", href: "/reports/labor-cost", icon: "💰" },
  { label: "Project Profitability", href: "/reports/project-profitability", icon: "📈" },
  { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤" },
  { label: "Equipment Utilization", href: "/reports/equipment", icon: "🔧" },
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
  { label: "Company Settings", href: "/admin/company", icon: "🏢" },
  { label: "Companies", href: "/admin/companies", icon: "🏛️" },
  { label: "Users", href: "/admin/users", icon: "👥" },
  { label: "Data Import", href: "/admin/data-import", icon: "🗂️" },
  { label: "Pay Periods", href: "/admin/pay-periods", icon: "📅" },
  { label: "Compliance", href: "/admin/compliance", icon: "✅" },
  { label: "Roles & Permissions", href: "/admin/roles", icon: "🛡️" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜" },
  { label: "AI Settings", href: "/admin/ai-settings", icon: "🤖" },
  { label: "API Keys", href: "/admin/api-keys", icon: "🔑" },
  { label: "System Health", href: "/admin/system-health", icon: "💚" },
  { label: "Health Dashboard", href: "/admin/health", icon: "📡" },
  { label: "Feedback Inbox", href: "/admin/feedback", icon: "💬" },
];
