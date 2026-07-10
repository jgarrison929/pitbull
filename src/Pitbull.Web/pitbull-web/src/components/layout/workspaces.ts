import type { NavItem } from "./nav-items";

// ---------------------------------------------------------------------------
// Workspace definitions — the core data model for workspace navigation.
// Each workspace groups 5-12 nav items that a single persona primarily uses.
// ---------------------------------------------------------------------------

export type WorkspaceId =
  | "my-work"
  | "projects"
  | "finance"
  | "operations"
  | "people"
  | "reports"
  | "admin";

export interface Workspace {
  id: WorkspaceId;
  label: string;
  icon: string;
  /** Permission required to SEE this workspace in the switcher */
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  /** Static items shown when this workspace is active */
  items: NavItem[];
  /** Separators: index in items[] where a separator + label should appear */
  separators?: { beforeIndex: number; label: string }[];
}

export interface QuickAction {
  label: string;
  href: string;
  icon: string;
}

export interface RoleDefaults {
  defaultWorkspace: WorkspaceId;
  favorites: string[]; // hrefs
  quickActions: QuickAction[];
  mobileTabs: { label: string; href: string; icon: string; matchPaths?: string[] }[];
}

// ---------------------------------------------------------------------------
// Workspace: Projects
// ---------------------------------------------------------------------------

export function getProjectWorkspaceItems(projectId: string | null): NavItem[] {
  const base = projectId ? `/projects/${projectId}` : null;

  const globalItems: NavItem[] = [
    { label: "All Projects", href: "/projects", icon: "🏗️", requiredPermission: "Projects.View" },
    { label: "Bids", href: "/bids", icon: "📋", requiredPermission: "Bids.View" },
  ];

  if (!base) return globalItems;

  const projectItems: NavItem[] = [
    { label: "Overview", href: `${base}`, icon: "📄", requiredPermission: "Projects.View" },
    { label: "Job Cost", href: `${base}/job-cost`, icon: "💰", requiredPermission: "Projects.View" },
    { label: "Daily Reports", href: `${base}/daily-reports`, icon: "📝", requiredPermission: "PM.DailyReports" },
    { label: "Tasks", href: `${base}/tasks`, icon: "✅", requiredPermission: "Projects.View" },
    { label: "RFIs", href: `${base}/rfis`, icon: "❓", requiredPermission: "PM.RFIs" },
    { label: "Submittals", href: `${base}/submittals`, icon: "📬", requiredPermission: "PM.Submittals" },
    { label: "Schedule", href: `${base}/schedule`, icon: "📅", requiredPermission: "PM.Schedule" },
    { label: "Change Orders", href: `${base}/change-orders`, icon: "📝", requiredPermission: "Contracts.View" },
    { label: "Documents", href: `${base}/documents`, icon: "📁", requiredPermission: "Documents.View" },
    { label: "Plans & Specs", href: `${base}/plans-specs`, icon: "📐", requiredPermission: "Documents.View" },
    { label: "Punch List", href: `${base}/punch-list`, icon: "📋", requiredPermission: "PM.PunchList" },
    { label: "Progress", href: `${base}/progress`, icon: "📈", requiredPermission: "Projects.View" },
    { label: "Cost Projections", href: `${base}/projections`, icon: "🔮", requiredPermission: "Projects.View" },
    { label: "Communications", href: `${base}/communications`, icon: "💬", requiredPermission: "Projects.View" },
    { label: "Meetings", href: `${base}/meetings`, icon: "🤝", requiredPermission: "PM.Meetings" },
    { label: "Narratives", href: `${base}/narratives`, icon: "📖", requiredPermission: "Projects.View" },
  ];

  return [...globalItems, ...projectItems];
}

export function getProjectWorkspaceSeparators(projectId: string | null): Workspace["separators"] {
  if (!projectId) return undefined;
  return [{ beforeIndex: 2, label: "Active Project" }];
}

// ---------------------------------------------------------------------------
// Workspace: Finance (merges old Financial + Billing)
// ---------------------------------------------------------------------------

const financeItems: NavItem[] = [
  { label: "Journal Entries", href: "/accounting/journal-entries", icon: "📓", requiredPermission: "Accounting.ViewGL" },
  { label: "Chart of Accounts", href: "/chart-of-accounts", icon: "🧾", requiredPermission: "Accounting.ViewGL" },
  { label: "Accounting Periods", href: "/accounting/periods", icon: "📆", requiredPermission: "Accounting.ManagePeriods" },
  { label: "WIP Schedule", href: "/accounting/wip", icon: "📈", requiredPermission: "Accounting.ViewGL" },
  { label: "Bank Reconciliation", href: "/accounting/bank-reconciliation", icon: "🏦", requiredPermission: "Accounting.ManageBankAccounts" },
  { label: "Retention", href: "/accounting/retention", icon: "🔒", requiredPermission: "Billing.View" },
  { label: "Lien Waivers", href: "/accounting/lien-waivers", icon: "📋", requiredPermission: "Billing.LienWaivers" },
  // Billing section
  { label: "Owner Contracts", href: "/billing/contracts", icon: "📑", requiredPermission: "Billing.View" },
  { label: "Owner Billing (AR)", href: "/billing/applications", icon: "💰", requiredPermission: "Billing.View" },
  { label: "Sub Pay Apps (AP)", href: "/payment-applications", icon: "💵", requiredPermission: "Billing.View" },
  { label: "AR Aging", href: "/billing/aging", icon: "📊", requiredPermission: "Billing.View" },
  { label: "AI Invoice Extract", href: "/invoices/extract", icon: "🤖", requiredPermission: "AP.View" },
];

const financeSeparators: Workspace["separators"] = [
  { beforeIndex: 7, label: "Billing" },
];

// ---------------------------------------------------------------------------
// Workspace: Operations (old Procurement)
// ---------------------------------------------------------------------------

const operationsItems: NavItem[] = [
  { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: "🧱", requiredPermission: "AP.View" },
  { label: "Vendor Invoices", href: "/procurement/invoices", icon: "🧾", requiredPermission: "AP.View" },
  { label: "Vendors", href: "/vendors", icon: "🏢", requiredPermission: "AP.View" },
  { label: "Customers", href: "/customers", icon: "🤝", requiredPermission: "AR.View" },
  { label: "Subcontracts", href: "/contracts", icon: "📄", requiredPermission: "Contracts.View" },
  { label: "Change Orders", href: "/change-orders", icon: "📝", requiredPermission: "Contracts.View" },
];

// ---------------------------------------------------------------------------
// Workspace: People (HR + Payroll + Time Tracking)
// ---------------------------------------------------------------------------

const peopleItems: NavItem[] = [
  { label: "My Approvals", href: "/my-approvals", icon: "✅" },
  { label: "Cost Codes", href: "/cost-codes", icon: "🏷️", requiredPermission: "Projects.View" },
  { label: "Employees", href: "/employees", icon: "👷", requiredPermission: "Employees.View" },
  { label: "Projects", href: "/projects", icon: "🏗️", requiredPermission: "Projects.View" },
  { label: "Subcontracts", href: "/contracts", icon: "📄", requiredPermission: "Contracts.View" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️", requiredPermission: "TimeTracking.View" },
  { label: "Approvals", href: "/time-tracking/approval", icon: "✅", requiredPermission: "TimeTracking.Approve" },
  // Payroll section
  { label: "Payroll Runs", href: "/payroll/runs", icon: "🧮", requiredPermission: "Payroll.View" },
  { label: "Certified Payroll", href: "/payroll/certified", icon: "📄", requiredPermission: "Payroll.View" },
  { label: "Payroll Reviews", href: "/payroll/reviews", icon: "✅", requiredPermission: "Payroll.Process" },
  { label: "Wage Determinations", href: "/payroll/wage-determinations", icon: "📚", requiredPermission: "Payroll.View" },
  { label: "Payroll Exports", href: "/payroll/exports", icon: "📤", requiredPermission: "Payroll.View" },
  // Resources section
  { label: "Equipment", href: "/equipment", icon: "🚜", requiredPermission: "Equipment.View" },
];

const peopleSeparators: Workspace["separators"] = [
  { beforeIndex: 1, label: "Day-1 Setup" },
  { beforeIndex: 7, label: "Payroll" },
  { beforeIndex: 12, label: "Resources" },
];

// ---------------------------------------------------------------------------
// Workspace: Reports
// ---------------------------------------------------------------------------

const reportsItems: NavItem[] = [
  { label: "Weekly Summary", href: "/reports/weekly-summary", icon: "📅", requiredPermission: "Reports.View" },
  { label: "Labor Cost", href: "/reports/labor-cost", icon: "💰", requiredPermission: "Reports.View" },
  { label: "Project Profitability", href: "/reports/project-profitability", icon: "📈", requiredPermission: "Reports.View" },
  { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊", requiredPermission: "Reports.View" },
  { label: "Equipment Utilization", href: "/reports/equipment", icon: "🔧", requiredPermission: "Reports.View" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤", requiredPermission: "Reports.Export" },
  { label: "Time Audit", href: "/time-tracking/audit", icon: "📜", requiredPermission: "TimeTracking.View" },
];

// ---------------------------------------------------------------------------
// Workspace: Admin
// ---------------------------------------------------------------------------

const adminWorkspaceItems: NavItem[] = [
  { label: "Workflow Definitions", href: "/admin/workflow-definitions", icon: "🔀", requiredPermission: "Admin.Settings" },
  { label: "Company Settings", href: "/admin/company", icon: "🏢", requiredPermission: "Admin.Settings" },
  { label: "Companies", href: "/admin/companies", icon: "🏛️", requiredPermission: "Admin.Companies" },
  { label: "Users", href: "/admin/users", icon: "👥", requiredPermission: "Admin.Users" },
  { label: "Roles & Permissions", href: "/admin/roles", icon: "🛡️", requiredPermission: "Admin.Roles" },
  { label: "Data Import", href: "/admin/data-import", icon: "🗂️", requiredPermission: "Admin.DataImport" },
  { label: "Integrations", href: "/admin/integrations", icon: "🔗", requiredPermission: "Admin.Settings" },
  { label: "Pay Periods", href: "/admin/pay-periods", icon: "📅", requiredPermission: "Payroll.Process" },
  { label: "Compliance", href: "/admin/compliance", icon: "✅", requiredPermission: "Admin.Settings" },
  { label: "AI Settings", href: "/admin/ai-settings", icon: "🤖", requiredPermission: "AI.Settings" },
  { label: "API Keys", href: "/admin/api-keys", icon: "🔑", requiredPermission: "SystemAdmin.APIKeys" },
  { label: "System Health", href: "/admin/system-health", icon: "💚", requiredPermission: "SystemAdmin.Health" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜", requiredPermission: "SystemAdmin.AuditLogs" },
  { label: "Secrets", href: "/admin/secrets", icon: "🔐", requiredPermission: "Admin.Settings" },
  { label: "Feedback Inbox", href: "/admin/feedback", icon: "💬", requiredPermission: "Admin.Settings" },
];

// ---------------------------------------------------------------------------
// Static workspace definitions (Projects is dynamic — built at render time)
// ---------------------------------------------------------------------------

export const workspaces: Workspace[] = [
  {
    id: "my-work",
    label: "My Work",
    icon: "⭐",
    items: [], // My Work is special — rendered via favorites/recents, not static items
  },
  {
    id: "projects",
    label: "Projects",
    icon: "🏗️",
    requiredPermission: "Projects.View",
    items: [], // Dynamic — built by getProjectWorkspaceItems()
  },
  {
    id: "finance",
    label: "Finance",
    icon: "💰",
    requiredAnyPermission: ["Accounting.ViewGL", "Billing.View"],
    items: financeItems,
    separators: financeSeparators,
  },
  {
    id: "operations",
    label: "Operations",
    icon: "📦",
    requiredAnyPermission: ["AP.View", "AR.View", "Contracts.View"],
    items: operationsItems,
  },
  {
    id: "people",
    label: "People",
    icon: "👥",
    requiredAnyPermission: ["Employees.View", "TimeTracking.View", "Payroll.View"],
    items: peopleItems,
    separators: peopleSeparators,
  },
  {
    id: "reports",
    label: "Reports",
    icon: "📊",
    requiredPermission: "Reports.View",
    items: reportsItems,
  },
  {
    id: "admin",
    label: "Admin",
    icon: "⚙️",
    requiredAnyPermission: ["Admin.Settings", "Admin.Users", "SystemAdmin.Health"],
    items: adminWorkspaceItems,
  },
];

// ---------------------------------------------------------------------------
// All navigable items across all workspaces (for command palette / ⌘K search)
// ---------------------------------------------------------------------------

export function getAllNavItems(projectId: string | null): NavItem[] {
  const projectItems = getProjectWorkspaceItems(projectId);
  return [
    { label: "Dashboard", href: "/", icon: "📊" },
    ...projectItems,
    ...financeItems,
    ...operationsItems,
    ...peopleItems,
    ...reportsItems,
    ...adminWorkspaceItems,
    // Settings (accessible via ⌘K even though not in sidebar)
    { label: "Settings", href: "/settings", icon: "⚙️" },
    { label: "Notifications", href: "/settings/notifications", icon: "🔔" },
    { label: "Overtime Rules", href: "/settings/overtime", icon: "⏰" },
    { label: "Help Center", href: "/help", icon: "❓" },
    { label: "My Approvals", href: "/my-approvals", icon: "✅" },
  ];
}

// ---------------------------------------------------------------------------
// Role-based defaults
// ---------------------------------------------------------------------------

/**
 * Keys match JWT `role_profile` claim (RoleProfileResolver.ToApiName).
 * Legacy display names kept as aliases for older callers.
 */
export const roleDefaults: Record<string, RoleDefaults> = {
  executive: {
    defaultWorkspace: "reports",
    favorites: ["/", "/reports/financial-overview", "/accounting/wip", "/billing/aging", "/bids", "/projects"],
    quickActions: [
      { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊" },
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "AR Aging", href: "/billing/aging", icon: "💰" },
    ],
    mobileTabs: [
      // Demo CEO: portfolio + cash + financials (high mobile traffic)
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
      { label: "Aging", href: "/billing/aging", icon: "💰", matchPaths: ["/billing/aging"] },
      { label: "Reports", href: "/reports/financial-overview", icon: "📊", matchPaths: ["/reports"] },
    ],
  },
  cfo: {
    defaultWorkspace: "finance",
    favorites: ["/", "/accounting/wip", "/billing/aging", "/accounting/journal-entries", "/reports/financial-overview"],
    quickActions: [
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "AR Aging", href: "/billing/aging", icon: "📊" },
      { label: "Owner Billing", href: "/billing/applications", icon: "💰" },
    ],
    mobileTabs: [
      // Demo CFO: keep paths specific so WIP vs journal vs billing don't all light up
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "WIP", href: "/accounting/wip", icon: "📈", matchPaths: ["/accounting/wip"] },
      { label: "Aging", href: "/billing/aging", icon: "📊", matchPaths: ["/billing/aging"] },
      { label: "Billing", href: "/billing/applications", icon: "💰", matchPaths: ["/billing/applications", "/billing/contracts"] },
    ],
  },
  projectManager: {
    defaultWorkspace: "projects",
    favorites: ["/", "/projects", "/time-tracking/approval", "/rfis", "/my-approvals"],
    quickActions: [
      { label: "New RFI", href: "/rfis/new", icon: "❓" },
      { label: "Approve Timecards", href: "/time-tracking/approval", icon: "✅" },
      { label: "New Daily Report", href: "/daily-reports/mobile", icon: "📝" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
      { label: "RFIs", href: "/rfis", icon: "❓", matchPaths: ["/rfis"] },
      { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
    ],
  },
  /** @deprecated use projectManager */
  "Project Manager": {
    defaultWorkspace: "projects",
    favorites: ["/", "/projects", "/time-tracking/approval"],
    quickActions: [
      { label: "New RFI", href: "/rfis/new", icon: "❓" },
      { label: "Approve Timecards", href: "/time-tracking/approval", icon: "✅" },
      { label: "New Daily Report", href: "/daily-reports/mobile", icon: "📝" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
      { label: "RFIs", href: "/rfis", icon: "❓", matchPaths: ["/rfis"] },
      { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
    ],
  },
  /** @deprecated use cfo */
  Controller: {
    defaultWorkspace: "finance",
    favorites: ["/", "/accounting/journal-entries", "/accounting/wip", "/reports/financial-overview"],
    quickActions: [
      { label: "New Journal Entry", href: "/accounting/journal-entries/new", icon: "📓" },
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "Close Period", href: "/accounting/periods", icon: "📆" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Journal", href: "/accounting/journal-entries", icon: "📓", matchPaths: ["/accounting/journal-entries"] },
      { label: "WIP", href: "/accounting/wip", icon: "📈", matchPaths: ["/accounting/wip"] },
      { label: "Billing", href: "/billing/applications", icon: "💰", matchPaths: ["/billing/applications", "/billing/contracts"] },
    ],
  },
  clerk: {
    defaultWorkspace: "operations",
    favorites: ["/", "/procurement/invoices", "/payment-applications", "/billing/applications", "/vendors"],
    quickActions: [
      { label: "Enter Invoice", href: "/procurement/invoices/new", icon: "🧾" },
      { label: "Sub Pay Apps", href: "/payment-applications", icon: "💵" },
      { label: "Owner Billing", href: "/billing/applications", icon: "💰" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Invoices", href: "/procurement/invoices", icon: "🧾", matchPaths: ["/procurement"] },
      { label: "Pay Apps", href: "/payment-applications", icon: "💵", matchPaths: ["/payment-applications"] },
      { label: "Vendors", href: "/vendors", icon: "🏢", matchPaths: ["/vendors"] },
    ],
  },
  "AP Clerk": {
    defaultWorkspace: "operations",
    favorites: ["/", "/procurement/invoices", "/payment-applications", "/procurement/purchase-orders", "/vendors"],
    quickActions: [
      { label: "Enter Invoice", href: "/procurement/invoices/new", icon: "🧾" },
      { label: "Sub Pay Apps", href: "/payment-applications", icon: "💵" },
      { label: "Vendor Lookup", href: "/vendors", icon: "🏢" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Invoices", href: "/procurement/invoices", icon: "🧾", matchPaths: ["/procurement/invoices"] },
      { label: "Pay Apps", href: "/payment-applications", icon: "💵", matchPaths: ["/payment-applications"] },
      { label: "Vendors", href: "/vendors", icon: "🏢", matchPaths: ["/vendors"] },
    ],
  },
  "AR Clerk": {
    defaultWorkspace: "finance",
    favorites: ["/", "/billing/applications", "/billing/aging", "/customers"],
    quickActions: [
      { label: "Owner Billing", href: "/billing/applications", icon: "💰" },
      { label: "AR Aging", href: "/billing/aging", icon: "📊" },
      { label: "Customers", href: "/customers", icon: "🤝" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Owner AR", href: "/billing/applications", icon: "💰", matchPaths: ["/billing"] },
      { label: "AR Aging", href: "/billing/aging", icon: "📊", matchPaths: ["/billing/aging"] },
      { label: "Customers", href: "/customers", icon: "🤝", matchPaths: ["/customers"] },
    ],
  },
  "Payroll Manager": {
    defaultWorkspace: "people",
    favorites: ["/", "/payroll/runs", "/payroll/certified", "/time-tracking"],
    quickActions: [
      { label: "Process Payroll", href: "/payroll/runs", icon: "🧮" },
      { label: "Certified Payroll", href: "/payroll/certified", icon: "📄" },
      { label: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Payroll", href: "/payroll/runs", icon: "🧮", matchPaths: ["/payroll"] },
      { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
      { label: "Certified", href: "/payroll/certified", icon: "📄", matchPaths: ["/payroll/certified"] },
    ],
  },
  hr: {
    defaultWorkspace: "people",
    favorites: ["/", "/employees", "/admin/compliance", "/employees/onboarding"],
    quickActions: [
      { label: "New Employee", href: "/employees/new", icon: "👷" },
      { label: "Compliance", href: "/admin/compliance", icon: "✅" },
      { label: "Onboarding", href: "/employees/onboarding", icon: "📋" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Employees", href: "/employees", icon: "👷", matchPaths: ["/employees"] },
      { label: "Compliance", href: "/admin/compliance", icon: "✅", matchPaths: ["/admin/compliance"] },
      { label: "Onboarding", href: "/employees/onboarding", icon: "📋", matchPaths: ["/employees/onboarding"] },
    ],
  },
  "HR Director": {
    defaultWorkspace: "people",
    favorites: ["/", "/employees", "/admin/compliance", "/employees/onboarding"],
    quickActions: [
      { label: "New Employee", href: "/employees/new", icon: "👷" },
      { label: "Compliance", href: "/admin/compliance", icon: "✅" },
      { label: "Onboarding", href: "/employees/onboarding", icon: "📋" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Employees", href: "/employees", icon: "👷", matchPaths: ["/employees"] },
      { label: "Compliance", href: "/admin/compliance", icon: "✅", matchPaths: ["/admin/compliance"] },
      { label: "Onboarding", href: "/employees/onboarding", icon: "📋", matchPaths: ["/employees/onboarding"] },
    ],
  },
  field: {
    defaultWorkspace: "my-work",
    favorites: ["/time-tracking", "/daily-reports/mobile", "/equipment"],
    quickActions: [
      { label: "Enter Crew Time", href: "/time-tracking/crew-entry", icon: "⏱️" },
      { label: "Daily Report", href: "/daily-reports/mobile", icon: "📝" },
      { label: "Punch List", href: "/projects", icon: "📋" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
      { label: "Report", href: "/daily-reports/mobile", icon: "📝", matchPaths: ["/daily-reports"] },
      { label: "Punch", href: "/projects", icon: "📋", matchPaths: ["/projects"] },
    ],
  },
  Foreman: {
    defaultWorkspace: "my-work",
    favorites: ["/time-tracking", "/daily-reports/mobile", "/equipment"],
    quickActions: [
      { label: "Enter Crew Time", href: "/time-tracking/crew-entry", icon: "⏱️" },
      { label: "Daily Report", href: "/daily-reports/mobile", icon: "📝" },
      { label: "Punch List", href: "/projects", icon: "📋" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
      { label: "Report", href: "/daily-reports/mobile", icon: "📝", matchPaths: ["/daily-reports"] },
      { label: "Punch", href: "/projects", icon: "📋", matchPaths: ["/projects"] },
    ],
  },
  estimator: {
    defaultWorkspace: "projects",
    favorites: ["/", "/bids", "/cost-codes", "/projects"],
    quickActions: [
      { label: "Bid Pipeline", href: "/bids", icon: "📋" },
      { label: "New Bid", href: "/bids/new", icon: "➕" },
      { label: "Cost Codes", href: "/cost-codes", icon: "🏷️" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Bids", href: "/bids", icon: "📋", matchPaths: ["/bids"] },
      { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
      { label: "Codes", href: "/cost-codes", icon: "🏷️", matchPaths: ["/cost-codes"] },
    ],
  },
  itAdmin: {
    defaultWorkspace: "admin",
    favorites: ["/", "/admin/system-health", "/admin/users", "/admin/roles"],
    quickActions: [
      { label: "System Health", href: "/admin/system-health", icon: "💚" },
      { label: "Users", href: "/admin/users", icon: "👥" },
      { label: "Roles", href: "/admin/roles", icon: "🛡️" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Health", href: "/admin/system-health", icon: "💚", matchPaths: ["/admin"] },
      { label: "Users", href: "/admin/users", icon: "👥", matchPaths: ["/admin/users"] },
      { label: "Roles", href: "/admin/roles", icon: "🛡️", matchPaths: ["/admin/roles"] },
    ],
  },
  Admin: {
    defaultWorkspace: "admin",
    favorites: ["/", "/admin/system-health", "/admin/users", "/admin/audit-logs"],
    quickActions: [
      { label: "System Health", href: "/admin/system-health", icon: "💚" },
      { label: "Users", href: "/admin/users", icon: "👥" },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Health", href: "/admin/system-health", icon: "💚", matchPaths: ["/admin/system-health"] },
      { label: "Users", href: "/admin/users", icon: "👥", matchPaths: ["/admin/users"] },
      { label: "Audit", href: "/admin/audit-logs", icon: "📜", matchPaths: ["/admin/audit-logs"] },
    ],
  },
};

/** Fallback defaults when user role doesn't match any known role */
export const defaultRoleDefaults: RoleDefaults = {
  defaultWorkspace: "my-work",
  favorites: ["/", "/projects", "/time-tracking"],
  quickActions: [
    { label: "Dashboard", href: "/", icon: "📊" },
    { label: "Projects", href: "/projects", icon: "🏗️" },
    { label: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
  ],
  mobileTabs: [
    { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
    { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
    { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
    { label: "Reports", href: "/reports/weekly-summary", icon: "📊", matchPaths: ["/reports"] },
  ],
};

/** Landing page for each workspace — used when switching workspaces to navigate immediately. */
export function getWorkspaceLandingHref(workspaceId: WorkspaceId): string {
  switch (workspaceId) {
    case "my-work":
      return "/";
    case "projects":
      return "/projects";
    case "finance":
      return "/accounting/journal-entries";
    case "operations":
      return "/procurement/purchase-orders";
    case "people":
      return "/cost-codes";
    case "reports":
      return "/reports";
    case "admin":
      return "/admin/company";
    default:
      return "/";
  }
}

/**
 * Look up role defaults. Prefer JWT role_profile (title-based persona),
 * then Identity role names, then generic defaults.
 */
export function getRoleDefaults(
  roles?: string[],
  roleProfile?: string | null
): RoleDefaults {
  if (roleProfile && roleDefaults[roleProfile]) {
    return roleDefaults[roleProfile];
  }
  if (roles) {
    for (const role of roles) {
      if (roleDefaults[role]) return roleDefaults[role];
    }
  }
  return defaultRoleDefaults;
}
