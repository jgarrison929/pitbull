/**
 * Regression: plan dates must use the job zone (America/Los_Angeles), not UTC.
 *
 * After 00:00Z (evening PT) UTC calendar day ≠ LA day. Seed used
 * `toISOString().slice(0,10)` while assistant/plans used LA → submit
 * and updateLine targeted I-5's UTC-"today" instead of Cedar tomorrow.
 */
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-0000000000pd";

/** Same calendar the assistant uses for today/tomorrow. */
function assistantTomorrow(now: Date): string {
  return addCalendarDays(planDateToday(now, timeZoneForJob()), 1);
}

function assistantToday(now: Date): string {
  return planDateToday(now, timeZoneForJob());
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function utcTomorrow(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return d.toISOString().slice(0, 10);
}

describe("seed plan dates use job time zone", () => {
  it("at 00:30Z (5:30 PM PT) Cedar tomorrow matches assistant, not UTC", () => {
    // Pin: just after UTC midnight — the failing verify-v5 window.
    const now = new Date("2026-10-26T00:30:00.000Z");
    expect(utcDay(now)).toBe("2026-10-26");
    expect(assistantToday(now)).toBe("2026-10-25");
    expect(assistantTomorrow(now)).toBe("2026-10-26");
    // Bug signature: UTC tomorrow ≠ job-zone tomorrow.
    expect(utcTomorrow(now)).toBe("2026-10-27");
    expect(utcTomorrow(now)).not.toBe(assistantTomorrow(now));

    const rows = seed(company, now);
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    const i5 = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:i5:today"),
    )!;

    expect(cedar.planDate).toBe(assistantTomorrow(now));
    expect(i5.planDate).toBe(assistantToday(now));
    // Must not seed on the UTC calendar (the pre-fix bug).
    expect(cedar.planDate).not.toBe(utcTomorrow(now));
    expect(i5.planDate).not.toBe(utcDay(now));
  });

  it("just before job-local midnight still aligns seed with assistant", () => {
    // 06:59Z = 11:59 PM PDT on Oct 25 — still Oct 25 in the job zone.
    const now = new Date("2026-10-26T06:59:00.000Z");
    expect(assistantToday(now)).toBe("2026-10-25");
    expect(utcDay(now)).toBe("2026-10-26");

    const rows = seed(company, now);
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    const i5 = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:i5:today"),
    )!;

    expect(cedar.planDate).toBe(assistantTomorrow(now));
    expect(i5.planDate).toBe(assistantToday(now));
  });

  it("after job-local midnight UTC day and plan day agree", () => {
    // 07:01Z = 12:01 AM PDT Oct 26.
    const now = new Date("2026-10-26T07:01:00.000Z");
    expect(assistantToday(now)).toBe("2026-10-26");
    expect(utcDay(now)).toBe("2026-10-26");

    const rows = seed(company, now);
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    expect(cedar.planDate).toBe(assistantTomorrow(now));
    expect(cedar.planDate).toBe(utcTomorrow(now));
  });

  it("field history stays strictly before plan-today in the job zone at 00:30Z", () => {
    const now = new Date("2026-10-26T00:30:00.000Z");
    const today = assistantToday(now);
    const rows = seed(company, now);
    const history = rows.dailyPlans.filter((p) => p.status === "approved");
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((p) => p.planDate < today)).toBe(true);
  });
});
