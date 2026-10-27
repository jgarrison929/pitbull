/**
 * Cost-item TTFB / pool acceptance (staging server-tail FAIL).
 *
 * HTTP burst numbers live in scripts/cost-item-ttfb-burst.mjs (production
 * build). This file locks the shared pool defaults and a warm server path
 * budget so a regression to tiny pools / serial cost-item loads goes red.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  DEFAULT_DB_POOL_MAX,
  PROXY_DB_POOL_MAX,
  getDb,
  getDbQueryCount,
  resetDbClient,
  resetDbQueryCount,
} from "@/db";
import { companies } from "@/db/schema";
import { getCostItemPage } from "@/server/cost-item-page";
import { getPortfolio } from "@/server/data";
import { createSandbox } from "@/server/sandbox";
import { recentRuns } from "@/server/assistant/actions";
import { seedId } from "@/seed";

const db = getDb();
const COST = { job: "24-077", code: "07-150" } as const;
const LATENCY_MS = 15;
/** Shell + page + rail under simulated RTT — well under 200 ms TTFB target. */
const ROUTE_P50_MS = 200;

describe.skipIf(!db)("cost-item TTFB budget", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  const prevLatency = process.env.V5_DB_LATENCY_MS;
  let companyId = "";
  let userId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    process.env.V5_DB_LATENCY_MS = String(LATENCY_MS);
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
    userId = seedId(companyId, "user:foreman");
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    if (prevLatency === undefined) delete process.env.V5_DB_LATENCY_MS;
    else process.env.V5_DB_LATENCY_MS = prevLatency;
    const client = getDb();
    if (client) {
      for (const id of created) {
        await client.delete(companies).where(eq(companies.id, id));
      }
    }
    await resetDbClient();
  });

  it("pool defaults stay modest (oversized pools regress TTFB tails)", () => {
    // Verify #60: max=40/24 raised Phase A foreman TTFB max vs main’s 20/8.
    expect(DEFAULT_DB_POOL_MAX).toBe(20);
    expect(PROXY_DB_POOL_MAX).toBe(8);
    expect(DEFAULT_DB_POOL_MAX + PROXY_DB_POOL_MAX).toBe(28);
  });

  it("getCostItemPage stays ≤2 queries on 07-150", async () => {
    await getCostItemPage(companyId, COST.job, COST.code);
    resetDbQueryCount();
    const page = await getCostItemPage(companyId, COST.job, COST.code);
    expect(page).not.toBeNull();
    expect(getDbQueryCount()).toBeLessThanOrEqual(2);
  });

  it(`shell+cost-item+rail p50 < ${ROUTE_P50_MS}ms at ${LATENCY_MS}ms RTT`, async () => {
    await Promise.all([
      getPortfolio(companyId),
      getCostItemPage(companyId, COST.job, COST.code),
      recentRuns({ companyId, userId }),
    ]);
    const samples: number[] = [];
    for (let i = 0; i < 9; i++) {
      const t0 = performance.now();
      await Promise.all([
        getPortfolio(companyId),
        getCostItemPage(companyId, COST.job, COST.code),
        recentRuns({ companyId, userId }),
      ]);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)]!;
    console.log(
      JSON.stringify(
        {
          note: "cost-item shell+page+rail",
          latencyMs: LATENCY_MS,
          p50Ms: Math.round(p50),
          samplesMs: samples.map((ms) => Math.round(ms)),
          targetP50Ms: ROUTE_P50_MS,
        },
        null,
        2,
      ),
    );
    expect(p50).toBeLessThan(ROUTE_P50_MS);
  });
});
