import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findRawColors,
  RAW_PALETTE_CLASS,
  stripComments,
} from "@/lib/no-raw-colors";

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
  for (const root of PRODUCT_ROOTS) {
    walk(join(process.cwd(), root));
  }
  return files;
}

describe("no raw colors in product UI (5.0.3 Part C)", () => {
  it("components and app pages use theme tokens only", () => {
    const hits: string[] = [];
    for (const file of walkProductTsx()) {
      for (const h of findRawColors(readFileSync(file, "utf8"))) {
        hits.push(`${file}:${h.line} ${h.match}`);
      }
    }
    expect(hits).toEqual([]);
  });

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

  it("must-fail: text-white is banned", () => {
    expect(findRawColors(`listening && "bg-negative text-white"`).map((h) => h.match)).toContain(
      "text-white",
    );
  });

  it("ignores PR refs inside comments", () => {
    const src = stripComments(`{/* Scroll (#671) */}\nclassName="text-caution"`);
    expect(findRawColors(src)).toEqual([]);
  });
});
