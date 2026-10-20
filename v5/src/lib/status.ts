// The one status rule. Every screen and the assistant color CPI and SPI through these functions.
//   index ≥ 1.00 → on track (green), 0.95 to under 1.00 → watch (amber), under 0.95 → at risk (red).
//   A negative dollar variance is never green: an on-track index with money lost becomes watch.
// Indices are graded at the two decimals they are shown with, so 0.995 shows 1.00 and grades as 1.00.

export type Status = "on-track" | "watch" | "at-risk";

const rank: Record<Status, number> = { "on-track": 0, watch: 1, "at-risk": 2 };
const shown = (i: number) => Math.round(i * 100) / 100;

export function indexStatus(index: number): Status {
  const v = shown(index);
  if (v >= 1) return "on-track";
  if (v >= 0.95) return "watch";
  return "at-risk";
}

/** CPI with cost variance, or SPI with schedule variance. null index means nothing spent or planned yet. */
export function varianceStatus(
  index: number | null,
  varianceCents: number,
): Status | null {
  if (index === null) return varianceCents < 0 ? "at-risk" : null;
  const s = indexStatus(index);
  return s === "on-track" && varianceCents < 0 ? "watch" : s;
}

export const worst = (...all: (Status | null)[]): Status =>
  all.reduce<Status>((w, s) => (s && rank[s] > rank[w] ? s : w), "on-track");

/** A job or the portfolio: the worse of its cost and schedule status. */
export function overallStatus(r: {
  cpi: number;
  spi: number;
  costVarianceCents: number;
  scheduleVarianceCents: number;
}): Status {
  return worst(
    varianceStatus(r.cpi, r.costVarianceCents),
    varianceStatus(r.spi, r.scheduleVarianceCents),
  );
}
