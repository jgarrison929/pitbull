import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Seed + EV write/read paths must not invent a wall clock. Only seed-clock.ts
 * may call bare `new Date()` / `Date.now()` as the production fallback.
 * Parsing a calendar string (`new Date(\`${iso}T…\`)`) is fine.
 */

const ROOT = join(import.meta.dirname, "..");

/** Modules that feed seeded dates or earned value. */
const SCOPES = [
  "seed",
  "server/progress.ts",
  "server/data.ts",
  "server/cost-rollups.ts",
  "server/cost-item-page.ts",
  "server/plan-page.ts",
  "server/plans.ts",
  "server/change-orders.ts",
  "server/estimate-import.ts",
  "server/assistant/actions.ts",
] as const;

const ALLOW_FILES = new Set([
  // The only place bare wall fallback is allowed.
  "server/seed-clock.ts",
]);

/** Test files may use wall dates as fixtures. */
const isTest = (rel: string) => /\.test\.ts$/.test(rel);

function listTsFiles(relPath: string): string[] {
  const abs = join(ROOT, relPath);
  const st = statSync(abs);
  if (st.isFile()) return relPath.endsWith(".ts") ? [relPath] : [];
  const out: string[] = [];
  for (const name of readdirSync(abs)) {
    if (name === "node_modules") continue;
    out.push(...listTsFiles(join(relPath, name)));
  }
  return out;
}

/** Strip block + line comments so examples in docs don't trip the guard. */
function stripComments(src: string) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Bare wall clock: `new Date()` with nothing inside, or `Date.now()`.
 * Not: `new Date(x)`, `new Date(\`…\`)`, `new Date("…")`.
 */
const BARE_NEW_DATE = /(?<![\w.$])new\s+Date\s*\(\s*\)/g;
const DATE_NOW = /(?<![\w.$])Date\.now\s*\(\s*\)/g;

describe("seed/EV clock guard", () => {
  it("bans bare new Date() / Date.now() outside seed-clock.ts", () => {
    const files = SCOPES.flatMap((s) => listTsFiles(s)).filter(
      (f) => !isTest(f) && !ALLOW_FILES.has(f.replace(/\\/g, "/")),
    );
    expect(files.length).toBeGreaterThan(5);

    const hits: string[] = [];
    for (const rel of files) {
      const src = stripComments(readFileSync(join(ROOT, rel), "utf8"));
      for (const re of [BARE_NEW_DATE, DATE_NOW]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          const line = src.slice(0, m.index).split("\n").length;
          hits.push(`${rel}:${line}: ${m[0]}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("keeps seed-clock.ts as the sole bare-fallback owner", () => {
    const src = readFileSync(join(ROOT, "server/seed-clock.ts"), "utf8");
    expect(src).toMatch(/new Date\(\)/);
    expect(relative(ROOT, join(ROOT, "server/seed-clock.ts"))).toBe(
      "server/seed-clock.ts",
    );
  });
});
