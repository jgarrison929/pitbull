/**
 * Postgres pool sizing for the Next.js app and the drill-down proxy.
 * Kept free of drizzle/postgres imports so middleware (`proxy.ts`) can share
 * the same constants without pulling the ORM into the edge/node proxy graph.
 *
 * Do not re-raise to the closed #60 thrash sizes (app 40 / proxy 24): those
 * made cost-item Phase A worse than main under Verify. The app default here
 * is the former app+proxy sum (20+8) so RSC Suspense on heavy job pages can
 * use capacity that sat idle in the separate proxy pool during document work;
 * proxy stays at 8.
 */

/** Default app pool size. Override with V5_DB_POOL_MAX (positive int). */
export const DEFAULT_DB_POOL_MAX = 28;

/**
 * Proxy drill-down 404-check pool. Crawl bursts hit this on every job /
 * cost-item / plan navigation; kept at 8 (not #60's 24) so document-path
 * Postgres work is not fighting a large idle proxy reservation.
 */
export const PROXY_DB_POOL_MAX = 8;

/** Soft-cap for V5_DB_POOL_MAX typos — well below the #60 thrash total (64). */
export const DB_POOL_MAX_SOFT_CAP = 40;

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
