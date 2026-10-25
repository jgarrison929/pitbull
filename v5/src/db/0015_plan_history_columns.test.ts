import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0015_plan_history_columns.sql"),
  "utf8",
);

describe("migration 0015_plan_history_columns", () => {
  it("adds created_by_id and reported_at (expand-only)", () => {
    expect(migrationSql).toMatch(/ADD COLUMN "created_by_id" uuid/);
    expect(migrationSql).toMatch(
      /ADD COLUMN "reported_at" timestamp with time zone/,
    );
    expect(migrationSql).toMatch(
      /daily_plans_created_by_id_users_id_fk/,
    );
    expect(migrationSql).not.toMatch(/DROP COLUMN/);
    expect(migrationSql).not.toMatch(/NOT NULL/);
  });
});
