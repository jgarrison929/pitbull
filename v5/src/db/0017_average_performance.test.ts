import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "drizzle/0017_average_performance.sql"),
  "utf8",
);
const migrateScript = readFileSync(
  join(process.cwd(), "scripts/db-migrate.mjs"),
  "utf8",
);

describe("migration 0017_average_performance", () => {
  it("adds average_performance via ADD VALUE only", () => {
    expect(sql).toMatch(
      /ALTER\s+TYPE\s+"public"\."forecast_method"\s+ADD\s+VALUE\s+'average_performance'/i,
    );
    // Must-fail: recreating the enum (0012 style) would wipe other values mid-upgrade.
    expect(sql).not.toMatch(/DROP\s+TYPE/i);
    expect(sql).not.toMatch(/CREATE\s+TYPE/i);
    expect(sql).not.toMatch(/UPDATE\s+"cost_items"/i);
  });

  it("must-fail: db:migrate must apply ADD VALUE outside a transaction", () => {
    expect(migrateScript).toMatch(/outside a transaction/i);
    expect(migrateScript).toMatch(/addValue/);
    expect(migrateScript).toMatch(/if \(addValue\)/);
    // ADD VALUE branch uses client.unsafe; transactional branch uses begin.
    expect(migrateScript).toMatch(/client\.begin/);
    const addBranch = migrateScript.slice(
      migrateScript.indexOf("if (addValue)"),
      migrateScript.indexOf("} else {", migrateScript.indexOf("if (addValue)")),
    );
    expect(addBranch).toMatch(/client\.unsafe/);
    expect(addBranch).not.toMatch(/\.begin/);
  });
});

