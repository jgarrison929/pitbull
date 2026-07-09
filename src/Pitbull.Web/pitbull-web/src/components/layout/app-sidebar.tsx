"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspaceNav, type RecentPage } from "@/hooks/use-workspace-nav";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompanySwitcher } from "./company-switcher";
import { ProjectSwitcher } from "./project-switcher";
import {
  type NavItem as NavItemType,
} from "./nav-items";
import {
  type WorkspaceId,
  type Workspace,
  getProjectWorkspaceItems,
  getProjectWorkspaceSeparators,
  getAllNavItems,
  getWorkspaceLandingHref,
} from "./workspaces";
import { findActiveHref } from "./nav-utils";
import { useKeyboardShortcuts } from "@/contexts/keyboard-shortcuts-context";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { getAppVersionLabel } from "@/lib/app-version";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
  isFavorite,
  onToggleFavorite,
  onNavigate,
}: {
  item: NavItemType;
  isActive: boolean;
  isCollapsed: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (href: string) => void;
  onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={item.disabled ? "#" : item.href}
      className={cn(
        "group/item flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative",
        item.disabled
          ? "text-sidebar-foreground/40 cursor-not-allowed"
          : isActive
            ? "bg-sidebar-accent text-amber-400"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
      onClick={(e) => {
        if (item.disabled) {
          e.preventDefault();
          return;
        }
        onNavigate?.();
      }}
    >
      <span className={cn("text-base shrink-0", isCollapsed && "mx-auto")}>
        {item.icon}
      </span>
      {!isCollapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.disabled && (
            <span className="ml-auto text-[10px] uppercase tracking-wider text-sidebar-foreground/50 bg-sidebar-accent px-1.5 py-0.5 rounded">
              Soon
            </span>
          )}
          {onToggleFavorite && !item.disabled && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(item.href);
              }}
              className={cn(
                "ml-auto shrink-0 transition-opacity",
                isFavorite
                  ? "text-amber-400 opacity-100"
                  : "opacity-0 group-hover/item:opacity-100 text-sidebar-foreground/40 hover:text-amber-400"
              )}
              aria-label={isFavorite ? `Remove ${item.label} from favorites` : `Add ${item.label} to favorites`}
            >
              <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
            </button>
          )}
        </>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <SimpleTooltip content={item.label} side="right">
        {content}
      </SimpleTooltip>
    );
  }

  return content;
}

function WorkspaceSectionSeparator({ label }: { label: string }) {
  return (
    <div className="pt-3 pb-1.5">
      <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace Switcher
// ---------------------------------------------------------------------------

function WorkspaceSwitcher({
  workspaces,
  active,
  onSelect,
  isCollapsed,
}: {
  workspaces: Workspace[];
  active: WorkspaceId;
  onSelect: (id: WorkspaceId) => void;
  isCollapsed: boolean;
}) {
  const current = workspaces.find((w) => w.id === active);

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 py-2">
        {workspaces.map((ws) => (
          <SimpleTooltip key={ws.id} content={ws.label} side="right">
            <button
              onClick={() => onSelect(ws.id)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors",
                ws.id === active
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              aria-label={ws.label}
            >
              {ws.icon}
            </button>
          </SimpleTooltip>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent",
            "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          )}
        >
          <span className="text-base">{current?.icon || "⭐"}</span>
          <span className="flex-1 text-left truncate">{current?.label || "My Work"}</span>
          <span className="text-sidebar-foreground/40 text-xs">&#x25BC;</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-56">
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            className={cn(
              "flex items-center gap-3 py-2",
              ws.id === active && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            <span className="text-base">{ws.icon}</span>
            <span className="font-medium">{ws.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// My Work Section
// ---------------------------------------------------------------------------

function MyWorkSection({
  favorites,
  recentPages,
  quickActions,
  allItems,
  activeHref,
  onToggleFavorite,
  onNavigate,
}: {
  favorites: string[];
  recentPages: RecentPage[];
  quickActions: { label: string; href: string; icon: string }[];
  allItems: NavItemType[];
  activeHref: string | null;
  onToggleFavorite: (href: string) => void;
  onNavigate?: () => void;
}) {
  // Resolve favorite hrefs to nav items
  const favoriteItems = useMemo(() => {
    return favorites
      .map((href) => allItems.find((item) => item.href === href))
      .filter((item): item is NavItemType => item !== undefined);
  }, [favorites, allItems]);

  return (
    <div className="space-y-1">
      {/* Dashboard — always first */}
      <SidebarNavItem
        item={{ label: "Dashboard", href: "/", icon: "📊" }}
        isActive={activeHref === "/"}
        isCollapsed={false}
        onNavigate={onNavigate}
      />

      {/* Favorites */}
      {favoriteItems.length > 0 && (
        <>
          <WorkspaceSectionSeparator label="Favorites" />
          {favoriteItems.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              isActive={item.href === activeHref}
              isCollapsed={false}
              isFavorite={true}
              onToggleFavorite={onToggleFavorite}
              onNavigate={onNavigate}
            />
          ))}
        </>
      )}

      {/* Recent */}
      {recentPages.length > 0 && (
        <>
          <WorkspaceSectionSeparator label="Recent" />
          {recentPages.slice(0, 5).map((recent) => (
            <Link
              key={recent.href}
              href={recent.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                recent.href === activeHref
                  ? "bg-sidebar-accent text-amber-400 font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <span className="text-base shrink-0">{recent.icon}</span>
              <span className="truncate">{recent.label}</span>
            </Link>
          ))}
        </>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <>
          <WorkspaceSectionSeparator label="Quick Actions" />
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-amber-400/80 hover:bg-sidebar-accent hover:text-amber-400 transition-colors"
            >
              <span className="text-base shrink-0">{action.icon}</span>
              <span className="truncate">+ {action.label}</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Context Header
// ---------------------------------------------------------------------------

function ProjectContextHeader({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="px-3 py-2">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to All Projects
      </button>
      <div className="px-3">
        <ProjectSwitcher />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------

export function AppSidebar({ onNavigate, variant = "desktop" }: { onNavigate?: () => void; variant?: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { can, canAny } = usePermissions();
  const { setHelpOpen } = useKeyboardShortcuts();
  const {
    activeWorkspace,
    isCollapsed,
    favorites,
    recentPages,
    currentProjectId,
    isProjectContext,
    visibleWorkspaces,
    roleDefaults,
    setActiveWorkspace,
    toggleCollapsed,
    toggleFavorite,
    isFavorite,
  } = useWorkspaceNav();

  // Build items for the current workspace
  const workspaceItems = useMemo(() => {
    if (activeWorkspace === "my-work") return []; // My Work is special
    if (activeWorkspace === "projects") {
      return getProjectWorkspaceItems(currentProjectId);
    }
    const ws = visibleWorkspaces.find((w) => w.id === activeWorkspace);
    return ws?.items || [];
  }, [activeWorkspace, currentProjectId, visibleWorkspaces]);

  const workspaceSeparators = useMemo(() => {
    if (activeWorkspace === "projects") {
      return getProjectWorkspaceSeparators(currentProjectId);
    }
    const ws = visibleWorkspaces.find((w) => w.id === activeWorkspace);
    return ws?.separators;
  }, [activeWorkspace, currentProjectId, visibleWorkspaces]);

  // Filter items by permission (demo users see everything)
  const isDemoUser = user?.isDemoUser ?? false;
  const filteredItems = useMemo(() => {
    if (isDemoUser) return workspaceItems; // Demo: show all nav items
    return workspaceItems.filter((item) => {
      if (item.requiredPermission) return can(item.requiredPermission);
      if (item.requiredAnyPermission) return canAny(item.requiredAnyPermission);
      return true;
    });
  }, [workspaceItems, can, canAny, isDemoUser]);

  // All items for active href calculation
  const allNavItems = useMemo(() => getAllNavItems(currentProjectId), [currentProjectId]);

  const activeHref = useMemo(
    () => findActiveHref(pathname, allNavItems),
    [pathname, allNavItems]
  );

  // Build items with separators inserted
  const itemsWithSeparators = useMemo(() => {
    if (!workspaceSeparators || workspaceSeparators.length === 0) {
      return filteredItems.map((item) => ({ type: "item" as const, item }));
    }

    const result: ({ type: "item"; item: NavItemType } | { type: "separator"; label: string })[] = [];
    const sepMap = new Map(workspaceSeparators.map((s) => [s.beforeIndex, s.label]));

    // We need to map original indices to filtered indices
    let originalIndex = 0;
    for (const item of workspaceItems) {
      const sepLabel = sepMap.get(originalIndex);
      if (sepLabel) {
        // Only add separator if the item at this index passed filtering
        const isFiltered = filteredItems.includes(item);
        if (isFiltered) {
          result.push({ type: "separator", label: sepLabel });
        }
      }
      if (filteredItems.includes(item)) {
        result.push({ type: "item", item });
      }
      originalIndex++;
    }

    return result;
  }, [filteredItems, workspaceItems, workspaceSeparators]);

  // Settings dropdown items (removed from main nav, accessible via user menu)
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Mobile variant: always visible, never collapsed, full width
  const isMobile = variant === "mobile";
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200",
        isMobile
          ? "w-full h-full min-h-0"
          : cn("hidden lg:flex min-h-screen", effectiveCollapsed ? "lg:w-[52px]" : "lg:w-64")
      )}
    >
      {/* Logo + Collapse Toggle */}
      <div className={cn(
        "flex items-center gap-3 py-4",
        effectiveCollapsed ? "px-2 justify-center" : "px-5"
      )}>
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 font-bold text-sm shrink-0">
            P
          </div>
          {!effectiveCollapsed && (
            <div>
              <h1 className="font-bold text-sm leading-tight">Pitbull</h1>
              <p className="text-[10px] text-sidebar-foreground/60">Construction Solutions</p>
            </div>
          )}
        </Link>
        {!effectiveCollapsed && !isMobile && (
          <button
            onClick={toggleCollapsed}
            className="ml-auto text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {effectiveCollapsed && (
        <button
          onClick={toggleCollapsed}
          className="mx-auto mb-1 text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <Separator className="bg-sidebar-border" />

      {/* Company Switcher */}
      {!effectiveCollapsed && (
        <>
          <div className="px-3 pt-3 pb-2">
            <CompanySwitcher variant="sidebar" />
          </div>
          <Separator className="bg-sidebar-border mx-3" />
        </>
      )}
      {/* When collapsed, company switcher is available in the header */}

      {/* Workspace Switcher */}
      <div className={cn("pt-2", effectiveCollapsed ? "px-0.5" : "px-3")}>
        <WorkspaceSwitcher
          workspaces={visibleWorkspaces}
          active={activeWorkspace}
          onSelect={(id) => {
            setActiveWorkspace(id);
            router.push(getWorkspaceLandingHref(id));
            onNavigate?.();
          }}
          isCollapsed={effectiveCollapsed}
        />
      </div>

      {!effectiveCollapsed && <Separator className="bg-sidebar-border mx-3 mt-2" />}

      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-2 space-y-0.5 overflow-y-auto",
        effectiveCollapsed ? "px-1" : "px-3"
      )}>
        {/* My Work — special rendering */}
        {activeWorkspace === "my-work" && !effectiveCollapsed && (
          <MyWorkSection
            favorites={favorites}
            recentPages={recentPages}
            quickActions={roleDefaults.quickActions}
            allItems={allNavItems}
            activeHref={activeHref}
            onToggleFavorite={toggleFavorite}
            onNavigate={onNavigate}
          />
        )}

        {/* Project Context Header */}
        {activeWorkspace === "projects" && isProjectContext && !effectiveCollapsed && (
          <ProjectContextHeader
            onBack={() => {
              setActiveWorkspace("projects");
              router.push("/projects");
            }}
          />
        )}

        {/* Workspace items (not My Work) */}
        {activeWorkspace !== "my-work" && (
          <>
            {itemsWithSeparators.map((entry) => {
              if (entry.type === "separator") {
                if (effectiveCollapsed) return null;
                return <WorkspaceSectionSeparator key={`sep-${entry.label}`} label={entry.label} />;
              }
              return (
                <SidebarNavItem
                  key={entry.item.href}
                  item={entry.item}
                  isActive={entry.item.href === activeHref}
                  isCollapsed={effectiveCollapsed}
                  isFavorite={isFavorite(entry.item.href)}
                  onToggleFavorite={effectiveCollapsed ? undefined : toggleFavorite}
                  onNavigate={onNavigate}
                />
              );
            })}
          </>
        )}

        {/* Collapsed: show My Work as simple icons for favorites */}
        {activeWorkspace === "my-work" && effectiveCollapsed && (
          <>
            <SidebarNavItem
              item={{ label: "Dashboard", href: "/", icon: "📊" }}
              isActive={activeHref === "/"}
              isCollapsed={true}
              onNavigate={onNavigate}
            />
            {favorites.slice(0, 5).map((href) => {
              const item = allNavItems.find((n) => n.href === href);
              if (!item) return null;
              return (
                <SidebarNavItem
                  key={href}
                  item={item}
                  isActive={item.href === activeHref}
                  isCollapsed={true}
                  onNavigate={onNavigate}
                />
              );
            })}
          </>
        )}
      </nav>

      {/* AI Trigger */}
      {!effectiveCollapsed ? (
        <div className="px-3 py-2">
          <Separator className="bg-sidebar-border mb-2" />
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              // Opens AI chat panel via existing AiChatPanel component
              const event = new CustomEvent("pitbull:open-ai-chat");
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Ask Pitbull AI</span>
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-2">
          <SimpleTooltip content="Ask Pitbull AI" side="right">
            <button
              onClick={() => {
                const event = new CustomEvent("pitbull:open-ai-chat");
                window.dispatchEvent(event);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-amber-400 transition-colors"
              aria-label="Ask Pitbull AI"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </SimpleTooltip>
        </div>
      )}

      <Separator className="bg-sidebar-border" />

      {/* User Section */}
      <div className={cn("py-3", effectiveCollapsed ? "px-1" : "px-3")}>
        {effectiveCollapsed ? (
          <div className="flex flex-col items-center gap-1">
            <SimpleTooltip content="Settings" side="right">
              <Link
                href="/settings"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </SimpleTooltip>
            <SimpleTooltip content={user?.name || "User"} side="right">
              <button
                onClick={logout}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium"
                aria-label="Sign out"
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </button>
            </SimpleTooltip>
          </div>
        ) : (
          <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full rounded-lg px-3 py-2 hover:bg-sidebar-accent transition-colors text-left">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {user?.email || ""}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Help Center
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHelpOpen(true)}>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-muted px-1 rounded">?</span>
                  Keyboard Shortcuts
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Version (also shown globally via AppVersionBadge; keep sidebar link for About) */}
      <div className={cn(
        "px-3 pb-2 text-center",
        effectiveCollapsed && "px-1"
      )}>
        <Link
          href="/settings/about"
          className="text-[10px] font-mono text-sidebar-foreground/30 hover:text-sidebar-foreground/50 transition-colors"
          title="About this version"
        >
          {effectiveCollapsed ? getAppVersionLabel() : `Pitbull ${getAppVersionLabel()}`}
        </Link>
      </div>
    </aside>
  );
}
