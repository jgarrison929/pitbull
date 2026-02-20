"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CompanySwitcher } from "./company-switcher";
import { ProjectSwitcher } from "./project-switcher";
import {
  coreNavItems,
  resourceItems,
  moduleGroups,
  DEFAULT_PINNED_GROUPS,
  getProjectManagementItems,
  reportItems,
  settingsItems,
  adminItems,
  type NavItem as NavItemType,
  type ModuleGroup,
} from "./nav-items";
import { findActiveHref } from "./nav-utils";

const PINNED_KEY = "pitbull:sidebar:pinned";
const EXPANDED_KEY = "pitbull:sidebar:expanded";

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

function MobileModuleSection({
  group,
  isPinned,
  onTogglePin,
  activeHref,
  onNavigate,
}: {
  group: ModuleGroup;
  isPinned: boolean;
  onTogglePin: (id: string) => void;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between pt-4 pb-2">
        <span className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {group.label}
        </span>
        <button
          onClick={() => onTogglePin(group.id)}
          className={cn(
            "mr-2 text-xs",
            isPinned ? "text-amber-400" : "text-neutral-500"
          )}
          title={isPinned ? "Unpin section" : "Pin section"}
          aria-label={isPinned ? `Unpin ${group.label}` : `Pin ${group.label}`}
        >
          {"\u{1F4CC}"}
        </button>
      </div>
      {group.items.map((item) => (
        <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
      ))}
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

  // Pinned groups state -- shares localStorage key with desktop sidebar
  const [pinnedGroups, setPinnedGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_PINNED_GROUPS;
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_PINNED_GROUPS;
    } catch {
      return DEFAULT_PINNED_GROUPS;
    }
  });

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(EXPANDED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedGroups)); } catch { /* noop */ }
  }, [pinnedGroups]);

  useEffect(() => {
    try { localStorage.setItem(EXPANDED_KEY, String(isExpanded)); } catch { /* noop */ }
  }, [isExpanded]);

  const togglePin = useCallback((id: string) => {
    setPinnedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }, []);

  const pinnedModules = moduleGroups.filter((g) => pinnedGroups.includes(g.id));
  const unpinnedModules = moduleGroups.filter((g) => !pinnedGroups.includes(g.id));

  const activeHref = useMemo(() => {
    const moduleItems = moduleGroups.flatMap((g) => g.items);
    const allItems = [
      ...coreNavItems,
      ...resourceItems,
      ...moduleItems,
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
        {/* Core nav */}
        {coreNavItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Resources */}
        <SectionHeader label="Resources" />
        {resourceItems.map((item) => (
          <MobileNavItem key={item.label} item={item} isActive={item.href === activeHref} onNavigate={onNavigate} />
        ))}

        {/* Pinned module groups */}
        {pinnedModules.map((group) => (
          <MobileModuleSection
            key={group.id}
            group={group}
            isPinned={true}
            onTogglePin={togglePin}
            activeHref={activeHref}
            onNavigate={onNavigate}
          />
        ))}

        {/* More Modules -- collapsible for unpinned groups */}
        {unpinnedModules.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full pt-4 pb-2 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-400 transition-colors">
              <span>More Modules ({unpinnedModules.length})</span>
              <span className={cn("transition-transform text-[10px]", isExpanded && "rotate-180")}>
                &#x25BC;
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {unpinnedModules.map((group) => (
                <MobileModuleSection
                  key={group.id}
                  group={group}
                  isPinned={false}
                  onTogglePin={togglePin}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

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
            &#x2197;
          </button>
        </div>
      </div>
    </div>
  );
}
