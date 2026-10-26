/**
 * Lightweight ALS for per-request DB timing. Lives under db/ so the pool
 * wrapper can record without importing server route modules (cycle risk).
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type DbTimingStore = {
  dbMs: number;
  queries: number;
};

const als = new AsyncLocalStorage<DbTimingStore>();

export function runWithDbTiming<T>(store: DbTimingStore, fn: () => T): T {
  return als.run(store, fn);
}

export function getDbTimingStore(): DbTimingStore | undefined {
  return als.getStore();
}

export function recordDbQuery(durationMs: number) {
  const s = als.getStore();
  if (!s) return;
  s.queries += 1;
  s.dbMs += durationMs;
}
