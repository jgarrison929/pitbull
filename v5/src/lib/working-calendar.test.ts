import { describe, expect, it } from "vitest";
import { createWorkingCalendar } from "./working-calendar";

describe("createWorkingCalendar", () => {
  const cal = createWorkingCalendar(["2026-11-26"]);

  it("treats Mon–Fri as working and weekends as not", () => {
    expect(cal.isWorkingDay("2026-11-02")).toBe(true); // Mon
    expect(cal.isWorkingDay("2026-11-06")).toBe(true); // Fri
    expect(cal.isWorkingDay("2026-11-07")).toBe(false); // Sat
    expect(cal.isWorkingDay("2026-11-08")).toBe(false); // Sun
  });

  it("skips the Thanksgiving holiday", () => {
    expect(cal.isWorkingDay("2026-11-26")).toBe(false);
    expect(cal.nextWorkingDay("2026-11-25")).toBe("2026-11-27");
    expect(cal.prevWorkingDay("2026-11-27")).toBe("2026-11-25");
  });

  it("addWorkingDays moves by working days only", () => {
    expect(cal.addWorkingDays("2026-11-06", 1)).toBe("2026-11-09");
    expect(cal.addWorkingDays("2026-11-02", 4)).toBe("2026-11-06");
    expect(cal.addWorkingDays("2026-11-09", 0)).toBe("2026-11-09");
    expect(cal.addWorkingDays("2026-11-09", -1)).toBe("2026-11-06");
  });

  it("workingDayDelta matches nextWorkingDay steps", () => {
    expect(cal.workingDayDelta("2026-11-02", "2026-11-02")).toBe(0);
    expect(cal.workingDayDelta("2026-11-02", "2026-11-06")).toBe(4);
    expect(cal.workingDayDelta("2026-11-09", "2026-11-10")).toBe(1);
    expect(cal.workingDayDelta("2026-11-10", "2026-11-09")).toBe(-1);
  });

  it("must-fail: a weekday holiday must not count as a working day", () => {
    expect(cal.isWorkingDay("2026-11-26")).toBe(false);
    expect(cal.isWorkingDay("2026-11-26")).not.toBe(true);
  });
});
