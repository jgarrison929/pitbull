import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DB_POOL_MAX,
  PROXY_DB_POOL_MAX,
  dbPoolMaxFromEnv,
} from "@/db";

describe("db pool max (V5_DB_POOL_MAX)", () => {
  it("defaults to a burst-safe size when unset or invalid", () => {
    // Former app(20)+proxy(8) sum — RSC Suspense on heavy jobs; not #60's 40.
    expect(DEFAULT_DB_POOL_MAX).toBe(28);
    expect(dbPoolMaxFromEnv({})).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "0" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "-3" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "nope" })).toBe(
      DEFAULT_DB_POOL_MAX,
    );
  });

  it("honors a positive override and soft-caps typos", () => {
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "4" })).toBe(4);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "12.9" })).toBe(12);
    // Soft-cap stays well below the closed #60 thrash total (40+24).
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "999" })).toBe(40);
  });

  it("must-fail: getDb must use dbPoolMaxFromEnv and log max without secrets", () => {
    const src = readFileSync(join(process.cwd(), "src/db/index.ts"), "utf8");
    expect(src).toMatch(/const max = dbPoolMaxFromEnv\(\)/);
    expect(src).toMatch(/postgres pool max=/);
    expect(src).toMatch(/^\s*max,$/m);
    // Hard-coded max alone would ignore the env override.
    expect(src).not.toMatch(/postgres\([^)]+,\s*\{\s*max:\s*\d+/);
    // Startup log must not interpolate DATABASE_URL / userinfo.
    const logLine = src.match(/console\.info\(([^)]+)\)/);
    expect(logLine?.[1] ?? "").not.toMatch(/DATABASE_URL|password|userinfo/i);
    expect(logLine?.[1] ?? "").toMatch(/pool max=/);
  });

  it("must-fail: proxy drill-down pool uses PROXY_DB_POOL_MAX (not a stale literal 2 or #60's 24)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/PROXY_DB_POOL_MAX/);
    expect(src).toMatch(/max:\s*PROXY_DB_POOL_MAX/);
    expect(src).not.toMatch(/max:\s*2\b/);
    expect(src).not.toMatch(/max:\s*24\b/);
    expect(PROXY_DB_POOL_MAX).toBe(8);
    // App default reclaimed former stranded proxy headroom; proxy stays 8.
    expect(DEFAULT_DB_POOL_MAX).toBe(28);
    expect(DEFAULT_DB_POOL_MAX + PROXY_DB_POOL_MAX).toBe(36);
  });
});
