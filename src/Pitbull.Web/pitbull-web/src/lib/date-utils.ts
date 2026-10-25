/**
 * Get the start of the week for a given date.
 *
 * @param date   The reference date
 * @param startDay  0 = Sunday, 1 = Monday (default), …, 6 = Saturday
 * @returns A new Date set to midnight on the first day of that week
 */
export function getWeekStart(date: Date, startDay: number = 1): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0–6 (Sun–Sat)
  const diff = (day - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (6 days after the start).
 */
export function getWeekEnd(date: Date, startDay: number = 1): Date {
  const start = getWeekStart(date, startDay);
  start.setDate(start.getDate() + 6);
  return start;
}

/**
 * Format a date as YYYY-MM-DD for API calls and keys.
 */
export function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}
