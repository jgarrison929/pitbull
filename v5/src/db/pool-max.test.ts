import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_DB_POOL_MAX,
  PROXY_DB_POOL_MAX,
  DB_POOL_MAX_SOFT_CAP,
  dbPoolMaxFromEnv,
  getDb,
  resetDbClient,
} from "@/db";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadJobPage } from "@/server/job-page";
import { createSandbox } from "@/server/sandbox";

describe("db pool max (V5_DB_POOL_MAX)", () => {
  it("defaults when unset or invalid; honors override; soft-caps typos", () => {
    expect(dbPoolMaxFromEnv({})).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "0" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "-3" })).toBe(DEFAULT_DB_POOL_MAX);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "nope" })).toBe(
      DEFAULT_DB_POOL_MAX,
    );
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "4" })).toBe(4);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "12.9" })).toBe(12);
    expect(dbPoolMaxFromEnv({ V5_DB_POOL_MAX: "999" })).toBe(DB_POOL_MAX_SOFT_CAP);
    // Burst-safe band: enough for Suspense, well below #60 thrash (40+24).
    expect(DEFAULT_DB_POOL_MAX).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_DB_POOL_MAX).toBeLessThanOrEqual(DB_POOL_MAX_SOFT_CAP);
    expect(PROXY_DB_POOL_MAX).toBeGreaterThanOrEqual(2);
    expect(PROXY_DB_POOL_MAX).toBeLessThanOrEqual(16);
    expect(DEFAULT_DB_POOL_MAX + PROXY_DB_POOL_MAX).toBeLessThanOrEqual(48);
  });

  it("must-fail: getDb must use dbPoolMaxFromEnv and log max without secrets", () => {
    const src = readFileSync(join(process.cwd(), "src/db/index.ts"), "utf8");
    expect(src).toMatch(/const max = dbPoolMaxFromEnv\(\)/);
    expect(src).toMatch(/postgres pool max=/);
    expect(src).toMatch(/^\s*max,$/m);
    expect(src).not.toMatch(/postgres\([^)]+,\s*\{\s*max:\s*\d+/);
    const logLine = src.match(/console\.info\(([^)]+)\)/);
    expect(logLine?.[1] ?? "").not.toMatch(/DATABASE_URL|password|userinfo/i);
    expect(logLine?.[1] ?? "").toMatch(/pool max=/);
  });

  it("must-fail: proxy drill-down pool uses PROXY_DB_POOL_MAX (not a stale literal)", () => {
    const src = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(src).toMatch(/PROXY_DB_POOL_MAX/);
    expect(src).toMatch(/max:\s*PROXY_DB_POOL_MAX/);
    expect(src).not.toMatch(/max:\s*2\b/);
    expect(src).not.toMatch(/max:\s*24\b/);
  });
});

describe.skipIf(!getDb())("db pool concurrent job-page burst (behavior)", () => {
  const created: string[] = [];
  let companyId = "";

  beforeAll(async () => {
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
  }, 120_000);

  afterAll(async () => {
    const db = getDb();
    if (db) {
      for (const id of created) {
        await db.delete(companies).where(eq(companies.id, id));
      }
    }
    await resetDbClient();
  });

  it("handles 24 concurrent heavy job loads without timeout or throw", async () => {
    const jobs = ["24-077", "24-118"] as const;
    const roles = ["pm", "foreman", "superintendent", "executive"] as const;
    // 24 = 4 roles × 6 (repeat) — same concurrency as Verify's warm burst.
    const work = Array.from({ length: 24 }, (_, i) => ({
      role: roles[i % roles.length]!,
      number: jobs[i % jobs.length]!,
    }));
    const t0 = performance.now();
    const results = await Promise.all(
      work.map(async ({ role, number }) => {
        const data = await loadJobPage(companyId, number, role);
        if (!data) throw new Error(`missing ${number}`);
        return data.p.job.number;
      }),
    );
    const elapsed = performance.now() - t0;
    expect(results).toHaveLength(24);
    expect(new Set(results).size).toBe(2);
    // Wall budget: concurrent wave on local Postgres; not the browser load gate.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});
