import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  DEFAULT_WORKDAYS_MASK,
} from "@/lib/schedule";
import { createWorkingCalendar } from "@/lib/working-calendar";
import { seed, seedId } from "./index";
import {
  SEED_TO_JOB_START_DAYS,
  seedJobStartOn,
  seedWorkingJobStartOn,
} from "./schedule";

const company = "00000000-0000-4000-8000-0000000000c1";
/** Frozen seed clock from the 5.1.0-a / intel fixture. */
const today = new Date("2026-10-20T17:00:00.000Z");
const rows = seed(company, today);

function cedarActs() {
  const job = rows.jobs.find((j) => j.number === "25-031")!;
  return rows.activities
    .filter((a) => a.jobId === job.id)
    .sort((a, b) => a.code!.localeCompare(b.code!));
}

describe("5.1.0-a schedule seed", () => {
  it("seeds A–E on 25-031 with absolute early dates under the frozen clock", () => {
    expect(seedJobStartOn(today)).toBe("2026-11-02");
    expect(SEED_TO_JOB_START_DAYS).toBe(13);

    const byCode = Object.fromEntries(cedarActs().map((a) => [a.code, a]));
    expect(Object.keys(byCode).sort()).toEqual(["A", "B", "C", "D", "E"]);

    expect(byCode.A).toMatchObject({
      name: "Drive piles",
      durationDays: 5,
      earlyStartOn: "2026-11-02",
      earlyFinishOn: "2026-11-06",
    });
    expect(byCode.B).toMatchObject({
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-11",
    });
    expect(byCode.C).toMatchObject({
      name: "Pier columns",
      durationDays: 4,
      earlyStartOn: "2026-11-09",
      earlyFinishOn: "2026-11-12",
    });
    expect(byCode.D).toMatchObject({
      earlyStartOn: "2026-11-13",
      earlyFinishOn: "2026-11-16",
    });

    // Until 5.1.1: late = early, float 0, not critical.
    for (const a of cedarActs()) {
      expect(a.lateStartOn).toBe(a.earlyStartOn);
      expect(a.lateFinishOn).toBe(a.earlyFinishOn);
      expect(a.totalFloatDays).toBe(0);
      expect(a.isCritical).toBe(false);
      expect(a.durationDays).toBeGreaterThanOrEqual(ACTIVITY_DURATION_MIN_DAYS);
      expect(a.durationDays).toBeLessThanOrEqual(ACTIVITY_DURATION_MAX_DAYS);
    }
  });

  it("links Cedar cost items and covers the Bridge Crew 2 plan date on E", () => {
    const cedar = rows.jobs.find((j) => j.number === "25-031")!;
    const costId = (code: string) => seedId(company, `cost:cedar:${code}`);
    const actId = (code: string) => seedId(company, `activity:cedar:${code}`);
    const links = rows.activityCostItems.filter((l) =>
      cedarActs().some((a) => a.id === l.activityId),
    );
    const pairs = links.map((l) => [l.activityId, l.costItemId]);
    expect(pairs).toEqual(
      expect.arrayContaining([
        [actId("A"), costId("03-450")],
        [actId("B"), costId("04-110")],
        [actId("C"), costId("04-210")],
        [actId("E"), costId("04-310")],
      ]),
    );
    expect(pairs.some(([, cid]) => cid === costId("07-410"))).toBe(false);

    const plan = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    const e = cedarActs().find((a) => a.code === "E")!;
    expect(e.earlyStartOn! <= plan.planDate!).toBe(true);
    expect(e.earlyFinishOn! >= plan.planDate!).toBe(true);
    expect(e.name).toBe("Tie column cage");
    void cedar;
  });

  it("gives 24-118 and 24-077 a calendar + ≥3 activities; draft 26-010 has none", () => {
    for (const number of ["24-118", "24-077"]) {
      const job = rows.jobs.find((j) => j.number === number)!;
      expect(rows.jobCalendars.filter((c) => c.jobId === job.id)).toHaveLength(
        1,
      );
      expect(
        rows.activities.filter((a) => a.jobId === job.id).length,
      ).toBeGreaterThanOrEqual(3);
      expect(
        rows.jobCalendars.find((c) => c.jobId === job.id)!.workdaysMask,
      ).toBe(DEFAULT_WORKDAYS_MASK);
    }

    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    expect(rows.activities.filter((a) => a.jobId === harbor.id)).toHaveLength(0);
    expect(rows.jobCalendars.filter((c) => c.jobId === harbor.id)).toHaveLength(
      0,
    );
  });

  it("5.1.2-a: Award baseline on approved jobs; Harbor has none", () => {
    expect(rows.scheduleBaselines).toHaveLength(3);
    for (const number of ["25-031", "24-118", "24-077"]) {
      const job = rows.jobs.find((j) => j.number === number)!;
      const bas = rows.scheduleBaselines.filter((b) => b.jobId === job.id);
      expect(bas).toHaveLength(1);
      expect(bas[0]).toMatchObject({
        name: "Award baseline",
        reason: "Award",
      });
      const copies = rows.baselineActivities.filter(
        (a) => a.baselineId === bas[0]!.id,
      );
      expect(copies.length).toBe(
        rows.activities.filter((a) => a.jobId === job.id).length,
      );
    }
    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    expect(
      rows.scheduleBaselines.filter((b) => b.jobId === harbor.id),
    ).toHaveLength(0);
    expect(rows.baselineActivities).toHaveLength(rows.activities.length);
  });

  it("seeds Thanksgiving on each job calendar in the seed year", () => {
    expect(rows.calendarHolidays.map((h) => h.on).sort()).toEqual([
      "2026-11-26",
      "2026-11-26",
      "2026-11-26",
    ]);
    expect(rows.calendarHolidays.every((h) => h.name === "Thanksgiving")).toBe(
      true,
    );
  });

  it("must-fail: wrong A finish (inclusive duration off-by-one)", () => {
    const a = cedarActs().find((x) => x.code === "A")!;
    // Treating duration as exclusive calendar add would end on 11-07 (Sat) or 11-05.
    expect(a.earlyFinishOn).not.toBe("2026-11-05");
    expect(a.earlyFinishOn).not.toBe("2026-11-07");
    expect(a.earlyFinishOn).toBe("2026-11-06");
  });

  it("must-fail: Harbor draft must stay schedule-empty", () => {
    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    const sneak = rows.activities.filter((a) => a.jobId === harbor.id);
    expect(sneak).toEqual([]);
    expect(sneak.length === 0).toBe(true);
  });

  it("must-fail: duplicate activity codes on one job", () => {
    const job = rows.jobs.find((j) => j.number === "25-031")!;
    const codes = rows.activities
      .filter((a) => a.jobId === job.id)
      .map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("shifts the graph with seedNow() and keeps codes stable", () => {
    const later = seed(company, new Date("2026-10-27T17:00:00.000Z"));
    const cedar = later.jobs.find((j) => j.number === "25-031")!;
    const a = later.activities.find(
      (x) => x.jobId === cedar.id && x.code === "A",
    )!;
    expect(a.earlyStartOn).toBe("2026-11-09");
    expect(a.earlyFinishOn).toBe("2026-11-13");
    // Thanksgiving stays the fourth Thursday of the job-start year (not shifted).
    expect(
      later.calendarHolidays.every((h) => h.on === "2026-11-26"),
    ).toBe(true);
  });

  /**
   * S3 lock: "Holidays are dates with no work". At seedNow ≥ 2026-11-05 the
   * Cedar graph crosses Thanksgiving — without the holiday in createWorkingCalendar,
   * B ends 11-27 (works 11-26) instead of 11-30.
   */
  it("must-fail S3: no activity works Thanksgiving when seedNow crosses it", () => {
    const seedNow = new Date("2026-11-05T17:00:00.000Z");
    const seeded = seed(company, seedNow);
    expect(seeded.calendarHolidays.every((h) => h.on === "2026-11-26")).toBe(
      true,
    );

    const cal = createWorkingCalendar(
      seeded.calendarHolidays.map((h) => h.on!),
    );
    expect(cal.isWorkingDay("2026-11-26")).toBe(false);

    const cedar = seeded.jobs.find((j) => j.number === "25-031")!;
    const b = seeded.activities.find(
      (a) => a.jobId === cedar.id && a.code === "B",
    )!;
    expect(b.earlyStartOn).toBe("2026-11-25");
    // With Thanksgiving: 11-25, 11-27, 11-30. S3 empty calendar: 11-25..11-27.
    expect(b.earlyFinishOn).toBe("2026-11-30");
    expect(b.earlyFinishOn).not.toBe("2026-11-27");

    for (const a of seeded.activities) {
      let on = a.earlyStartOn!;
      for (;;) {
        expect(
          on,
          `${a.code ?? a.name} must not work Thanksgiving`,
        ).not.toBe("2026-11-26");
        expect(
          cal.isWorkingDay(on),
          `${a.code ?? a.name} ${on} must be a working day`,
        ).toBe(true);
        if (on === a.earlyFinishOn) break;
        on = cal.nextWorkingDay(on);
      }
    }

    // Prove the empty-holiday calendar is the S3 mutant shape (works Thanksgiving).
    const noHoliday = createWorkingCalendar([]);
    expect(noHoliday.isWorkingDay("2026-11-26")).toBe(true);
    expect(noHoliday.addWorkingDays(b.earlyStartOn!, b.durationDays - 1)).toBe(
      "2026-11-27",
    );
  });

  it("imports lib/working-calendar and must not ship a parallel working-days module", () => {
    const src = readFileSync(join(process.cwd(), "src/seed/schedule.ts"), "utf8");
    expect(src).toMatch(/from "@\/lib\/working-calendar"/);
    expect(src).toMatch(/createWorkingCalendar/);
    expect(src).not.toMatch(/working-days/);
    expect(src).not.toMatch(/createScheduleCalendar/);
    expect(
      existsSync(join(process.cwd(), "src/lib/schedule/working-days.ts")),
    ).toBe(false);
  });

  it("keeps every seeded schedule date inside the working-calendar index range", () => {
    for (const a of rows.activities) {
      expect(a.earlyStartOn! >= "1990-01-01").toBe(true);
      expect(a.earlyFinishOn! <= "2140-12-31").toBe(true);
    }
    for (const h of rows.calendarHolidays) {
      expect(h.on! >= "1990-01-01").toBe(true);
      expect(h.on! <= "2140-12-31").toBe(true);
    }
  });

  it("must-fail: stepping past the 1990–2140 index throws from the working calendar", () => {
    const cal = createWorkingCalendar();
    expect(() => cal.prevWorkingDay("1990-01-01")).toThrow(/out of range/);
    expect(() => cal.addWorkingDays("2140-12-31", 1)).toThrow(/out of range/);
  });

  it.each([
    // Staging-style clocks: calendar-only shift from Sunday lands on Saturday.
    ["Sunday", "2026-10-25T20:00:00.000Z", "2026-11-07"],
    // Saturday seedNow still must keep every activity on working days.
    ["Saturday", "2026-10-24T20:00:00.000Z", "2026-11-06"],
  ] as const)(
    "must-fail: %s seedNow never starts/ends activities on non-working days",
    (_label, iso, calendarShiftedStart) => {
      const weekendNow = new Date(iso);
      expect(seedJobStartOn(weekendNow)).toBe(calendarShiftedStart);

      const seeded = seed(company, weekendNow);
      const thanksgiving = seeded.calendarHolidays[0]!.on!;
      const cal = createWorkingCalendar([thanksgiving]);

      // Snap must move off a weekend calendar shift (Sunday → Sat 11-07).
      const workingStart = seedWorkingJobStartOn(weekendNow, cal);
      expect(cal.isWorkingDay(workingStart)).toBe(true);
      if (!cal.isWorkingDay(calendarShiftedStart)) {
        expect(workingStart).toBe(cal.nextWorkingDay(calendarShiftedStart));
        expect(workingStart).not.toBe(calendarShiftedStart);
      }

      expect(seeded.activities.length).toBeGreaterThan(0);
      for (const a of seeded.activities) {
        expect(
          cal.isWorkingDay(a.earlyStartOn!),
          `${a.code} start ${a.earlyStartOn} must be a working day`,
        ).toBe(true);
        expect(
          cal.isWorkingDay(a.earlyFinishOn!),
          `${a.code} finish ${a.earlyFinishOn} must be a working day`,
        ).toBe(true);
        // Inclusive working-day span must match durationDays.
        const span =
          cal.workingDayDelta(a.earlyStartOn!, a.earlyFinishOn!) + 1;
        expect(span).toBe(a.durationDays);
      }
    },
  );
});
