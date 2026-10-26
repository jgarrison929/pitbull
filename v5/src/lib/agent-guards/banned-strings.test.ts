import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBannedStrings, PRODUCT_BANNED } from "./banned-strings";

const root = join(import.meta.dirname, "../../..");

/** Input placeholders on forms are fine; product/marketing copy is not. */
const ALLOW_PLACEHOLDER_ATTR = /\bplaceholder\s*=\s*\{?["'`]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|md)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe("banned product strings", () => {
  it("must-fail: ERP in user-facing copy", () => {
    const hits = findBannedStrings(
      `Pitbull is the construction ERP your team needs.`,
    );
    expect(hits.map((h) => h.id)).toContain("erp");
  });

  it("must-fail: coming soon / stub theater", () => {
    const hits = findBannedStrings(`Schedule module — coming soon.`);
    expect(hits.map((h) => h.id)).toContain("coming-soon");
  });

  it("scans content + app chrome for banned strings", () => {
    const files = [
      ...walk(join(root, "src/content")),
      join(root, "README.md"),
      ...walk(join(root, "src/app")).filter((p) => p.endsWith("page.tsx")),
    ];
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const h of findBannedStrings(src)) {
        if (h.id === "placeholder-copy") {
          const line = src.split("\n")[h.line - 1] ?? "";
          if (ALLOW_PLACEHOLDER_ATTR.test(line)) continue;
          if (
            /\/placeholder\/[a-z]*/.test(line) ||
            /placeholder-copy/.test(line)
          )
            continue;
        }
        hits.push(`${file}:${h.line} [${h.id}] ${h.match}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("keeps ERP in the ban list", () => {
    expect(PRODUCT_BANNED.some((b) => b.id === "erp")).toBe(true);
  });
});
