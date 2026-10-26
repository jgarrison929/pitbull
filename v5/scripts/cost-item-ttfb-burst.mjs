#!/usr/bin/env node
/**
 * Crawl-like TTFB burst for cost-item + plan drills (staging server-tail FAIL).
 *
 * Fires CONCURRENCY parallel document GETs against a production `next start`
 * (BASE_URL), mixing cost-item and plan paths across 4 demo roles × widths.
 * Reports p50 / p95 / max TTFB and optional Server-Timing proxy dur.
 *
 *   BASE_URL=http://127.0.0.1:3100 node scripts/cost-item-ttfb-burst.mjs
 *   LABEL=before OUT=/tmp/ttfb-before.json node scripts/cost-item-ttfb-burst.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const LABEL = process.env.LABEL ?? "burst";
const OUT = process.env.OUT ?? "";
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const WIDTHS = [320, 375, 390, 768, 1280, 1440];
/** Concurrent in-flight document fetches (≈ roles × widths). */
const CONCURRENCY = Number(process.env.CONCURRENCY ?? ROLES.length * WIDTHS.length);
const ROUNDS = Number(process.env.ROUNDS ?? 2);
const COST_PATHS = [
  "/app/jobs/24-077/cost-items/07-150",
  "/app/jobs/24-077/cost-items/08-200",
  "/app/jobs/25-031/cost-items/04-110",
  "/app/jobs/24-118/cost-items/03-200",
  "/app/jobs/24-118/cost-items/07-300",
];

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

function parseServerTiming(header) {
  if (!header) return {};
  const out = {};
  for (const part of header.split(",")) {
    const m = part.trim().match(/^([^;]+)(?:;dur=([0-9.]+))?/i);
    if (m) out[m[1]] = m[2] != null ? Number(m[2]) : true;
  }
  return out;
}

async function signIn(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByTestId(`role-${role}`).click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "pcs_session");
  if (!session) throw new Error(`no pcs_session for ${role}`);
  return session.value;
}

async function resolvePlanPath(cookie) {
  const res = await fetch(`${BASE}/app/jobs/24-118/cost-items/03-200`, {
    headers: { cookie: `pcs_session=${cookie}`, accept: "text/html" },
  });
  const html = await res.text();
  const m = html.match(/\/app\/jobs\/24-118\/plans\/[0-9a-f-]{36}/i);
  return m?.[0] ?? null;
}

async function measureTtfb(cookie, path) {
  const ac = new AbortController();
  const kill = setTimeout(() => ac.abort(), Number(process.env.FETCH_TIMEOUT_MS ?? 20_000));
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        cookie: `pcs_session=${cookie}`,
        accept: "text/html",
        // Bust PPR resume cache so each hit pays proxy + SSR like a cold crawl.
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      signal: ac.signal,
    });
    // Headers received ≈ TTFB for undici (includes proxy middleware).
    const ttfbMs = performance.now() - t0;
    // Drain body with a cap so a stuck stream cannot hang the burst.
    const reader = res.body?.getReader();
    let bytes = 0;
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (bytes < 512_000) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (html.length < 64_000) html += dec.decode(value, { stream: true });
      }
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }
    const totalMs = performance.now() - t0;
    const timing = parseServerTiming(res.headers.get("server-timing"));
    const meta = html.match(
      /data-testid="v5-timing"[^>]*data-db-ms="(\d+)"[^>]*data-queries="(\d+)"[^>]*data-total-ms="(\d+)"/,
    );
    return {
      path,
      status: res.status,
      ttfbMs,
      totalMs,
      bytes,
      serverTiming: timing,
      proxyHeaderMs: res.headers.get("x-v5-proxy-ms"),
      pageMeta: meta
        ? {
            db: Number(meta[1]),
            queries: Number(meta[2]),
            total: Number(meta[3]),
          }
        : null,
    };
  } finally {
    clearTimeout(kill);
  }
}

const browser = await chromium.launch({ headless: true });
const cookiesByRole = {};
try {
  for (const role of ROLES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    cookiesByRole[role] = await signIn(page, role);
    await context.close();
  }
} finally {
  await browser.close();
}

const planByRole = {};
for (const role of ROLES) {
  planByRole[role] = await resolvePlanPath(cookiesByRole[role]);
}

const paths = [];
for (let i = 0; i < CONCURRENCY; i++) {
  const role = ROLES[i % ROLES.length];
  const usePlan = i % 3 === 0 && planByRole[role];
  paths.push({
    role,
    path: usePlan
      ? planByRole[role]
      : COST_PATHS[i % COST_PATHS.length],
    cookie: cookiesByRole[role],
  });
}

const allSamples = [];
const proxyDurs = [];

for (let round = 0; round < ROUNDS; round++) {
  // Warm once per round with a single sequential hit so cold compile is out.
  if (round === 0) {
    await measureTtfb(paths[0].cookie, paths[0].path);
  }
  // Bound concurrency with a small wave so a wedged stream cannot kill the
  // whole Promise.all (Verify Phase A uses many contexts but sequential pages
  // per context; we still want overlapping documents).
  // Default = full concurrency (matches Verify). WAVE=N can shard if needed.
  const wave = Math.min(
    paths.length,
    Number(process.env.WAVE ?? paths.length),
  );
  for (let i = 0; i < paths.length; i += wave) {
    const chunk = paths.slice(i, i + wave);
    const results = await Promise.all(
      chunk.map(async (p) => {
        try {
          return await measureTtfb(p.cookie, p.path);
        } catch (err) {
          console.error(`FAIL ${p.path} ${err instanceof Error ? err.message : err}`);
          process.exitCode = 1;
          return null;
        }
      }),
    );
    for (const r of results) {
      if (!r) continue;
      if (r.status !== 200) {
        console.error(`FAIL ${r.path} HTTP ${r.status}`);
        process.exitCode = 1;
      }
      allSamples.push(r.ttfbMs);
      if (typeof r.serverTiming.v5proxy === "number") {
        proxyDurs.push(r.serverTiming.v5proxy);
      }
    }
  }
}

const ttfb = summarize(allSamples);
const proxy = proxyDurs.length ? summarize(proxyDurs) : null;
const report = {
  label: LABEL,
  base: BASE,
  concurrency: CONCURRENCY,
  rounds: ROUNDS,
  targets: { p95TtfbMs: 200, maxTtfbMs: 400 },
  ttfb,
  proxyDurMs: proxy,
  pass: ttfb.p95 < 200 && ttfb.max < 400,
  samplesMs: allSamples.map((ms) => Math.round(ms)),
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
if (!report.pass) process.exitCode = 1;
