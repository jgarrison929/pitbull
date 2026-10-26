/**
 * Shared schedule-import draft shape for XER (5.1.3-a) and MSP XML (5.1.3-b).
 * Parsers are pure; apply lives in `v5/src/server/schedule-import.ts`.
 */

export const SCHEDULE_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

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

export type ScheduleImportMode = "replace" | "merge";
