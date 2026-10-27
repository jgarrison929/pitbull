#!/usr/bin/env node
/**
 * Measures Outcome 3 budgets against a stress-seeded 10k-leaf job:
 *   - SQL roll-up (leaf sums) p95 target < 500ms
 *   - cost-code search SQL p95 target < 300ms
 *   - concurrent HTTP search at 5 and 10 users (requires BASE_URL + COOKIE)
 *   - job page HTTP TTFB (optional; set BASE_URL + COOKIE) — never reported
 *     as a pass from the DB-hydrate proxy alone
 *
 * Usage:
 *   DATABASE_URL=... npm run perf:cost-codes
 *   DATABASE_URL=... BASE_URL=... COOKIE=... TIMED_JOB_PATH=/app/jobs/99-010 npm run perf:cost-codes
 */
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import postgres from "postgres";
import { parsePostgresUrl } from "../src/db/database-url.ts";
import { redactDbEnsureError } from "./db-ensure.mjs";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const parsedUrl = parsePostgresUrl(rawUrl);
if (!parsedUrl) {
  console.error("DATABASE_URL is not a usable Postgres URL");
  process.exit(1);
}
const url = parsedUrl.connectionString;

const LEAF_COUNT = 10_000;
const STRESS_JOB_NUMBER = "99-010";
const SEARCH_P95_LIMIT_MS = 300;
const ROLLUP_P95_LIMIT_MS = 500;
const JOB_TTFB_P95_LIMIT_MS = 2000;

function seedId(companyId, key) {
  const h = createHash("sha256").update(`${companyId}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[i];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: Math.round(percentile(sorted, 50) * 100) / 100,
    p95: Math.round(percentile(sorted, 95) * 100) / 100,
    max: Math.round(sorted.at(-1) * 100) / 100,
  };
}

/** Fire `total` requests with at most `concurrency` in flight. */
async function runConcurrent(total, concurrency, fn) {
  const samples = [];
  let next = 0;
  async function worker() {
    while (next < total) {
      const i = next++;
      const t0 = performance.now();
      await fn(i);
      samples.push(performance.now() - t0);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => worker()),
  );
  return samples;
}

async function main() {
  const sql = postgres(url, { max: 5, onnotice: () => {} });
  const companyId = randomUUID();
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  const jobId = seedId(companyId, "job:stress");
  const start = iso(addDays(today, -100));
  const finish = iso(addDays(today, 100));

  console.log("seeding stress company…");
  const tSeed0 = performance.now();
  await sql`insert into companies (id, name, is_sandbox, seeded_at) values (${companyId}, ${"Perf Stress Co"}, true, ${today})`;
  await sql`
    insert into jobs (id, company_id, number, name, short_name, owner, pm_name, finish_on, contract_cents, estimate_status)
    values (${jobId}, ${companyId}, ${STRESS_JOB_NUMBER}, ${"Stress WBS — 10k cost codes"}, ${"Stress 10k"}, ${"Internal"}, ${"Perf"}, ${iso(addDays(today, 200))}, ${5_000_000_000}, ${"approved"})`;

  const rows = [];
  for (let d = 0; d < 10; d++) {
    const divCode = String(d + 1).padStart(2, "0");
    const divId = seedId(companyId, `stress:div:${divCode}`);
    const divPath = `/${divCode}/`;
    rows.push({
      id: divId,
      parent_id: null,
      path: divPath,
      depth: 0,
      is_leaf: false,
      code: divCode,
      description: `Division ${divCode}`,
      budget_cents: 0,
      claimed: 0,
      installed: 0,
      qty: 0,
    });
    for (let g = 0; g < 10; g++) {
      const groupCode = `${divCode}-${String(g + 1).padStart(2, "0")}`;
      const groupId = seedId(companyId, `stress:grp:${groupCode}`);
      const groupPath = `${divPath}${groupCode}/`;
      rows.push({
        id: groupId,
        parent_id: divId,
        path: groupPath,
        depth: 1,
        is_leaf: false,
        code: groupCode,
        description: `Group ${groupCode}`,
        budget_cents: 0,
        claimed: 0,
        installed: 0,
        qty: 0,
      });
      for (let L = 0; L < 100; L++) {
        const leafCode = `${groupCode}-${String(L + 1).padStart(3, "0")}`;
        const leafId = seedId(companyId, `stress:leaf:${leafCode}`);
        const budget = 10000 + ((d * 1000 + g * 100 + L) % 500) * 100;
        const claimed = (L * 7 + g * 3 + d) % 1000;
        rows.push({
          id: leafId,
          parent_id: groupId,
          path: `${groupPath}${leafCode}/`,
          depth: 2,
          is_leaf: true,
          code: leafCode,
          description: `Leaf ${leafCode} activity`,
          budget_cents: budget,
          claimed,
          installed: claimed * 1000,
          qty: 1_000_000,
        });
      }
    }
  }

  // Current Budget = labor plug of the legacy total (cb_*); EV reads sum of cb_*.
  const cbSql = `(cb_labor_cents + cb_material_cents + cb_equipment_cents + cb_sub_cents)`;

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await sql.begin(async (tx) => {
      for (const c of chunk) {
        await tx`
          insert into cost_items (
            id, company_id, job_id, parent_id, path, depth, is_leaf,
            code, description, unit, ev_method,
            budget_qty_milli, installed_qty_milli, claimed_installed_qty_milli,
            ob_labor_cents, ob_material_cents, ob_equipment_cents, ob_sub_cents,
            cb_labor_cents, cb_material_cents, cb_equipment_cents, cb_sub_cents,
            ce_labor_cents, ce_material_cents, ce_equipment_cents, ce_sub_cents,
            planned_start_on, planned_finish_on, planned_cents, actual_cents,
            claimed_percent_milli, earn_derivation, budget_mh_per_unit_milli
          ) values (
            ${c.id}, ${companyId}, ${jobId}, ${c.parent_id}, ${c.path}, ${c.depth}, ${c.is_leaf},
            ${c.code}, ${c.description}, ${"CY"}, ${"units"},
            ${c.qty}, ${c.installed}, ${c.installed},
            ${c.budget_cents}, 0, 0, 0,
            ${c.budget_cents}, 0, 0, 0,
            ${c.budget_cents}, 0, 0, 0,
            ${start}, ${finish}, ${Math.round(c.budget_cents / 2)},
            ${Math.round((c.budget_cents * c.claimed) / 1000 / 0.95)},
            ${c.claimed}, ${"stress"}, ${0}
          )`;
      }
    });
  }

  const seedMs = performance.now() - tSeed0;
  const [{ leaves }] = await sql`
    select count(*)::int as leaves from cost_items where job_id = ${jobId} and is_leaf = true`;
  console.log(
    `seeded ${leaves} leaves in ${seedMs.toFixed(0)}ms (expect ${LEAF_COUNT})`,
  );

  const rollSamples = [];
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    await sql.unsafe(`
      select
        coalesce(sum${cbSql}, 0)::bigint,
        coalesce(sum(
          case
            when ev_method = 'units' and budget_qty_milli > 0
              then (${cbSql} * claimed_installed_qty_milli) / budget_qty_milli
            else (${cbSql} * claimed_percent_milli) / 1000
          end
        ), 0)::bigint,
        coalesce(sum(actual_cents), 0)::bigint,
        coalesce(sum(planned_cents), 0)::bigint
      from cost_items
      where job_id = '${jobId}' and is_leaf = true`);
    rollSamples.push(performance.now() - t0);
  }

  const searchSamples = [];
  const queries = [
    "01-01-001",
    "Leaf 05",
    "Division",
    "99-999",
    "activity",
    "02-03",
  ];
  for (let i = 0; i < 40; i++) {
    const q = `%${queries[i % queries.length].replace(/[%_]/g, "")}%`;
    const t0 = performance.now();
    // Fixed path: resolve job id, then leaf search — never select * from cost_items.
    await sql`select id from jobs where company_id = ${companyId} and number = ${STRESS_JOB_NUMBER} limit 1`;
    await sql`
      select id, code, description, unit
      from cost_items
      where job_id = ${jobId} and is_leaf = true
        and (code ilike ${q} or description ilike ${q})
      order by code
      limit 20`;
    searchSamples.push(performance.now() - t0);
  }

  // Job page server work: load all WBS rows (ordered by path) + leaf roll-up.
  // Reported as jobHydrate only — never as a job-page TTFB pass.
  const hydrateSamples = [];
  for (let i = 0; i < 15; i++) {
    const t0 = performance.now();
    await sql`
      select * from cost_items where job_id = ${jobId} order by path`;
    await sql.unsafe(`
      select
        coalesce(sum${cbSql}, 0)::bigint,
        coalesce(sum(
          case
            when ev_method = 'units' and budget_qty_milli > 0
              then (${cbSql} * claimed_installed_qty_milli) / budget_qty_milli
            else (${cbSql} * claimed_percent_milli) / 1000
          end
        ), 0)::bigint,
        coalesce(sum(actual_cents), 0)::bigint,
        coalesce(sum(planned_cents), 0)::bigint
      from cost_items
      where job_id = '${jobId}' and is_leaf = true`);
    hydrateSamples.push(performance.now() - t0);
  }

  const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") || null;
  const cookie = process.env.COOKIE || null;
  const jobPath =
    process.env.TIMED_JOB_PATH ?? `/app/jobs/${STRESS_JOB_NUMBER}`;
  const searchPath =
    process.env.TIMED_SEARCH_PATH ??
    `${jobPath}/cost-items/search?q=01-01&limit=20`;

  let jobPageHttp = null;
  let searchHttp = null;

  if (baseUrl && cookie) {
    const headers = { cookie };

    const jobSamples = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}${jobPath}`, {
        headers,
        redirect: "manual",
      });
      await res.arrayBuffer();
      jobSamples.push(performance.now() - t0);
    }
    jobPageHttp = {
      fullBody: summarize(jobSamples),
      note: "HTTP full body round-trip; TTFB alone is the static shell and is not a gate",
    };

    const serial = [];
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}${searchPath}`, {
        headers,
        redirect: "manual",
      });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      await res.json();
      serial.push(performance.now() - t0);
    }

    const c5 = await runConcurrent(100, 5, async () => {
      const res = await fetch(`${baseUrl}${searchPath}`, {
        headers,
        redirect: "manual",
      });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      await res.json();
    });
    const c10 = await runConcurrent(200, 10, async () => {
      const res = await fetch(`${baseUrl}${searchPath}`, {
        headers,
        redirect: "manual",
      });
      if (!res.ok) throw new Error(`search HTTP ${res.status}`);
      await res.json();
    });

    searchHttp = {
      serial: summarize(serial),
      concurrent5: summarize(c5),
      concurrent10: summarize(c10),
      limitMs: SEARCH_P95_LIMIT_MS,
      pass: {
        serial: summarize(serial).p95 < SEARCH_P95_LIMIT_MS,
        concurrent5: summarize(c5).p95 < SEARCH_P95_LIMIT_MS,
        concurrent10: summarize(c10).p95 < SEARCH_P95_LIMIT_MS,
      },
    };
  }

  const rollup = summarize(rollSamples);
  const searchSql = summarize(searchSamples);
  const hydrate = summarize(hydrateSamples);

  const report = {
    leaves,
    seedMs: Math.round(seedMs),
    rollupMs: rollup,
    searchSqlMs: searchSql,
    jobHydrateMs: hydrate,
    jobPageHttp,
    searchHttp,
    budgets: {
      rollupP95: ROLLUP_P95_LIMIT_MS,
      searchP95: SEARCH_P95_LIMIT_MS,
      jobPageTtfbP95: JOB_TTFB_P95_LIMIT_MS,
    },
    pass: {
      rollup: rollup.p95 < ROLLUP_P95_LIMIT_MS,
      searchSql: searchSql.p95 < SEARCH_P95_LIMIT_MS,
      // Only pass/fail TTFB when HTTP was measured — hydrate is not a TTFB proxy.
      jobPageTtfb:
        jobPageHttp === null
          ? "not measured"
          : jobPageHttp.fullBody.p95 < JOB_TTFB_P95_LIMIT_MS,
      searchHttp:
        searchHttp === null
          ? "not measured"
          : searchHttp.pass.serial &&
            searchHttp.pass.concurrent5 &&
            searchHttp.pass.concurrent10,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await sql`delete from companies where id = ${companyId}`;
  await sql.end();

  const failed =
    !report.pass.rollup ||
    !report.pass.searchSql ||
    report.pass.jobPageTtfb === false ||
    report.pass.searchHttp === false;
  process.exit(failed ? 2 : 0);
}

main().catch((err) => {
  console.error(`perf:cost-codes failed: ${redactDbEnsureError(err)}`);
  process.exit(1);
});
