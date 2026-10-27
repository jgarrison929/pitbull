// 5.0.4 "Speed checks (all slices)" (main 05cd947c, the Planner's #80). "Cold load. Each run uses a new browser context
// (empty HTTP cache, no cookies). On a first page, Verify signs in through `role-<role>` on `/login` as `signInRole` in
// `crawl.mjs` does, and sets the theme. Then it opens a new page in that same context and navigates directly to the
// measured path. That direct navigation is the only one timed. The sign-in and its redirect to `/app` are never timed,
// including for `/app`." "Time to network idle … from `page.goto(url, { waitUntil: "load" })` until
// `page.waitForLoadState("networkidle")` returns". "LCP … the `startTime` of the last entry the observer has received
// when network idle is reached … A run with no entry fails." "Checks 1 and 2 hold for every run, so the worst of 5 is
// the value checked. Check 3 uses the median, the 3rd of the 5 sorted values".
import { contextFor, CRAWL_ROLES, signInRole, THEME_COOKIE } from "./crawl.mjs";

export const SPEED_RUNS = 5;
export const SPEED_IDLE_MAX_MS = 1500;
export const SPEED_LCP_MAX_MS = 1500; // "under 1,500 ms": strictly less
export const SPEED_MEDIAN_MAX_MS = 1200;

export const SPEED_PASSES = {
  "speed-1": { name: "5.0.4 Speed 1: /app, each role, 390×844, light and dark, 5 runs ≤ 1,500 ms idle, LCP < 1,500 ms", roles: CRAWL_ROLES, sizes: [{ width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app"], rule: "every" },
  "speed-2": { name: "5.0.4 Speed 2: PM /app/jobs/24-118, 834×1112, light, 5 runs ≤ 1,500 ms idle, LCP < 1,500 ms", roles: ["pm"], sizes: [{ width: 834, height: 1112 }], themes: ["light"], pages: ["/app/jobs/24-118"], rule: "every" },
  "speed-3": { name: "5.0.4 Speed 3: /app, 24-077, 25-031, each role, 390×844, light and dark, median idle ≤ 1,200 ms", roles: CRAWL_ROLES, sizes: [{ width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app", "/app/jobs/24-077", "/app/jobs/25-031"], rule: "median" },
};

const LCP_INIT = () => {
  window.__lcp = null;
  try {
    new PerformanceObserver((list) => { const e = list.getEntries().at(-1); if (e) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch { window.__lcp = "unsupported"; }
};

export async function speedPass(browser, base, pass, { runs = SPEED_RUNS } = {}) {
  const rows = [];
  for (const theme of pass.themes) for (const role of pass.roles) for (const { width, height } of pass.sizes) for (const p of pass.pages) {
    const row = { role, width, height, theme, path: p, runs: [] };
    for (let i = 0; i < runs; i++) {
      const ctx = await browser.newContext(contextFor(width, height, theme));
      try {
        await ctx.addCookies([{ name: THEME_COOKIE, value: theme, url: base }]);
        await ctx.addInitScript(LCP_INIT);
        const signIn = await ctx.newPage();
        await signInRole(signIn, base, role);
        const page = await ctx.newPage(); // the measured page: same context, so sign-in's cache stays
        await signIn.close();
        const t0 = Date.now();
        const res = await page.goto(base + p, { waitUntil: "load" });
        await page.waitForLoadState("networkidle");
        const idleMs = Date.now() - t0;
        const lcp = await page.evaluate(() => window.__lcp);
        row.runs.push({ status: res?.status() ?? null, idleMs, lcpMs: typeof lcp === "number" ? Math.round(lcp) : lcp });
      } catch (error) {
        row.runs.push({ error: String(error?.message ?? error).split("\n")[0] });
      } finally {
        await ctx.close();
      }
    }
    rows.push(row);
  }
  return rows;
}

/** "the 3rd of the 5 sorted values" (percentile(sorted, 50) in job-page-ttfb-burst.mjs). */
export const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.ceil(s.length / 2) - 1] : NaN; };

export function evaluateSpeedRows(pass, rows, { runs = SPEED_RUNS } = {}) {
  const f = [];
  for (const r of rows) {
    const at = `${r.role}@${r.width}x${r.height} ${r.theme} ${r.path}`;
    if (r.runs.length !== runs) f.push(`${at}: ${r.runs.length}/${runs} runs`);
    for (const [i, x] of r.runs.entries()) {
      if (x.error) { f.push(`${at} run ${i + 1}: ${x.error}`); continue; }
      if (x.status !== 200) f.push(`${at} run ${i + 1}: HTTP ${x.status}`);
      if (pass.rule === "every") {
        if (!(x.idleMs <= SPEED_IDLE_MAX_MS)) f.push(`${at} run ${i + 1}: idle ${x.idleMs} ms > ${SPEED_IDLE_MAX_MS}`);
        if (typeof x.lcpMs !== "number") f.push(`${at} run ${i + 1}: LCP not observed (${x.lcpMs})`);
        else if (!(x.lcpMs < SPEED_LCP_MAX_MS)) f.push(`${at} run ${i + 1}: LCP ${x.lcpMs} ms ≥ ${SPEED_LCP_MAX_MS}`);
      }
    }
    if (pass.rule === "median") {
      if (r.runs.some((x) => x.error)) continue; // each errored run already failed above; no median from fewer than 5
      const ok = r.runs.map((x) => x.idleMs);
      const m = median(ok);
      if (!(m <= SPEED_MEDIAN_MAX_MS)) f.push(`${at}: median idle ${m} ms > ${SPEED_MEDIAN_MAX_MS} (runs ${ok.join(", ")})`);
    }
  }
  return f;
}
