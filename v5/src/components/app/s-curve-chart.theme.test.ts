import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("S-curve chart theme tokens", () => {
  it("must-fail: chart strokes use theme tokens only (no hard-coded hex/rgb)", () => {
    const src = readFileSync(join(here, "s-curve-chart.tsx"), "utf8");
    expect(src).toMatch(/var\(--chart-1\)/);
    expect(src).toMatch(/var\(--chart-2\)/);
    expect(src).toMatch(/var\(--chart-3\)/);
    expect(src).toMatch(/var\(--border\)/);
    expect(src).not.toMatch(/recharts/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/rgb[a]?\(/);
    expect(src).not.toMatch(/hsl[a]?\(/);
  });

  it("must-fail: no Recharts dependency for the S-curve", () => {
    const pkg = JSON.parse(
      readFileSync(join(here, "../../../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.recharts).toBeUndefined();
  });

  it("must-fail: light and dark --chart-1/2/3 stay theme-token pairs (readable on each bg)", () => {
    const css = readFileSync(join(here, "../../app/globals.css"), "utf8");
    const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const pick = (block: string, name: string) => {
      const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
      return m?.[1]?.trim() ?? "";
    };
    for (const name of ["--chart-1", "--chart-2", "--chart-3"] as const) {
      const light = pick(root, name);
      const darkVal = pick(dark, name);
      expect(light, name).toMatch(/^oklch\(/);
      expect(darkVal, name).toMatch(/^oklch\(/);
      expect(light, `${name} light≠dark`).not.toBe(darkVal);
    }
    // Dark chart-1 must be lighter than the dark card so the PV line reads.
    const darkChart1 = pick(dark, "--chart-1");
    const darkCard = pick(dark, "--card");
    const L = (oklch: string) => Number(oklch.match(/oklch\(([\d.]+)/)?.[1]);
    expect(L(darkChart1)).toBeGreaterThan(L(darkCard));
  });
});
