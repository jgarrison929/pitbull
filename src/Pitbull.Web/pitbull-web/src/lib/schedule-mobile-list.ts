/**
 * Schedule activity mobile list helpers (band 3.7 / 3.6.1+).
 * No SPI/CPI invent; critical flag only when server provides it.
 */

export type ScheduleActivityMobileItem = {
  id: string;
  name: string;
  status: string;
  start?: string | null;
  finish?: string | null;
  isCritical?: boolean | null;
  totalFloat?: number | null;
};

export const SCHEDULE_MOBILE_EMPTY =
  "No activities in this filter. Empty means none — not an on-track health score.";

export function scheduleActivitiesMobileUrl(projectId: string, scheduleId: string, pageSize = 100): string {
  return `/api/projects/${projectId}/schedules/${scheduleId}/activities?view=mobile&pageSize=${pageSize}`;
}

export function formatFloatDays(floatDays: number | null | undefined): string {
  if (floatDays === null || floatDays === undefined || Number.isNaN(floatDays)) {
    return "Float insufficient";
  }
  return `${floatDays}d float`;
}

export function criticalLabel(isCritical: boolean | null | undefined): string {
  if (isCritical === true) return "Critical";
  if (isCritical === false) return "Non-critical";
  return "Critical unknown";
}
