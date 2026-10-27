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

/** A postgres:// URL whose host is local. Unparseable (including an empty host) → false. */
export function isLocalDbUrl(dbUrl) {
  try {
    const u = new URL(dbUrl);
    if (!/^postgres(ql)?:$/.test(u.protocol)) return false;
    return isLocalHost(u.hostname);
  } catch {
    return false;
  }
}
