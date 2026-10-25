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
 *
 * ## features.fieldLlmEod / NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD (2.20.1)
 *
 * Optional LLM enhancement for end-of-day field summary.
 * **Production default: OFF** when unset/empty — rule-based summary always available.
 * Enable only when AI is configured and you accept token cost:
 * - `NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD=true` (or `1` / `on` / `yes`)
 */

function isExplicitlyOff(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "no";
}

function isExplicitlyOn(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function isDigitalTwinEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FEATURE_DIGITAL_TWIN;
  if (raw === undefined || raw === "") return true;
  if (isExplicitlyOff(raw)) return false;
  return true;
}

/** Optional LLM EOD summary — default OFF (2.20.1). Rule-based path always works. */
export function isFieldLlmEodEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FEATURE_FIELD_LLM_EOD;
  if (raw === undefined || raw === "") return false;
  return isExplicitlyOn(raw);
}
