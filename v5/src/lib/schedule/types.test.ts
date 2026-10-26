import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  activityDatesBeforeCpm,
  DEFAULT_WORKDAYS_MASK,
  activities,
  barPlacement,
  ganttAxisRange,
  jobCalendars,
} from "./index";

describe("@/lib/schedule module surface", () => {
  it("exports table handles and duration bounds for 5.1.0-b/c", () => {
    expect(jobCalendars).toBeTruthy();
    expect(activities).toBeTruthy();
    expect(DEFAULT_WORKDAYS_MASK).toBe(31);
    expect(ACTIVITY_DURATION_MIN_DAYS).toBe(1);
    expect(ACTIVITY_DURATION_MAX_DAYS).toBe(3_650);
    expect(typeof barPlacement).toBe("function");
    expect(typeof ganttAxisRange).toBe("function");
  });

  it("activityDatesBeforeCpm mirrors early onto late with zero float", () => {
    expect(activityDatesBeforeCpm("2026-11-09", "2026-11-12")).toEqual({
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-12",
      lateStartOn: "2026-11-09",
      lateFinishOn: "2026-11-12",
      totalFloatDays: 0,
      isCritical: false,
    });
  });

  it("must-fail: pre-CPM helper must not invent float or critical", () => {
    const d = activityDatesBeforeCpm("2026-11-02", "2026-11-06");
    expect(d.totalFloatDays).not.toBeGreaterThan(0);
    expect(d.isCritical).not.toBe(true);
    expect(d.lateFinishOn).toBe(d.earlyFinishOn);
  });
});
