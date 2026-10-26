import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Part F acceptance: no code path dual-writes the dropped text `crew` column
 * into `dailyPlans` inserts. Assistant args may still pass a crew *name*.
 */
describe("crews contract: no dailyPlans text crew writes", () => {
  const srcRoot = join(process.cwd(), "src");

  function walkTs(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name);
      if (name.isDirectory()) {
        if (name.name === "node_modules") continue;
        out.push(...walkTs(p));
      } else if (name.name.endsWith(".ts") || name.name.endsWith(".tsx")) {
        out.push(p);
      }
    }
    return out;
  }

  it("createDailyPlan and seed inserts do not set crew: on dailyPlans", () => {
    const plans = readFileSync(join(srcRoot, "server/plans.ts"), "utf8");
    // Insert may be db.insert or tx.insert (plan-events wraps a transaction).
    const insertNeedle = /await (?:db|tx)\.insert\(dailyPlans\)\.values\(\{/;
    expect(plans).toMatch(insertNeedle);
    const start = plans.search(insertNeedle);
    const insertBlock = plans.slice(start, plans.indexOf("});", start) + 3);
    expect(insertBlock).toMatch(/crewId:\s*crew\.id/);
    expect(insertBlock).not.toMatch(/\bcrew:\s*crew\.name/);
    expect(insertBlock).not.toMatch(/\bcrew:\s*["']/);

    for (const rel of [
      "seed/index.ts",
      "seed/field-history.ts",
      "seed/stress.ts",
    ]) {
      const body = readFileSync(join(srcRoot, rel), "utf8");
      // dailyPlans push objects must not include text crew.
      expect(body, rel).not.toMatch(
        /dailyPlans(?:\.push)?\([\s\S]{0,200}?\bcrew:\s*["']/,
      );
      expect(body, rel).not.toMatch(
        /planRows\.push\(\{[\s\S]*?\bcrew:\s*job\.crew\.name/,
      );
    }
  });

  it("must-fail: schema no longer declares daily_plans.crew text", () => {
    const schema = readFileSync(join(srcRoot, "db/schema.ts"), "utf8");
    const dailyPlansBlock = schema.slice(
      schema.indexOf("export const dailyPlans"),
      schema.indexOf("export const dailyPlanLines"),
    );
    expect(dailyPlansBlock).toMatch(/crewId:\s*uuid\("crew_id"\)/);
    expect(dailyPlansBlock).toMatch(/\.notNull\(\)/);
    expect(dailyPlansBlock).not.toMatch(/crew:\s*text\("crew"\)/);
  });

  it("must-fail: no TypeScript insert still assigns dailyPlans.crew column", () => {
    // Narrow scan: values({ ... crew: ... }) next to dailyPlans inserts.
    const offenders: string[] = [];
    for (const file of walkTs(srcRoot)) {
      if (file.includes(".test.")) continue;
      const body = readFileSync(file, "utf8");
      if (!body.includes("dailyPlans")) continue;
      if (
        /insert\(dailyPlans\)[\s\S]{0,400}?\bcrew:\s*(?!\{)/.test(body) ||
        /dailyPlans\.push\(\{[\s\S]{0,300}?\bcrew:\s*["']/.test(body)
      ) {
        offenders.push(file.replace(srcRoot + "/", ""));
      }
    }
    expect(offenders).toEqual([]);
  });
});
