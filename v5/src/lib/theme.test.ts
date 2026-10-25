import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

describe("theme cookie (5.0.3 Part C)", () => {
  it("defaults unknown values to light", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme("")).toBe("light");
    expect(parseTheme("system")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
  });

  it("root layout reads the cookie and applies the dark class", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/from ["']@\/server\/theme["']/);
    expect(layout).toMatch(/const theme = await getTheme\(\)/);
    expect(layout).toMatch(/theme === ["']dark["'] && ["']dark["']/);
    expect(layout).toMatch(/data-theme=\{theme\}/);
    // Cookie on <html> blocks the static shell — keep the opt-out explicit.
    expect(layout).toMatch(/export const instant = false/);
  });

  it("must-fail: layout must await getTheme() (server cookie read)", () => {
    // #724 follow-up: a leftover `getTheme` import string stayed green while
    // the await + dark class wiring were removed (only e2e caught the flash).
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const themeSrc = readFileSync(join(process.cwd(), "src/server/theme.ts"), "utf8");
    expect(layout).toMatch(/const theme = await getTheme\(\)/);
    expect(layout).toMatch(/theme === ["']dark["'] && ["']dark["']/);
    expect(layout).toMatch(/data-theme=\{theme\}/);
    expect(layout).toMatch(/export const instant = false/);
    expect(themeSrc).toMatch(/cookies\(\)/);
    expect(themeSrc).toMatch(/THEME_COOKIE/);
    expect(themeSrc).toMatch(/\.get\(THEME_COOKIE\)/);
  });

  it("user menu hosts Light and Dark switches", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/app/shell.tsx"),
      "utf8",
    );
    const switchSrc = readFileSync(
      join(process.cwd(), "src/components/app/theme-switch.tsx"),
      "utf8",
    );
    expect(shell).toMatch(/ThemeSwitch/);
    expect(switchSrc).toContain('data-testid="theme-switch"');
    expect(switchSrc).toContain("theme-${value}");
    expect(switchSrc).toMatch(/setTheme/);
    expect(switchSrc).toContain("Light");
    expect(switchSrc).toContain("Dark");
  });

  it("cookie name is stable for SSR + e2e", () => {
    expect(THEME_COOKIE).toBe("pcs_theme");
  });
});
