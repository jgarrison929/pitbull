/**
 * Cost overlay empty banner (2.17.8).
 * Shown when cost mode is active and no zones have real allocation heat.
 */

export const COST_NOT_ALLOCATED_BANNER =
  "Cost by zone not allocated — no fake cost heat. Link cost codes to zones to enable this overlay.";

export function shouldShowCostNotAllocatedBanner(
  mode: string,
  overlayNodes?: Array<{ band?: string | null }> | null
): boolean {
  if (mode !== "cost") return false;
  if (!overlayNodes?.length) return true;
  // Any non-insufficient band means something is allocated/shown
  const hasAllocated = overlayNodes.some(
    (n) => n.band && n.band !== "InsufficientData"
  );
  return !hasAllocated;
}
