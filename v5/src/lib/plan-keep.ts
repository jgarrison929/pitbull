/**
 * When two plans share job + crew + date, which one to keep.
 * Prefer issued (and later) over draft, then the newest — never lowest UUID alone.
 * Newest = submitted_at, then created_at, then id as last resort.
 * Mirrors the ORDER BY in drizzle/0013_crews_and_plan_crew_id.sql.
 */

export type PlanKeepCandidate = {
  id: string;
  status: string;
  planDate: string;
  submittedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export function planStatusKeepRank(status: string): number {
  switch (status) {
    case "approved":
      return 4;
    case "reported":
      return 3;
    case "issued":
      return 2;
    case "draft":
      return 1;
    default:
      return 0;
  }
}

function timeMs(value: string | Date | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** True when `a` should be kept over `b` (strictly better). */
export function planKeepBeats(a: PlanKeepCandidate, b: PlanKeepCandidate): boolean {
  const rd = planStatusKeepRank(a.status) - planStatusKeepRank(b.status);
  if (rd !== 0) return rd > 0;
  if (a.planDate !== b.planDate) return a.planDate > b.planDate;
  const sa = timeMs(a.submittedAt);
  const sb = timeMs(b.submittedAt);
  if (sa !== sb) return sa > sb;
  const ca = timeMs(a.createdAt);
  const cb = timeMs(b.createdAt);
  if (ca !== cb) return ca > cb;
  return a.id > b.id;
}

/** Keep the winner among candidates (issued over draft, then newest). */
export function preferPlanKeep<T extends PlanKeepCandidate>(plans: T[]): T | null {
  if (!plans.length) return null;
  return plans.reduce((best, p) => (planKeepBeats(p, best) ? p : best));
}
