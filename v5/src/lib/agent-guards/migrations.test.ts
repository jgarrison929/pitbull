import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADD_VALUE_ALLOWLIST,
  findAddValueInMigration,
} from "./migrations";

const drizzleDir = join(import.meta.dirname, "../../../drizzle");
const migrateScriptPath = join(
  import.meta.dirname,
  "../../../scripts/db-migrate.mjs",
);

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

  it("db-migrate applies ADD VALUE outside a transaction", () => {
    const migrateScript = readFileSync(migrateScriptPath, "utf8");
    expect(migrateScript).toMatch(/outside a transaction/i);
    expect(migrateScript).toMatch(/if \(addValue\)/);
    const addBranch = migrateScript.slice(
      migrateScript.indexOf("if (addValue)"),
      migrateScript.indexOf(
        "} else {",
        migrateScript.indexOf("if (addValue)"),
      ),
    );
    expect(addBranch).toMatch(/client\.unsafe/);
    expect(addBranch).not.toMatch(/\.begin/);
  });

  it("committed ADD VALUE migrations are allowlisted (db-migrate outside TX)", () => {
    const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
    expect(sqlFiles.length).toBeGreaterThan(5);
    const hits: string[] = [];
    for (const f of sqlFiles) {
      const sql = readFileSync(join(drizzleDir, f), "utf8");
      if (findAddValueInMigration(sql)) hits.push(f);
    }
    for (const f of hits) {
      expect(
        ADD_VALUE_ALLOWLIST[f],
        `${f} uses ADD VALUE but is not in ADD_VALUE_ALLOWLIST — add with reason (db-migrate outside TX) or use recreate-enum`,
      ).toBeDefined();
      expect(ADD_VALUE_ALLOWLIST[f]!.reason.length).toBeGreaterThan(10);
    }
    for (const listed of Object.keys(ADD_VALUE_ALLOWLIST)) {
      expect(
        sqlFiles,
        `allowlisted ${listed} missing from drizzle/`,
      ).toContain(listed);
      expect(
        hits,
        `allowlisted ${listed} no longer contains ADD VALUE`,
      ).toContain(listed);
    }
  });
});
