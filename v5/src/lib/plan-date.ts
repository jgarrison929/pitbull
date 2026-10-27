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

/**
 * Job page entry point: zone is fixed inside (timeZoneForJob), not a page arg.
 * Page must call this — not splitPlansByPlanToday with a zone — so a UTC swap
 * at the call site is impossible without leaving this helper.
 */
export function jobPagePlans<T extends { planDate: string }>(
  plans: T[],
  now: Date,
): { today: string; open: T[]; history: T[] } {
  return splitPlansByPlanToday(plans, now, timeZoneForJob());
}

/** Numeric wall-clock parts of `instant` in `timeZone`. */
function localParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: n("year"),
    month: n("month"),
    day: n("day"),
    hour: n("hour"),
    minute: n("minute"),
    second: n("second"),
  };
}

/**
 * UTC instant for wall-clock `hour:minute:second` on calendar `day`
 * (YYYY-MM-DD) in `timeZone` (default job zone = America/Los_Angeles).
 *
 * Seed audit / plan-event stamps use this so LocalTime in PT shows a real
 * workday, not a pile of identical `seedNow` milliseconds.
 */
export function instantAtLocal(
  day: string,
  hour: number,
  minute = 0,
  second = 0,
  timeZone: string = JOB_TIME_ZONE,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`instantAtLocal: bad day ${day}`);
  }
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  // Guess as if the wall clock were UTC, then correct by the zone offset.
  let utcMs = Date.UTC(y, m - 1, d, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    );
    const desired = Date.UTC(y, m - 1, d, hour, minute, second);
    utcMs += desired - asUtc;
  }
  return new Date(utcMs);
}

/**
 * `count` instants through a Pacific workday on the job-zone calendar of
 * `now`, oldest first, every stamp ≤ `now`. Gaps are ≥ 1 minute so LocalTime
 * labels never collapse to the same clock reading (the old `now + i` ms bug).
 *
 * When the wall-clock window cannot fit (early morning / clock before 07:05),
 * falls back to packing stamps ending at `now` fifteen minutes apart — still
 * distinct when formatted in America/Los_Angeles or UTC.
 */
export function seedAuditSpread(now: Date, count: number): Date[] {
  if (count <= 0) return [];
  const tz = JOB_TIME_ZONE;
  const day = planDateToday(now, tz);
  const local = localParts(now, tz);
  const endMin = Math.min(local.hour * 60 + local.minute, 18 * 60 + 55);
  const startMin = Math.max(7 * 60 + 5, endMin - Math.max(6 * 60, count - 1));
  const span = Math.max(endMin - startMin, count - 1);
  const candidates: Date[] = [];
  for (let i = 0; i < count; i++) {
    const minuteOfDay =
      count === 1
        ? endMin
        : startMin + Math.round((span * i) / (count - 1));
    candidates.push(
      instantAtLocal(
        day,
        Math.floor(minuteOfDay / 60),
        minuteOfDay % 60,
        0,
        tz,
      ),
    );
  }
  const ok =
    candidates.every((t) => t.getTime() <= now.getTime()) &&
    candidates.every(
      (t, i) => i === 0 || t.getTime() > candidates[i - 1]!.getTime(),
    );
  if (ok) return candidates;
  const step = 15 * 60_000;
  return Array.from(
    { length: count },
    (_, i) => new Date(now.getTime() - (count - 1 - i) * step),
  );
}
