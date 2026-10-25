import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "drizzle/0018_daily_plan_events.sql"),
  "utf8",
);

describe("migration 0018_daily_plan_events", () => {
  it("creates plan_event_kind + daily_plan_events with role + time", () => {
    expect(migrationSql).toMatch(
      /CREATE TYPE "public"\."plan_event_kind" AS ENUM\('created', 'submitted', 'reported', 'returned', 'approved'\)/,
    );
    expect(migrationSql).toMatch(/CREATE TABLE "daily_plan_events"/);
    expect(migrationSql).toMatch(/"actor_role" "role" NOT NULL/);
    expect(migrationSql).toMatch(/daily_plan_events_plan_idx/);
    expect(migrationSql).not.toMatch(/ALTER TABLE "daily_plans"/);
    expect(migrationSql).not.toMatch(/DROP COLUMN/);
  });

  it("backfills created/submitted/reported/returned/approved from stamp columns", () => {
    expect(migrationSql).toMatch(/'created'::"plan_event_kind"/);
    expect(migrationSql).toMatch(/'submitted'::"plan_event_kind"/);
    expect(migrationSql).toMatch(/'reported'::"plan_event_kind"/);
    expect(migrationSql).toMatch(/'returned'::"plan_event_kind"/);
    expect(migrationSql).toMatch(/'approved'::"plan_event_kind"/);
    expect(migrationSql).toMatch(/'superintendent'::"role"/);
    expect(migrationSql).toMatch(/'foreman'::"role"/);
  });

  it("must-fail: backfill must not invent display names", () => {
    expect(migrationSql.toLowerCase()).not.toMatch(
      /elena|marcus|ray|dominguez|brooks|lee/,
    );
  });
});
