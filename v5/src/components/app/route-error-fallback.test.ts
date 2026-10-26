import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Trust-bar banned words (same idea as verify-v5 `BANNED_VISIBLE`). */
const BANNED = [
  /coming\s+soon/i,
  /\btodo\b/i,
  /lorem/i,
  /placeholder/i,
  /\berp\b/i,
  /not\s+implemented/i,
  /\bstub(s|bed)?\b/i,
  /\bfixme\b/i,
  /\btbd\b/i,
  /\bwip\b/i,
] as const;

/** Default Next crash phrases verify-v5 treats as an error boundary. */
const CRASH_DEFAULTS = [
  /Application error/i,
  /Something went wrong/i,
  /Unhandled Runtime Error/i,
  /This page could not be found/i,
  /client-side exception/i,
  /Internal Server Error/i,
] as const;

const FILES = [
  "src/components/app/route-error-fallback.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/app/error.tsx",
] as const;

describe("route error recovery copy", () => {
  it("ships honest recovery wording with no banned or default crash phrases", () => {
    for (const rel of FILES) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      for (const re of BANNED) {
        expect(src, `${rel} banned ${re}`).not.toMatch(re);
      }
      for (const re of CRASH_DEFAULTS) {
        expect(src, `${rel} crash default ${re}`).not.toMatch(re);
      }
    }

    const fallback = readFileSync(
      join(process.cwd(), "src/components/app/route-error-fallback.tsx"),
      "utf8",
    );
    expect(fallback).toMatch(/Try again/);
    expect(fallback).toMatch(/failed/i);
    expect(fallback).toMatch(/Demo login/);
    // Digest stays in server/console logs only — never rendered.
    expect(fallback).not.toMatch(/Error id/);
    expect(fallback).not.toMatch(/>\s*\{digest\}/);

    const route = readFileSync(join(process.cwd(), "src/app/error.tsx"), "utf8");
    const app = readFileSync(join(process.cwd(), "src/app/app/error.tsx"), "utf8");
    const global = readFileSync(
      join(process.cwd(), "src/app/global-error.tsx"),
      "utf8",
    );
    expect(route).toMatch(/RouteErrorFallback/);
    expect(app).toMatch(/RouteErrorFallback/);
    expect(global).toMatch(/RouteErrorFallback/);
    expect(global).toMatch(/<html/);
    expect(global).toMatch(/globals\.css/);
  });

  it("keeps an /app segment boundary so AppShell is not replaced", () => {
    const appError = readFileSync(
      join(process.cwd(), "src/app/app/error.tsx"),
      "utf8",
    );
    const layout = readFileSync(
      join(process.cwd(), "src/app/app/layout.tsx"),
      "utf8",
    );
    expect(appError).toMatch(/scope="route"/);
    expect(layout).toMatch(/AppShell/);
  });
});
