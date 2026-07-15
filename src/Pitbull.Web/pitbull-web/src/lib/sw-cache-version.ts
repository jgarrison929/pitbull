/**
 * Expected service-worker CACHE_VERSION string (public/sw.js).
 * Bump both together on deploy-freshness stamps so activate() drops stale precache.
 */
export const SW_CACHE_VERSION = "v3.2.8";

/** Parse CACHE_VERSION assignment from sw.js source text. */
export function parseSwCacheVersionFromSource(swSource: string): string | null {
  const m = swSource.match(/const\s+CACHE_VERSION\s*=\s*["']([^"']+)["']/);
  return m?.[1] ?? null;
}

/** True when install uses skipWaiting and activate uses clients.claim. */
export function swHasDeployClaimHooks(swSource: string): boolean {
  return (
    swSource.includes("skipWaiting()") &&
    (swSource.includes("clients.claim()") || swSource.includes("self.clients.claim()"))
  );
}
