import { describe, expect, it } from "vitest";
import {
  JOB_TIME_ZONE,
  addCalendarDays,
  calendarDateInTz,
  instantAtLocal,
  jobPagePlans,
  planDateInWindow,
  planDateToday,
  seedAuditSpread,
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

  it("jobPagePlans (page wiring) keeps LA-today open — no zone arg to swap", () => {
    const now = new Date("2026-10-27T00:30:00.000Z");
    const plans = [
      { id: "hist", planDate: "2026-10-23" },
      { id: "today", planDate: "2026-10-26" },
      { id: "tomorrow", planDate: "2026-10-27" },
    ];
    const { today, open, history } = jobPagePlans(plans, now);
    expect(today).toBe("2026-10-26");
    expect(today).not.toBe(now.toISOString().slice(0, 10));
    expect(open.map((p) => p.id)).toEqual(["today", "tomorrow"]);
    expect(history.map((p) => p.id)).toEqual(["hist"]);
  });

  it("instantAtLocal maps PT wall clock to the matching UTC instant", () => {
    // 2026-10-20 is PDT (UTC-7): 16:05 PT = 23:05Z.
    const t = instantAtLocal("2026-10-20", 16, 5);
    expect(t.toISOString()).toBe("2026-10-20T23:05:00.000Z");
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: JOB_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(t);
    expect(label).toMatch(/16:05/);
  });

  it("seedAuditSpread yields strictly increasing stamps ≤ now", () => {
    const now = new Date("2026-10-20T17:00:00.000Z"); // 10:00 AM PDT
    const stamps = seedAuditSpread(now, 24);
    expect(stamps).toHaveLength(24);
    for (let i = 1; i < stamps.length; i++) {
      expect(stamps[i]!.getTime()).toBeGreaterThan(stamps[i - 1]!.getTime());
      expect(stamps[i]!.getTime() - stamps[i - 1]!.getTime()).toBeGreaterThanOrEqual(
        60_000,
      );
    }
    expect(stamps[stamps.length - 1]!.getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
  });
});
