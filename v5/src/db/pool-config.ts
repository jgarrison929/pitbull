/**
 * Postgres pool sizing for the Next.js app and the drill-down proxy.
 * Kept free of drizzle/postgres imports so middleware (`proxy.ts`) can share
 * the same constants without pulling the ORM into the edge/node proxy graph.
 */

/**
 * Default shared-app pool size. Override with V5_DB_POOL_MAX (positive int).
 * Sized for verify crawl bursts: Suspense fan-out (shell portfolio + page +
 * assistant) holds several connections per in-flight document; too-small
 * pools queue and spike TTFB (staging saw 60 ms → 836 ms on the same cost
 * item under Part C concurrency).
 */
export const DEFAULT_DB_POOL_MAX = 40;

/**
 * Proxy drill-down 404-check pool. Every matched document (and historically
 * every RSC flight) hits this before SSR. Undersizing here directly inflates
 * TTFB under role×width crawl overlap.
 */
export const PROXY_DB_POOL_MAX = 24;

/** Soft-cap for V5_DB_POOL_MAX typos (app pool only; proxy uses its constant). */
export const DB_POOL_MAX_SOFT_CAP = 80;

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
