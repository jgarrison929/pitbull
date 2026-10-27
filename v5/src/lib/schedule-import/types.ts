/**
 * Shared schedule-import draft + result shapes (5.1.3).
 * Parsers (5.1.3-a XER / 5.1.3-b MSP XML) produce a draft; apply writes it
 * in one transaction (`v5/src/server/schedule-import.ts`).
 *
 * Naming matches the 5.1.3-c UI contract so that PR can drop soft stubs on rebase.
 */

/** Domain cap from 5.1.3. Server-action body limit must stay above this + multipart overhead. */
export const MAX_SCHEDULE_IMPORT_BYTES = 10_000_000;

/** @deprecated Prefer {@link MAX_SCHEDULE_IMPORT_BYTES}. */
export const SCHEDULE_IMPORT_MAX_BYTES = MAX_SCHEDULE_IMPORT_BYTES;

export type ScheduleImportMode = "replace" | "merge";

export type ScheduleImportLinkType = "finish_to_start" | "start_to_start";

export type ScheduleImportActivity = {
  code: string;
  name: string;
  durationDays: number;
  /** YYYY-MM-DD when the file supplies a start. */
  startOn?: string;
};

export type ScheduleImportLink = {
  predecessorCode: string;
  successorCode: string;
  type: ScheduleImportLinkType;
  lagDays: number;
};

export type ScheduleImportHoliday = {
  on: string;
  name: string;
};

export type ScheduleImportSkipped = {
  kind: string;
  count: number;
  sample?: string;
};

export type ScheduleImportDraft = {
  activities: ScheduleImportActivity[];
  links: ScheduleImportLink[];
  holidays: ScheduleImportHoliday[];
  skipped: ScheduleImportSkipped[];
};

export type ScheduleImportParseOk = ScheduleImportDraft;
export type ScheduleImportParseErr = { error: string };
export type ScheduleImportParseResult =
  | ScheduleImportParseOk
  | ScheduleImportParseErr;

export function isScheduleImportParseErr(
  r: ScheduleImportParseResult,
): r is ScheduleImportParseErr {
  return "error" in r;
}

export type ScheduleImportOk = {
  ok: true;
  jobNumber: string;
  shortName: string;
  activityCount: number;
  linkCount: number;
  holidayCount: number;
  mode: ScheduleImportMode;
  skipped: ScheduleImportSkipped[];
  summary: string;
};

export type ScheduleImportFail = {
  ok: false;
  jobNumber: string;
  shortName: string;
  summary: string;
  reason?:
    | "not_found"
    | "draft_estimate"
    | "too_large"
    | "invalid_file"
    | "apply"
    | "code_conflict"
    | "bad_mode";
  /** Row / graph errors shown as a list under the summary. */
  detailLines?: string[];
  skipped?: ScheduleImportSkipped[];
  errors?: string[];
  refused?: true;
};

export type ScheduleImportResult = ScheduleImportOk | ScheduleImportFail;

/** One line per skipped construct for the import summary UI (5.1.3-c). */
export function formatSkippedLines(
  skipped: readonly ScheduleImportSkipped[],
): string[] {
  return skipped.map((s) => {
    const n = s.count === 1 ? "1 row" : `${s.count} rows`;
    const sample = s.sample?.trim() ? ` (e.g. ${s.sample.trim()})` : "";
    return `Skipped ${s.kind}: ${n}${sample}`;
  });
}
