import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type JournalEntry,
  loadMigrationJournal,
} from "@/lib/applied-migrations";

const drizzleDir = join(process.cwd(), "drizzle");
const migrationSql = readFileSync(
  join(drizzleDir, "0020_schedule_activities.sql"),
  "utf8",
);
const snapshot0020 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0020_snapshot.json"), "utf8"),
) as {
  id: string;
  prevId: string;
  tables: Record<
    string,
    { indexes?: Record<string, { name: string; isUnique: boolean }> }
  >;
};
const snapshot0019 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0019_snapshot.json"), "utf8"),
) as { id: string };

/** True when SQL creates activities_job_code_uidx as a UNIQUE index. */
export function activitiesJobCodeIndexIsUnique(sql: string): boolean {
  return /CREATE\s+UNIQUE\s+INDEX\s+"activities_job_code_uidx"/i.test(sql);
}

/**
 * Journal + snapshot claim for 0020 (predecessor = 0019 after #10).
 */
export function schedule0020JournalClaim(args: {
  entries: readonly JournalEntry[];
  prevId: string;
  predecessorSnapshotId: string;
}): boolean {
  const { entries, prevId, predecessorSnapshotId } = args;
  const tags = entries.map((e) => e.tag);
  const scheduleIdx = tags.indexOf("0020_schedule_activities");
  if (scheduleIdx < 0) return false;
  // Sits on 0019. Later migrations (0021+) may follow; 0020 is not buried under 0019.
  if (tags[scheduleIdx - 1] !== "0019_crews_contract") return false;
  if (scheduleIdx !== 20) return false;
  const schedule = entries[scheduleIdx]!;
  if (schedule.idx !== 20) return false;
  if (schedule.when !== 1793030000000) return false;
  if (schedule.when <= 1793020000000) return false;
  // Snapshot must chain from 0019.
  if (prevId !== predecessorSnapshotId) return false;
  return true;
}

describe("migration 0020_schedule_activities", () => {
  it("creates the four 5.1.0-a schedule tables with uniqueness and duration check", () => {
    expect(migrationSql).toMatch(/CREATE TABLE "job_calendars"/);
    expect(migrationSql).toMatch(/CREATE TABLE "calendar_holidays"/);
    expect(migrationSql).toMatch(/CREATE TABLE "activities"/);
    expect(migrationSql).toMatch(/CREATE TABLE "activity_cost_items"/);
    expect(migrationSql).toMatch(/job_calendars_job_uidx/);
    expect(migrationSql).toMatch(/calendar_holidays_day_uidx/);
    expect(migrationSql).toMatch(/activities_duration_days_ck/);
    expect(migrationSql).toMatch(/duration_days" >= 1 and .*<= 3650/);
    expect(migrationSql).toMatch(/workdays_mask" integer DEFAULT 31/);
    // 5.1.0-a does not add plan-line activity_id (0021) or activity_links (5.1.1).
    expect(migrationSql).not.toMatch(/activity_links/);
    expect(migrationSql).not.toMatch(/daily_plan_lines/);
  });

  it("N8: activities_job_code_uidx is a UNIQUE index (name alone is not enough)", () => {
    expect(activitiesJobCodeIndexIsUnique(migrationSql)).toBe(true);
    // Snapshot must agree — a UNIQUE SQL with isUnique:false would still be wrong.
    const idx =
      snapshot0020.tables["public.activities"]?.indexes?.[
        "activities_job_code_uidx"
      ];
    expect(idx?.name).toBe("activities_job_code_uidx");
    expect(idx?.isUnique).toBe(true);
  });

  it("must-fail N8: non-unique activities_job_code_uidx goes RED", () => {
    // Name still present; UNIQUE dropped — old name-only assert would stay green.
    const broken = migrationSql.replace(
      /CREATE\s+UNIQUE\s+INDEX\s+"activities_job_code_uidx"/i,
      'CREATE INDEX "activities_job_code_uidx"',
    );
    expect(broken).toMatch(/activities_job_code_uidx/);
    expect(activitiesJobCodeIndexIsUnique(broken)).toBe(false);
  });

  it("N9: journal position + idx 20 + prevId chain from 0019", () => {
    const entries = loadMigrationJournal();
    const tags = entries.map((e) => e.tag);
    expect(tags).toContain("0018_daily_plan_events");
    expect(tags).toContain("0019_crews_contract");
    expect(tags).toContain("0020_schedule_activities");
    expect(tags.at(-1)).toBe("0021_action_runs_job_idx");
    const jobFeed = entries.find((e) => e.tag === "0021_action_runs_job_idx")!;
    expect(jobFeed.idx).toBe(21);
    expect(jobFeed.when).toBeGreaterThan(1793030000000);
    expect(tags.indexOf("0020_schedule_activities")).toBeGreaterThan(
      tags.indexOf("0019_crews_contract"),
    );

    const schedule = entries.find((e) => e.tag === "0020_schedule_activities")!;
    // Stamp above #10's 0019_crews_contract @ 1793020000000; idx 20.
    expect(schedule.when).toBe(1793030000000);
    expect(schedule.when).toBeGreaterThan(1793020000000);
    expect(schedule.idx).toBe(20);
    expect(schedule.tag.startsWith("0017_")).toBe(false);
    expect(schedule.tag.startsWith("0019_")).toBe(false);

    // Position + prevId (not when alone).
    expect(snapshot0020.prevId).toBe(snapshot0019.id);
    expect(
      schedule0020JournalClaim({
        entries,
        prevId: snapshot0020.prevId,
        predecessorSnapshotId: snapshot0019.id,
      }),
    ).toBe(true);
  });

  it("must-fail N9: journal idx 17 for 0020 goes RED (when alone would stay green)", () => {
    const entries = loadMigrationJournal().map((e) => ({ ...e }));
    const schedule = entries.find((e) => e.tag === "0020_schedule_activities")!;
    // Keep when correct — old when-only assert would stay green.
    expect(schedule.when).toBe(1793030000000);
    schedule.idx = 17;
    expect(
      schedule0020JournalClaim({
        entries,
        prevId: snapshot0020.prevId,
        predecessorSnapshotId: snapshot0019.id,
      }),
    ).toBe(false);
  });

  it("must-fail N9: wrong snapshot prevId goes RED", () => {
    const entries = loadMigrationJournal();
    expect(
      schedule0020JournalClaim({
        entries,
        prevId: "00000000-0000-0000-0000-000000000000",
        predecessorSnapshotId: snapshot0019.id,
      }),
    ).toBe(false);
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
