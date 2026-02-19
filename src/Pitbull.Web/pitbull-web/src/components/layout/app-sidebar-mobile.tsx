"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { CompanySwitcher } from "./company-switcher";
import { ProjectSwitcher } from "./project-switcher";
import {
  mainNavItems,
  financialItems,
  getProjectManagementItems,
  reportItems,
  settingsItems,
  adminItems,
  type NavItem as NavItemType,
} from "./nav-items";
import { findActiveHref } from "./nav-utils";

function MobileNavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItemType;
  isActive: boolean;
  onNavigate?: () => void;
}) {
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
      onClick={item.disabled ? (e) => e.preventDefault() : onNavigate}
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

export function AppSidebarMobile({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Extract current project ID from URL for project-scoped navigation
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] || null;
  const projectManagementItems = getProjectManagementItems(currentProjectId);

  const activeHref = useMemo(() => {
    const allItems = [
      ...mainNavItems,
      ...financialItems,
      ...projectManagementItems,
      ...reportItems,
      ...settingsItems,
      ...(user?.roles?.includes("Admin") ? adminItems : []),
    ];
    return findActiveHref(pathname, allItems);
  }, [pathname, projectManagementItems, user?.roles]);

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
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Financial Section */}
        <SectionHeader label="Financial" />
        {financialItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Project Management Section */}
        <SectionHeader label="Project Management" />
        {!currentProjectId && (
          <p className="px-3 text-xs text-neutral-500 italic pb-1">
            Select a project to navigate
          </p>
        )}
        {projectManagementItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Reports Section */}
        <SectionHeader label="Reports" />
        {reportItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Settings Section */}
        <SectionHeader label="Settings" />
        {settingsItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Admin Section - Only visible to admins */}
        {user?.roles?.includes("Admin") && (
          <>
            <SectionHeader label="Admin" />
            {adminItems.map((item) => (
              <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
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
