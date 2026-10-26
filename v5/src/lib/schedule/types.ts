/**
 * Schedule table types for 5.1.0-a (schema + seed).
 * 5.1.0-b (server actions) and 5.1.0-c (Gantt) import from `@/lib/schedule`.
 */
import type {
  activities,
  activityCostItems,
  calendarHolidays,
  jobCalendars,
} from "@/db/schema";

/** Bitmask: bit 0 = Monday … bit 6 = Sunday. Mon–Fri = 31. */
export const DEFAULT_WORKDAYS_MASK = 31;

export const ACTIVITY_DURATION_MIN_DAYS = 1;
export const ACTIVITY_DURATION_MAX_DAYS = 3_650;

export type JobCalendar = typeof jobCalendars.$inferSelect;
export type JobCalendarInsert = typeof jobCalendars.$inferInsert;

export type CalendarHoliday = typeof calendarHolidays.$inferSelect;
export type CalendarHolidayInsert = typeof calendarHolidays.$inferInsert;

export type Activity = typeof activities.$inferSelect;
export type ActivityInsert = typeof activities.$inferInsert;

export type ActivityCostItem = typeof activityCostItems.$inferSelect;
export type ActivityCostItemInsert = typeof activityCostItems.$inferInsert;

/** Seed / 5.1.0 early-date rule: late = early, float 0, not critical. */
export function activityDatesBeforeCpm(earlyStartOn: string, earlyFinishOn: string) {
  return {
    earlyStartOn,
    earlyFinishOn,
    lateStartOn: earlyStartOn,
    lateFinishOn: earlyFinishOn,
    totalFloatDays: 0,
    isCritical: false as const,
  };
}
