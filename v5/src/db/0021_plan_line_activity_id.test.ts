import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type JournalEntry,
  loadMigrationJournal,
} from "@/lib/applied-migrations";

const drizzleDir = join(process.cwd(), "drizzle");
const migrationSql = readFileSync(
  join(drizzleDir, "0021_plan_line_activity_id.sql"),
  "utf8",
);
const snapshot0021 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0021_snapshot.json"), "utf8"),
) as {
  id: string;
  prevId: string;
  tables: Record<
    string,
    {
      columns?: Record<string, { name: string; notNull: boolean }>;
      indexes?: Record<string, { name: string }>;
      foreignKeys?: Record<
        string,
        { name: string; tableFrom: string; tableTo: string; onDelete: string }
      >;
    }
  >;
};
const snapshot0020 = JSON.parse(
  readFileSync(join(drizzleDir, "meta/0020_snapshot.json"), "utf8"),
) as { id: string };

/** Journal + snapshot claim for 0021 (predecessor = 0020). */
export function planLine0021JournalClaim(args: {
  entries: readonly JournalEntry[];
  prevId: string;
  predecessorSnapshotId: string;
}): boolean {
  const { entries, prevId, predecessorSnapshotId } = args;
  const tags = entries.map((e) => e.tag);
  const idx = tags.indexOf("0021_plan_line_activity_id");
  const scheduleIdx = tags.indexOf("0020_schedule_activities");
  if (idx < 0 || scheduleIdx < 0) return false;
  if (idx !== scheduleIdx + 1) return false;
  if (idx !== entries.length - 1) return false;
  const entry = entries[idx]!;
  if (entry.idx !== 21) return false;
  if (entry.when !== 1793040000000) return false;
  if (entry.when <= 1793030000000) return false;
  if (prevId !== predecessorSnapshotId) return false;
  return true;
}

describe("migration 0021_plan_line_activity_id", () => {
  it("adds nullable activity_id FK + index on daily_plan_lines", () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE "daily_plan_lines" ADD COLUMN "activity_id" uuid/,
    );
    expect(migrationSql).toMatch(
      /daily_plan_lines_activity_id_activities_id_fk/,
    );
    expect(migrationSql).toMatch(/ON DELETE set null/i);
    expect(migrationSql).toMatch(
      /CREATE INDEX "daily_plan_lines_activity_idx"/,
    );
    const col =
      snapshot0021.tables["public.daily_plan_lines"]?.columns?.activity_id;
    expect(col?.name).toBe("activity_id");
    expect(col?.notNull).toBe(false);
    const fk =
      snapshot0021.tables["public.daily_plan_lines"]?.foreignKeys?.[
        "daily_plan_lines_activity_id_activities_id_fk"
      ];
    expect(fk?.tableTo).toBe("activities");
    expect(fk?.onDelete).toBe("set null");
  });

  it("N9: journal position + idx 21 + prevId chain from 0020", () => {
    const entries = loadMigrationJournal();
    const tags = entries.map((e) => e.tag);
    expect(tags).toContain("0020_schedule_activities");
    expect(tags).toContain("0021_plan_line_activity_id");
    expect(tags.at(-1)).toBe("0021_plan_line_activity_id");
    expect(snapshot0021.prevId).toBe(snapshot0020.id);
    expect(
      planLine0021JournalClaim({
        entries,
        prevId: snapshot0021.prevId,
        predecessorSnapshotId: snapshot0020.id,
      }),
    ).toBe(true);
  });

  it("must-fail N9: wrong when stamp goes RED", () => {
    const entries = loadMigrationJournal().map((e) => ({ ...e }));
    const row = entries.find((e) => e.tag === "0021_plan_line_activity_id")!;
    row.when = 1793030000000; // equal to 0020 — must not claim
    expect(
      planLine0021JournalClaim({
        entries,
        prevId: snapshot0021.prevId,
        predecessorSnapshotId: snapshot0020.id,
      }),
    ).toBe(false);
  });
});
