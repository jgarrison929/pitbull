/**
 * Schedule module surface for 5.1.0 slices.
 * - 5.1.0-a: schema tables + types (this package)
 * - 5.1.0-b: server writes
 * - 5.1.0-c: Gantt UI imports Activity / JobCalendar types from here
 *
 * Working-day math: import `@/lib/working-calendar` only — never a parallel module.
 */
export {
  activities,
  activityCostItems,
  calendarHolidays,
  jobCalendars,
} from "@/db/schema";

export {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  activityDatesBeforeCpm,
  DEFAULT_WORKDAYS_MASK,
  type Activity,
  type ActivityCostItem,
  type ActivityCostItemInsert,
  type ActivityInsert,
  type CalendarHoliday,
  type CalendarHolidayInsert,
  type JobCalendar,
  type JobCalendarInsert,
} from "./types";
