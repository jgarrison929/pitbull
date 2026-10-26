/**
 * Postgres refuses ALTER TYPE … ADD VALUE inside a transaction block.
 * Stock drizzle migrators wrap each file in a TX — ADD VALUE fails there.
 *
 * This repo's `scripts/db-migrate.mjs` detects ADD VALUE and applies those
 * migrations outside a transaction (others stay transactional). New ADD VALUE
 * files must be allowlisted below with that reason; prefer recreate-enum
 * (see 0012) when a simple ADD VALUE is not enough.
 */

const ADD_VALUE = /ALTER\s+TYPE\b[\s\S]*?\bADD\s+VALUE\b/i;

export function findAddValueInMigration(sql: string): boolean {
  return ADD_VALUE.test(sql);
}

/**
 * Committed migrations that intentionally use ADD VALUE.
 * Safe only while `scripts/db-migrate.mjs` applies them outside a transaction.
 */
export const ADD_VALUE_ALLOWLIST: Readonly<
  Record<string, { reason: string }>
> = {
  "0017_average_performance.sql": {
    reason:
      "Re-adds forecast_method value; db-migrate.mjs applies ADD VALUE outside a transaction",
  },
};
