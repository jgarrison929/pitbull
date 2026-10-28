/** Day named by a dailyReport.post summary: `Reported … for Tue, Oct 20:`. */
export function reportedDayInSummary(summary: string): string | null {
  const match = /^Reported .+ for ([^:]+):/.exec(summary);
  return match?.[1] ?? null;
}

export type SamePlanReport = {
  action: string;
  summary: string;
  /** Plan this report was posted against. Absent on older rows. */
  planId?: string | null;
};

/**
 * Newest-first. A second post of the same plan on the same day replaces the
 * earlier row. A different plan that day stays. Rows with no plan id stay.
 */
export function collapseSamePlanReports<T extends SamePlanReport>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (row.action !== "dailyReport.post" || !row.planId) return true;
    const day = reportedDayInSummary(row.summary);
    if (!day) return true;
    const key = `${row.planId}|${day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
