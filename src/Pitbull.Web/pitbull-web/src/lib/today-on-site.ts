import { describe, it, expect } from "vitest";

/** Client mirror of TodayOnSiteDto field names for UI (3.3.2) */
export type TodayOnSiteView = {
  projectId: string;
  dayUtc: string;
  dailyReportCount: number;
  photoCount: number;
  openRfiCount: number;
  label: string;
};

export function todayOnSiteEmptyCopy(hasAny: boolean): string {
  if (hasAny) return "";
  return "No field activity filed today for this job yet (empty is honest).";
}

export function formatTodayOnSiteSummary(v: TodayOnSiteView): string {
  return `${v.label}: ${v.dailyReportCount} report(s), ${v.photoCount} photo(s), ${v.openRfiCount} open RFI(s)`;
}
