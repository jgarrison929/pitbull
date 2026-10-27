// Remote-target gate for verify.mjs. A run reaches staging or production only when the caller names that target
// explicitly: `--target staging|production`, or PV_VERIFY_TARGET=staging|production in the environment. A localhost
// URL needs neither. Anything else is refused before any network call (exit 2). `--self-check` makes no network call
// and is exempt. This file has no side effects on import.

export const TARGET_ENV = "PV_VERIFY_TARGET";
export const EXPLICIT_TARGETS = ["staging", "production"];
export const REMOTE_REFUSED_EXIT = 2;

/** localhost, *.localhost, 127.0.0.0/8 and ::1 only. */
export function isLocalHost(hostname) {
  const h = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127(\.\d{1,3}){3}$/.test(h);
}

export function isLocalUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && isLocalHost(u.hostname);
  } catch {
    return false;
  }
}

/**
 * @returns {{ ok: true, flag: string } | { ok: false, error: string }}
 * flag is what verify.mjs hands to resolveTarget: the explicit target for a remote URL, the CLI flag otherwise.
 */
export function remoteTargetGate({ url, flag = "auto", env = {}, selfCheck = false }) {
  const fromEnv = env[TARGET_ENV];
  if (fromEnv !== undefined && fromEnv !== "" && !EXPLICIT_TARGETS.includes(fromEnv)) {
    return { ok: false, error: `${TARGET_ENV} must be staging or production (got ${fromEnv})` };
  }
  const explicitFlag = EXPLICIT_TARGETS.includes(flag) ? flag : null;
  if (explicitFlag && fromEnv && fromEnv !== explicitFlag) {
    return { ok: false, error: `--target ${explicitFlag} and ${TARGET_ENV}=${fromEnv} disagree` };
  }
  const explicit = explicitFlag ?? (fromEnv || null);
  if (selfCheck || isLocalUrl(url)) return { ok: true, flag: explicit ?? flag };
  if (!explicit) {
    return {
      ok: false,
      error:
        `refused: ${url} is not localhost. A remote run needs an explicit target: --target staging|production ` +
        `(or ${TARGET_ENV}=staging|production). Nothing was contacted.`,
    };
  }
  return { ok: true, flag: explicit };
}

// ---- Local database gate ----
// A DATABASE_URL is local when its host is loopback (isLocalHost), or when the host is named in the explicit allowlist
// env VERIFY_LOCAL_DB_HOSTS (comma-separated, exact names; set by ci.yml on jobs whose Postgres is a service container
// reached by hostname) AND every address it resolves to at check time is loopback, RFC 1918 private (10/8, 172.16/12,
// which holds the docker bridge networks, 192.168/16), or IPv6 loopback / unique-local (fc00::/7). A public address is
// refused even when the name is allowlisted. No allowlist, no CI bypass, no single-label wildcard.
// Parsing uses db-url.mjs parsePostgresUrl, the same parser the tools connect with, so a password with / ? # @ % parses.
import { parsePostgresUrl } from "./db-url.mjs";

export const LOCAL_DB_HOSTS_ENV = "VERIFY_LOCAL_DB_HOSTS";

/** Loopback, RFC 1918, or IPv6 loopback / unique-local. Literal addresses only. */
export function isPrivateAddress(ip) {
  const a = String(ip ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = a.replace(/^::ffff:/, "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [o1, o2] = [Number(v4[1]), Number(v4[2])];
    return o1 === 127 || o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168);
  }
  return a === "::1" || /^f[cd][0-9a-f]{0,2}:/.test(a);
}

export function localDbAllowlist(env = {}) {
  return String(env[LOCAL_DB_HOSTS_ENV] ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

/** The host of a postgres:// URL, or null when it is not one (never the userinfo). */
export function dbUrlHost(dbUrl) {
  const p = parsePostgresUrl(dbUrl);
  return p ? p.host : null;
}

/** Sync, loopback only: a postgres:// URL whose host is localhost / 127.0.0.0/8 / ::1. Unparseable → false. */
export function isLocalDbUrl(dbUrl) {
  const h = dbUrlHost(dbUrl);
  return h != null && isLocalHost(h);
}

/**
 * The full gate. lookup(host) resolves to [{ address }] (node:dns/promises lookup with all: true by default; injectable
 * for tests). @returns {Promise<{ ok: true } | { ok: false, reason: string }>} reason never contains the URL or userinfo.
 */
export async function localDbGate(dbUrl, { env = {}, lookup = null } = {}) {
  const h = dbUrlHost(dbUrl);
  if (h == null) return { ok: false, reason: "DATABASE_URL is not a parseable postgres:// URL" };
  if (isLocalHost(h)) return { ok: true };
  if (!localDbAllowlist(env).includes(h)) return { ok: false, reason: `DATABASE_URL host is not loopback and not in ${LOCAL_DB_HOSTS_ENV}` };
  let addrs;
  try {
    const look = lookup ?? (async (name) => (await import("node:dns/promises")).lookup(name, { all: true }));
    addrs = (await look(h)).map((x) => x.address);
  } catch {
    return { ok: false, reason: `DATABASE_URL host is in ${LOCAL_DB_HOSTS_ENV} but does not resolve` };
  }
  if (!addrs.length) return { ok: false, reason: `DATABASE_URL host is in ${LOCAL_DB_HOSTS_ENV} but does not resolve` };
  if (!addrs.every(isPrivateAddress)) return { ok: false, reason: `DATABASE_URL host is in ${LOCAL_DB_HOSTS_ENV} but resolves to a non-private address` };
  return { ok: true };
}
