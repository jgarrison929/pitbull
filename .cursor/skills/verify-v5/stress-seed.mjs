#!/usr/bin/env node
// Stress-seed check: against a v5 server started with V5_SEED_STRESS=1, sign in by role card (which
// seeds a fresh sandbox through the real createSandbox path) and read Postgres: the sign-in must land on
// /app with no 5xx, the new sandbox must hold the stress job and "Stress Crew", and no daily_plans.crew_id
// anywhere may reference a missing crew. Evaluation is evaluateStressSeed in checks.mjs.
// The new sandbox is deleted afterwards. run-local-browser.sh runs this (CI skill smoke and local).
// DATABASE_URL is parsed with parsePostgresUrl (db-url.mjs, same approach as v5/src/db/database-url.ts):
// postgres() only ever gets the percent-encoded connection string, so a password with / ? # @ % works,
// and every line this script prints or writes is redacted (no URL, user info or password, ever).
// Usage: DATABASE_URL=… node .cursor/skills/verify-v5/stress-seed.mjs --url http://localhost:3101 [--out file.json]
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { evaluateStressSeed, STRESS_JOB_NUMBER } from "./checks.mjs";
import { signInRole } from "./crawl.mjs";
import { parsePostgresUrl } from "./db-url.mjs";
import { redactText, safeJson, secretValues } from "./evidence.mjs";
import { isLocalUrl, isLocalDbUrl } from "./target-guard.mjs";

const SECRETS = secretValues(process.env);
const safe = (x) => redactText(x, SECRETS);
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (error) => {
    console.error(`FAIL stress seed (V5_SEED_STRESS=1): crashed: ${safe(String(error?.message ?? error).split("\n")[0]).slice(0, 300)}`);
    process.exit(1);
  });
}

const { values: args } = parseArgs({ options: { url: { type: "string" }, out: { type: "string" } } });
if (!args.url || !process.env.DATABASE_URL) {
  console.error("usage: DATABASE_URL=… node stress-seed.mjs --url http://localhost:<port> [--out file.json]");
  process.exit(2);
}
// Local only (target-guard.mjs): this tool never runs against staging or production.
if (!isLocalUrl(args.url)) {
  console.error(`refused: ${args.url} is not localhost; this tool runs only against a local app`);
  process.exit(2);
}
if (process.env.DATABASE_URL && !isLocalDbUrl(process.env.DATABASE_URL)) {
  console.error("refused: DATABASE_URL is not a local database (host not shown); this tool runs only against a local DB");
  process.exit(2);
}
const db = parsePostgresUrl(process.env.DATABASE_URL);
if (!db) {
  console.error("FAIL stress seed (V5_SEED_STRESS=1): DATABASE_URL is not a usable postgres:// URL (value not shown)");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");
const postgres = require("postgres");

const base = args.url.replace(/\/$/, "");
const sql = postgres(db.connectionString, { max: 1, onnotice: () => {} });
const observed = { http5xx: [] };
let newIds = [];
try {
  const before = new Set((await sql`select id from companies`).map((r) => r.id));
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    page.on("response", (r) => {
      if (r.status() >= 500 && r.url().startsWith(base)) observed.http5xx.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().slice(base.length)}`);
    });
    try {
      await signInRole(page, base, "pm", 60_000);
    } catch (e) {
      observed.error = safe(String(e?.message ?? e).split("\n")[0]).slice(0, 200);
    }
    observed.landedOn = page.url().startsWith(base) ? page.url().slice(base.length) : page.url();
  } finally {
    await browser.close();
  }
  newIds = (await sql`select id from companies`).map((r) => r.id).filter((id) => !before.has(id));
  observed.newSandboxes = newIds.length;
  const [o] = await sql`
    select count(*)::int as n from daily_plans p
    where p.crew_id is not null and not exists (select 1 from crews c where c.id = p.crew_id)`;
  observed.orphanPlans = o.n;
  if (newIds.length === 1) {
    const [r] = await sql`
      select
        (select count(*)::int from jobs where company_id = ${newIds[0]} and number = ${STRESS_JOB_NUMBER}) as jobs,
        (select count(*)::int from crews where company_id = ${newIds[0]} and name = 'Stress Crew') as crews,
        (select count(*)::int from daily_plans p join crews c on c.id = p.crew_id
           where p.company_id = ${newIds[0]} and c.name = 'Stress Crew') as plans`;
    Object.assign(observed, { stressJobs: r.jobs, stressCrews: r.crews, stressPlansOnStressCrew: r.plans });
  } else if (!observed.error) {
    observed.error = `expected 1 new sandbox after sign-in, found ${newIds.length}`;
  }
} catch (e) {
  observed.error ??= safe(String(e?.message ?? e)).slice(0, 200);
} finally {
  for (const id of newIds) await sql`delete from companies where id = ${id}`.catch(() => {});
  await sql.end({ timeout: 5 }).catch(() => {});
}
const failures = evaluateStressSeed(observed);
const result = { url: base, observed, failures, passed: failures.length === 0 };
if (args.out) writeFileSync(args.out, safeJson(result, SECRETS) + "\n");
console.log(safe(`${failures.length ? "FAIL" : "PASS"} stress seed (V5_SEED_STRESS=1): ${failures.length ? failures.join("; ") : `sign-in → ${observed.landedOn}, stress job ${STRESS_JOB_NUMBER} 1, Stress Crew 1, stress plans on it ${observed.stressPlansOnStressCrew}, orphan crew_id 0`}`));
process.exit(failures.length ? 1 : 0);
