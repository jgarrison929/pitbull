import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Calendar used for seed rows and seeded EV timestamps (claim locks, as-of PV).
 * Optional `V5_SEED_NOW` freezes that calendar for visual baselines.
 * Sandbox TTL / "still live?" checks stay on the wall clock in sandbox.ts.
 */
export function seedNow(fallback = new Date()): Date {
  const raw = process.env.V5_SEED_NOW?.trim();
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`V5_SEED_NOW is not a valid date: ${raw}`);
  }
  return parsed;
}

/** Per-async seed path: createSandbox(seedAt) must lock claims at seedAt, not wall. */
const seedClock = new AsyncLocalStorage<Date>();

/** Run seed action history (and nested locks) under an explicit seed calendar. */
export function runWithSeedClock<T>(now: Date, fn: () => Promise<T>): Promise<T> {
  return seedClock.run(now, fn);
}

/**
 * Clock for earned-value writes during seed. Prefers the active seed-path
 * calendar, else `V5_SEED_NOW`, else wall.
 */
export function getSeedClock(fallback = seedNow()): Date {
  return seedClock.getStore() ?? fallback;
}
