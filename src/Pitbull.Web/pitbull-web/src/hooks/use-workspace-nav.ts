"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  type WorkspaceId,
  workspaces,
  getRoleDefaults,
  getAllNavItems,
} from "@/components/layout/workspaces";

// ---------------------------------------------------------------------------
// LocalStorage keys
// ---------------------------------------------------------------------------

const WORKSPACE_KEY = "pitbull:workspace:active";
const FAVORITES_KEY = "pitbull:workspace:favorites";
const RECENTS_KEY = "pitbull:workspace:recents";
const COLLAPSED_KEY = "pitbull:sidebar:collapsed";
const INITIALIZED_KEY = "pitbull:workspace:initialized";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentPage {
  href: string;
  label: string;
  icon: string;
  visitedAt: number;
}

const MAX_RECENTS = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

/** Detect which workspace a URL belongs to */
function detectWorkspaceFromPath(pathname: string): WorkspaceId | null {
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/bids")) return "projects";
  if (pathname.startsWith("/accounting") || pathname.startsWith("/chart-of-accounts")) return "finance";
  if (pathname.startsWith("/billing") || pathname.startsWith("/payment-applications")) return "finance";
  if (pathname.startsWith("/procurement") || pathname.startsWith("/vendors") || pathname.startsWith("/customers")) return "operations";
  if (pathname.startsWith("/contracts") || pathname.startsWith("/change-orders")) return "operations";
  if (pathname.startsWith("/employees") || pathname.startsWith("/time-tracking") || pathname.startsWith("/payroll")) return "people";
  if (pathname.startsWith("/cost-codes") || pathname.startsWith("/equipment")) return "people";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const defaults = useMemo(() => getRoleDefaults(user?.roles), [user?.roles]);

  // Initialize on first use — seed favorites from role defaults
  const [initialized] = useState(() => {
    if (typeof window === "undefined") return false;
    const already = localStorage.getItem(INITIALIZED_KEY);
    if (!already) {
      writeStorage(FAVORITES_KEY, defaults.favorites);
      writeStorage(WORKSPACE_KEY, JSON.stringify(defaults.defaultWorkspace));
      localStorage.setItem(INITIALIZED_KEY, "true");
      return false;
    }
    return true;
  });

  // Active workspace
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceId>(() => {
    const stored = readStorage<WorkspaceId | null>(WORKSPACE_KEY, null);
    return stored || defaults.defaultWorkspace;
  });

  // Sidebar collapsed
  const [isCollapsed, setIsCollapsedState] = useState(() =>
    readStorage(COLLAPSED_KEY, false)
  );

  // Favorites (hrefs)
  const [favorites, setFavoritesState] = useState<string[]>(() =>
    readStorage(FAVORITES_KEY, defaults.favorites)
  );

  // Recent pages
  const [recentPages, setRecentPagesState] = useState<RecentPage[]>(() =>
    readStorage(RECENTS_KEY, [])
  );

  // Project context: extract from URL
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)/i);
  const currentProjectId = projectMatch?.[1] || null;

  // Whether we're in project context mode (auto-override workspace)
  const isProjectContext = currentProjectId !== null;

  // The effective workspace (project context overrides user selection)
  const effectiveWorkspace: WorkspaceId = isProjectContext
    ? "projects"
    : activeWorkspace;

  // Auto-switch workspace when navigating to a page that belongs to a different workspace.
  // Only triggers on pathname change — NOT on manual workspace selection — to prevent
  // a feedback loop where selecting workspace X while viewing a page in workspace Y
  // would immediately revert the selection back to Y.
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (isProjectContext) return; // Don't auto-switch when in project context
    if (prevPathnameRef.current !== null && prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    const detected = detectWorkspaceFromPath(pathname);
    if (detected && detected !== activeWorkspace) {
      setActiveWorkspaceState(detected);  
      writeStorage(WORKSPACE_KEY, detected);
    }
  }, [pathname, isProjectContext, activeWorkspace]);

  // Track page visit in recents
  useEffect(() => {
    if (pathname === "/") return; // Don't track dashboard in recents
    const allItems = getAllNavItems(currentProjectId);
    const match = allItems.find(
      (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href + "/"))
    );
    if (!match) return;

    setRecentPagesState((prev) => {  
      const filtered = prev.filter((r) => r.href !== match.href);
      const updated = [
        { href: match.href, label: match.label, icon: match.icon, visitedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENTS);
      writeStorage(RECENTS_KEY, updated);
      return updated;
    });
  }, [pathname, currentProjectId]);

  // Actions
  const setActiveWorkspace = useCallback((id: WorkspaceId) => {
    setActiveWorkspaceState(id);
    writeStorage(WORKSPACE_KEY, id);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      writeStorage(COLLAPSED_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((href: string) => {
    setFavoritesState((prev) => {
      const next = prev.includes(href)
        ? prev.filter((f) => f !== href)
        : [...prev, href];
      writeStorage(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (href: string) => favorites.includes(href),
    [favorites]
  );

  // Get visible workspaces (filtered by permissions + demo user restrictions)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.permissions is the correct dependency
  const visibleWorkspaces = useMemo(() => {
    // If no user/permissions yet, show all (permissions will re-filter on load)
    if (!user?.permissions) return workspaces;

    // Demo users see all workspaces including Admin (browse-only).
    // API DemoRestrictionMiddleware enforces read-only on admin endpoints.
    if (user.isDemoUser) {
      return workspaces;
    }

    const perms = new Set(user.permissions);
    const hasPerm = (p: string) => perms.has("*") || perms.has(p);
    const hasAnyPerm = (ps: string[]) => perms.has("*") || ps.some((p) => perms.has(p));

    return workspaces.filter((ws) => {
      if (ws.requiredPermission) return hasPerm(ws.requiredPermission);
      if (ws.requiredAnyPermission) return hasAnyPerm(ws.requiredAnyPermission);
      return true; // my-work is always visible
    });
  }, [user?.permissions, user?.isDemoUser]);

  return {
    // State
    activeWorkspace: effectiveWorkspace,
    isCollapsed,
    favorites,
    recentPages,
    currentProjectId,
    isProjectContext,
    visibleWorkspaces,
    roleDefaults: defaults,

    // Actions
    setActiveWorkspace,
    toggleCollapsed,
    toggleFavorite,
    isFavorite,

    // For backward compat / unused value guard
    initialized,
  };
}
