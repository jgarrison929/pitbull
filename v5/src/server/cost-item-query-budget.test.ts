/**
 * Cost-item drill-down query budget (Part C pages).
 * Bounds getCostItemPage so serial N+1 / duplicate lock lookups go red.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  getDb,
  getDbQueryCount,
  resetDbClient,
  resetDbQueryCount,
} from "@/db";
import { companies } from "@/db/schema";
import { getCostItemPage } from "@/server/cost-item-page";
import { createSandbox } from "@/server/sandbox";

const db = getDb();

/** job⋈item⋈lock + entries — rollup/MH derived in JS (Verify #60 pool tail). */
const COST_ITEM_QUERY_BUDGET = 2;

describe.skipIf(!db)("cost item page query budget", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  const prevLatency = process.env.V5_DB_LATENCY_MS;
  let companyId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    process.env.V5_DB_LATENCY_MS = "3";
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    if (prevLatency === undefined) delete process.env.V5_DB_LATENCY_MS;
    else process.env.V5_DB_LATENCY_MS = prevLatency;
    const client = getDb();
    if (client && created.length) {
      for (const id of created) {
        await client.delete(companies).where(eq(companies.id, id));
      }
    }
    await resetDbClient();
  });

  it("must-fail: getCostItemPage stays ≤2 queries with many history entries", async () => {
    // 25-031 / 04-210 has 30 days of labor rows — N+1 would be ≫ 2.
    await getCostItemPage(companyId, "25-031", "04-210");
    resetDbQueryCount();
    const page = await getCostItemPage(companyId, "25-031", "04-210");
    const queries = getDbQueryCount();
    expect(page).not.toBeNull();
    expect(page!.item.code).toBe("04-210");
    expect(page!.entries.length).toBeGreaterThan(10);
    expect(queries).toBeLessThanOrEqual(COST_ITEM_QUERY_BUDGET);
    expect(queries).toBeLessThan(page!.entries.length);
  });

  it("must-fail: cost-item-page must not call pathRollupSql / laborMhMilliByLock", () => {
    const src = readFileSync(
      join(process.cwd(), "src/server/cost-item-page.ts"),
      "utf8",
    );
    // entryInLockSnapshot from cost-rollups is fine; the two extra DB round-trips are not.
    expect(src).not.toMatch(/\bpathRollupSql\b/);
    expect(src).not.toMatch(/\blaborMhMilliByLock\b/);
  });

  it("server data load under 500ms at 3ms RTT for 24-077 / 09-100", async () => {
    await getCostItemPage(companyId, "24-077", "09-100");
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      await getCostItemPage(companyId, "24-077", "09-100");
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)]!;
    expect(p50).toBeLessThan(500);
  });

  it("keeps posted totals equal to path rollup AC", async () => {
    const page = await getCostItemPage(companyId, "24-077", "09-100");
    expect(page).not.toBeNull();
    expect(page!.postedTotalCents).toBe(page!.rollup.actualCents);
    expect(page!.entriesTotalCents).toBe(page!.rollup.actualCents);
  });
});
