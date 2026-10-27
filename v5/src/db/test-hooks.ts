/**
 * Test-only DB instrumentation. Import from here in vitest files — never from
 * production routes/services.
 *
 * Provides query counting, V5_DB_LATENCY_MS busy-wait injection, and pool reset.
 * Production `db/index.ts` stays free of those hooks.
 */
import {
  disposeDbClient,
  getDb,
  registerDbClientWrap,
  type SqlClient,
} from "@/db";

let queryCount = 0;
let installed = false;

function latencyMs() {
  const raw = process.env.V5_DB_LATENCY_MS;
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Busy-wait so the postgres.js ThenableQuery API stays intact under fake RTT. */
function sleepSync(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* spin */
  }
}

function wrapForTests(client: SqlClient): SqlClient {
  const delay = latencyMs();
  const originalUnsafe = client.unsafe.bind(client);
  client.unsafe = ((query: string, params?: unknown, opts?: unknown) => {
    queryCount += 1;
    if (process.env.V5_DB_LOG_QUERIES === "1") {
      const oneLine = String(query).replace(/\s+/g, " ").trim().slice(0, 120);
      console.log(`SQL[${queryCount}] ${oneLine}`);
    }
    if (delay > 0) sleepSync(delay);
    return originalUnsafe(query, params as never, opts as never);
  }) as typeof client.unsafe;
  return client;
}

/** Install the wrap (idempotent while already installed). */
export function installDbTestHooks() {
  if (installed) return;
  registerDbClientWrap(wrapForTests);
  installed = true;
}

/**
 * Clear the wrap so the next getDb() client is uninstrumented.
 * Used by must-fail tests that prove wrap-off cannot pass budgets vacuously.
 */
export function uninstallDbTestHooks() {
  registerDbClientWrap(null);
  installed = false;
  queryCount = 0;
}

installDbTestHooks();

/**
 * Count of SQL statements issued through the shared client (tests / perf).
 * Throws when the wrap is not installed so budgets cannot pass with a silent 0.
 */
export function getDbQueryCount() {
  if (!installed) {
    throw new Error(
      "DB test hooks wrap is not installed — import @/db/test-hooks (or call installDbTestHooks()) before measuring queries; otherwise budgets pass vacuously at 0.",
    );
  }
  return queryCount;
}

/** Reset the query counter without tearing down the pool. */
export function resetDbQueryCount() {
  queryCount = 0;
}

/**
 * Drop the shared client so the next getDb() rebuilds it (latency options read
 * from env at construct time).
 */
export async function resetDbClient() {
  queryCount = 0;
  await disposeDbClient();
}

export { getDb };
