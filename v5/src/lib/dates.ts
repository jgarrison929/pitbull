/**
 * Calendar day for a date-only ISO (`YYYY-MM-DD`) or an instant, always in UTC.
 * Matches plan-card / assistant `day()` so Pacific browsers do not show the
 * previous local evening for a UTC midnight post.
 */
export function utcDay(isoOrDate: string | Date): string {
  const iso =
    typeof isoOrDate === "string"
      ? isoOrDate.length <= 10
        ? `${isoOrDate}T00:00:00Z`
        : isoOrDate
      : isoOrDate.toISOString();
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
