#!/usr/bin/env node
/**
 * Crawl-like TTFB burst for cost-item (+ optional plan) drills.
 *
 * Modes:
 *   MODE=mixed (default) — CONCURRENCY parallel document GETs, COST_PATHS +
 *     optional plan, ROUNDS times. Matches the PR script Verify runs
 *     (defaults: concurrency 24, rounds 2).
 *   MODE=phase-a — Verify Phase A shape: 24 contexts (4 roles × 6 widths),
 *     each loading every discovered leaf cost-item once (foreman-discovered
 *     list reused for all roles). Reports foreman + overall gates.
 *
 *   BASE_URL=http://127.0.0.1:3100 node scripts/cost-item-ttfb-burst.mjs
 *   MODE=phase-a LABEL=head OUT=/tmp/ttfb-head.json node scripts/cost-item-ttfb-burst.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);
const LABEL = process.env.LABEL ?? "burst";
const OUT = process.env.OUT ?? "";
const MODE = (process.env.MODE ?? "mixed").toLowerCase();
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
/** Jobs scanned when discovering leaf cost-item hrefs (Phase A). */
const DISCOVER_JOBS = ["24-077", "25-031", "24-118"];

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

/**
 * Foreman-discovered leaf cost-item paths (Verify Phase A). Job HTML from a
 * bare fetch often lacks hydrated cost-table hrefs — walk the DOM instead.
 */
async function discoverCostItemPaths() {
  const browser = await chromium.launch({ headless: true });
  const hrefs = new Set();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await signIn(page, "foreman");
    for (const job of DISCOVER_JOBS) {
      await page.goto(`${BASE}/app/jobs/${job}`, { waitUntil: "networkidle" });
      const links = await page.$$eval('a[href*="/cost-items/"]', (as) =>
        as.map((a) => a.getAttribute("href") || ""),
      );
      for (const href of links) {
        if (!href || href.includes("/search")) continue;
        try {
          const u = new URL(href, BASE);
          hrefs.add(u.pathname);
        } catch {
          hrefs.add(href.split("?")[0]);
        }
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return [...hrefs].sort();
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
        // Keep enough of the stream to catch late RSC payloads with v5-timing.
        if (html.length < 256_000) html += dec.decode(value, { stream: true });
      }
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }
    const totalMs = performance.now() - t0;
    const timing = parseServerTiming(res.headers.get("server-timing"));
    // HTML attrs or RSC flight JSON (`"data-testid":"v5-timing","data-db-ms":N`).
    const meta =
      html.match(
        /data-testid="v5-timing"[^>]*data-db-ms="(\d+)"[^>]*data-queries="(\d+)"[^>]*data-total-ms="(\d+)"/,
      ) ||
      html.match(
        /"data-testid":"v5-timing","data-db-ms":(\d+),"data-queries":(\d+),"data-total-ms":(\d+)/,
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

const allSamples = [];
const foremanSamples = [];
const proxyDurs = [];
const dbMsSamples = [];
/** @type {Record<string, number[]>} */
const byWidth = Object.fromEntries(WIDTHS.map((w) => [String(w), []]));
/** @type {{ role: string, width: number, path: string, ttfbMs: number }[]} */
const slowest = [];

function record(sample) {
  allSamples.push(sample.ttfbMs);
  byWidth[String(sample.width)].push(sample.ttfbMs);
  if (sample.role === "foreman") foremanSamples.push(sample.ttfbMs);
  if (typeof sample.serverTiming?.v5proxy === "number") {
    proxyDurs.push(sample.serverTiming.v5proxy);
  }
  if (sample.pageMeta?.db != null) dbMsSamples.push(sample.pageMeta.db);
  slowest.push({
    role: sample.role,
    width: sample.width,
    path: sample.path,
    ttfbMs: sample.ttfbMs,
  });
}

if (MODE === "phase-a" || MODE === "phasea" || MODE === "a" || MODE === "phase-a-nav") {
  const useNav = MODE === "phase-a-nav" || process.env.NAV === "1";
  const costPaths = await discoverCostItemPaths();
  if (costPaths.length < 10) {
    console.error(`Phase A discover found only ${costPaths.length} paths`);
    process.exit(1);
  }
  // 24 workers (role × width); each walks every discovered cost-item.
  const workers = [];
  for (const role of ROLES) {
    for (const width of WIDTHS) {
      workers.push({ role, width, cookie: cookiesByRole[role] });
    }
  }

  if (useNav) {
    // Verify Phase A: 24 contexts, document navigation TTFB via
    // PerformanceNavigationTiming.responseStart (one try per load).
    const navBrowser = await chromium.launch({ headless: true });
    try {
      // Warm compile out of the first wave.
      {
        const ctx = await navBrowser.newContext({
          viewport: { width: 1280, height: 800 },
        });
        await ctx.addCookies([
          { name: "pcs_session", value: workers[0].cookie, url: BASE },
        ]);
        const page = await ctx.newPage();
        await page.goto(`${BASE}${costPaths[0]}`, {
          waitUntil: "commit",
          timeout: 60_000,
        });
        await ctx.close();
      }
      await Promise.all(
        workers.map(async (w) => {
          const ctx = await navBrowser.newContext({
            viewport: { width: w.width, height: 800 },
          });
          await ctx.addCookies([
            { name: "pcs_session", value: w.cookie, url: BASE },
          ]);
          const page = await ctx.newPage();
          for (const path of costPaths) {
            try {
              await page.goto(`${BASE}${path}`, {
                waitUntil: "commit",
                timeout: 60_000,
              });
              const ttfbMs = await page.evaluate(() => {
                const n = performance.getEntriesByType("navigation")[0];
                if (n && typeof n.responseStart === "number" && n.responseStart > 0) {
                  return n.responseStart;
                }
                // Fallback when navigation timing is missing.
                return n && typeof n.duration === "number" ? n.duration : 0;
              });
              record({
                ttfbMs,
                role: w.role,
                width: w.width,
                path,
                serverTiming: {},
                pageMeta: null,
              });
            } catch (err) {
              console.error(
                `FAIL ${path} ${err instanceof Error ? err.message : err}`,
              );
              process.exitCode = 1;
            }
          }
          await ctx.close();
        }),
      );
    } finally {
      await navBrowser.close();
    }
  } else {
    // Warm one path so cold compile is out of the first wave.
    await measureTtfb(workers[0].cookie, costPaths[0]);

    await Promise.all(
      workers.map(async (w) => {
        for (const path of costPaths) {
          try {
            const r = await measureTtfb(w.cookie, path);
            if (r.status !== 200) {
              console.error(`FAIL ${path} HTTP ${r.status}`);
              process.exitCode = 1;
            }
            record({ ...r, role: w.role, width: w.width, path });
          } catch (err) {
            console.error(
              `FAIL ${path} ${err instanceof Error ? err.message : err}`,
            );
            process.exitCode = 1;
          }
        }
      }),
    );
  }

  slowest.sort((a, b) => b.ttfbMs - a.ttfbMs);
  const ttfb = summarize(allSamples);
  const foreman = summarize(foremanSamples);
  const proxy = proxyDurs.length ? summarize(proxyDurs) : null;
  const dbMs = dbMsSamples.length ? summarize(dbMsSamples) : null;
  const byWidthSummary = Object.fromEntries(
    WIDTHS.map((w) => [String(w), summarize(byWidth[String(w)])]),
  );
  const report = {
    label: LABEL,
    mode: useNav ? "phase-a-nav" : "phase-a",
    base: BASE,
    concurrency: workers.length,
    costItemCount: costPaths.length,
    targets: { p95TtfbMs: 200, maxTtfbMs: 400 },
    ttfb,
    foreman,
    byWidth: byWidthSummary,
    proxyDurMs: proxy,
    dataDbMs: dbMs,
    slowest: slowest.slice(0, 8),
    pass: foreman.max < 400 && ttfb.max < 400,
    gate: {
      A_foreman: foreman.max < 400,
      A_all: ttfb.max < 400,
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  if (!report.pass) process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}

// ---- MODE=mixed (PR script / Verify step 2) ----
const planByRole = {};
for (const role of ROLES) {
  planByRole[role] = await resolvePlanPath(cookiesByRole[role]);
}

const paths = [];
for (let i = 0; i < CONCURRENCY; i++) {
  const role = ROLES[i % ROLES.length];
  const width = WIDTHS[i % WIDTHS.length];
  const usePlan = i % 3 === 0 && planByRole[role];
  paths.push({
    role,
    width,
    path: usePlan
      ? planByRole[role]
      : COST_PATHS[i % COST_PATHS.length],
    cookie: cookiesByRole[role],
  });
}

for (let round = 0; round < ROUNDS; round++) {
  // Warm once per round with a single sequential hit so cold compile is out.
  if (round === 0) {
    await measureTtfb(paths[0].cookie, paths[0].path);
  }
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
          const r = await measureTtfb(p.cookie, p.path);
          return { ...r, width: p.width, role: p.role, path: p.path };
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
      record(r);
    }
  }
}

slowest.sort((a, b) => b.ttfbMs - a.ttfbMs);
const ttfb = summarize(allSamples);
const proxy = proxyDurs.length ? summarize(proxyDurs) : null;
const dbMs = dbMsSamples.length ? summarize(dbMsSamples) : null;
const byWidthSummary = Object.fromEntries(
  WIDTHS.map((w) => [String(w), summarize(byWidth[String(w)])]),
);
const report = {
  label: LABEL,
  mode: "mixed",
  base: BASE,
  concurrency: CONCURRENCY,
  rounds: ROUNDS,
  targets: { p95TtfbMs: 200, maxTtfbMs: 400 },
  ttfb,
  byWidth: byWidthSummary,
  proxyDurMs: proxy,
  dataDbMs: dbMs,
  slowest: slowest.slice(0, 8),
  pass: ttfb.p95 < 200 && ttfb.max < 400,
  samplesMs: allSamples.map((ms) => Math.round(ms)),
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
if (!report.pass) process.exitCode = 1;
