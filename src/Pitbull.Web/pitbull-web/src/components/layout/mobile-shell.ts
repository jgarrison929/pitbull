/**
 * Shared mobile dashboard chrome tokens.
 * Bottom nav is `lg:hidden` (~64–72px + safe-area). Main content and fixed
 * widgets must clear that band so primary actions stay tappable.
 */

/** Tailwind classes for authenticated main content bottom padding (below `lg`). */
export const MOBILE_MAIN_BOTTOM_CLEARANCE =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6";

/** Fixed FAB sits above the bottom nav on viewports that show the nav. */
export const MOBILE_FAB_POSITION =
  "fixed z-50 lg:hidden bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4";

/** Version badge on small screens: lift above bottom nav. */
export const MOBILE_VERSION_BADGE_OFFSET =
  "max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]";

/** Root column for dashboard content — prevent wide tables from expanding the page. */
export const DASHBOARD_CONTENT_COLUMN = "flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden";
