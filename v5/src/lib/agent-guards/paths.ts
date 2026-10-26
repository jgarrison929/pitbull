/**
 * Path ownership for recurring agent mistakes.
 * Scanners and CI use these lists — prefer deleting the wrong path over documenting it.
 */

/** Files that must never exist (wrong owners / confused App Router names). */
export const FORBIDDEN_RELATIVE_PATHS = [
  // Duplicate working-day math — sole owner is src/lib/working-calendar.ts (#719 / Verify FAIL).
  "src/lib/schedule/working-days.ts",
  "src/lib/working-days.ts",
  "src/lib/schedule/workingDays.ts",
] as const;

/**
 * Parked until 5.0.3 queue (#721, #724–#728) lands — then a pure rename PR:
 * components/app/page.tsx → page-shell.tsx. Do not recreate under another name.
 */
export const PARKED_PAGE_SHELL_RENAME = {
  from: "src/components/app/page.tsx",
  to: "src/components/app/page-shell.tsx",
  holdUntil: "5.0.3 queue (#721, #724–#728) on main",
} as const;

/** Canonical module for working-day arithmetic (indexed, not per-day Date walks). */
export const WORKING_CALENDAR_PATH = "src/lib/working-calendar.ts";

/** Canonical CPM engine (pure library). */
export const CPM_PATH = "src/lib/cpm.ts";

/**
 * Builder feature PRs must not touch these. Owned by verify / edge routing
 * slices; a ban/lint is the corrective (see owned-paths + check-owned-paths.mjs).
 */
export const BUILDER_FORBIDDEN_TOUCH = [
  ".cursor/skills/verify-v5",
  "v5/src/proxy.ts",
] as const;
