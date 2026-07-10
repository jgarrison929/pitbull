import type { NavItem } from "./nav-items";

/**
 * Find the single best-matching nav item href for the current pathname.
 * Prefers exact match, then longest startsWith match. This prevents
 * /settings from also highlighting when on /settings/notifications.
 */
export function findActiveHref(pathname: string, allItems: NavItem[]): string | null {
  const exact = allItems.find((i) => i.href === pathname);
  if (exact) return exact.href;

  let best: string | null = null;
  for (const item of allItems) {
    if (item.href !== "/" && pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.length) {
        best = item.href;
      }
    }
  }
  return best ?? (pathname === "/" ? "/" : null);
}

export type MobileTabMatch = {
  href: string;
  matchPaths?: string[];
};

/**
 * Whether a role mobile bottom-nav tab is active for the current pathname.
 * Home (`/`) is exact-only; other tabs use matchPaths prefixes or href prefix.
 */
function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function isMobileTabActive(pathname: string, tab: MobileTabMatch): boolean {
  if (tab.href === "/") {
    return pathname === "/";
  }
  if (tab.matchPaths?.length) {
    return tab.matchPaths.some((p) => pathMatchesPrefix(pathname, p));
  }
  return pathMatchesPrefix(pathname, tab.href);
}
