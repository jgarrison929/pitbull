import "server-only";

/** Max clock skew allowed for stamp `at` (future timestamps beyond this are rejected). */
export const STAMP_FUTURE_SKEW_MS = 30_000;

/**
 * Max age for stamp `at` relative to `now`. Older timestamps are rejected
 * (blocks forged ancient dates while allowing short verify-run / clock skew).
 */
export const STAMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

/** True when `commit` is a full 40-character hex git SHA. */
export function isFullCommitSha(commit: string): boolean {
  return FULL_COMMIT_SHA.test(commit.trim());
}

/**
 * True when the stamped commit refers to the same git object as the deployed SHA.
 * Compares case-insensitively. Stamped side should already be a full SHA;
 * deployed may be a short prefix from the build env.
 */
export function commitsMatchDeployed(
  stamped: string,
  deployed: string,
): boolean {
  const a = stamped.trim().toLowerCase();
  const b = deployed.trim().toLowerCase();
  if (!a || !b || a === "unknown" || b === "unknown") return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Reject timestamps more than {@link STAMP_FUTURE_SKEW_MS} ahead of `now`,
 * or more than {@link STAMP_MAX_AGE_MS} behind `now`.
 */
export function isStampTimestampAllowed(
  at: Date,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(at.getTime())) return false;
  const t = at.getTime();
  const n = now.getTime();
  return t <= n + STAMP_FUTURE_SKEW_MS && t >= n - STAMP_MAX_AGE_MS;
}

/** Human-readable reason when {@link isStampTimestampAllowed} is false; null when ok. */
export function stampTimestampRejectReason(
  at: Date,
  now: Date = new Date(),
): "invalid at" | "timestamp is in the future" | "timestamp is too old" | null {
  if (!Number.isFinite(at.getTime())) return "invalid at";
  const t = at.getTime();
  const n = now.getTime();
  if (t > n + STAMP_FUTURE_SKEW_MS) return "timestamp is in the future";
  if (t < n - STAMP_MAX_AGE_MS) return "timestamp is too old";
  return null;
}
