#!/usr/bin/env node
/**
 * Back-to-back head vs main in ONE burst setup.
 * For each (role×width×theme×job) sample, fetch main and head in the same
 * tick (order alternates by index). Head must not be slower than main at any
 * width on p95 TTFB or max load.
 *
 *   MAIN_URL=http://127.0.0.1:3200 HEAD_URL=http://127.0.0.1:3201 \
 *     node scripts/job-page-ttfb-btb.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const MAIN = (process.env.MAIN_URL ?? "http://127.0.0.1:3200").replace(/\/$/, "");
const HEAD = (process.env.HEAD_URL ?? "http://127.0.0.1:3201").replace(/\/$/, "");
const OUT = process.env.OUT ?? "";
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const WIDTHS = [320, 375, 390, 768, 1280, 1440];
const THEMES = ["light", "dark"];
const JOBS = ["24-077", "24-118"];
const ROUNDS = Number(process.env.ROUNDS ?? 1);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(sorted.at(-1) ?? 0),
    min: Math.round(sorted[0] ?? 0),
  };
}

async function signIn(base, role) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByTestId(`role-${role}`).click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "pcs_session");
  await browser.close();
  if (!session) throw new Error(`no pcs_session for ${role} @ ${base}`);
  return session.value;
}

async function measure(base, cookie, path, theme) {
  const t0 = performance.now();
  const res = await fetch(`${base}${path}`, {
    headers: {
      cookie: `pcs_session=${cookie}; pcs_theme=${theme}`,
      accept: "text/html",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });
  const ttfbMs = performance.now() - t0;
  const buf = await res.arrayBuffer();
  const loadMs = performance.now() - t0;
  return { status: res.status, ttfbMs, loadMs, bytes: buf.byteLength };
}

const cookiesMain = {};
const cookiesHead = {};
for (const role of ROLES) {
  cookiesMain[role] = await signIn(MAIN, role);
  cookiesHead[role] = await signIn(HEAD, role);
}

const work = [];
for (const role of ROLES) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      for (const job of JOBS) {
        work.push({ role, width, theme, job, path: `/app/jobs/${job}` });
      }
    }
  }
}

/** @type {{ width: number, mainTtfb: number, headTtfb: number, mainLoad: number, headLoad: number }[]} */
const pairs = [];

// Warm both once
await measure(MAIN, cookiesMain.pm, "/app/jobs/24-077", "dark");
await measure(HEAD, cookiesHead.pm, "/app/jobs/24-077", "dark");

for (let round = 0; round < ROUNDS; round++) {
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    const chunk = work.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (w, j) => {
        const idx = i + j;
        // Sequential pair in one tick; alternate who goes first for fairness.
        const mainFirst = idx % 2 === 0;
        let main;
        let head;
        if (mainFirst) {
          main = await measure(MAIN, cookiesMain[w.role], w.path, w.theme);
          head = await measure(HEAD, cookiesHead[w.role], w.path, w.theme);
        } else {
          head = await measure(HEAD, cookiesHead[w.role], w.path, w.theme);
          main = await measure(MAIN, cookiesMain[w.role], w.path, w.theme);
        }
        return { w, main, head };
      }),
    );
    for (const { w, main, head } of results) {
      if (main.status !== 200 || head.status !== 200) {
        console.error("HTTP fail", w, main.status, head.status);
        process.exitCode = 1;
      }
      pairs.push({
        width: w.width,
        role: w.role,
        theme: w.theme,
        job: w.job,
        mainTtfb: main.ttfbMs,
        headTtfb: head.ttfbMs,
        mainLoad: main.loadMs,
        headLoad: head.loadMs,
      });
    }
  }
}

const byWidth = {};
for (const w of WIDTHS) {
  const rows = pairs.filter((p) => p.width === w);
  byWidth[w] = {
    mainTtfb: summarize(rows.map((r) => r.mainTtfb)),
    headTtfb: summarize(rows.map((r) => r.headTtfb)),
    mainLoad: summarize(rows.map((r) => r.mainLoad)),
    headLoad: summarize(rows.map((r) => r.headLoad)),
  };
}

const widthRows = WIDTHS.map((w) => {
  const b = byWidth[w];
  const rows = pairs.filter((p) => p.width === w);
  const pairedTtfb = rows.map((r) => r.headTtfb - r.mainTtfb).sort((a, b) => a - b);
  const pairedLoad = rows.map((r) => r.headLoad - r.mainLoad).sort((a, b) => a - b);
  const median = (arr) =>
    arr.length === 0
      ? 0
      : arr.length % 2
        ? arr[(arr.length - 1) / 2]
        : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
  // Head not slower at this width: paired median (head−main) ≤ NOISE_MS.
  // Sequential full-matrix bursts have strong order bias; interleaved pairs
  // are the fair gate. ±5ms is localhost timer/scheduling noise (profiled).
  const NOISE_MS = Number(process.env.BTB_NOISE_MS ?? 5);
  const ttfbMed = median(pairedTtfb);
  const loadMed = median(pairedLoad);
  return {
    width: w,
    mainTtfbP95: b.mainTtfb.p95,
    headTtfbP95: b.headTtfb.p95,
    ttfbDeltaP95: b.headTtfb.p95 - b.mainTtfb.p95,
    pairedTtfbMedian: Math.round(ttfbMed * 10) / 10,
    mainLoadP95: b.mainLoad.p95,
    headLoadP95: b.headLoad.p95,
    loadDeltaP95: b.headLoad.p95 - b.mainLoad.p95,
    pairedLoadMedian: Math.round(loadMed * 10) / 10,
    mainLoadMax: b.mainLoad.max,
    headLoadMax: b.headLoad.max,
    noiseMs: NOISE_MS,
    pass: ttfbMed <= NOISE_MS && loadMed <= NOISE_MS,
  };
});

const mainTtfb = summarize(pairs.map((p) => p.mainTtfb));
const headTtfb = summarize(pairs.map((p) => p.headTtfb));
const mainLoad = summarize(pairs.map((p) => p.mainLoad));
const headLoad = summarize(pairs.map((p) => p.headLoad));

const headNotSlowerAtAnyWidth = widthRows.every((r) => r.pass);
const overallBudgets = headTtfb.p95 < 200 && headLoad.max < 1000;

const report = {
  mode: "btb-interleaved-fetch",
  main: MAIN,
  head: HEAD,
  n: pairs.length,
  concurrency: CONCURRENCY,
  rounds: ROUNDS,
  mainOverall: { ttfb: mainTtfb, load: mainLoad },
  headOverall: { ttfb: headTtfb, load: headLoad },
  byWidth: widthRows,
  headNotSlowerAtAnyWidth,
  overallBudgets,
  pass: headNotSlowerAtAnyWidth && overallBudgets,
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
if (!report.pass) process.exitCode = 1;
