// 5.0.4 axe checks (main 4c9d3539): c-4 color-contrast, c-8 full WCAG tags, i-3 button-name + tree toggle names, i-4 list.
// axe-core is read from v5/node_modules (on rc/5.0.4 it is installed by `npm ci` as a dev dependency of
// eslint-plugin-jsx-a11y, axe-core 4.14.0). The spec names @axe-core/playwright, which wraps the same engine: here the
// engine is injected with addScriptTag and run with the same tags. If axe-core cannot be loaded the checks FAIL; they
// are never skipped.
import { createRequire } from "node:module";
import path from "node:path";
import { CRAWL_ROLES, contextFor, signInRole, THEME_COOKIE } from "./crawl.mjs";

/** c-8: "`@axe-core/playwright` with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` reports 0 violations". */
export const C8_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** i-3: "each tree toggle's accessible name matches `/^(Expand|Collapse) \S+ .+/`". */
export const TOGGLE_NAME = /^(Expand|Collapse) \S+ .+/;
export const TOGGLE_SELECTOR = '[data-testid="cost-tree-row"] button[aria-expanded]';

/**
 * The axe passes, each as written in the spec. `sizes` are { width, height }.
 * c-4 runs over the nav-crawl pages at the 5.0.4 crawl sizes (the "Mobile and layout checks" table lists
 * Contrast at "all three" viewports: 320×568, 390×844, 1280×800). The caller passes the nav-crawl pages.
 */
export const AXE_PASSES = {
  "c-8": {
    name: "5.0.4-c check 8: full axe (wcag2a/2aa/21a/21aa/22aa) on 24-077, 26-010, 24-077/07-300",
    roles: CRAWL_ROLES,
    sizes: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    pages: ["/app/jobs/24-077", "/app/jobs/26-010", "/app/jobs/24-077/cost-items/07-300"],
    options: { runOnly: { type: "tag", values: C8_TAGS } },
  },
  "i-3": {
    name: "5.0.4-i check 3: axe button-name 0 and tree toggle names on 26-010",
    roles: CRAWL_ROLES,
    sizes: [{ width: 1440, height: 900 }, { width: 390, height: 844 }],
    pages: ["/app/jobs/26-010"],
    options: { runOnly: { type: "rule", values: ["button-name"] } },
    toggles: true,
  },
  "i-4": {
    name: "5.0.4-i check 4: axe list 0 on 24-077, 24-118, 25-031",
    roles: ["pm", "executive", "superintendent"],
    sizes: [{ width: 1440, height: 900 }],
    pages: ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031"],
    options: { runOnly: { type: "rule", values: ["list"] } },
  },
};
export const C4_OPTIONS = { runOnly: { type: "rule", values: ["color-contrast"] } };
export const AXE_THEMES = ["light", "dark"];

/** axe-core source from `<repo>/v5/node_modules`, or { error }. */
export function loadAxeSource(repoRoot) {
  try {
    const req = createRequire(path.join(repoRoot, "v5", "package.json"));
    const file = req.resolve("axe-core/axe.min.js");
    const version = req("axe-core/package.json").version;
    return { source: req("node:fs").readFileSync(file, "utf8"), version };
  } catch (error) {
    return { error: `axe-core not loadable from v5/node_modules: ${String(error?.message ?? error).split("\n")[0]}` };
  }
}

/** Run axe on the current page. Returns { violations: [{ id, impact, count, targets }] }. */
export async function runAxe(page, source, options) {
  await page.addScriptTag({ content: source });
  return page.evaluate(async (opts) => {
    // eslint-disable-next-line no-undef
    const r = await window.axe.run(document, opts);
    return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })) };
  }, options);
}

/** Accessible names of the visible tree toggles (aria-label, else aria-labelledby text, else text). */
export async function toggleNames(page) {
  return page.$$eval(TOGGLE_SELECTOR, (els) =>
    els
      .filter((e) => e.getClientRects().length > 0)
      .map((e) => {
        const by = (e.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
        return (e.getAttribute("aria-label") || by || e.textContent || "").replace(/\s+/g, " ").trim();
      }),
  );
}

/** One fresh context per role × size × theme; signs in, loads each page to network idle, runs axe. */
export async function axePass(browser, base, { roles, sizes, themes = AXE_THEMES, pages, options, toggles = false, source }) {
  const rows = [];
  for (const theme of themes) {
    for (const role of roles) {
      for (const { width, height } of sizes) {
        const ctx = await browser.newContext(contextFor(width, height, theme));
        await ctx.addCookies([{ name: THEME_COOKIE, value: theme, url: base }]);
        const page = await ctx.newPage();
        try {
          await signInRole(page, base, role);
          for (const p of pages) {
            const row = { role, width, height, theme, path: p };
            try {
              const res = await page.goto(base + p, { waitUntil: "load" });
              await page.waitForLoadState("networkidle");
              row.status = res?.status() ?? null;
              row.htmlTheme = await page.evaluate(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
              row.violations = (await runAxe(page, source, options)).violations;
              if (toggles) row.toggles = await toggleNames(page);
            } catch (error) {
              row.error = String(error?.message ?? error).split("\n")[0];
            }
            rows.push(row);
          }
        } finally {
          await ctx.close();
        }
      }
    }
  }
  return rows;
}

/** Failures for axe rows: load errors, non-200, wrong theme, any violation, and (i-3) toggle names. */
export function evaluateAxeRows(rows, { toggles = false } = {}) {
  const f = [];
  for (const r of rows) {
    const where = `${r.role}@${r.width}x${r.height} ${r.theme} ${r.path}`;
    if (r.error) { f.push(`${where}: ${r.error}`); continue; }
    if (r.status !== 200) f.push(`${where}: HTTP ${r.status}`);
    if (r.htmlTheme !== r.theme) f.push(`${where}: page rendered ${r.htmlTheme}, pass is ${r.theme}`);
    if (!Array.isArray(r.violations)) { f.push(`${where}: axe did not run`); continue; }
    for (const v of r.violations) f.push(`${where}: axe ${v.id} (${v.impact}) × ${v.count}: ${v.targets.join(" | ")}`);
    if (toggles) {
      if (!Array.isArray(r.toggles) || r.toggles.length === 0) f.push(`${where}: no visible cost-tree toggle to name`);
      for (const name of r.toggles ?? []) if (!TOGGLE_NAME.test(name)) f.push(`${where}: tree toggle name "${name}" does not match ${TOGGLE_NAME}`);
    }
  }
  return f;
}
