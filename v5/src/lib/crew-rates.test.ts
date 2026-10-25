import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";

describe("crew labor rates (5.0.2 Part A)", () => {
  it("names the three seed crews and their cents/MH", () => {
    expect(CREW_LABOR_RATE_CENTS).toEqual({
      "Bridge Crew 2": 9250,
      "Culvert Crew A": 7800,
      "Interchange Crew 1": 8800,
    });
  });

  it("flat-rate constant is gone from product source (not tests)", () => {
    const banned = "DEFAULT_" + "LABOR_RATE_CENTS";
    const root = join(process.cwd(), "src");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        // Spec A5: product source under v5/src — skip *.test.*
        if (/\.test\.(ts|tsx)$/.test(name)) continue;
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const text = readFileSync(p, "utf8");
        if (text.includes(banned)) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
