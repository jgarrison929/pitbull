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
  getProjectManagementItems,
  reportItems,
  settingsItems,
  helpItems,
  adminItems,
  type NavItem as NavItemType,
} from "./nav-items";
import { findActiveHref } from "./nav-utils";
import { useKeyboardShortcuts } from "@/contexts/keyboard-shortcuts-context";

function NavItem({
  item,
  isActive,
}: {
  item: NavItemType;
  isActive: boolean;
}) {
  return (
    <Link
      href={item.disabled ? "#" : item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        item.disabled
          ? "text-sidebar-foreground/40 cursor-not-allowed"
          : isActive
            ? "bg-sidebar-accent text-amber-400"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
      onClick={item.disabled ? (e) => e.preventDefault() : undefined}
    >
      <span className="text-base">{item.icon}</span>
      {item.label}
      {item.disabled && (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-sidebar-foreground/50 bg-sidebar-accent px-1.5 py-0.5 rounded">
          Soon
        </span>
      )}
    </Link>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-2">
      <span className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        {label}
      </span>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { setHelpOpen } = useKeyboardShortcuts();

  // Extract current project ID from URL for project-scoped navigation
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] || null;
  const projectManagementItems = getProjectManagementItems(currentProjectId);

  // Compute the single active href across all nav items so only the most
  // specific match highlights (fixes /settings also lighting up for /settings/notifications).
  const activeHref = useMemo(() => {
    const allItems = [
      ...mainNavItems,
      ...projectManagementItems,
      ...reportItems,
      ...settingsItems,
      ...helpItems,
      ...(user?.roles?.includes("Admin") ? adminItems : []),
    ];
    return findActiveHref(pathname, allItems);
  }, [pathname, projectManagementItems, user?.roles]);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-sidebar text-sidebar-foreground min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-bold text-lg">
          P
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">Pitbull</h1>
          <p className="text-xs text-sidebar-foreground/60">Construction Solutions</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Company Switcher */}
      <div className="px-3 pt-3">
        <CompanySwitcher variant="sidebar" />
      </div>

      <Separator className="bg-sidebar-border mx-3" />

      {/* Quick Project Switcher */}
      <div className="px-3 pt-2">
        <ProjectSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {mainNavItems.map((item) => (
          <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
        ))}

        {/* Project Management Section */}
        <SectionHeader label="Project Management" />
        {!currentProjectId && (
          <div className="px-3 pb-1">
            <p className="text-xs text-sidebar-foreground/40 italic">
              Select a project to navigate
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Go to Projects &rarr;
            </Link>
          </div>
        )}
        {projectManagementItems.map((item) => (
          <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
        ))}

        {/* Reports Section */}
        <SectionHeader label="Reports" />
        {reportItems.map((item) => (
          <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
        ))}

        {/* Settings Section */}
        <SectionHeader label="Settings" />
        {settingsItems.map((item) => (
          <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
        ))}

        {/* Admin Section - Only visible to admins */}
        {user?.roles?.includes("Admin") && (
          <>
            <SectionHeader label="Admin" />
            {adminItems.map((item) => (
              <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
            ))}
          </>
        )}

        {/* Help */}
        {helpItems.map((item) => (
          <NavItem key={item.label} item={item} isActive={item.href === activeHref} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer Links */}
      <div className="px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/help" className="text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">Help</Link>
        <button
          onClick={() => setHelpOpen(true)}
          className="text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          Shortcuts
        </button>
        <Link href="/privacy" className="text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">Privacy</Link>
        <Link href="/terms" className="text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">Terms</Link>
      </div>
      <div className="px-4 pb-2 text-center">
        <p className="text-[10px] text-sidebar-foreground/40">
          Pitbull v0.12.0
        </p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User Info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {user?.email || ""}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground text-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Sign out"
          >
            ↗
          </button>
        </div>
      </div>
    </aside>
  );
}
