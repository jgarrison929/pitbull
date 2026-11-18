/**
 * Postgres pool sizing for the Next.js app and the drill-down proxy.
 * Kept free of drizzle/postgres imports so middleware (`proxy.ts`) can share
 * the same constants without pulling the ORM into the edge/node proxy graph.
 *
 * Keep app default at 20 / proxy 8 — Verify #70 showed raising app to 28
 * regressed TTFB p95 vs main (232 vs 215) under the warm 24-browser burst.
 * Do not re-raise to the closed #60 thrash sizes (app 40 / proxy 24).
 */

/** Default shared-app pool size. Override with V5_DB_POOL_MAX (positive int). */
export const DEFAULT_DB_POOL_MAX = 20;

/**
 * Proxy drill-down 404-check pool. Crawl bursts hit this on every job /
 * cost-item / plan navigation; max 2 queued acquisition waits under Suspense
 * overlap with the app pool.
 */
export const PROXY_DB_POOL_MAX = 8;

/** Soft-cap for V5_DB_POOL_MAX typos — well below the #60 thrash total (64). */
export const DB_POOL_MAX_SOFT_CAP = 50;

/**
 * App pool `max` from env. Invalid / missing → DEFAULT_DB_POOL_MAX.
 * Soft-capped so a typo cannot open hundreds of connections per process.
 */
export function dbPoolMaxFromEnv(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.V5_DB_POOL_MAX;
  if (raw == null || raw === "") return DEFAULT_DB_POOL_MAX;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DB_POOL_MAX;
  return Math.min(Math.floor(n), DB_POOL_MAX_SOFT_CAP);
}
