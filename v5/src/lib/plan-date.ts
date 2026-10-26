/**
 * Calendar helpers for daily-plan dates.
 *
 * Plan "today" / "tomorrow" must use the **job's** IANA zone everywhere
 * (seed, reset, createDailyPlan, assistant updateLine/submit). Mixing
 * UTC calendar day with a local zone breaks the hour after UTC midnight
 * (evening in US time zones) — seed and the assistant disagree on which
 * plan is "tomorrow".
 *
 * Demo jobs share America/Los_Angeles until a per-job column exists.
 */

/** Demo / Summit jobs: Pacific. Single source for plan-date zone. */
export const JOB_TIME_ZONE = "America/Los_Angeles";

/** YYYY-MM-DD for `now` in the given IANA zone. */
export function calendarDateInTz(
  now: Date,
  timeZone: string = JOB_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Plan calendar day for a job: YYYY-MM-DD of `now` in the job's time zone.
 * Seed, reset, submit, create, and assistant today/tomorrow all go through here.
 */
export function planDateToday(
  now: Date,
  timeZone: string = JOB_TIME_ZONE,
): string {
  return calendarDateInTz(now, timeZone);
}

/**
 * Job IANA zone. Demo rows have no column yet — always JOB_TIME_ZONE.
 * Pass-through when a future `job.timeZone` string is present.
 */
export function timeZoneForJob(job?: unknown): string {
  if (job && typeof job === "object" && "timeZone" in job) {
    const z = (job as { timeZone?: string | null }).timeZone?.trim();
    if (z) return z;
  }
  return JOB_TIME_ZONE;
}

/** Add whole calendar days to a YYYY-MM-DD string (UTC noon math). */
export function addCalendarDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when planDate is within ±windowDays of todayIso (inclusive). */
export function planDateInWindow(
  planDate: string,
  todayIso: string,
  windowDays = 14,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return false;
  const min = addCalendarDays(todayIso, -windowDays);
  const max = addCalendarDays(todayIso, windowDays);
  return planDate >= min && planDate <= max;
}

/**
 * Job page working surface: open = today and future; history = before today.
 * Uses job-zone today — a UTC revert drops LA-today into history after 00:00Z.
 */
export function splitPlansByPlanToday<T extends { planDate: string }>(
  plans: T[],
  now: Date,
  timeZone: string = JOB_TIME_ZONE,
): { today: string; open: T[]; history: T[] } {
  const today = planDateToday(now, timeZone);
  return {
    today,
    open: plans
      .filter((p) => p.planDate >= today)
      .slice()
      .sort((a, b) => a.planDate.localeCompare(b.planDate)),
    history: plans
      .filter((p) => p.planDate < today)
      .slice()
      .sort((a, b) => b.planDate.localeCompare(a.planDate)),
  };
}
