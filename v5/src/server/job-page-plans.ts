import "server-only";

import { jobPagePlans } from "@/lib/plan-date";
import { seedNow } from "@/server/seed-clock";

/**
 * Job page plan surface: open / history / New-plan default date.
 *
 * Clock is `seedNow()` inside — the page must not pass a Date (M8d) or
 * invent a UTC YYYY-MM-DD for New plan (M8t). Callers only read `today`.
 */
export function jobPagePlanSurface<T extends { planDate: string }>(
  plans: T[],
): { today: string; open: T[]; history: T[] } {
  return jobPagePlans(plans, seedNow());
}
