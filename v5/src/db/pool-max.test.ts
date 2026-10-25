import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DB_POOL_MAX,
  PROXY_DB_POOL_MAX,
  dbPoolMaxFromEnv,
} from "@/db";

describe("db pool max (V5_DB_POOL_MAX)", () => {
  it("defaults to a safe size when unset or invalid", () => {
    expect(DEFAULT_DB_POOL_MAX).toBe(10);
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
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "999" })).toBe(50);
  });

  it("must-fail: getDb must use dbPoolMaxFromEnv and log max without secrets", () => {
    const src = readFileSync(join(process.cwd(), "src/db/index.ts"), "utf8");
    expect(src).toMatch(/const max = dbPoolMaxFromEnv\(\)/);
    expect(src).toMatch(/postgres pool max=/);
    expect(src).toMatch(/^\s*max,$/m);
    // Hard-coded max: 10 alone would ignore the env override.
    expect(src).not.toMatch(/postgres\(url,\s*\{\s*max:\s*10/);
    // Startup log must not interpolate DATABASE_URL / userinfo.
    const logLine = src.match(/console\.info\(([^)]+)\)/);
    expect(logLine?.[1] ?? "").not.toMatch(/DATABASE_URL|password|userinfo/i);
    expect(logLine?.[1] ?? "").toMatch(/pool max=/);
  });

  it("documents per-process ceiling vs proxy pool", () => {
    // App pool + proxy drill-down pool (proxy.ts max: 2).
    expect(PROXY_DB_POOL_MAX).toBe(2);
    expect(DEFAULT_DB_POOL_MAX + PROXY_DB_POOL_MAX).toBe(12);
  });
});
