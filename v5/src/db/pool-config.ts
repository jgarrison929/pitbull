/**
 * Postgres pool sizing for the Next.js app and the drill-down proxy.
 * Kept free of drizzle/postgres imports so middleware (`proxy.ts`) can share
 * the same constants without pulling the ORM into the edge/node proxy graph.
 */

/**
 * Default shared-app pool size. Override with V5_DB_POOL_MAX (positive int).
 *
 * Keep this modest: Verify #60 showed larger defaults (40) oversubscribed
 * Postgres under crawl-like concurrency and *raised* TTFB tails vs main.
 * Suspense still fans out a few queries per document; 20 covers that without
 * inviting a stampeded of parallel statements across 24 browser contexts.
 */
export const DEFAULT_DB_POOL_MAX = 20;

/**
 * Proxy drill-down 404-check pool. Document navigations (and soft-nav RSC)
 * hit this before SSR. Prefer a small warm pool: oversized max lets many
 * concurrent lookups thrash Postgres and inflate `v5proxy` dur (Verify saw
 * 440 ms tails at max=24; main’s max=8 stayed under the TTFB gate).
 */
export const PROXY_DB_POOL_MAX = 8;

/** Soft-cap for V5_DB_POOL_MAX typos (app pool only; proxy uses its constant). */
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
