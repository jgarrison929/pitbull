/**
 * Plans & Specs mobile layout tokens (2.13.4–2.13.5).
 * Field viewers on phone; admin CRUD remains desktop (lg+).
 */

/** Tailwind: show only at lg+ (admin primary CTAs). */
export const PLANS_ADMIN_CTA_CLASS = "hidden lg:inline-flex";

/** Tailwind: show only at lg+ (admin block chrome). */
export const PLANS_ADMIN_BLOCK_CLASS = "hidden lg:block";

/** Minimum touch target height for plan controls (px). */
export const PLANS_TOUCH_TARGET_PX = 44;

/** Tailwind classes for one-handed mobile search input. */
export const PLANS_MOBILE_SEARCH_INPUT_CLASS =
  "pl-9 min-h-[48px] sm:min-h-9 text-base sm:text-sm";

/** True when viewport should default to viewer-first (matches Tailwind max-lg). */
export function isPlansFieldModeViewport(widthPx: number): boolean {
  return widthPx < 1024;
}

/** Whether a control height meets the 44px mobile touch bar. */
export function meetsPlansTouchTarget(heightPx: number): boolean {
  return heightPx >= PLANS_TOUCH_TARGET_PX;
}