/**
 * Job page query budget under seeded field history (30 working days / job).
 *
 * Measures the same server data path as `app/jobs/[number]/page.tsx` against
 * a DB with V5_DB_LATENCY_MS simulated RTT, and bounds plan loads so an
 * N+1 (one query per history plan) cannot return.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  getDbQueryCount,
  resetDbClient,
  resetDbQueryCount,
} from "@/db/test-hooks";
import { companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { planDateToday } from "@/lib/plan-date";
import { jobChanges } from "@/server/assistant/actions";
import { listChangeOrders } from "@/server/change-orders";
import {
  getJob,
  getJobEvControls,
  getJobPagePlans,
  getPlansForJob,
  getPortfolio,
} from "@/server/data";
import { listCrews } from "@/server/plans";
import {
  draftClaimForJob,
  getApprovalPendingByCostItem,
  getReportedActualsForPlans,
} from "@/server/progress";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import { FIELD_HISTORY_WORKING_DAYS } from "@/seed/field-history";

const db = getDb();
const JOBS = ["24-077", "25-031", "24-118"] as const;
/** Fixed query budget for plans+lines regardless of history length. */
const PLANS_QUERY_BUDGET = 2;
/** Full job-page data path under ~3ms RTT must stay under half a second. */
const PAGE_RENDER_BUDGET_MS = 500;

async function loadJobPageData(companyId: string, number: string) {
  const p = await getJob(companyId, number);
  if (!p) throw new Error(`job ${number} missing`);
  const todayLA = planDateToday(seedNow());
  // Shell JobStrip pays getPortfolio on every /app/* page — include it.
  const [
    portfolio,
    pagePlans,
    changes,
    draftClaim,
    evControls,
    approvalPending,
    coData,
    crewRows,
  ] = await Promise.all([
    getPortfolio(companyId),
    getJobPagePlans(companyId, p.job.id, todayLA),
    jobChanges(companyId, p.job.number),
    draftClaimForJob(companyId, p.job.id),
    getJobEvControls(companyId, p.job.id),
    getApprovalPendingByCostItem(companyId, p.job.id),
    listChangeOrders(companyId, p.job.number),
    listCrews(companyId),
  ]);
  const { openPlans, historyPlans } = pagePlans;
  const reportable = openPlans.filter(
    (pl) => pl.status === "issued" || pl.status === "reported",
  );
  const reportedByPlan = await getReportedActualsForPlans(
    companyId,
    reportable.map((pl) => pl.id),
  );
  const historyMh = historyPlans.reduce((s, pl) => s + pl.manHours, 0);
  return {
    p,
    portfolio,
    openPlans,
    historyPlans,
    changes,
    draftClaim,
    evControls,
    approvalPending,
    coData,
    crewRows,
    reportedByPlan,
    historyMh,
    budgetCents: p.budgetCents,
    earnedCents: p.earnedCents,
    actualCents: p.actualCents,
  };
}

describe.skipIf(!db)("job page query budget (field history)", () => {
  const created: string[] = [];
  const prevSeedNow = process.env.V5_SEED_NOW;
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
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
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

  it("baseline: counts queries and times server data load under 3ms RTT", async () => {
    const rows = [];
    for (const number of JOBS) {
      // Warm
      await loadJobPageData(companyId, number);
      const samples: number[] = [];
      let queries = 0;
      let summary: Awaited<ReturnType<typeof loadJobPageData>> | null = null;
      for (let i = 0; i < 5; i++) {
        resetDbQueryCount();
        const t0 = performance.now();
        summary = await loadJobPageData(companyId, number);
        samples.push(performance.now() - t0);
        queries = getDbQueryCount();
      }
      samples.sort((a, b) => a - b);
      rows.push({
        number,
        queries,
        open: summary!.openPlans.length,
        history: summary!.historyPlans.length,
        historyMh: summary!.historyMh,
        msP50: Math.round(samples[Math.floor(samples.length / 2)] * 100) / 100,
        msMax: Math.round(samples.at(-1)! * 100) / 100,
      });
    }
    // Printed into CI logs / copied into the PR body.
    console.log(
      JSON.stringify(
        { latencyMs: 3, note: "job page server data path", rows },
        null,
        2,
      ),
    );
    // Seeded display totals — lock history length and MH so load optimizations
    // cannot quietly drop lines or change the history rail.
    const expectedMh: Record<(typeof JOBS)[number], number> = {
      "24-077": 4992,
      "25-031": 3381.8,
      "24-118": 12088.3,
    };
    for (const row of rows) {
      expect(row.history).toBe(FIELD_HISTORY_WORKING_DAYS);
      expect(row.historyMh).toBeCloseTo(
        expectedMh[row.number as (typeof JOBS)[number]],
        1,
      );
      expect(row.msP50).toBeLessThan(PAGE_RENDER_BUDGET_MS);
    }
  });

  it("must-fail: getPlansForJob stays ≤2 queries with 30 history plans", async () => {
    const p = await getJob(companyId, "24-077");
    expect(p).not.toBeNull();
    resetDbQueryCount();
    const plans = await getPlansForJob(companyId, p!.job.id);
    const queries = getDbQueryCount();
    const history = plans.filter(
      (pl) => pl.planDate < planDateToday(seedNow()),
    );
    expect(history.length).toBe(FIELD_HISTORY_WORKING_DAYS);
    // Wrap-off would leave queries at 0 and pass ≤ budget vacuously — require work.
    expect(queries).toBeGreaterThan(0);
    // N+1 would be 1 + history (or 1 + plans) — this bound goes red if it returns.
    expect(queries).toBeLessThanOrEqual(PLANS_QUERY_BUDGET);
    expect(queries).toBeLessThan(history.length);
    // Same bound must hold for every active job (history length is the variable).
    for (const number of JOBS) {
      const job = await getJob(companyId, number);
      expect(job).not.toBeNull();
      resetDbQueryCount();
      const rows = await getPlansForJob(companyId, job!.job.id);
      const jobQueries = getDbQueryCount();
      expect(jobQueries).toBeGreaterThan(0);
      expect(jobQueries).toBeLessThanOrEqual(PLANS_QUERY_BUDGET);
      expect(
        rows.filter((pl) => pl.planDate < planDateToday(seedNow())).length,
      ).toBe(FIELD_HISTORY_WORKING_DAYS);
    }
  });

  it("getJobPagePlans history MH matches full-line sum (exact)", async () => {
    for (const number of JOBS) {
      const job = await getJob(companyId, number);
      expect(job).not.toBeNull();
      const today = planDateToday(seedNow());
      const full = await getPlansForJob(companyId, job!.job.id);
      const page = await getJobPagePlans(companyId, job!.job.id, today);
      const fullHistMh = full
        .filter((pl) => pl.planDate < today)
        .reduce(
          (s, pl) => s + pl.lines.reduce((a, l) => a + l.manHours, 0),
          0,
        );
      const pageHistMh = page.historyPlans.reduce((s, pl) => s + pl.manHours, 0);
      expect(pageHistMh).toBeCloseTo(fullHistMh, 5);
      expect(page.historyPlans.length).toBe(FIELD_HISTORY_WORKING_DAYS);
    }
  });

  it("server data load for each measured job stays under 500ms at 3ms RTT", async () => {
    for (const number of JOBS) {
      await loadJobPageData(companyId, number);
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await loadJobPageData(companyId, number);
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p50 = samples[Math.floor(samples.length / 2)]!;
      expect(
        p50,
        `${number} p50 ${p50.toFixed(1)}ms exceeds ${PAGE_RENDER_BUDGET_MS}ms`,
      ).toBeLessThan(PAGE_RENDER_BUDGET_MS);
    }
  });
});
