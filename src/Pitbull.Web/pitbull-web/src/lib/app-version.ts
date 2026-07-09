/**
 * Frontend app version for UI display.
 * Build-time: next.config injects NEXT_PUBLIC_APP_VERSION from package.json when unset.
 */
export function getAppVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/i, "");
  // Fallback if env missing (e.g. misconfigured deploy) — keep in sync with package.json
  return "2.0.0";
}

/** Short label for chrome (e.g. "v2.0.0"). */
export function getAppVersionLabel(): string {
  return `v${getAppVersion()}`;
}
