"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { CompanySwitcher } from "./company-switcher";
import { ProjectSwitcher } from "./project-switcher";

const mainNavItems = [
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

function getProjectManagementItems(projectId: string | null) {
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

const reportItems = [
  { label: "Labor Cost", href: "/reports/labor-cost", icon: "💰" },
  { label: "Project Profitability", href: "/reports/project-profitability", icon: "📈" },
  { label: "Weekly Summary", href: "/reports/weekly-summary", icon: "📅" },
  { label: "Financial Overview", href: "/reports/financial-overview", icon: "📊" },
  { label: "Equipment Utilization", href: "/reports/equipment", icon: "🔧" },
  { label: "Vista Export", href: "/reports/vista-export", icon: "📤" },
];

const settingsItems = [
  { label: "Preferences", href: "/settings", icon: "⚙️" },
  { label: "Overtime Rules", href: "/settings/overtime", icon: "⏰" },
];

const adminItems = [
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
];

function MobileNavItem({
  item,
  pathname,
}: {
  item: { label: string; href: string; icon: string; disabled?: boolean };
  pathname: string;
}) {
  const isActive =
    item.href === "/"
      ? pathname === "/"
      : item.href === "/settings"
      ? pathname === "/settings"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.disabled ? "#" : item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        item.disabled
          ? "text-neutral-500 cursor-not-allowed"
          : isActive
            ? "bg-amber-500/15 text-amber-400"
            : "text-neutral-300 hover:bg-white/5 hover:text-white"
      )}
      onClick={item.disabled ? (e) => e.preventDefault() : undefined}
    >
      <span className="text-base">{item.icon}</span>
      {item.label}
      {item.disabled && (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded">
          Soon
        </span>
      )}
    </Link>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-2">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
    </div>
  );
}

export function AppSidebarMobile() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Extract current project ID from URL for project-scoped navigation
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] || null;
  const projectManagementItems = getProjectManagementItems(currentProjectId);

  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-bold text-lg">
          P
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Pitbull</h1>
          <p className="text-xs text-neutral-400">Construction Solutions</p>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Company Switcher */}
      <div className="px-3 pt-3">
        <CompanySwitcher variant="sidebar" />
      </div>

      <Separator className="bg-white/10 mx-3" />

      {/* Quick Project Switcher */}
      <div className="px-3 pt-2">
        <ProjectSwitcher />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {mainNavItems.map((item) => (
          <MobileNavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Project Management Section */}
        <SectionHeader label="Project Management" />
        {!currentProjectId && (
          <p className="px-3 text-xs text-neutral-500 italic pb-1">
            Select a project to navigate
          </p>
        )}
        {projectManagementItems.map((item) => (
          <MobileNavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Reports Section */}
        <SectionHeader label="Reports" />
        {reportItems.map((item) => (
          <MobileNavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Settings Section */}
        <SectionHeader label="Settings" />
        {settingsItems.map((item) => (
          <MobileNavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Admin Section - Only visible to admins */}
        {user?.roles?.includes("Admin") && (
          <>
            <SectionHeader label="Admin" />
            {adminItems.map((item) => (
              <MobileNavItem key={item.label} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      <Separator className="bg-white/10" />

      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-neutral-400 truncate">
              {user?.email || ""}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-neutral-400 hover:text-white text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Sign out"
          >
            ↗
          </button>
        </div>
      </div>
    </div>
  );
}
