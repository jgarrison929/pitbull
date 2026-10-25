/**
 * Single Postgres URL parser for host classification and client connect.
 *
 * Never trust a raw `new URL(postgresUrl)` — unencoded `/` `?` `#` in userinfo
 * makes WHATWG treat the username as hostname. Always encode userinfo when `@`
 * is present, then parse with the URL API (http: stand-in). Hostname only is
 * ever returned to callers; connection strings passed to postgres.js are the
 * encoded form so Invalid URL cannot leak the password into logs.
 */

export type ParsedPostgresUrl = {
  /** Lower-cased hostname — never userinfo. */
  host: string;
  /** postgres(ql): URL safe for `postgres()` / WHATWG. */
  connectionString: string;
};

function encodeUserinfoPart(raw: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}

/**
 * Parse a Postgres connection URL.
 * Returns null when the string is not a usable postgres URL (invalid).
 */
export function parsePostgresUrl(url: string): ParsedPostgresUrl | null {
  const m = url.match(/^(postgres(?:ql)?):\/\/(.+)$/i);
  if (!m) return null;
  const scheme = m[1]!.toLowerCase();
  const rest = m[2]!;

  let httpForm: string;
  let hadPassword = false;
  if (rest.includes("@")) {
    // Prefer encode path whenever @ is present — never trust raw WHATWG on
    // postgres: (user:5432/x@host → hostname "user").
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

  let parsed: URL;
  try {
    parsed = new URL(httpForm);
  } catch {
    return null;
  }
  // Some Node versions keep brackets on IPv6 hostname; normalize to bare form.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return null;

  // Rebuild a postgres URL with encoded userinfo for postgres.js.
  const auth = rest.includes("@")
    ? `${parsed.username}${hadPassword ? `:${parsed.password}` : ""}@`
    : "";
  // parsed.username/password are already percent-encoded by URL.
  const connectionString = `${scheme}://${auth}${parsed.host}${parsed.pathname}${parsed.search}`;
  return { host, connectionString };
}

/** Hostname only, or null when invalid — never userinfo. */
export function databaseUrlHost(url: string): string | null {
  return parsePostgresUrl(url)?.host ?? null;
}

/**
 * Connection string for postgres.js. Null when unparseable — callers must not
 * pass the raw env URL (Invalid URL errors embed the password in `input`).
 */
export function databaseConnectionString(url: string): string | null {
  return parsePostgresUrl(url)?.connectionString ?? null;
}

/**
 * True when `value` leaks raw userinfo from the URL (for must-fails).
 * Ignores single-character tokens so hostnames like `example` are not
 * false-positives for password `p`.
 */
export function containsUserinfoLeak(url: string, value: string): boolean {
  const m = url.match(/^(postgres(?:ql)?:\/\/)(.+)$/i);
  if (!m) return false;
  const rest = m[2]!;
  const at = rest.lastIndexOf("@");
  if (at < 0) return false;
  const userinfo = rest.slice(0, at);
  const colon = userinfo.indexOf(":");
  const user = colon >= 0 ? userinfo.slice(0, colon) : userinfo;
  const pass = colon >= 0 ? userinfo.slice(colon + 1) : "";
  const hay = value.toLowerCase();
  if (userinfo.length >= 3 && hay.includes(userinfo.toLowerCase())) return true;
  if (pass.length >= 2 && hay.includes(pass.toLowerCase())) return true;
  if (user.length >= 3 && hay.includes(user.toLowerCase())) return true;
  return false;
}
