/**
 * Plan page query + latency budget (superintendent Part C / verify crawl).
 *
 * getPlanPage must stay at ≤3 queries in one parallel wave (header⋈job, lines,
 * history). A serial job-then-rest chain or N+1 history would blow the budget
 * under simulated RTT the same way staging saw ~1.0–1.6 s networkidle.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import {
  getDb,
  getDbQueryCount,
  resetDbClient,
  resetDbQueryCount,
} from "@/db";
import { companies, dailyPlans } from "@/db/schema";
import { planDateToday } from "@/lib/plan-date";
import { getJob, getJobPagePlans, getPortfolio } from "@/server/data";
import { getPlanPage } from "@/server/plan-page";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import { recentRuns } from "@/server/assistant/actions";
import { seedId } from "@/seed";

const db = getDb();

/** header⋈job + lines + history — fixed, not per event / per line. */
const PLAN_PAGE_QUERY_BUDGET = 3;
/**
 * Shell (portfolio) + plan + assistant rail — same server path the plan route
 * pays under Suspense. At 25 ms simulated RTT (pessimistic serial sleep), keep
 * well under half the 800 ms browser target so real overlap still has margin.
 */
const PLAN_ROUTE_BUDGET_MS = 400;
const LATENCY_MS = 25;

describe.skipIf(!db)("plan page query budget", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  const prevLatency = process.env.V5_DB_LATENCY_MS;
  let companyId = "";
  let planId = "";
  let userId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    process.env.V5_DB_LATENCY_MS = String(LATENCY_MS);
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
    userId = seedId(companyId, "user:superintendent");
    // Same Part C rotation as staging verify: labor history on 24-118.
    const job = await getJob(companyId, "24-118");
    if (!job) throw new Error("24-118 missing");
    const today = planDateToday(seedNow());
    const pages = await getJobPagePlans(companyId, job.job.id, today);
    planId = pages.historyPlans[0]?.id ?? pages.openPlans[0]?.id ?? "";
    if (!planId) {
      const [anyPlan] = await getDb()!
        .select({ id: dailyPlans.id })
        .from(dailyPlans)
        .where(eq(dailyPlans.jobId, job.job.id))
        .orderBy(asc(dailyPlans.planDate))
        .limit(1);
      planId = anyPlan?.id ?? "";
    }
    if (!planId) throw new Error("no plan on 24-118");
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

  it("must-fail: getPlanPage stays ≤3 queries (one wave)", async () => {
    await getPlanPage(companyId, "24-118", planId);
    resetDbQueryCount();
    const page = await getPlanPage(companyId, "24-118", planId);
    const queries = getDbQueryCount();
    expect(page).not.toBeNull();
    expect(page!.lines.length).toBeGreaterThan(0);
    expect(page!.history.length).toBeGreaterThan(0);
    expect(queries).toBeLessThanOrEqual(PLAN_PAGE_QUERY_BUDGET);
    // Guard against unbounded per-event reads.
    expect(queries).toBeLessThan(page!.history.length + page!.lines.length);
  });

  it("getPlanPage source overlaps header/lines/history (no serial job await)", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./plan-page.ts", import.meta.url), "utf8"),
    );
    // Old shape: await job lookup, then Promise.all(plan, lines, history).
    expect(src).not.toMatch(
      /const \[job\] = await db[\s\S]*Promise\.all\(\[/,
    );
    expect(src).toMatch(/Promise\.all\(\[/);
    expect(src).toMatch(/innerJoin\(jobs/);
  });

  it(`plan route server path p50 < ${PLAN_ROUTE_BUDGET_MS}ms at ${LATENCY_MS}ms RTT`, async () => {
    // Warm once.
    await Promise.all([
      getPortfolio(companyId),
      getPlanPage(companyId, "24-118", planId),
      recentRuns({ companyId, userId }),
    ]);

    const samples: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      await Promise.all([
        getPortfolio(companyId),
        getPlanPage(companyId, "24-118", planId),
        recentRuns({ companyId, userId }),
      ]);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length / 2)]!;
    console.log(
      JSON.stringify(
        {
          note: "plan route shell+page+rail (simulated RTT)",
          latencyMs: LATENCY_MS,
          budgetMs: PLAN_ROUTE_BUDGET_MS,
          p50Ms: Math.round(p50),
          samplesMs: samples.map((ms) => Math.round(ms)),
        },
        null,
        2,
      ),
    );
    expect(p50).toBeLessThan(PLAN_ROUTE_BUDGET_MS);
  });
});
