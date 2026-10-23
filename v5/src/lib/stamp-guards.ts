import "server-only";

/** Max clock skew allowed for stamp `at` (future timestamps beyond this are rejected). */
export const STAMP_FUTURE_SKEW_MS = 30_000;

/**
 * True when the stamped commit refers to the same git object as the deployed SHA.
 * Compares case-insensitively; either side may be a short prefix (≤12+ chars).
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

/** Reject timestamps more than {@link STAMP_FUTURE_SKEW_MS} ahead of `now`. */
export function isStampTimestampAllowed(
  at: Date,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(at.getTime())) return false;
  return at.getTime() <= now.getTime() + STAMP_FUTURE_SKEW_MS;
}
