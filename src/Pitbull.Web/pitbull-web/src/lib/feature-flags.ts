/**
 * Product feature flags — env-driven with safe defaults for demo/dev.
 * Twin is on by default; set NEXT_PUBLIC_FEATURE_DIGITAL_TWIN=false to hide.
 */

export function isDigitalTwinEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_FEATURE_DIGITAL_TWIN;
  if (raw === undefined || raw === "") return true;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}
