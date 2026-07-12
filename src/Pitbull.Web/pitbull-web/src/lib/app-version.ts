/**
 * Frontend app version for UI display.
 * Build-time: next.config injects NEXT_PUBLIC_APP_VERSION from package.json when unset.
 */
export function getAppVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/i, "");
  // Fallback if env missing (e.g. misconfigured deploy) — keep in sync with package.json / VERSION
  return "2.15.7";
}

/** Short label for chrome (e.g. "v2.1.0"). */
export function getAppVersionLabel(): string {
  return `v${getAppVersion()}`;
}

/** Normalize version strings for comparison (strip leading v, trim). */
export function normalizeAppVersion(version: string | null | undefined): string {
  if (!version) return "";
  return version.trim().replace(/^v/i, "");
}

export const VERSION_STORAGE_KEYS = {
  /** Last API product version the client successfully acknowledged. */
  remoteSeen: "pitbull-remote-version-seen",
  /** Guard: avoid reload loops for the same remote version in one tab session. */
  reloadAttempt: "pitbull-version-reload-attempt",
} as const;

/**
 * Decide whether a hard reload is needed after learning the server's product version.
 * Pure — no I/O — so unit tests can pin loop-safety and mismatch cases.
 */
export function shouldHardReloadForVersionChange(input: {
  remoteVersion: string | null | undefined;
  clientVersion: string;
  lastSeenRemote: string | null | undefined;
  alreadyAttemptedForRemote: string | null | undefined;
}): { reload: boolean; storeRemote: string | null; reason: string } {
  const remote = normalizeAppVersion(input.remoteVersion);
  const client = normalizeAppVersion(input.clientVersion);
  const lastSeen = normalizeAppVersion(input.lastSeenRemote);
  const attempted = normalizeAppVersion(input.alreadyAttemptedForRemote);

  if (!remote) {
    return { reload: false, storeRemote: null, reason: "no-remote" };
  }

  // First visit: remember remote, do not thrash the user.
  if (!lastSeen) {
    return { reload: false, storeRemote: remote, reason: "first-seen" };
  }

  // Server version unchanged since we last acknowledged it.
  if (remote === lastSeen) {
    return { reload: false, storeRemote: null, reason: "unchanged" };
  }

  // New server version. Only reload if this tab has not already tried for this remote,
  // and the loaded client bundle still doesn't match (stale shell / SW cache).
  if (attempted === remote) {
    return { reload: false, storeRemote: remote, reason: "already-attempted" };
  }

  if (client === remote) {
    // Shell already matches; just record the new remote.
    return { reload: false, storeRemote: remote, reason: "client-matches" };
  }

  return { reload: true, storeRemote: remote, reason: "stale-client" };
}
