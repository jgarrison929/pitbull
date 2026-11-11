import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type JournalEntry,
  loadMigrationJournal,
} from "@/lib/applied-migrations";

const drizzleDir = join(process.cwd(), "drizzle");
const migrationSql = readFileSync(
  join(drizzleDir, "0023_schedule_baselines.sql"),
  "utf8",
);
const snapshot0023 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0023_snapshot.json"), "utf8"),
) as {
  id: string;
  prevId: string;
  tables: Record<
    string,
    { indexes?: Record<string, { name: string; isUnique: boolean }> }
  >;
};
const snapshot0020 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0020_snapshot.json"), "utf8"),
) as { id: string };

/**
 * Journal + snapshot claim for 0023 (5.1.2-a).
 * Leaves 0021 / 0022 tags free for 5.1.0-d / 5.1.1; idx/when leave room.
 */
export function schedule0023JournalClaim(args: {
  entries: readonly JournalEntry[];
  prevId: string;
  predecessorSnapshotId: string;
}): boolean {
  const { entries, prevId, predecessorSnapshotId } = args;
  const tags = entries.map((e) => e.tag);
  const idx = tags.indexOf("0023_schedule_baselines");
  if (idx < 0) return false;
  if (idx !== entries.length - 1) return false;
  const entry = entries[idx]!;
  if (entry.idx !== 23) return false;
  if (entry.when !== 1793060000000) return false;
  const prev = entries[idx - 1];
  if (!prev || prev.when >= entry.when) return false;
  if (prevId !== predecessorSnapshotId) return false;
  // Must not invent 0021/0022 placeholders on this slice.
  if (tags.includes("0021_schedule_baselines")) return false;
  if (tags.some((t) => t.startsWith("0021_") || t.startsWith("0022_")))
    return false;
  return true;
}

describe("migration 0023_schedule_baselines", () => {
  it("creates schedule_baselines + baseline_activities with uniqueness and FKs", () => {
    expect(migrationSql).toMatch(/CREATE TABLE "schedule_baselines"/);
    expect(migrationSql).toMatch(/CREATE TABLE "baseline_activities"/);
    expect(migrationSql).toMatch(/schedule_baselines_job_idx/);
    expect(migrationSql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+"baseline_activities_pair_uidx"/i,
    );
    expect(migrationSql).toMatch(
      /baseline_activities_activity_id_activities_id_fk[\s\S]*ON DELETE restrict/i,
    );
    // 5.1.2-a does not own activity_links (0022) or plan-line activity_id (0021).
    expect(migrationSql).not.toMatch(/activity_links/);
    expect(migrationSql).not.toMatch(/daily_plan_lines/);
  });

  it("N: baseline_activities_pair_uidx is UNIQUE (name alone is not enough)", () => {
    expect(migrationSql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+"baseline_activities_pair_uidx"/i,
    );
    const idx =
      snapshot0023.tables["public.baseline_activities"]?.indexes?.[
        "baseline_activities_pair_uidx"
      ];
    expect(idx?.name).toBe("baseline_activities_pair_uidx");
    expect(idx?.isUnique).toBe(true);
  });

  it("must-fail: non-unique pair index goes RED", () => {
    const broken = migrationSql.replace(
      /CREATE\s+UNIQUE\s+INDEX\s+"baseline_activities_pair_uidx"/i,
      'CREATE INDEX "baseline_activities_pair_uidx"',
    );
    expect(broken).toMatch(/baseline_activities_pair_uidx/);
    expect(
      /CREATE\s+UNIQUE\s+INDEX\s+"baseline_activities_pair_uidx"/i.test(broken),
    ).toBe(false);
  });

  it("journal claim: tag 0023, idx 23, when after 0020, snapshot chains from 0020", () => {
    const entries = loadMigrationJournal();
    const tags = entries.map((e) => e.tag);
    expect(tags).toContain("0020_schedule_activities");
    expect(tags.at(-1)).toBe("0023_schedule_baselines");
    expect(tags).not.toContain("0021_schedule_baselines");
    expect(snapshot0023.prevId).toBe(snapshot0020.id);
    expect(
      schedule0023JournalClaim({
        entries,
        prevId: snapshot0023.prevId,
        predecessorSnapshotId: snapshot0020.id,
      }),
    ).toBe(true);
  });

  it("must-fail: claiming 0021 for baselines goes RED", () => {
    expect(existsSync(join(drizzleDir, "0021_schedule_baselines.sql"))).toBe(
      false,
    );
    const entries = loadMigrationJournal().map((e) =>
      e.tag === "0023_schedule_baselines"
        ? { ...e, tag: "0021_schedule_baselines", idx: 21 }
        : e,
    );
    expect(
      schedule0023JournalClaim({
        entries,
        prevId: snapshot0023.prevId,
        predecessorSnapshotId: snapshot0020.id,
      }),
    ).toBe(false);
  });

  it("must-fail: wrong snapshot prevId goes RED", () => {
    expect(
      schedule0023JournalClaim({
        entries: loadMigrationJournal(),
        prevId: "00000000-0000-0000-0000-000000000000",
        predecessorSnapshotId: snapshot0020.id,
      }),
    ).toBe(false);
  });
});
