/**
 * CPM practices honesty helpers (band 3.8 / 3.7.1–3.7.5).
 * Never invent float or paint on-track green by default.
 */

export type CpmActivityGlance = {
  isCritical?: boolean | null;
  totalFloat?: number | null;
  freeFloat?: number | null;
  dataDate?: string | null;
  baselineFinish?: string | null;
  currentFinish?: string | null;
};

export const CPM_GLOSSARY = {
  dataDate: "Data date — the as-of date for schedule status (server value only).",
  totalFloat: "Total float — days an activity can slip without delaying project finish (null = insufficient data).",
  freeFloat: "Free float — days an activity can slip without delaying successors (null = insufficient data).",
  critical: "Critical — on the longest path when the server flag is true; never assumed green.",
} as const;

export function formatDataDate(dataDate: string | null | undefined): string {
  if (!dataDate) return "Data date not set";
  const d = new Date(dataDate);
  if (Number.isNaN(d.getTime())) return "Data date invalid";
  return `Data date ${d.toLocaleDateString()}`;
}

export function formatBaselineVarianceDays(
  baselineFinish: string | null | undefined,
  currentFinish: string | null | undefined
): string {
  if (!baselineFinish || !currentFinish) return "Baseline variance insufficient";
  const b = new Date(baselineFinish);
  const c = new Date(currentFinish);
  if (Number.isNaN(b.getTime()) || Number.isNaN(c.getTime())) return "Baseline variance insufficient";
  const days = Math.round((c.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "On baseline finish";
  if (days > 0) return `${days}d behind baseline`;
  return `${Math.abs(days)}d ahead of baseline`;
}

export function cpmOnTrackClaimAllowed(glance: CpmActivityGlance): boolean {
  // Never claim on-track health without real data
  if (glance.totalFloat === null || glance.totalFloat === undefined) return false;
  if (glance.isCritical === null || glance.isCritical === undefined) return false;
  return false; // product ban: no invented on-track KPI tile
}
