/**
 * Postgres refuses ALTER TYPE … ADD VALUE inside a transaction block.
 * Drizzle wraps each migration in a transaction — ADD VALUE always fails at apply.
 * Prefer recreate-enum (see 0012) or a documented out-of-band step, never ADD VALUE.
 */

const ADD_VALUE = /ALTER\s+TYPE\b[\s\S]*?\bADD\s+VALUE\b/i;

export function findAddValueInMigration(sql: string): boolean {
  return ADD_VALUE.test(sql);
}
