import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = join(import.meta.dirname);
const fontsDir = join(appDir, "fonts");
const layoutPath = join(appDir, "layout.tsx");

/**
 * Prove product fonts stay pinned to committed static Geist faces.
 * Variable wght AA was the hypothesized root of the 20 px harbor-phone miss;
 * next/font/google + Variable.woff2 must not return.
 */
describe("pinned Geist faces (visual baseline trust)", () => {
  it("layout uses next/font/local only (no google / no Variable)", () => {
    const src = readFileSync(layoutPath, "utf8");
    expect(src).toMatch(/from ["']next\/font\/local["']/);
    expect(src).not.toMatch(/next\/font\/google/);
    expect(src).not.toMatch(/Variable\.woff2/);
    expect(src).toMatch(/Geist-Regular\.woff2/);
    expect(src).toMatch(/GeistMono-Regular\.woff2/);
    expect(src).toMatch(/adjustFontFallback:\s*false/);
    expect(src).toMatch(/display:\s*["']block["']/);
  });

  it("commits only static weight woff2 files under src/app/fonts", () => {
    expect(existsSync(fontsDir)).toBe(true);
    const files = readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      expect(f, `${f} must not be a variable face`).not.toMatch(/Variable/i);
      expect(f).toMatch(/^Geist(Mono)?-(Regular|Medium|SemiBold|Bold)\.woff2$/);
    }
  });
});
