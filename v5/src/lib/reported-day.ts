/** Day named by a dailyReport.post summary: `Reported … for Tue, Oct 20:`. */
export function reportedDayInSummary(summary: string): string | null {
  const match = /^Reported .+ for ([^:]+):/.exec(summary);
  return match?.[1] ?? null;
}
