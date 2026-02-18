export interface NavItem {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
}

export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "📊" },
  { label: "Projects", href: "/projects", icon: "🏗️" },
  { label: "Bids", href: "/bids", icon: "📋" },
  { label: "Time Tracking", href: "/time-tracking", icon: "⏱️" },
  { label: "Employees", href: "/employees", icon: "👷" },
  { label: "Cost Codes", href: "/cost-codes", icon: "🏷️" },
  { label: "Equipment", href: "/equipment", icon: "🚜" },
  { label: "Contracts", href: "/contracts", icon: "📄" },
  { label: "Change Orders", href: "/change-orders", icon: "📝" },
  { label: "Pay Apps", href: "/payment-applications", icon: "💵" },
];

export function getProjectManagementItems(projectId: string | null): NavItem[] {
  const base = projectId ? `/projects/${projectId}` : null;
  return [
    { label: "Schedule", href: base ? `${base}/schedule` : "#", icon: "📅", disabled: !base },
    { label: "Job Cost", href: base ? `${base}/job-cost` : "#", icon: "💰", disabled: !base },
    { label: "RFIs", href: base ? `${base}/rfis` : "#", icon: "❓", disabled: !base },
    { label: "Submittals", href: base ? `${base}/submittals` : "#", icon: "📬", disabled: !base },
    { label: "Plans & Specs", href: base ? `${base}/plans-specs` : "#", icon: "📐", disabled: !base },
    { label: "Communications", href: base ? `${base}/communications` : "#", icon: "💬", disabled: !base },
    { label: "Daily Reports", href: base ? `${base}/daily-reports` : "#", icon: "📝", disabled: !base },
    { label: "Progress", href: base ? `${base}/progress` : "#", icon: "📈", disabled: !base },
    { label: "Projections", href: base ? `${base}/projections` : "#", icon: "🔮", disabled: !base },
    { label: "Meetings", href: base ? `${base}/meetings` : "#", icon: "🤝", disabled: !base },
    { label: "Documents", href: base ? `${base}/documents` : "#", icon: "📁", disabled: !base },
    { label: "Tasks", href: base ? `${base}/tasks` : "#", icon: "✅", disabled: !base },
    { label: "Narratives", href: base ? `${base}/narratives` : "#", icon: "📖", disabled: !base },
  ];
}

export const reportItems: NavItem[] = [
  { label: "Labor Cost", href: "/reports/labor-cost", icon: "💰" },
  { label: "Project Profitability", href: "/reports/project-profitability", icon: "📈" },
  { label: "Weekly Summary", href: "/reports/weekly-summary", icon: "📅" },
  { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊" },
  { label: "Equipment Utilization", href: "/reports/equipment", icon: "🔧" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤" },
];

export const settingsItems: NavItem[] = [
  { label: "Preferences", href: "/settings", icon: "⚙️" },
  { label: "Notifications", href: "/settings/notifications", icon: "🔔" },
  { label: "Overtime Rules", href: "/settings/overtime", icon: "⏰" },
  { label: "Projects", href: "/settings/projects", icon: "🏗️" },
  { label: "Contracts", href: "/settings/contracts", icon: "📄" },
  { label: "Bids", href: "/settings/bids", icon: "📋" },
  { label: "RFIs", href: "/settings/rfis", icon: "❓" },
  { label: "Reports", href: "/settings/reports", icon: "📊" },
  { label: "Company Setup", href: "/settings/company/setup", icon: "🧙" },
];

export const adminItems: NavItem[] = [
  { label: "Company Settings", href: "/admin/company", icon: "🏢" },
  { label: "Users", href: "/admin/users", icon: "👥" },
  { label: "Roles & Permissions", href: "/admin/roles", icon: "🛡️" },
  { label: "API Keys", href: "/admin/api-keys", icon: "🔑" },
  { label: "System Health", href: "/admin/system-health", icon: "💚" },
  { label: "Pay Periods", href: "/admin/pay-periods", icon: "📅" },
  { label: "Companies", href: "/admin/companies", icon: "🏛️" },
  { label: "AI Settings", href: "/admin/ai-settings", icon: "🤖" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "📜" },
  { label: "Compliance", href: "/admin/compliance", icon: "✅" },
  { label: "Data Import", href: "/admin/data-import", icon: "🗂️" },
];
