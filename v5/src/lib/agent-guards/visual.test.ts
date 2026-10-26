import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  darkThemeShipped,
  findLoosenedMaxDiff,
  missingDarkTwins,
} from "./visual";

const root = join(import.meta.dirname, "../../..");
const snapDir = join(root, "tests/e2e/visual.spec.ts-snapshots");

describe("visual baseline guards", () => {
  it("must-fail: maxDiffPixels > 0 (past AA silence)", () => {
    expect(findLoosenedMaxDiff(`maxDiffPixels: 120`)).toEqual([120]);
    expect(findLoosenedMaxDiff(`maxDiffPixels: 0`)).toEqual([]);
  });

  it("playwright config and visual.spec keep maxDiffPixels: 0", () => {
    for (const rel of [
      "playwright.config.ts",
      "tests/e2e/visual.spec.ts",
    ] as const) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(findLoosenedMaxDiff(src), rel).toEqual([]);
      expect(src).toMatch(/maxDiffPixels:\s*0/);
    }
  });

  it("must-fail: light baseline without dark twin when dark theme ships", () => {
    const missing = missingDarkTwins([
      "job-desktop-chromium-linux.png",
      "portfolio-desktop-chromium-linux.png",
    ]);
    expect(missing).toEqual([
      "job-desktop-chromium-linux.png",
      "portfolio-desktop-chromium-linux.png",
    ]);
  });

  it("requires dark twins once dark theme is in the tree", () => {
    const themeSources: string[] = [];
    for (const rel of [
      "src/lib/theme.ts",
      "src/server/theme.ts",
      "src/components/app/theme-switch.tsx",
      "src/app/theme/actions.ts",
    ] as const) {
      const p = join(root, rel);
      if (existsSync(p)) themeSources.push(readFileSync(p, "utf8"));
    }
    if (!darkThemeShipped(themeSources)) return;

    const names = readdirSync(snapDir).filter((n) => n.endsWith(".png"));
    expect(missingDarkTwins(names)).toEqual([]);
  });
});
