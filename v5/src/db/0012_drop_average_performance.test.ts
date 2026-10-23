import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Migration 0012 must only remap forecast_method → current_budget. */
const sql = readFileSync(
  join(process.cwd(), "drizzle/0012_drop_average_performance.sql"),
  "utf8",
);

describe("migration 0012_drop_average_performance", () => {
  it("maps every non-current_budget row to current_budget only", () => {
    expect(sql).toMatch(
      /UPDATE\s+"cost_items"\s+SET\s+"forecast_method"\s*=\s*'current_budget'\s+WHERE\s+"forecast_method"\s*<>\s*'current_budget'/i,
    );
  });

  it("recreates the enum with only current_budget", () => {
    expect(sql).toMatch(
      /CREATE TYPE "public"\."forecast_method" AS ENUM\('current_budget'\)/,
    );
    expect(sql).not.toMatch(
      /CREATE TYPE "public"\."forecast_method" AS ENUM\([^)]*average_performance/,
    );
  });

  it("touches only cost_items.forecast_method — no other tables or money columns", () => {
    const updates = [...sql.matchAll(/UPDATE\s+"(\w+)"/gi)].map((m) => m[1]);
    expect(updates).toEqual(["cost_items"]);
    expect(sql).not.toMatch(
      /\b(budget_cents|actual_cents|earned_cents|daily_plans|companies)\b/,
    );
    // Data rewrite SET assigns forecast_method only (ignore ALTER … SET DEFAULT / SET DATA TYPE).
    const dataSets = [
      ...sql.matchAll(/UPDATE\s+"cost_items"\s+SET\s+([^;]+)/gi),
    ];
    expect(dataSets.length).toBe(1);
    const assigns = dataSets[0]![1]!.split(",").map((s) => s.trim());
    for (const a of assigns) {
      expect(a.startsWith('"forecast_method"')).toBe(true);
    }
  });
});
