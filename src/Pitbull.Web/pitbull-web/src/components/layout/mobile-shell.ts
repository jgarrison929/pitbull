/**
 * Shared mobile dashboard chrome tokens.
 * Bottom nav is `lg:hidden` (~64–72px + safe-area). Main content and fixed
 * widgets must clear that band so primary actions stay tappable.
 */

/** Field report wizard route — bottom nav is hidden so a single action bar owns the bottom. */
export const FIELD_REPORT_MOBILE_PATH = "/daily-reports/mobile";

/** True when MobileBottomNav should not render (field report wizard owns the bottom chrome). */
export function isFieldReportMobilePath(
  pathname: string | null | undefined
): boolean {
  if (!pathname) return false;
  // Strip query/hash if a full path-with-search is ever passed (usePathname is path-only).
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  return (
    path === FIELD_REPORT_MOBILE_PATH ||
    path.startsWith(`${FIELD_REPORT_MOBILE_PATH}/`)
  );
}

/** Tailwind classes for authenticated main content bottom padding (below `lg`). */
export const MOBILE_MAIN_BOTTOM_CLEARANCE =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6";

/** Fixed FAB sits above the bottom nav on viewports that show the nav. */
export const MOBILE_FAB_POSITION =
  "fixed z-50 lg:hidden bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4";

/** Version badge on small screens: lift above bottom nav. */
export const MOBILE_VERSION_BADGE_OFFSET =
  "max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]";

/**
 * Field report wizard primary actions — pin to the true bottom (nav hidden on this route).
 * Includes home-indicator safe-area so CTAs stay tappable on notched phones.
 */
export const MOBILE_FIELD_WIZARD_ACTION_BAR =
  "fixed inset-x-0 bottom-0 z-20 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]";

/**
 * PWA install prompt — above bottom nav + safe-area on phone; standard bottom-4 on lg+.
 * z-60 so it stacks above the z-50 nav band.
 */
export const MOBILE_PWA_PROMPT_POSITION =
  "fixed z-[60] left-4 right-4 mx-auto max-w-md bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-4 animate-in slide-in-from-bottom-4 fade-in-50 duration-300";

/** Root column for dashboard content — prevent wide tables from expanding the page. */
export const DASHBOARD_CONTENT_COLUMN = "flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden";
