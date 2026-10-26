import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMigrationJournal } from "@/lib/applied-migrations";

const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0020_schedule_activities.sql"),
  "utf8",
);

describe("migration 0020_schedule_activities", () => {
  it("creates the four 5.1.0-a schedule tables with uniqueness and duration check", () => {
    expect(migrationSql).toMatch(/CREATE TABLE "job_calendars"/);
    expect(migrationSql).toMatch(/CREATE TABLE "calendar_holidays"/);
    expect(migrationSql).toMatch(/CREATE TABLE "activities"/);
    expect(migrationSql).toMatch(/CREATE TABLE "activity_cost_items"/);
    expect(migrationSql).toMatch(/job_calendars_job_uidx/);
    expect(migrationSql).toMatch(/activities_job_code_uidx/);
    expect(migrationSql).toMatch(/calendar_holidays_day_uidx/);
    expect(migrationSql).toMatch(/activities_duration_days_ck/);
    expect(migrationSql).toMatch(/duration_days" >= 1 and .*<= 3650/);
    expect(migrationSql).toMatch(/workdays_mask" integer DEFAULT 31/);
    // 5.1.0-a does not add plan-line activity_id (0021) or activity_links (5.1.1).
    expect(migrationSql).not.toMatch(/activity_links/);
    expect(migrationSql).not.toMatch(/daily_plan_lines/);
  });

  it("is claimed as 0020 after main's 0017 (schedule is not tagged 0017)", () => {
    const entries = loadMigrationJournal();
    const tags = entries.map((e) => e.tag);
    // #726 on main owns 0017_average_performance — allow it.
    expect(tags).toContain("0017_average_performance");
    expect(tags).toContain("0020_schedule_activities");
    expect(tags.at(-1)).toBe("0020_schedule_activities");
    // JournalEntry exposes tag + when; order is array position.
    expect(tags.indexOf("0020_schedule_activities")).toBeGreaterThan(
      tags.indexOf("0017_average_performance"),
    );

    const schedule = entries.find((e) => e.tag === "0020_schedule_activities")!;
    expect(schedule.when).toBe(1793030000000);
    // This PR's schedule slice must not steal the 0017 tag from Part B.
    expect(schedule.tag.startsWith("0017_")).toBe(false);
  });

  it("must-fail: a 0017-tagged schedule migration is not accepted as this slice", () => {
    expect(migrationSql).not.toMatch(/0017_schedule/);
    const tags = loadMigrationJournal().map((e) => e.tag);
    expect(tags.includes("0017_schedule_activities")).toBe(false);
  });

  it("must-fail: no parallel working-days module (use lib/working-calendar after #719)", () => {
    expect(
      existsSync(join(process.cwd(), "src/lib/schedule/working-days.ts")),
    ).toBe(false);
    expect(
      existsSync(join(process.cwd(), "src/lib/schedule/working-days.test.ts")),
    ).toBe(false);
  });
});
