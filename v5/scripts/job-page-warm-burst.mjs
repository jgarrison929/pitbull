#!/usr/bin/env node
/**
 * Verify-shaped warm 24-browser burst for job pages 24-077 / 24-118.
 * 4 roles × 6 widths concurrent Chromium contexts; each walks themes×jobs
 * with goto(waitUntil:load) then waitForLoadState(networkidle) — same as crawl.mjs.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3200").replace(/\/$/, "");
const LABEL = process.env.LABEL ?? "burst";
const OUT = process.env.OUT ?? "";
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const WIDTHS = [320, 375, 390, 768, 1280, 1440];
const THEMES = ["light", "dark"];
const JOBS = ["24-077", "24-118"];
const ROUNDS = Number(process.env.ROUNDS ?? 1);
const HEADED = process.env.HEADED === "1";

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

const browser = await chromium.launch({ headless: !HEADED });
const cookiesByRole = {};
{
  for (const role of ROLES) {
    const context = await browser.newContext();
    const page = await context.newPage();
    cookiesByRole[role] = await signIn(page, role);
    await context.close();
  }
}

/** Warm one page before the burst matrix. */
{
  const ctx = await browser.newContext();
  await ctx.addCookies([
    { name: "pcs_session", value: cookiesByRole.pm, url: BASE },
  ]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/jobs/24-077`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await ctx.close();
}

const loadSamples = [];
const idleSamples = [];
const slowest = [];

for (let round = 0; round < ROUNDS; round++) {
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
          await ctx.addCookies([
            { name: "pcs_theme", value: theme, url: BASE },
          ]);
          for (const job of JOBS) {
            const path = `/app/jobs/${job}`;
            const t0 = Date.now();
            const res = await page.goto(`${BASE}${path}`, {
              waitUntil: "load",
              timeout: 60_000,
            });
            const loadMs = Date.now() - t0;
            await page.waitForLoadState("networkidle");
            const idleMs = Date.now() - t0;
            loadSamples.push(loadMs);
            idleSamples.push(idleMs);
            slowest.push({
              role,
              width,
              theme,
              job,
              status: res?.status() ?? 0,
              loadMs,
              idleMs,
            });
          }
        }
        await ctx.close();
      }),
    ),
  );
}

await browser.close();

slowest.sort((a, b) => b.idleMs - a.idleMs);
const load = summarize(loadSamples);
const idle = summarize(idleSamples);
const report = {
  label: LABEL,
  base: BASE,
  mode: "warm-24-browser-load-idle",
  jobs: JOBS,
  roles: ROLES.length,
  widths: WIDTHS.length,
  themes: THEMES.length,
  rounds: ROUNDS,
  targets: { maxLoadMs: 1000, maxIdleMs: 1500 },
  load,
  idle,
  slowest: slowest.slice(0, 16),
  pass: load.max < 1000 && idle.max < 1500,
};

console.log(JSON.stringify(report, null, 2));
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
if (!report.pass) process.exitCode = 1;
