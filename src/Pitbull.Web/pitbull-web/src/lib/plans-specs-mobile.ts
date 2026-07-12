/**
 * Plans & Specs mobile layout tokens (2.13.4).
 * Field viewers on phone; admin CRUD remains desktop (lg+).
 */

/** Tailwind: show only at lg+ (admin primary CTAs). */
export const PLANS_ADMIN_CTA_CLASS = "hidden lg:inline-flex";

/** Tailwind: show only at lg+ (admin block chrome). */
export const PLANS_ADMIN_BLOCK_CLASS = "hidden lg:block";

/** True when viewport should default to viewer-first (matches Tailwind max-lg). */
export function isPlansFieldModeViewport(widthPx: number): boolean {
  return widthPx < 1024;
}
