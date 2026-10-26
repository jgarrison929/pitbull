#!/usr/bin/env node
/**
 * Acceptance measurement for plan-detail networkidle (5.0.3 staging FAIL).
 * 20 loads × widths → p95 < 800 ms, max < 800 ms (product target; verify
 * crawl budget remains 1500). Run against `next start` (Playwright webServer
 * or BASE_URL). Not part of default CI e2e — parallel suite load falsifies
 * wall-clock idle.
 *
 *   BASE_URL=http://localhost:3100 node scripts/plan-page-idle-acceptance.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SAMPLES = 20;
const P95_MS = 800;
const MAX_MS = 800;
const WIDTHS = [320, 390, 768, 1280];
const JOB = "24-118";
const COST = "03-200";

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByTestId("role-superintendent").click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

async function resolvePlanPath(page) {
  await page.goto(`${BASE}/app/jobs/${JOB}/cost-items/${COST}`, {
    waitUntil: "networkidle",
  });
  const href = await page
    .getByTestId("cost-entry-plan-link")
    .first()
    .getAttribute("href");
  if (!href || !/\/plans\/[0-9a-f-]{36}$/i.test(href)) {
    throw new Error(`no plan link on ${JOB}/${COST}: ${href}`);
  }
  return href;
}

async function measureIdle(page, path) {
  const t0 = Date.now();
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  return { status: res?.status() ?? 0, idleMs: Date.now() - t0 };
}

const browser = await chromium.launch({ headless: true });
const summary = {};
let failed = false;

try {
  for (const width of WIDTHS) {
    const context = await browser.newContext(
      width < 768
        ? {
            viewport: { width, height: 844 },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 2,
          }
        : { viewport: { width, height: 900 } },
    );
    const page = await context.newPage();
    await signIn(page);
    const path = await resolvePlanPath(page);

    const samples = [];
    for (let i = 0; i < SAMPLES; i++) {
      const { status, idleMs } = await measureIdle(page, path);
      if (status !== 200) {
        console.error(`FAIL ${path} @${width}: HTTP ${status}`);
        failed = true;
        break;
      }
      samples.push(idleMs);
    }
    if (samples.length !== SAMPLES) {
      await context.close();
      break;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = Math.round(percentile(sorted, 95));
    const max = Math.round(Math.max(...samples));
    const key = `w${width} ${path}`;
    summary[key] = {
      p95Ms: p95,
      maxMs: max,
      samplesMs: samples.map((ms) => Math.round(ms)),
    };
    if (p95 >= P95_MS || max >= MAX_MS) {
      console.error(
        `FAIL ${key}: p95=${p95} max=${max} (budget p95<${P95_MS} max<${MAX_MS})`,
      );
      failed = true;
    } else {
      console.log(`OK ${key}: p95=${p95} max=${max}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ note: "plan-page idle acceptance", summary }, null, 2));
process.exit(failed ? 1 : 0);
