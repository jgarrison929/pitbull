import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findRawColors,
  RAW_COLOR_ALLOWLIST,
  RAW_PALETTE_CLASS,
  stripComments,
} from "./no-raw-colors";

const root = join(import.meta.dirname, "../../..");
const PRODUCT_ROOTS = ["src/components", "src/app"] as const;

function walkProductTsx(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (/\.test\.(ts|tsx)$/.test(name)) continue;
      if (name === "globals.css") continue;
      if (!/\.(ts|tsx)$/.test(name)) continue;
      files.push(p);
    }
  };
  for (const r of PRODUCT_ROOTS) walk(join(root, r));
  return files;
}

describe("no raw colors in product UI", () => {
  it("must-fail: text-amber-700 is banned", () => {
    const sample = `className="text-amber-700 dark:text-amber-400"`;
    RAW_PALETTE_CLASS.lastIndex = 0;
    expect(findRawColors(sample).map((h) => h.match)).toEqual([
      "text-amber-700",
      "text-amber-400",
    ]);
  });

  it("must-fail: hex and oklch literals are banned", () => {
    const sample = `style={{ color: "#ff0000", background: oklch(0.5 0.1 40) }}`;
    expect(findRawColors(sample).map((h) => h.match)).toEqual([
      "#ff0000",
      "oklch(",
    ]);
  });

  it("ignores PR refs inside comments", () => {
    const src = stripComments(
      `{/* Scroll (#671) */}\nclassName="text-caution"`,
    );
    expect(findRawColors(src)).toEqual([]);
  });

  it("new product files use theme tokens only (allowlist for pre-Part-C hits)", () => {
    const hits: string[] = [];
    for (const file of walkProductTsx()) {
      const rel = relative(root, file).replace(/\\/g, "/");
      const allowed = new Set(RAW_COLOR_ALLOWLIST[rel] ?? []);
      for (const h of findRawColors(readFileSync(file, "utf8"))) {
        const ok =
          allowed.has(h.match) ||
          [...allowed].some((a) => h.match.startsWith(a));
        if (!ok) hits.push(`${rel}:${h.line} ${h.match}`);
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
