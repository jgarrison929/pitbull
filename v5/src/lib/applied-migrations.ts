import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";

export type JournalEntry = { tag: string; when: number; idx?: number };

/**
 * True when each journal entry's `when` is strictly greater than the previous
 * entry's (by array order / rising `idx`). Drizzle stores `when` as
 * `folderMillis` / `__drizzle_migrations.created_at` and skips any migration
 * whose millis are ≤ the last applied row — so a lower stamp silently no-ops.
 */
export function journalWhenStrictlyIncreases(
  entries: readonly JournalEntry[],
): boolean {
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1]!;
    const cur = entries[i]!;
    if (cur.when <= prev.when) return false;
    if (
      typeof prev.idx === "number" &&
      typeof cur.idx === "number" &&
      cur.idx <= prev.idx
    ) {
      return false;
    }
  }
  return true;
}

/** Load drizzle journal tags from the deploy's `drizzle/meta/_journal.json`. */
export function loadMigrationJournal(
  cwd: string = process.cwd(),
): JournalEntry[] {
  const raw = readFileSync(
    path.join(cwd, "drizzle", "meta", "_journal.json"),
    "utf8",
  );
  const journal = JSON.parse(raw) as { entries?: JournalEntry[] };
  return journal.entries ?? [];
}

/**
 * Map applied `__drizzle_migrations.created_at` rows to journal tag names.
 * Drizzle stores `folderMillis` (= journal `when`) as `created_at`.
 * Unknown timestamps stay labeled honestly as `unknown:<when>`.
 */
export function namesForAppliedRows(
  rows: readonly { created_at: number | string | bigint }[],
  journal: readonly JournalEntry[],
): string[] {
  const byWhen = new Map(journal.map((e) => [e.when, e.tag]));
  return rows.map((row) => {
    const when = Number(row.created_at);
    return byWhen.get(when) ?? `unknown:${when}`;
  });
}

/**
 * Applied migration list for /status and /health.
 * - `null` — no database configured
 * - `string[]` — table readable (`[]` means none applied)
 * - `"unavailable"` — table missing or query failed (not the same as empty)
 */
export type AppliedMigrations = string[] | null | "unavailable";

/** Status-page label for {@link AppliedMigrations}. */
export function formatMigrationsLabel(migrations: AppliedMigrations): string {
  if (migrations === null) return "not-configured";
  if (migrations === "unavailable") return "unavailable";
  if (migrations.length === 0) return "(none)";
  return migrations.join(", ");
}

/**
 * Applied v5 migration tag names in apply order, or `null` when no DB.
 * Returns `"unavailable"` when the migrations table is missing or unreadable.
 */
export async function listAppliedMigrationNames(
  db: Db | null,
  cwd: string = process.cwd(),
): Promise<AppliedMigrations> {
  if (!db) return null;
  try {
    const result = await db.execute(
      sql`select created_at from drizzle.__drizzle_migrations order by created_at asc`,
    );
    const rows = [...result] as { created_at: number | string | bigint }[];
    return namesForAppliedRows(rows, loadMigrationJournal(cwd));
  } catch {
    return "unavailable";
  }
}
