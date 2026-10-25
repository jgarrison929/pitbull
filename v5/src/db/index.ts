import dns from "node:dns";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;
let queryCount = 0;
let dnsPreferV4Applied = false;

/** Count of SQL statements issued through the shared client (tests / perf). */
export function getDbQueryCount() {
  return queryCount;
}

/** Reset the query counter without tearing down the pool. */
export function resetDbQueryCount() {
  queryCount = 0;
}

/**
 * Drop the shared client so the next getDb() rebuilds it (latency options read
 * from env at construct time). Tests only — production keeps the warm singleton.
 */
export async function resetDbClient() {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
  }
  sqlClient = null;
  db = null;
  queryCount = 0;
}

function latencyMs() {
  const raw = process.env.V5_DB_LATENCY_MS;
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Busy-wait so the postgres.js ThenableQuery API stays intact. */
function sleepSync(ms: number) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* spin */
  }
}

/**
 * Classify DATABASE_URL without exposing credentials — private Railway
 * networking vs public TCP proxy. Staging must use `${{Postgres.DATABASE_URL}}`
 * (*.railway.internal), not DATABASE_PUBLIC_URL / proxy.rlwy.net.
 */
export function classifyDatabaseUrl(url = process.env.DATABASE_URL): {
  configured: boolean;
  host: string | null;
  /** Private Railway DNS (same-environment Postgres). */
  privateRailway: boolean;
  /** Public TCP proxy — adds RTT/egress on every query. */
  publicProxy: boolean;
  /** Prefer IPv4 for *.railway.internal (Node dual-stack can stall on AAAA). */
  dnsPreferIpv4: boolean;
} {
  if (!url) {
    return {
      configured: false,
      host: null,
      privateRailway: false,
      publicProxy: false,
      dnsPreferIpv4: false,
    };
  }
  let host: string | null = null;
  try {
    // Hostname only — never substring-match the full connection string
    // (CodeQL: Incomplete URL substring sanitization).
    host = new URL(url).hostname.toLowerCase();
  } catch {
    host = null;
  }
  const privateRailway = Boolean(
    host === "railway.internal" || host?.endsWith(".railway.internal"),
  );
  // Suffix / equality on the parsed hostname — not String.includes on the URL.
  const publicProxy = Boolean(
    host &&
      (host === "proxy.rlwy.net" ||
        host.endsWith(".proxy.rlwy.net") ||
        host === "rlwy.net" ||
        host.endsWith(".rlwy.net") ||
        host === "up.railway.app" ||
        host.endsWith(".up.railway.app")),
  );
  return {
    configured: true,
    host,
    privateRailway,
    publicProxy,
    dnsPreferIpv4: privateRailway,
  };
}

function ensureRailwayDns() {
  if (dnsPreferV4Applied) return;
  const kind = classifyDatabaseUrl();
  if (!kind.dnsPreferIpv4) return;
  // Railway private DNS often returns AAAA first; Node can stall before IPv4.
  dns.setDefaultResultOrder("ipv4first");
  dnsPreferV4Applied = true;
}

function wrapClient(client: ReturnType<typeof postgres>) {
  const delay = latencyMs();
  const originalUnsafe = client.unsafe.bind(client);
  // All drizzle-orm/postgres-js queries go through unsafe().
  client.unsafe = ((query: string, params?: unknown, opts?: unknown) => {
    queryCount += 1;
    if (process.env.V5_DB_LOG_QUERIES === "1") {
      const oneLine = String(query).replace(/\s+/g, " ").trim().slice(0, 120);
      console.log(`SQL[${queryCount}] ${oneLine}`);
    }
    // Sync RTT: serializes parallel callers (pessimistic vs real network overlap)
    // but preserves ThenableQuery (.values / transactions).
    if (delay > 0) sleepSync(delay);
    return originalUnsafe(query, params as never, opts as never);
  }) as typeof client.unsafe;
  return client;
}

/** Returns the shared Drizzle client, or null when DATABASE_URL is not set. */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!db) {
    ensureRailwayDns();
    // Keep connections warm across requests — idle teardown re-pays TCP+auth RTT.
    // max 10: job page fires independent reads in parallel.
    sqlClient = wrapClient(
      postgres(url, {
        max: 10,
        idle_timeout: 0,
        max_lifetime: 60 * 30,
        connect_timeout: 10,
      }),
    );
    db = drizzle(sqlClient, { schema });
  }
  return db;
}

/** The shared client; throws when DATABASE_URL is missing, for code paths that cannot work without data. */
export function requireDb(): Db {
  const client = getDb();
  if (!client) throw new Error("DATABASE_URL is not set");
  return client;
}

/** A ping for checkHealth, or null when no database is configured. */
export function dbPing(): (() => Promise<void>) | null {
  const client = getDb();
  if (!client) return null;
  return async () => {
    await client.execute(sql`select 1`);
  };
}
