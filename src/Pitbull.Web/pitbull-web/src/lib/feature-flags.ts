/**
 * Product feature flags — env-driven with safe defaults for demo/dev/prod.
 *
 * ## features.digitalTwin / NEXT_PUBLIC_FEATURE_DIGITAL_TWIN (2.17.1)
 *
 * **Production default: ON** when the env var is unset or empty.
 * This matches demo and local defaults so zones-first twin ships visible.
 *
 * Opt out (hide nav + twin surfaces):
 * - `NEXT_PUBLIC_FEATURE_DIGITAL_TWIN=false` (or `0` / `off` / `no`)
 *
 * Railway / docker: set on `pitbull-web` service only when you need twin off.
 * Leaving the variable unset is the supported prod default (enabled).
 */

export function isDigitalTwinEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FEATURE_DIGITAL_TWIN;
  if (raw === undefined || raw === "") return true;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}
