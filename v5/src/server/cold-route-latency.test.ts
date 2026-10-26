/**
 * Acceptance: cold-ish SSR data paths for the staging verify FAIL routes.
 *
 * Proves each listed route stays under 1.2 s p95 across 20 loads on a fresh
 * DB pool, and that demo sandbox create (login cold path) stays under 2 s
 * for 20 of 20. Does not raise the verify crawl budget or add retries.
 *
 * Routes (server data path = shell portfolio + page loaders):
 *   - login cold → createSandbox (+ first portfolio, as /app)
 *   - /app/jobs/25-031
 *   - /app/jobs/24-077/cost-items/08-200
 *   - /app/jobs/24-118/cost-items/03-200
 *   - /app/jobs/25-031/plans/<open plan>
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { getDb, resetDbClient } from "@/db";
import { companies, dailyPlans } from "@/db/schema";
import { planDateToday } from "@/lib/plan-date";
import { jobChanges } from "@/server/assistant/actions";
import { listChangeOrders } from "@/server/change-orders";
import { getCostItemPage } from "@/server/cost-item-page";
import {
  getJob,
  getJobEvControls,
  getJobPagePlans,
  getPortfolio,
} from "@/server/data";
import { getPlanPage } from "@/server/plan-page";
import { listCrews } from "@/server/plans";
import {
  draftClaimForJob,
  getApprovalPendingByCostItem,
  getReportedActualsForPlans,
} from "@/server/progress";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";

const db = getDb();

const SAMPLES = 20;
/** Acceptance p95 for SSR data path (ms). Below crawl 1.5 s after client quiet. */
const ROUTE_P95_MS = 1200;
/** Login / sandbox create must land under this every sample. */
const LOGIN_MAX_MS = 2000;
/** Rebuild the pool every N samples → cold-ish, not fully warm forever. */
const POOL_REFRESH_EVERY = 5;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

async function loadJobRoute(companyId: string, number: string) {
  const p = await getJob(companyId, number);
  if (!p) throw new Error(`missing job ${number}`);
  const todayLA = planDateToday(seedNow());
  const [portfolio, pagePlans, , , , , ,] = await Promise.all([
    getPortfolio(companyId),
    getJobPagePlans(companyId, p.job.id, todayLA),
    jobChanges(companyId, p.job.number),
    draftClaimForJob(companyId, p.job.id),
    getJobEvControls(companyId, p.job.id),
    getApprovalPendingByCostItem(companyId, p.job.id),
    listChangeOrders(companyId, p.job.number),
    listCrews(companyId),
  ]);
  const reportable = pagePlans.openPlans.filter(
    (pl) => pl.status === "issued" || pl.status === "reported",
  );
  await getReportedActualsForPlans(
    companyId,
    reportable.map((pl) => pl.id),
  );
  return { portfolioJobs: portfolio.jobs.length, open: pagePlans.openPlans.length };
}

async function loadCostItemRoute(
  companyId: string,
  job: string,
  code: string,
) {
  const [portfolio, page] = await Promise.all([
    getPortfolio(companyId),
    getCostItemPage(companyId, job, code),
  ]);
  if (!page) throw new Error(`missing cost item ${job}/${code}`);
  return { portfolioJobs: portfolio.jobs.length, code: page.item.code };
}

async function loadPlanRoute(companyId: string, job: string, planId: string) {
  const [portfolio, page] = await Promise.all([
    getPortfolio(companyId),
    getPlanPage(companyId, job, planId),
  ]);
  if (!page) throw new Error(`missing plan ${planId}`);
  return { portfolioJobs: portfolio.jobs.length, lines: page.lines.length };
}

describe.skipIf(!db)("cold-route latency acceptance (staging FAIL routes)", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  const prevLatency = process.env.V5_DB_LATENCY_MS;
  let companyId = "";
  let planId25 = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    // No artificial RTT — measure real local pool cold/warm variance.
    delete process.env.V5_DB_LATENCY_MS;
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
    const today = planDateToday(seedNow());
    // Prefer an open (today+) plan on 25-031 when present.
    const job = await getJob(companyId, "25-031");
    if (!job) throw new Error("25-031 missing");
    const pages = await getJobPagePlans(companyId, job.job.id, today);
    if (pages.openPlans[0]) {
      planId25 = pages.openPlans[0].id;
    } else {
      const [anyPlan] = await getDb()!
        .select({ id: dailyPlans.id })
        .from(dailyPlans)
        .where(eq(dailyPlans.jobId, job.job.id))
        .orderBy(asc(dailyPlans.planDate))
        .limit(1);
      planId25 = anyPlan?.id ?? "";
    }
    if (!planId25) throw new Error("no plan id for 25-031");
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

  it("login/createSandbox under 2s for 20 of 20 on a fresh pool", async () => {
    await resetDbClient();
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      if (i % POOL_REFRESH_EVERY === 0) await resetDbClient();
      const t0 = performance.now();
      const id = await createSandbox();
      created.push(id);
      // First /app hit after role-card login pays portfolio.
      await getPortfolio(id);
      samples.push(performance.now() - t0);
    }
    const over = samples.filter((ms) => ms >= LOGIN_MAX_MS);
    console.log(
      JSON.stringify(
        {
          route: "login+createSandbox+/app portfolio",
          n: samples.length,
          maxMs: Math.round(Math.max(...samples)),
          p95Ms: Math.round(percentile([...samples].sort((a, b) => a - b), 95)),
          samplesMs: samples.map((ms) => Math.round(ms)),
        },
        null,
        2,
      ),
    );
    expect(over, `${over.length} login samples ≥ ${LOGIN_MAX_MS}ms`).toHaveLength(
      0,
    );
  }, 300_000);

  it("listed routes p95 < 1.2s across 20 cold-ish loads (fresh pool)", async () => {
    await resetDbClient();
    // Warm schema/plans once after pool rebuild.
    await loadJobRoute(companyId, "25-031");

    const routes: {
      name: string;
      run: () => Promise<unknown>;
    }[] = [
      { name: "job/25-031", run: () => loadJobRoute(companyId, "25-031") },
      {
        name: "cost-item/24-077/08-200",
        run: () => loadCostItemRoute(companyId, "24-077", "08-200"),
      },
      {
        name: "cost-item/24-118/03-200",
        run: () => loadCostItemRoute(companyId, "24-118", "03-200"),
      },
      {
        name: "plan/25-031",
        run: () => loadPlanRoute(companyId, "25-031", planId25),
      },
    ];

    const report: Record<
      string,
      { p95Ms: number; maxMs: number; samplesMs: number[] }
    > = {};

    for (const route of routes) {
      const samples: number[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        if (i % POOL_REFRESH_EVERY === 0) await resetDbClient();
        const t0 = performance.now();
        await route.run();
        samples.push(performance.now() - t0);
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const p95 = percentile(sorted, 95);
      report[route.name] = {
        p95Ms: Math.round(p95),
        maxMs: Math.round(sorted.at(-1)!),
        samplesMs: samples.map((ms) => Math.round(ms)),
      };
      expect(
        p95,
        `${route.name} p95 ${p95.toFixed(1)}ms exceeds ${ROUTE_P95_MS}ms`,
      ).toBeLessThan(ROUTE_P95_MS);
    }

    console.log(JSON.stringify({ note: "cold-route acceptance", report }, null, 2));
  }, 300_000);
});
