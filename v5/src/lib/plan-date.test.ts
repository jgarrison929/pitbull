import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDateInTz,
  planDateInWindow,
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

  it("accepts ±14 days inclusive", () => {
    const today = "2026-10-20";
    expect(planDateInWindow(today, today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, 14), today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, -14), today)).toBe(true);
    expect(planDateInWindow(addCalendarDays(today, 15), today)).toBe(false);
    expect(planDateInWindow(addCalendarDays(today, -15), today)).toBe(false);
  });
});
