import { describe, expect, it } from "vitest";
import {
  JOB_TIME_ZONE,
  addCalendarDays,
  calendarDateInTz,
  planDateInWindow,
  planDateToday,
  splitPlansByPlanToday,
  timeZoneForJob,
} from "./plan-date";

describe("plan-date", () => {
  it("formats America/Los_Angeles calendar dates", () => {
    // 2026-10-20 17:00 UTC is still 2026-10-20 in LA (PDT, UTC-7).
    expect(
      calendarDateInTz(new Date("2026-10-20T17:00:00.000Z")),
    ).toBe("2026-10-20");
    // Just after midnight UTC is still the prior evening in LA.
    expect(
      calendarDateInTz(new Date("2026-10-21T06:00:00.000Z")),
    ).toBe("2026-10-20");
  });

  it("planDateToday matches job zone (not UTC) just after UTC midnight", () => {
    // 00:01Z = 5:01 PM PDT previous calendar day.
    const justAfterUtcMidnight = new Date("2026-10-26T00:01:00.000Z");
    expect(justAfterUtcMidnight.toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(planDateToday(justAfterUtcMidnight)).toBe("2026-10-25");
    expect(planDateToday(justAfterUtcMidnight, JOB_TIME_ZONE)).toBe(
      "2026-10-25",
    );
  });

  it("planDateToday agrees with UTC day just before job-local midnight", () => {
    // 2026-10-26 06:59Z = 11:59 PM PDT on Oct 25 — still Oct 25 in LA.
    const beforeLocalMidnight = new Date("2026-10-26T06:59:00.000Z");
    expect(planDateToday(beforeLocalMidnight)).toBe("2026-10-25");
    // 07:01Z = 12:01 AM PDT Oct 26.
    const afterLocalMidnight = new Date("2026-10-26T07:01:00.000Z");
    expect(planDateToday(afterLocalMidnight)).toBe("2026-10-26");
  });

  it("timeZoneForJob defaults to JOB_TIME_ZONE", () => {
    expect(timeZoneForJob()).toBe(JOB_TIME_ZONE);
    expect(timeZoneForJob({})).toBe(JOB_TIME_ZONE);
    expect(timeZoneForJob({ timeZone: "America/Denver" })).toBe(
      "America/Denver",
    );
  });

  it("accepts ±14 days inclusive", () => {
    const today = "2026-10-20";
    expect(planDateInWindow(today, today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, 14), today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, -14), today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, 15), today)).toBe(false);
    expect(planDateInWindow(addCalendarDays(today, -15), today)).toBe(false);
  });

  it("splitPlansByPlanToday keeps LA-today open after UTC midnight", () => {
    const now = new Date("2026-10-27T00:30:00.000Z");
    const plans = [
      { id: "hist", planDate: "2026-10-23" },
      { id: "today", planDate: "2026-10-26" },
      { id: "tomorrow", planDate: "2026-10-27" },
    ];
    const { today, open, history } = splitPlansByPlanToday(plans, now);
    expect(today).toBe("2026-10-26");
    expect(open.map((p) => p.id)).toEqual(["today", "tomorrow"]);
    expect(history.map((p) => p.id)).toEqual(["hist"]);
  });
});
