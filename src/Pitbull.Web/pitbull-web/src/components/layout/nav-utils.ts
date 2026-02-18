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
