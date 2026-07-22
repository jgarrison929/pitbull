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
  /** Workspaces in the switcher for this persona (order preserved). */
  workspaces: WorkspaceId[];
  favorites: string[]; // hrefs — keep short (3–4)
  quickActions: QuickAction[];
  mobileTabs: { label: string; href: string; icon: string; matchPaths?: string[] }[];
}

export const ALL_WORKSPACE_IDS: WorkspaceId[] = [
  "my-work",
  "projects",
  "finance",
  "operations",
  "people",
  "reports",
  "admin",
];

// ---------------------------------------------------------------------------
// Workspace: Projects — portfolio + primary job links + More groups
// ---------------------------------------------------------------------------

export interface ProjectNavGroup {
  label: string;
  items: NavItem[];
}

/** Structured project nav for sidebar (primary + collapsible More). */
export interface ProjectWorkspaceNav {
  portfolio: NavItem[];
  /** Only when a project is open — day-job links (≤5). */
  primary: NavItem[];
  moreGroups: ProjectNavGroup[];
}

function portfolioItems(): NavItem[] {
  return [
    { label: "All Projects", href: "/projects", icon: "🏗️", requiredPermission: "Projects.View" },
    { label: "Bids", href: "/bids", icon: "📋", requiredPermission: "Bids.View" },
    { label: "Cost Codes", href: "/cost-codes", icon: "🏷️", requiredPermission: "Projects.View" },
  ];
}

export function getProjectWorkspaceNav(projectId: string | null): ProjectWorkspaceNav {
  const portfolio = portfolioItems();
  if (!projectId) {
    return { portfolio, primary: [], moreGroups: [] };
  }

  const base = `/projects/${projectId}`;
  // Day-job primary: walk the job, see the twin, capture, open RFIs. Job cost lives under More.
  const primary: NavItem[] = [
    { label: "Overview", href: base, icon: "📄", requiredPermission: "Projects.View" },
    { label: "Site Walk", href: `${base}/site-walk`, icon: "🚶", requiredPermission: "Projects.View" },
    { label: "Digital Twin", href: `${base}/twin`, icon: "🗺️", requiredPermission: "Spatial.View" },
    { label: "Daily Reports", href: `${base}/daily-reports`, icon: "📝", requiredPermission: "PM.DailyReports" },
    { label: "RFIs", href: `${base}/rfis`, icon: "❓", requiredPermission: "PM.RFIs" },
  ];

  const moreGroups: ProjectNavGroup[] = [
    {
      label: "Field",
      items: [
        { label: "Schedule", href: `${base}/schedule`, icon: "📅", requiredPermission: "PM.Schedule" },
        { label: "Plans & Specs", href: `${base}/plans-specs`, icon: "📐", requiredPermission: "Documents.View" },
        { label: "Punch List", href: `${base}/punch-list`, icon: "📋", requiredPermission: "PM.PunchList" },
      ],
    },
    {
      label: "Coordination",
      items: [
        { label: "Submittals", href: `${base}/submittals`, icon: "📬", requiredPermission: "PM.Submittals" },
        { label: "Tasks", href: `${base}/tasks`, icon: "✅", requiredPermission: "Projects.View" },
        { label: "Change Orders", href: `${base}/change-orders`, icon: "📝", requiredPermission: "Contracts.View" },
        { label: "Meetings", href: `${base}/meetings`, icon: "🤝", requiredPermission: "PM.Meetings" },
        { label: "Communications", href: `${base}/communications`, icon: "💬", requiredPermission: "Projects.View" },
      ],
    },
    {
      label: "Cost & docs",
      items: [
        { label: "Job Cost", href: `${base}/job-cost`, icon: "💰", requiredPermission: "Projects.View" },
        { label: "Progress", href: `${base}/progress`, icon: "📈", requiredPermission: "Projects.View" },
        { label: "Cost Projections", href: `${base}/projections`, icon: "🔮", requiredPermission: "Projects.View" },
        { label: "Documents", href: `${base}/documents`, icon: "📁", requiredPermission: "Documents.View" },
        { label: "Narratives", href: `${base}/narratives`, icon: "📖", requiredPermission: "Projects.View" },
      ],
    },
  ];

  return { portfolio, primary, moreGroups };
}

/** Flat list for ⌘K / recents / active-href (includes primary + more). */
export function getProjectWorkspaceItems(projectId: string | null): NavItem[] {
  const nav = getProjectWorkspaceNav(projectId);
  return [
    ...nav.portfolio,
    ...nav.primary,
    ...nav.moreGroups.flatMap((g) => g.items),
  ];
}

export function getProjectWorkspaceSeparators(projectId: string | null): Workspace["separators"] {
  // Portfolio-only view still uses separators; open-project uses primary/More UI.
  if (!projectId) {
    return [{ beforeIndex: 2, label: "Estimating" }];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Workspace: Finance (merges old Financial + Billing)
// ---------------------------------------------------------------------------

const financeItems: NavItem[] = [
  // Day-to-day construction finance first (WIP + AR), then GL setup.
  { label: "WIP Schedule", href: "/accounting/wip", icon: "📈", requiredPermission: "Accounting.ViewGL" },
  { label: "AR Aging", href: "/billing/aging", icon: "📊", requiredPermission: "Billing.View" },
  { label: "Owner Billing (AR)", href: "/billing/applications", icon: "💰", requiredPermission: "Billing.View" },
  { label: "Sub Pay Apps (AP)", href: "/payment-applications", icon: "💵", requiredPermission: "Billing.View" },
  { label: "Owner Contracts", href: "/billing/contracts", icon: "📑", requiredPermission: "Billing.View" },
  { label: "Retention", href: "/accounting/retention", icon: "🔒", requiredPermission: "Billing.View" },
  { label: "Lien Waivers", href: "/accounting/lien-waivers", icon: "📋", requiredPermission: "Billing.LienWaivers" },
  // General ledger
  { label: "Journal Entries", href: "/accounting/journal-entries", icon: "📓", requiredPermission: "Accounting.ViewGL" },
  { label: "Chart of Accounts", href: "/chart-of-accounts", icon: "🧾", requiredPermission: "Accounting.ViewGL" },
  { label: "Accounting Periods", href: "/accounting/periods", icon: "📆", requiredPermission: "Accounting.ManagePeriods" },
  { label: "Bank Reconciliation", href: "/accounting/bank-reconciliation", icon: "🏦", requiredPermission: "Accounting.ManageBankAccounts" },
  { label: "AI Invoice Extract", href: "/invoices/extract", icon: "🤖", requiredPermission: "AP.View" },
];

const financeSeparators: Workspace["separators"] = [
  { beforeIndex: 7, label: "General Ledger" },
];

// ---------------------------------------------------------------------------
// Workspace: Operations (procurement + vendor/customer contracts)
// ---------------------------------------------------------------------------

const operationsItems: NavItem[] = [
  { label: "Purchase Orders", href: "/procurement/purchase-orders", icon: "🧱", requiredPermission: "AP.View" },
  { label: "Vendor Invoices", href: "/procurement/invoices", icon: "🧾", requiredPermission: "AP.View" },
  { label: "Vendors", href: "/vendors", icon: "🏢", requiredPermission: "AP.View" },
  { label: "Customers", href: "/customers", icon: "🤝", requiredPermission: "AR.View" },
  { label: "Subcontracts", href: "/contracts", icon: "📄", requiredPermission: "Contracts.View" },
  { label: "Change Orders", href: "/change-orders", icon: "📝", requiredPermission: "Contracts.View" },
];

const operationsSeparators: Workspace["separators"] = [
  { beforeIndex: 4, label: "Contracts" },
];

// ---------------------------------------------------------------------------
// Workspace: People (workforce only — HR, time, payroll, fleet)
// Cost codes, projects, and subcontracts live in Projects / Operations.
// ---------------------------------------------------------------------------

const peopleItems: NavItem[] = [
  { label: "My Approvals", href: "/my-approvals", icon: "✅" },
  { label: "Employees", href: "/employees", icon: "👷", requiredPermission: "Employees.View" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️", requiredPermission: "TimeTracking.View" },
  { label: "Time Approvals", href: "/time-tracking/approval", icon: "✅", requiredPermission: "TimeTracking.Approve" },
  // Payroll
  { label: "Payroll Runs", href: "/payroll/runs", icon: "🧮", requiredPermission: "Payroll.View" },
  { label: "Certified Payroll", href: "/payroll/certified", icon: "📄", requiredPermission: "Payroll.View" },
  { label: "Payroll Reviews", href: "/payroll/reviews", icon: "✅", requiredPermission: "Payroll.Process" },
  { label: "Wage Determinations", href: "/payroll/wage-determinations", icon: "📚", requiredPermission: "Payroll.View" },
  { label: "Payroll Exports", href: "/payroll/exports", icon: "📤", requiredPermission: "Payroll.View" },
  // Fleet
  { label: "Equipment", href: "/equipment", icon: "🚜", requiredPermission: "Equipment.View" },
];

const peopleSeparators: Workspace["separators"] = [
  { beforeIndex: 1, label: "Workforce" },
  { beforeIndex: 4, label: "Payroll" },
  { beforeIndex: 9, label: "Fleet" },
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
    separators: operationsSeparators,
  },
  {
    id: "people",
    label: "People",
    icon: "👥",
    requiredAnyPermission: ["Employees.View", "TimeTracking.View", "Payroll.View", "Equipment.View"],
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
    // Field + estimating shortcuts used as favorites / quick actions / ⌘K
    { label: "Crew Time Entry", href: "/time-tracking/crew-entry", icon: "⏱️", requiredPermission: "TimeTracking.View" },
    { label: "Mobile Daily Report", href: "/daily-reports/mobile", icon: "📝", requiredPermission: "PM.DailyReports" },
    { label: "Settings", href: "/settings", icon: "⚙️" },
    { label: "Notifications", href: "/settings/notifications", icon: "🔔" },
    { label: "Overtime Rules", href: "/settings/overtime", icon: "⏰" },
    { label: "Help Center", href: "/help", icon: "❓" },
  ];
}

// ---------------------------------------------------------------------------
// Role-based defaults
// ---------------------------------------------------------------------------

/**
 * Keys match JWT `role_profile` claim (RoleProfileResolver.ToApiName).
 * Legacy display names kept as aliases for older callers.
 */
const PM_DEFAULTS: RoleDefaults = {
  defaultWorkspace: "projects",
  workspaces: ["my-work", "projects", "people", "reports"],
  favorites: ["/", "/projects", "/my-approvals", "/time-tracking/approval"],
  quickActions: [
    { label: "My Approvals", href: "/my-approvals", icon: "✅" },
    { label: "Projects", href: "/projects", icon: "🏗️" },
    { label: "Field Report", href: "/daily-reports/mobile", icon: "📝" },
  ],
  mobileTabs: [
    { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
    { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
    { label: "Approve", href: "/my-approvals", icon: "✅", matchPaths: ["/my-approvals", "/time-tracking/approval"] },
    { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
  ],
};

const CFO_DEFAULTS: RoleDefaults = {
  defaultWorkspace: "my-work",
  workspaces: ["my-work", "finance", "operations", "reports"],
  favorites: ["/", "/accounting/wip", "/billing/aging", "/billing/applications"],
  quickActions: [
    { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
    { label: "AR Aging", href: "/billing/aging", icon: "📊" },
    { label: "Owner Billing", href: "/billing/applications", icon: "💰" },
  ],
  mobileTabs: [
    { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
    { label: "WIP", href: "/accounting/wip", icon: "📈", matchPaths: ["/accounting/wip"] },
    { label: "Aging", href: "/billing/aging", icon: "📊", matchPaths: ["/billing/aging"] },
    { label: "Billing", href: "/billing/applications", icon: "💰", matchPaths: ["/billing/applications", "/billing/contracts"] },
  ],
};

const FIELD_DEFAULTS: RoleDefaults = {
  defaultWorkspace: "my-work",
  workspaces: ["my-work", "projects"],
  favorites: [
    "/",
    "/time-tracking/crew-entry",
    "/daily-reports/mobile",
    "/projects",
  ],
  quickActions: [
    { label: "Enter Crew Time", href: "/time-tracking/crew-entry", icon: "⏱️" },
    { label: "Quick Log", href: "/daily-reports/mobile?mode=quick", icon: "⚡" },
    { label: "Daily Report", href: "/daily-reports/mobile", icon: "📝" },
    { label: "Jobs", href: "/projects", icon: "🏗️" },
  ],
  mobileTabs: [
    { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
    { label: "Crew", href: "/time-tracking/crew-entry", icon: "⏱️", matchPaths: ["/time-tracking"] },
    {
      label: "Log",
      href: "/daily-reports/mobile?mode=quick",
      icon: "⚡",
      matchPaths: ["/daily-reports"],
    },
    { label: "Jobs", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
  ],
};

const HR_DEFAULTS: RoleDefaults = {
  defaultWorkspace: "people",
  workspaces: ["my-work", "people"],
  favorites: ["/", "/employees", "/time-tracking"],
  quickActions: [
    { label: "Employees", href: "/employees", icon: "👷" },
    { label: "New Employee", href: "/employees/new", icon: "👷" },
    { label: "Compliance", href: "/admin/compliance", icon: "✅" },
  ],
  mobileTabs: [
    { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
    { label: "Employees", href: "/employees", icon: "👷", matchPaths: ["/employees"] },
    { label: "Time", href: "/time-tracking", icon: "⏱️", matchPaths: ["/time-tracking"] },
    { label: "Compliance", href: "/admin/compliance", icon: "✅", matchPaths: ["/admin/compliance"] },
  ],
};

export const roleDefaults: Record<string, RoleDefaults> = {
  executive: {
    defaultWorkspace: "my-work",
    workspaces: ["my-work", "projects", "finance", "reports"],
    favorites: ["/", "/reports/financial-overview", "/accounting/wip", "/billing/aging"],
    quickActions: [
      { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊" },
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "AR Aging", href: "/billing/aging", icon: "💰" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      { label: "Projects", href: "/projects", icon: "🏗️", matchPaths: ["/projects"] },
      { label: "Aging", href: "/billing/aging", icon: "💰", matchPaths: ["/billing/aging"] },
      { label: "Reports", href: "/reports/financial-overview", icon: "📊", matchPaths: ["/reports"] },
    ],
  },
  cfo: CFO_DEFAULTS,
  projectManager: PM_DEFAULTS,
  /** @deprecated use projectManager */
  "Project Manager": PM_DEFAULTS,
  /** @deprecated use cfo */
  Controller: {
    ...CFO_DEFAULTS,
    favorites: ["/", "/accounting/wip", "/accounting/journal-entries", "/billing/aging"],
    quickActions: [
      { label: "WIP Schedule", href: "/accounting/wip", icon: "📈" },
      { label: "New Journal Entry", href: "/accounting/journal-entries/new", icon: "📓" },
      { label: "Close Period", href: "/accounting/periods", icon: "📆" },
    ],
  },
  clerk: {
    defaultWorkspace: "operations",
    workspaces: ["my-work", "operations", "finance"],
    favorites: ["/", "/procurement/invoices", "/payment-applications", "/vendors"],
    quickActions: [
      { label: "Enter Invoice", href: "/procurement/invoices/new", icon: "🧾" },
      { label: "Sub Pay Apps", href: "/payment-applications", icon: "💵" },
      { label: "Vendors", href: "/vendors", icon: "🏢" },
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
    workspaces: ["my-work", "operations"],
    favorites: ["/", "/procurement/invoices", "/payment-applications", "/vendors"],
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
    workspaces: ["my-work", "finance", "operations"],
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
    workspaces: ["my-work", "people"],
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
  hr: HR_DEFAULTS,
  "HR Director": HR_DEFAULTS,
  field: FIELD_DEFAULTS,
  Foreman: FIELD_DEFAULTS,
  estimator: {
    defaultWorkspace: "projects",
    workspaces: ["my-work", "projects"],
    favorites: ["/", "/bids", "/projects", "/cost-codes"],
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
  /**
   * Contract Administrator — main/owner contracts, subcontracts, sub pay apps,
   * subcontractor + project insurance/compliance (negotiate & administer).
   * JWT role_profile from RoleProfileResolver.ToApiName(ContractAdministrator).
   */
  contractAdministrator: {
    defaultWorkspace: "operations",
    workspaces: ["my-work", "operations", "finance", "projects", "reports"],
    favorites: [
      "/",
      "/billing/contracts",
      "/contracts",
      "/payment-applications",
      "/reports/compliance",
    ],
    quickActions: [
      { label: "Owner Contracts", href: "/billing/contracts", icon: "📑" },
      { label: "Subcontracts", href: "/contracts", icon: "📄" },
      { label: "Sub Pay Apps", href: "/payment-applications", icon: "💵" },
      { label: "Compliance", href: "/reports/compliance", icon: "✅" },
      { label: "Change Orders", href: "/change-orders", icon: "📝" },
    ],
    mobileTabs: [
      { label: "Home", href: "/", icon: "🏠", matchPaths: ["/"] },
      {
        label: "Subs",
        href: "/contracts",
        icon: "📄",
        matchPaths: ["/contracts", "/change-orders"],
      },
      {
        label: "Pay Apps",
        href: "/payment-applications",
        icon: "💵",
        matchPaths: ["/payment-applications"],
      },
      {
        label: "Compliance",
        href: "/reports/compliance",
        icon: "✅",
        matchPaths: ["/reports/compliance", "/admin/compliance"],
      },
    ],
  },
  itAdmin: {
    defaultWorkspace: "admin",
    workspaces: ALL_WORKSPACE_IDS,
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
    workspaces: ALL_WORKSPACE_IDS,
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
  workspaces: ["my-work", "projects", "people"],
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
      return "/accounting/wip";
    case "operations":
      return "/procurement/purchase-orders";
    case "people":
      return "/employees";
    case "reports":
      return "/reports/weekly-summary";
    case "admin":
      return "/admin/company";
    default:
      return "/";
  }
}

/**
 * Which workspace owns a path for auto-switch + breadcrumbs.
 * Cost codes live under Projects (estimating/job cost), not People.
 */
export function detectWorkspaceFromPath(pathname: string): WorkspaceId | null {
  if (pathname === "/" || pathname.startsWith("/settings") || pathname.startsWith("/help")) {
    return null;
  }
  // Personal inbox — My Work, not People (HR)
  if (pathname.startsWith("/my-approvals")) return "my-work";
  if (pathname.startsWith("/projects") || pathname.startsWith("/bids") || pathname.startsWith("/cost-codes")) {
    return "projects";
  }
  if (
    pathname.startsWith("/accounting") ||
    pathname.startsWith("/chart-of-accounts") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/payment-applications") ||
    pathname.startsWith("/invoices")
  ) {
    return "finance";
  }
  if (
    pathname.startsWith("/procurement") ||
    pathname.startsWith("/vendors") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/contracts") ||
    pathname.startsWith("/change-orders")
  ) {
    return "operations";
  }
  if (
    pathname.startsWith("/employees") ||
    pathname.startsWith("/time-tracking") ||
    pathname.startsWith("/payroll") ||
    pathname.startsWith("/equipment")
  ) {
    return "people";
  }
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/admin")) return "admin";
  // Global field shortcuts often live on My Work favorites
  if (pathname.startsWith("/daily-reports") || pathname.startsWith("/rfis") || pathname.startsWith("/sub-status")) {
    return "my-work";
  }
  return null;
}

/** True if People menu must never surface this href (guard for regressions). */
export function isMisplacedUnderPeople(href: string): boolean {
  return (
    href === "/cost-codes" ||
    href.startsWith("/cost-codes/") ||
    href === "/projects" ||
    href.startsWith("/projects/") ||
    href === "/contracts" ||
    href.startsWith("/contracts/") ||
    href === "/bids" ||
    href.startsWith("/bids/")
  );
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

/** Whether a workspace id is in the persona allow-list. */
export function roleAllowsWorkspace(
  workspaceId: WorkspaceId,
  roles?: string[],
  roleProfile?: string | null
): boolean {
  const allowed = getRoleDefaults(roles, roleProfile).workspaces;
  return allowed.includes(workspaceId);
}
