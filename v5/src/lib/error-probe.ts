/** Distinctive throw text — must never appear in the recovery UI. */
export const ERROR_PROBE_MESSAGE =
  "Forced route throw for error-boundary probe";

/** After Try again, e2e sets this cookie so the probe can recover. */
export const ERROR_PROBE_OK_COOKIE = "pcs_error_probe_ok";

/**
 * Explicit opt-in. Off by default (Railway / production). Set only in
 * Playwright webServer / local e2e — never on staging or production.
 */
export function isErrorProbeAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.V5_ERROR_PROBE === "1";
}
