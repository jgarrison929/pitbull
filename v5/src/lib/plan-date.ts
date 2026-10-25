/** Calendar helpers for daily-plan dates (America/Los_Angeles). */

const LA = "America/Los_Angeles";

/** YYYY-MM-DD for `now` in the given IANA zone (default America/Los_Angeles). */
export function calendarDateInTz(now: Date, timeZone = LA): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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
