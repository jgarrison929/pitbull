/**
 * Twin overlay poll interval (2.15.6).
 * Default 30s; override with NEXT_PUBLIC_TWIN_OVERLAY_POLL_MS (milliseconds).
 * Set to 0 or "off" to disable polling.
 */

/** Default overlay refresh interval when env is unset. */
export const DEFAULT_TWIN_OVERLAY_POLL_MS = 30_000;

/**
 * Resolve poll interval in ms.
 * - undefined/empty → default 30_000
 * - 0 / off / false / no → 0 (disabled)
 * - positive integer → that many ms (min 5_000 when > 0 to avoid thrash)
 */
export function resolveTwinOverlayPollMs(
  raw: string | undefined = process.env.NEXT_PUBLIC_TWIN_OVERLAY_POLL_MS
): number {
  if (raw === undefined || raw === "") return DEFAULT_TWIN_OVERLAY_POLL_MS;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "off" || v === "false" || v === "no") return 0;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TWIN_OVERLAY_POLL_MS;
  if (n === 0) return 0;
  return Math.max(5_000, n);
}
