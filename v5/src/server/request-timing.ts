import "server-only";
import {
  getDbTimingStore,
  runWithDbTiming,
  type DbTimingStore,
} from "@/db/query-timing";

export type RequestTimingStore = DbTimingStore & {
  route?: string;
  startedAt: number;
};

export function createTimingStore(route?: string): RequestTimingStore {
  return { dbMs: 0, queries: 0, route, startedAt: performance.now() };
}

export function runWithTiming<T>(
  store: RequestTimingStore,
  fn: () => T,
): T {
  return runWithDbTiming(store, fn);
}

export function getTimingStore(): RequestTimingStore | undefined {
  const s = getDbTimingStore();
  return s as RequestTimingStore | undefined;
}

export function formatServerTiming(parts: Record<string, number>): string {
  return Object.entries(parts)
    .map(([name, dur]) => `${name};dur=${Math.round(dur * 100) / 100}`)
    .join(", ");
}

/** Structured log for verify / burst diagnosis — no secrets. */
export function logRouteTiming(
  store: RequestTimingStore,
  extra: Record<string, number | string | undefined> = {},
) {
  const totalMs = performance.now() - store.startedAt;
  const payload = {
    route: store.route ?? "unknown",
    dbMs: Math.round(store.dbMs),
    queries: store.queries,
    totalMs: Math.round(totalMs),
    ...extra,
  };
  console.info(`[v5-timing] ${JSON.stringify(payload)}`);
  return payload;
}
