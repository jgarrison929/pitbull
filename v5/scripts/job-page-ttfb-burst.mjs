#!/usr/bin/env node
/**
 * Crawl-like job-page burst for 24-077 / 24-118 (staging verify job-page tail).
 *
 * 4 roles × 6 widths × 2 themes × 2 jobs. Concurrent document GETs for TTFB;
 * optional NAV=1 measures browser loadMs (goto → load) like verify crawl.
 *
 *   BASE_URL=http://127.0.0.1:3200 node scripts/job-page-ttfb-burst.mjs
 *   LABEL=main OUT=/tmp/job-ttfb-main.json node scripts/job-page-ttfb-burst.mjs
 *   NAV=1 …  — headed loadMs (slower; use for accept max&lt;1000)
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3200").replace(
  /\/$/,
  "",
);
const LABEL = process.env.LABEL ?? "burst";
const OUT = process.env.OUT ?? "";
const USE_NAV = process.env.NAV === "1";
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const WIDTHS = [320, 375, 390, 768, 1280, 1440];
const THEMES = ["light", "dark"];
const JOBS = ["24-077", "24-118"];
const ROUNDS = Number(process.env.ROUNDS ?? 1);
/** Concurrent in-flight document fetches (default = full matrix wave). */
const CONCURRENCY = Number(
  process.env.CONCURRENCY ?? ROLES.length * WIDTHS.length,
);

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

async function setTheme(page, theme) {
  // Demo theme cookie — match verify dark crawl.
  await page.context().addCookies([
    {
      name: "pcs_theme",
      value: theme,
      url: BASE,
    },
  ]);
}

async function measureTtfb(cookie, path, theme) {
  const ac = new AbortController();
  const kill = setTimeout(
    () => ac.abort(),
    Number(process.env.FETCH_TIMEOUT_MS ?? 30_000),
  );
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        cookie: `pcs_session=${cookie}; pcs_theme=${theme}`,
        accept: "text/html",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      signal: ac.signal,
    });
    const ttfbMs = performance.now() - t0;
    const reader = res.body?.getReader();
    let bytes = 0;
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (bytes < 512_000) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
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
    const meta =
      html.match(
        /data-testid="v5-timing"[^>]*data-db-ms="(\d+)"[^>]*data-queries="(\d+)"[^>]*data-total-ms="(\d+)"/,
      ) ||
      html.match(
        /"data-testid":"v5-timing","data-db-ms":(\d+),"data-queries":(\d+),"data-total-ms":(\d+)/,
      );
    // Reject unexpected Server-Timing metrics (leak guard for PR).
    const timingKeys = Object.keys(timing).filter((k) => k !== "v5proxy");
    return {
      path,
      status: res.status,
      ttfbMs,
      totalMs,
      loadMs: totalMs,
      bytes,
      serverTiming: timing,
      extraTimingKeys: timingKeys,
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
  if (!USE_NAV) await browser.close();
}

/** @type {{ role: string, width: number, theme: string, job: string, path: string, cookie: string }[]} */
const work = [];
for (const role of ROLES) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      for (const job of JOBS) {
        work.push({
          role,
          width,
          theme,
          job,
          path: `/app/jobs/${job}`,
          cookie: cookiesByRole[role],
        });
      }
    }
  }
}

const ttfbSamples = [];
const loadSamples = [];
const proxyDurs = [];
const dbMsSamples = [];
const byJob = Object.fromEntries(JOBS.map((j) => [j, []]));
const byTheme = Object.fromEntries(THEMES.map((t) => [t, []]));
/** @type {object[]} */
const slowest = [];
let extraTimingLeaks = 0;

async function record(sample, meta) {
  ttfbSamples.push(sample.ttfbMs);
  loadSamples.push(sample.loadMs ?? sample.totalMs ?? sample.ttfbMs);
  byJob[meta.job].push(sample.ttfbMs);
  byTheme[meta.theme].push(sample.ttfbMs);
  if (typeof sample.serverTiming?.v5proxy === "number") {
    proxyDurs.push(sample.serverTiming.v5proxy);
  }
  if (sample.pageMeta?.db != null) dbMsSamples.push(sample.pageMeta.db);
  if (sample.extraTimingKeys?.length) extraTimingLeaks += 1;
  slowest.push({
    ...meta,
    path: sample.path,
    ttfbMs: sample.ttfbMs,
    loadMs: sample.loadMs ?? sample.totalMs,
    proxy: sample.serverTiming?.v5proxy ?? null,
    dataDb: sample.pageMeta?.db ?? null,
  });
}

for (let round = 0; round < ROUNDS; round++) {
  if (round === 0) {
    await measureTtfb(work[0].cookie, work[0].path, work[0].theme);
  }

  if (USE_NAV) {
    // Browser loadMs: one context per (role×width), walk themes×jobs.
    await Promise.all(
      ROLES.flatMap((role) =>
        WIDTHS.map(async (width) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 800 },
          });
          await ctx.addCookies([
            { name: "pcs_session", value: cookiesByRole[role], url: BASE },
          ]);
          const page = await ctx.newPage();
          for (const theme of THEMES) {
            await setTheme(page, theme);
            for (const job of JOBS) {
              const path = `/app/jobs/${job}`;
              try {
                const t0 = performance.now();
                const res = await page.goto(`${BASE}${path}`, {
                  waitUntil: "load",
                  timeout: 60_000,
                });
                const loadMs = performance.now() - t0;
                const nav = await page.evaluate(() => {
                  const n = performance.getEntriesByType("navigation")[0];
                  return n && typeof n.responseStart === "number"
                    ? n.responseStart
                    : null;
                });
                const ttfbMs = nav != null && nav > 0 ? nav : loadMs;
                await record(
                  {
                    path,
                    status: res?.status() ?? 0,
                    ttfbMs,
                    loadMs,
                    totalMs: loadMs,
                    serverTiming: {},
                    extraTimingKeys: [],
                    pageMeta: null,
                  },
                  { role, width, theme, job },
                );
              } catch (err) {
                console.error(
                  `FAIL ${path} ${err instanceof Error ? err.message : err}`,
                );
                process.exitCode = 1;
              }
            }
          }
          await ctx.close();
        }),
      ),
    );
  } else {
    const wave = Math.min(work.length, CONCURRENCY);
    for (let i = 0; i < work.length; i += wave) {
      const chunk = work.slice(i, i + wave);
      const results = await Promise.all(
        chunk.map(async (w) => {
          try {
            const r = await measureTtfb(w.cookie, w.path, w.theme);
            return { r, w };
          } catch (err) {
            console.error(
              `FAIL ${w.path} ${err instanceof Error ? err.message : err}`,
            );
            process.exitCode = 1;
            return null;
          }
        }),
      );
      for (const row of results) {
        if (!row) continue;
        if (row.r.status !== 200) {
          console.error(`FAIL ${row.r.path} HTTP ${row.r.status}`);
          process.exitCode = 1;
        }
        await record(row.r, row.w);
      }
    }
  }
}

if (USE_NAV) await browser.close();

slowest.sort((a, b) => (b.loadMs ?? b.ttfbMs) - (a.loadMs ?? a.ttfbMs));
const ttfb = summarize(ttfbSamples);
const load = summarize(loadSamples);
const proxy = proxyDurs.length ? summarize(proxyDurs) : null;
const dbMs = dbMsSamples.length ? summarize(dbMsSamples) : null;
const report = {
  label: LABEL,
  mode: USE_NAV ? "nav-load" : "fetch-ttfb",
  base: BASE,
  jobs: JOBS,
  roles: ROLES.length,
  widths: WIDTHS.length,
  themes: THEMES.length,
  concurrency: CONCURRENCY,
  rounds: ROUNDS,
  targets: { p95TtfbMs: 200, maxLoadMs: 1000 },
  ttfb,
  load,
  byJob: Object.fromEntries(JOBS.map((j) => [j, summarize(byJob[j])])),
  byTheme: Object.fromEntries(THEMES.map((t) => [t, summarize(byTheme[t])])),
  proxyDurMs: proxy,
  dataDbMs: dbMs,
  extraTimingLeaks,
  slowest: slowest.slice(0, 12),
  pass: ttfb.p95 < 200 && load.max < 1000 && extraTimingLeaks === 0,
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
if (!report.pass) process.exitCode = 1;
