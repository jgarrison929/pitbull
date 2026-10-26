#!/usr/bin/env node
/**
 * Measure foreman /app/jobs/25-031 at 1280px the same way verify-v5 crawl does
 * (goto → loadMs, wait networkidle → idleMs). Prints JSON for the PR body.
 *
 * Usage: node scripts/measure-foreman-job.mjs [--base http://127.0.0.1:3000] [--label no-posthog]
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const base = arg("base", "http://127.0.0.1:3000").replace(/\/$/, "");
const label = arg("label", "run");
const samples = Number(arg("samples", "5"));
const path = "/app/jobs/25-031";
const width = 1280;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height: 800 },
});
const page = await context.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.getByTestId("role-foreman").click();
await page.waitForURL(/\/app/);
await page.waitForLoadState("networkidle");

const rows = [];
for (let i = 0; i < samples; i++) {
  const t0 = Date.now();
  const res = await page.goto(`${base}${path}`, { waitUntil: "load" });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState("networkidle");
  const idleMs = Date.now() - t0;
  rows.push({
    status: res?.status() ?? 0,
    loadMs,
    idleMs,
  });
}

rows.sort((a, b) => a.idleMs - b.idleMs);
const p50 = rows[Math.floor(rows.length / 2)];
const out = {
  label,
  path,
  width,
  posthogKeyPresent: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  samples: rows,
  idleMsP50: p50.idleMs,
  loadMsP50: p50.loadMs,
  budgetMs: 1500,
};
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(p50.idleMs <= 1500 ? 0 : 2);
