/**
 * Plan metadata offline cache contract (2.14.1).
 * SW caches GET plan-sets metadata (not PDF binaries) under API_CACHE network-first.
 */

/** Path pattern the service worker treats as cacheable plan metadata. */
export const PLAN_SETS_API_CACHE_PATH =
  /\/api\/projects\/[^/]+\/plan-sets(\?|$)/;

export function isPlanSetsMetadataUrl(pathnameWithSearch: string): boolean {
  return PLAN_SETS_API_CACHE_PATH.test(pathnameWithSearch);
}

/** Cache bucket name fragment used by public/sw.js (versioned separately). */
export const PLAN_METADATA_CACHE_NOTE =
  "network-first GET /api/projects/{id}/plan-sets → pitbull-api-* (metadata only)";
