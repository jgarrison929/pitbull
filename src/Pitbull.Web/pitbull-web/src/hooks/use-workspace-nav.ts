"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import {
  type WorkspaceId,
  workspaces,
  getRoleDefaults,
  getAllNavItems,
  detectWorkspaceFromPath,
} from "@/components/layout/workspaces";

// ---------------------------------------------------------------------------
// LocalStorage keys
// ---------------------------------------------------------------------------

const WORKSPACE_KEY = "pitbull:workspace:active";
const FAVORITES_KEY = "pitbull:workspace:favorites";
const RECENTS_KEY = "pitbull:workspace:recents";
const COLLAPSED_KEY = "pitbull:sidebar:collapsed";
const INITIALIZED_KEY = "pitbull:workspace:initialized";
/** Bump when role defaults / workspace item placement change so favorites re-seed. */
const NAV_SCHEMA_VERSION = "2.12.0";
const NAV_SCHEMA_KEY = "pitbull:workspace:nav-schema";

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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const defaults = useMemo(
    () => getRoleDefaults(user?.roles, user?.roleProfile),
    [user?.roles, user?.roleProfile]
  );

  // Initialize on first use — seed favorites from role defaults.
  // Re-seed when NAV_SCHEMA_VERSION changes (e.g. 2.12.0 role UX simplify).
  const [initialized] = useState(() => {
    if (typeof window === "undefined") return false;
    const already = localStorage.getItem(INITIALIZED_KEY);
    const schema = localStorage.getItem(NAV_SCHEMA_KEY);
    if (!already || schema !== NAV_SCHEMA_VERSION) {
      writeStorage(FAVORITES_KEY, defaults.favorites);
      writeStorage(WORKSPACE_KEY, defaults.defaultWorkspace);
      localStorage.setItem(INITIALIZED_KEY, "true");
      localStorage.setItem(NAV_SCHEMA_KEY, NAV_SCHEMA_VERSION);
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
  // Skip workspaces outside the persona allow-list (e.g. field on /admin deep link).
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (isProjectContext) return; // Don't auto-switch when in project context
    if (prevPathnameRef.current !== null && prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    const detected = detectWorkspaceFromPath(pathname);
    if (
      detected &&
      detected !== activeWorkspace &&
      defaults.workspaces.includes(detected)
    ) {
      setActiveWorkspaceState(detected);
      writeStorage(WORKSPACE_KEY, detected);
    }
  }, [pathname, isProjectContext, activeWorkspace, defaults.workspaces]);

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

  // Role allow-list first (persona UX), then permission gate.
  // Demo Explore-as-role uses the same allow-list so CEO/field menus stay clean.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.permissions is the correct dependency
  const visibleWorkspaces = useMemo(() => {
    const allowed = new Set(defaults.workspaces);
    const byRole = workspaces.filter((ws) => allowed.has(ws.id));

    // No permissions yet: still show role-scoped list (permissions re-filter on load)
    if (!user?.permissions) return byRole;

    const perms = new Set(user.permissions);
    const hasPerm = (p: string) => perms.has("*") || perms.has(p);
    const hasAnyPerm = (ps: string[]) => perms.has("*") || ps.some((p) => perms.has(p));

    // Demo users: role allow-list only (browse-only on admin enforced by API if they deep-link)
    if (user.isDemoUser) return byRole;

    return byRole.filter((ws) => {
      if (ws.requiredPermission) return hasPerm(ws.requiredPermission);
      if (ws.requiredAnyPermission) return hasAnyPerm(ws.requiredAnyPermission);
      return true; // my-work is always visible when allowed
    });
  }, [user?.permissions, user?.isDemoUser, defaults.workspaces]);

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
