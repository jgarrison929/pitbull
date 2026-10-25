/**
 * Plans offline open honesty copy (3.2.5).
 * Never claims whole set offline.
 */

export type PlanCacheState = "cached" | "not_cached" | "unknown";

export function planOpenButtonLabel(state: PlanCacheState, online: boolean): string {
  if (online) return "Open";
  if (state === "cached") return "Open offline";
  if (state === "not_cached") return "Unavailable offline";
  return "Open";
}

export function planOpenDisabled(state: PlanCacheState, online: boolean): boolean {
  if (online) return false;
  return state !== "cached";
}

export function planCacheBadge(state: PlanCacheState): string {
  if (state === "cached") return "On this device";
  if (state === "not_cached") return "Not on device";
  return "Cache unknown";
}

export function planUnavailableOfflineCopy(): string {
  return "This sheet is not saved on this device. Connect to open it, or use Save for offline when online.";
}
