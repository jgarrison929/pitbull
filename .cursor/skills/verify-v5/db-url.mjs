// Safe Postgres URL handling for the skill's own scripts (stress-seed.mjs). Standalone copy of the
// approach in v5/src/db/database-url.ts (product PR #8), so the skill never imports product code:
// a raw `new URL(postgresUrl)` (which postgres.js does internally) misreads an unencoded `/`, `?` or `#`
// in the password as the end of the host and, on failure, throws an Invalid URL error whose `input`
// carries the whole URL, password included. Always encode the userinfo first, then parse.
// Nothing here prints; callers redact with redactText (evidence.mjs) before any output.

function encodeUserinfoPart(raw) {
  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}

/**
 * Parse a postgres(ql):// URL → { host, port, database, user, password, connectionString } or null when it
 * is not a usable postgres URL. `connectionString` has percent-encoded userinfo, safe for postgres().
 * The userinfo ends at the LAST `@`, the password starts after the FIRST `:` in it (as in the product).
 */
export function parsePostgresUrl(url) {
  const m = typeof url === "string" ? url.match(/^(postgres(?:ql)?):\/\/(.+)$/i) : null;
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  const rest = m[2];
  let httpForm;
  let hadPassword = false;
  if (rest.includes("@")) {
    const at = rest.lastIndexOf("@");
    const userinfo = rest.slice(0, at);
    const hostAndAfter = rest.slice(at + 1);
    if (!hostAndAfter) return null;
    const colon = userinfo.indexOf(":");
    const user = colon >= 0 ? userinfo.slice(0, colon) : userinfo;
    const pass = colon >= 0 ? userinfo.slice(colon + 1) : "";
    hadPassword = colon >= 0;
    httpForm = `http://${encodeUserinfoPart(user)}:${encodeUserinfoPart(pass)}@${hostAndAfter}`;
  } else {
    httpForm = `http://${rest}`;
  }
  let parsed;
  try {
    parsed = new URL(httpForm);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return null;
  const auth = rest.includes("@") ? `${parsed.username}${hadPassword ? `:${parsed.password}` : ""}@` : "";
  const decode = (s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return {
    host,
    port: parsed.port,
    database: decode(parsed.pathname.replace(/^\//, "")),
    user: decode(parsed.username),
    password: hadPassword ? decode(parsed.password) : "",
    connectionString: `${scheme}://${auth}${parsed.host}${parsed.pathname}${parsed.search}`,
  };
}

/**
 * The URL's secret parts that could end up in an error message: the raw URL, the decoded password, the raw
 * userinfo and raw password. For redactText's secret list; their encoded spellings (percent, JSON, HTML,
 * \u, ...) are matched by scrubSecrets (evidence.mjs), not listed here.
 */
export function databaseUrlSecrets(url) {
  if (typeof url !== "string" || !url) return [];
  const out = [url];
  const p = parsePostgresUrl(url);
  if (p?.password) out.push(p.password);
  // The raw userinfo ends at the last @ (a password may itself contain @).
  const last = url.replace(/^[a-z]+:\/\//i, "");
  const at = last.lastIndexOf("@");
  if (at > 0) {
    const userinfo = last.slice(0, at);
    out.push(userinfo);
    const colon = userinfo.indexOf(":");
    if (colon >= 0 && userinfo.length - colon > 1) out.push(userinfo.slice(colon + 1));
  }
  return [...new Set(out.filter((s) => s.length >= 2))];
}
