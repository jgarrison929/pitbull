/**
 * Deployed-like phase breakdown for /app/jobs/24-077.
 * Run with DATABASE_URL pointed at the latency proxy and BASE_URL at `npm start`.
 *
 *   DATABASE_URL=postgres://…@127.0.0.1:65432/pcs_v5 \\
 *   BASE_URL=http://127.0.0.1:3001 \\
 *   npx vitest run src/server/job-page-profile.test.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { classifyDatabaseUrl, getDb } from "@/db";
import {
  getDbQueryCount,
  resetDbClient,
  resetDbQueryCount,
} from "@/db/test-hooks";
import { companies, sessions } from "@/db/schema";
import { calendarDateInTz } from "@/lib/plan-date";
import { seedId } from "@/seed";
import { jobChanges, recentRuns } from "@/server/assistant/actions";
import { listChangeOrders } from "@/server/change-orders";
import { getCostItemPage } from "@/server/cost-item-page";
import {
  getJob,
  getJobEvControls,
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
import postgres from "postgres";

const db = getDb();
const JOB = "24-077";
/** Resolved at runtime — vitest can load the module before shell env is visible. */
function baseUrl() {
  // Prefer PROFILE_BASE_URL — Next/tooling sometimes sets BASE_URL to "/".
  const raw =
    process.env.PROFILE_BASE_URL ||
    (process.env.BASE_URL?.startsWith("http") ? process.env.BASE_URL : "");
  return raw.replace(/\/$/, "");
}
function databaseUrl() {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL is required");
  return u;
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

describe.skipIf(
  !db ||
    !(
      process.env.PROFILE_BASE_URL ||
      process.env.BASE_URL?.startsWith("http")
    ),
)("job page production profile", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let userId = "";
  let token = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    await resetDbClient();
    companyId = await createSandbox();
    created.push(companyId);
    userId = seedId(companyId, "user:superintendent");
    token = randomBytes(32).toString("base64url");
    // getDb() after resetDbClient — module-level `db` may be a closed pool.
    await getDb()!.insert(sessions).values({
      id: hash(token),
      userId,
      companyId,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    const client = getDb();
    if (client && created.length) {
      for (const id of created) {
        await client.delete(companies).where(eq(companies.id, id));
      }
    }
    await resetDbClient();
  });

  it("prints per-phase breakdown for 24-077", async () => {
    // Legacy proxy path: new connection + 2 queries + end (before this PR).
    const proxyChurnSamples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const client = postgres(databaseUrl(), {
        max: 1,
        idle_timeout: 5,
        connect_timeout: 5,
      });
      try {
        const rows = await client<{ company_id: string }[]>`
          select company_id from sessions
          where id = ${hash(token)} and expires_at > now()
          limit 1`;
        const cid = rows[0]!.company_id;
        const jobs = await client`
          select id from jobs
          where company_id = ${cid} and number = ${JOB}
          limit 1`;
        expect(jobs[0]).toBeTruthy();
      } finally {
        await client.end({ timeout: 1 });
      }
      proxyChurnSamples.push(Math.round((performance.now() - t0) * 100) / 100);
    }

    // Fixed proxy path: warm pool + one join query.
    const warm = postgres(databaseUrl(), {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 5,
    });
    // Prime the pool.
    await warm`select 1`;
    const proxyWarmSamples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const rows = await warm<{ job_id: string }[]>`
        select j.id as job_id
        from sessions s
        inner join jobs j on j.company_id = s.company_id
        where s.id = ${hash(token)}
          and s.expires_at > now()
          and j.number = ${JOB}
        limit 1`;
      expect(rows[0]?.job_id).toBeTruthy();
      proxyWarmSamples.push(Math.round((performance.now() - t0) * 100) / 100);
    }
    await warm.end({ timeout: 1 });

    async function serverWork() {
      resetDbQueryCount();
      const t0 = performance.now();
      const phases: Record<string, number> = {};

      let t = performance.now();
      const p = await getJob(companyId, JOB);
      phases.getJobMs = Math.round((performance.now() - t) * 100) / 100;
      expect(p).not.toBeNull();

      t = performance.now();
      const [plans, , , , , ,] = await Promise.all([
        getPlansForJob(companyId, p!.job.id),
        jobChanges(companyId, p!.job.number),
        draftClaimForJob(companyId, p!.job.id),
        getJobEvControls(companyId, p!.job.id),
        getApprovalPendingByCostItem(companyId, p!.job.id),
        listChangeOrders(companyId, p!.job.number),
        listCrews(companyId),
      ]);
      phases.pageParallelMs = Math.round((performance.now() - t) * 100) / 100;

      const todayLA = calendarDateInTz(seedNow());
      const openPlans = plans.filter((pl) => pl.planDate >= todayLA);
      const historyPlans = plans.filter((pl) => pl.planDate < todayLA);
      const reportable = openPlans.filter(
        (pl) => pl.status === "issued" || pl.status === "reported",
      );

      t = performance.now();
      await getReportedActualsForPlans(
        companyId,
        reportable.map((pl) => pl.id),
      );
      phases.reportedActualsMs =
        Math.round((performance.now() - t) * 100) / 100;

      t = performance.now();
      await getPortfolio(companyId);
      phases.portfolioMs = Math.round((performance.now() - t) * 100) / 100;

      t = performance.now();
      await recentRuns({ companyId, userId });
      phases.assistantMs = Math.round((performance.now() - t) * 100) / 100;

      return {
        totalMs: Math.round((performance.now() - t0) * 100) / 100,
        queries: getDbQueryCount(),
        phases,
        history: historyPlans.length,
        historyMh: historyPlans.reduce(
          (s, pl) => s + pl.lines.reduce((a, l) => a + l.manHours, 0),
          0,
        ),
        nodes: p!.items.length,
      };
    }

    await serverWork();
    const dataSamples: Awaited<ReturnType<typeof serverWork>>[] = [];
    for (let i = 0; i < 5; i++) dataSamples.push(await serverWork());

    const cookie = `pcs_session=${token}`;
    const httpSamples = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl()}/app/jobs/${JOB}`, {
        headers: { cookie, accept: "text/html" },
        redirect: "manual",
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const html = buf.toString("utf8");
      httpSamples.push({
        status: res.status,
        totalMs: Math.round((performance.now() - t0) * 100) / 100,
        bytes: buf.length,
        historyRows: (html.match(/data-testid="plan-history-row"/g) ?? [])
          .length,
        hasPlanHistory: html.includes('data-testid="plan-history"'),
      });
    }

    const p50 = <T extends number>(xs: T[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)]!;
    };

    const report = {
      latencyProxy: databaseUrl().includes(":65432"),
      baseUrl: baseUrl(),
      job: JOB,
      proxyBeforeMs: {
        samples: proxyChurnSamples,
        p50: p50(proxyChurnSamples),
        note: "legacy: new postgres() + session + job + end() per request",
      },
      proxyAfterMs: {
        samples: proxyWarmSamples,
        p50: p50(proxyWarmSamples),
        note: "fixed: warm pool + one session⋈job query",
      },
      serverDataPath: {
        samplesMs: dataSamples.map((d) => d.totalMs),
        p50Ms: p50(dataSamples.map((d) => d.totalMs)),
        queriesP50: p50(dataSamples.map((d) => d.queries)),
        phasesP50: Object.fromEntries(
          Object.keys(dataSamples[0]!.phases).map((k) => [
            k,
            p50(dataSamples.map((d) => d.phases[k]!)),
          ]),
        ),
        history: dataSamples[0]!.history,
        historyMh: dataSamples[0]!.historyMh,
        nodes: dataSamples[0]!.nodes,
      },
      http: {
        coldMs: httpSamples[0]!.totalMs,
        warmSamplesMs: httpSamples.slice(1).map((h) => h.totalMs),
        warmP50Ms: p50(httpSamples.slice(1).map((h) => h.totalMs)),
        bytesP50: p50(httpSamples.map((h) => h.bytes)),
        status: httpSamples[0]!.status,
        historyRows: httpSamples[0]!.historyRows,
      },
      unexplainedWarmMs:
        Math.round(
          (p50(httpSamples.slice(1).map((h) => h.totalMs)) -
            p50(dataSamples.map((d) => d.totalMs)) -
            p50(proxyWarmSamples)) *
            100,
        ) / 100,
    };

    // --- Cost-item drill-down (24-077 / 09-100) ---
    const ITEM = "09-100";
    async function itemWork() {
      resetDbQueryCount();
      const t0 = performance.now();
      const page = await getCostItemPage(companyId, JOB, ITEM);
      return {
        totalMs: Math.round((performance.now() - t0) * 100) / 100,
        queries: getDbQueryCount(),
        entries: page?.entries.length ?? 0,
        postedTotalCents: page?.postedTotalCents ?? null,
        rollupAc: page?.rollup.actualCents ?? null,
      };
    }
    await itemWork();
    const itemSamples: Awaited<ReturnType<typeof itemWork>>[] = [];
    for (let i = 0; i < 5; i++) itemSamples.push(await itemWork());

    const itemHttp = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = await fetch(
        `${baseUrl()}/app/jobs/${JOB}/cost-items/${encodeURIComponent(ITEM)}`,
        { headers: { cookie, accept: "text/html" }, redirect: "manual" },
      );
      const buf = Buffer.from(await res.arrayBuffer());
      itemHttp.push({
        status: res.status,
        totalMs: Math.round((performance.now() - t0) * 100) / 100,
        bytes: buf.length,
        hasLabor: buf.toString("utf8").includes('data-testid="cost-entry-labor"'),
      });
    }

    const full = {
      ...report,
      dbNetwork: classifyDatabaseUrl(databaseUrl()),
      costItem: {
        code: ITEM,
        serverDataPath: {
          samplesMs: itemSamples.map((d) => d.totalMs),
          p50Ms: p50(itemSamples.map((d) => d.totalMs)),
          queriesP50: p50(itemSamples.map((d) => d.queries)),
          entries: itemSamples[0]!.entries,
          postedTotalCents: itemSamples[0]!.postedTotalCents,
          rollupAc: itemSamples[0]!.rollupAc,
        },
        http: {
          coldMs: itemHttp[0]!.totalMs,
          warmP50Ms: p50(itemHttp.slice(1).map((h) => h.totalMs)),
          bytesP50: p50(itemHttp.map((h) => h.bytes)),
          status: itemHttp[0]!.status,
          hasLabor: itemHttp[0]!.hasLabor,
        },
      },
    };

    console.log(JSON.stringify(full, null, 2));
    expect(report.http.status).toBe(200);
    expect(report.http.historyRows).toBe(30);
    expect(report.serverDataPath.history).toBe(30);
    expect(full.costItem.http.status).toBe(200);
    expect(full.costItem.serverDataPath.postedTotalCents).toBe(
      full.costItem.serverDataPath.rollupAc,
    );
    expect(full.costItem.serverDataPath.queriesP50).toBeLessThanOrEqual(5);
  }, 120_000);
});
