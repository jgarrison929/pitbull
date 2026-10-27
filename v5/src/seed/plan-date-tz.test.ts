/**
 * Regression: plan dates must use the job zone (America/Los_Angeles), not UTC.
 *
 * After 00:00Z (evening PT) UTC calendar day ≠ LA day. Seed used
 * `toISOString().slice(0,10)` while assistant/plans used LA → submit
 * and updateLine targeted I-5's UTC-"today" instead of Cedar tomorrow.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  jobPagePlans,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { seed, seedId } from "./index";
import { seedStressJob } from "./stress";
// jobPagePlanSurface needs seedNow — covered in server/job-page-plans.test.ts

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

  it("weekday evening 00:30Z: history below LA today and unique (job, crew, date)", () => {
    // Monday evening PT — UTC has rolled to Tuesday. UTC workingDaysBefore would
    // include LA-today (Mon) and collide with open I-5 on daily_plans_job_crew_date_uidx.
    const now = new Date("2026-10-27T00:30:00.000Z");
    expect(utcDay(now)).toBe("2026-10-27");
    expect(assistantToday(now)).toBe("2026-10-26");

    const rows = seed(company, now);
    const today = assistantToday(now);
    const history = rows.dailyPlans.filter((p) => p.status === "approved");
    expect(history.every((p) => p.planDate < today)).toBe(true);

    const i5 = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:i5:today"),
    )!;
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    expect(i5.planDate).toBe(today);
    expect(cedar.planDate).toBe(assistantTomorrow(now));

    const seen = new Set<string>();
    for (const plan of rows.dailyPlans) {
      const key = `${plan.jobId}:${plan.crewId}:${plan.planDate}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("M1b: Cedar createdAt is before seed now (not tomorrow@06:00Z)", () => {
    // Evening PT: tomorrow@06:00Z is still in the future and sorted after live Approves.
    const now = new Date("2026-10-27T00:30:00.000Z");
    const rows = seed(company, now);
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    const createdEvt = rows.dailyPlanEvents.find(
      (e) => e.planId === cedar.id && e.kind === "created",
    )!;
    expect(cedar.planDate).toBe(assistantTomorrow(now));
    expect(cedar.createdAt!.getTime()).toBeLessThan(now.getTime());
    expect(createdEvt.at!.getTime()).toBe(cedar.createdAt!.getTime());
    expect(cedar.createdAt!.getTime()).not.toBe(
      new Date(`${assistantTomorrow(now)}T06:00:00.000Z`).getTime(),
    );
  });

  it("M6: seeded action_run day labels use LA today/tomorrow", () => {
    const now = new Date("2026-10-27T00:30:00.000Z");
    // LA Mon Oct 26 / Tue Oct 27 — UTC would label Tue Oct 27 / Wed Oct 28.
    const rows = seed(company, now);
    const issued = rows.actionRuns.find((r) =>
      r.summary.includes("Issued Culvert Crew A's plan"),
    )!;
    const cedarShow = rows.actionRuns.find((r) =>
      r.summary.includes("Bridge Crew 2 on Cedar Creek Bridge"),
    )!;
    expect(issued.summary).toMatch(/Mon, Oct 26/);
    expect(issued.summary).not.toMatch(/Tue, Oct 27/);
    expect(cedarShow.summary).toMatch(/Tue, Oct 27/);
    expect(cedarShow.summary).not.toMatch(/Wed, Oct 28/);
  });

  it("M7: seedStressJob planDate is LA-tomorrow", () => {
    const now = new Date("2026-10-27T00:30:00.000Z");
    const stress = seedStressJob(company, now);
    expect(stress.dailyPlans[0]!.planDate).toBe(assistantTomorrow(now));
    expect(stress.dailyPlans[0]!.planDate).not.toBe(utcTomorrow(now));
  });

  it("M8: jobPagePlans keeps LA-today open (not history)", () => {
    const now = new Date("2026-10-27T00:30:00.000Z");
    const rows = seed(company, now);
    const i5 = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:i5:today"),
    )!;
    const { today, open, history } = jobPagePlans(rows.dailyPlans, now);
    expect(today).toBe("2026-10-26");
    expect(open.some((p) => p.id === i5.id)).toBe(true);
    expect(history.some((p) => p.id === i5.id)).toBe(false);
    expect(today).toBe(assistantToday(now));
    expect(today).not.toBe(utcDay(now));
  });

  it("M8 page wiring: job page mounts JobNewPlanSlot (lint-style; output test is authoritative)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/app/jobs/[number]/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/jobPagePlanSurface\s*\(\s*plans\s*\)/);
    // JSX mount — unused import alone must not satisfy this.
    expect(src).toMatch(/<JobNewPlanSlot\b/);
    expect(src).not.toMatch(/\bNewPlanForm\b/);
    expect(src).not.toMatch(/splitPlansByPlanToday\s*\(/);
    expect(src).not.toMatch(/jobPagePlans\s*\(/);
    // Any UTC calendar-day spelling on the page (slice / split / toJSON).
    expect(src).not.toMatch(/toISOString\s*\(/);
  });
});
