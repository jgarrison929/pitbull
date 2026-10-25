import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findAddValueInMigration } from "./migrations";

const drizzleDir = join(import.meta.dirname, "../../../drizzle");

describe("migration ADD VALUE ban", () => {
  it("must-fail: ADD VALUE inside a migration (PG refuses in a TX)", () => {
    const pastMistake = `
      ALTER TYPE "public"."forecast_method" ADD VALUE 'average_performance';
    `;
    expect(findAddValueInMigration(pastMistake)).toBe(true);
  });

  it("accepts recreate-enum style (0012)", () => {
    const ok = `
      CREATE TYPE "public"."forecast_method_new" AS ENUM('current_budget');
      ALTER TABLE "cost_items" ALTER COLUMN "forecast_method" TYPE ...
    `;
    expect(findAddValueInMigration(ok)).toBe(false);
  });

  it("no committed drizzle migration uses ADD VALUE", () => {
    const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const f of sqlFiles) {
      const sql = readFileSync(join(drizzleDir, f), "utf8");
      if (findAddValueInMigration(sql)) hits.push(f);
    }
    expect(hits).toEqual([]);
  });
});
