/** Breakpoints aligned with Tailwind `lg` (dashboard bottom nav). */
export const MOBILE_VIEWPORT_MAX_PX = 1023;

export type ViewportClass = "phone" | "tablet" | "desktop";

/** Pure helper — classify viewport for analytics (unit-tested). */
export function classifyViewportWidth(width: number): ViewportClass {
  if (width <= 640) return "phone";
  if (width <= MOBILE_VIEWPORT_MAX_PX) return "tablet";
  return "desktop";
}

export function isNarrowViewport(width: number): boolean {
  return width <= MOBILE_VIEWPORT_MAX_PX;
}
