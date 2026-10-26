// Browser half of the nav crawl: signs in by role card and measures each page. Evaluation lives in
// checks.mjs (evaluateCrawlRow) so the must-fail tests can drive the same code against a fake server.
import path from "node:path";
import { classifyClip, EMPTY_STATE, ERROR_BOUNDARY_SELECTOR, evaluateCrawlRow, MIN_INPUT_FONT_PX, MIN_SECONDARY_FONT_PX, MIN_TAP_PX, PAGE_BUDGET_MS, PHONE_MAX_PX, secondaryReachable } from "./checks.mjs";
import { costItemPlanLinks, discoverDrillLinks, DRILL_ROLE_ACCESS, drillDiscoveryFailures, drillPath, partCItemFor } from "./drill.mjs";
import { captureFailure, secretValues, startFailureRecorder } from "./evidence.mjs";

export const CRAWL_ROLES = ["executive", "pm", "superintendent", "foreman"];
export const CRAWL_WIDTHS = [320, 390, 768, 1280];
/** Extra widths /roadmap is also crawled at (5.0.1 acceptance check 12 used 375 and 1440). */
export const ROADMAP_EXTRA_WIDTHS = [375, 1440];

/** Main nav-crawl pages: /app, every seeded job page, assistant, changelog, status and /roadmap. */
export function navCrawlPages(seedJobNumbers) {
  return ["/app", ...seedJobNumbers.map((j) => `/app/jobs/${j}`), "/app/assistant", "/changelog", "/status", "/roadmap"];
}

/** Passes the nav crawl runs: every page × CRAWL_WIDTHS, then /roadmap × ROADMAP_EXTRA_WIDTHS. */
export function navCrawlPlan(seedJobNumbers) {
  return [
    { pages: navCrawlPages(seedJobNumbers), widths: CRAWL_WIDTHS },
    { pages: ["/roadmap"], widths: ROADMAP_EXTRA_WIDTHS },
  ];
}

/** Loads the plan must produce: roles × Σ(pages × widths). */
export function expectedNavLoads(plan, roles = CRAWL_ROLES) {
  return roles.length * plan.reduce((n, pass) => n + pass.pages.length * pass.widths.length, 0);
}

/**
 * /roadmap coverage → failure strings (empty = pass): every role × (CRAWL_WIDTHS + ROADMAP_EXTRA_WIDTHS)
 * has a crawled /roadmap row, each passes evaluateCrawlRow, and each rendered a <main> (the bar the
 * standalone /roadmap crawl it replaces had).
 */
export function roadmapCoverageFailures(rows, { roles = CRAWL_ROLES, budgetMs = PAGE_BUDGET_MS, phoneChecks = false } = {}) {
  const f = [];
  for (const role of roles) {
    for (const width of [...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS]) {
      if (!rows.some((r) => r.role === role && r.width === width && r.path === "/roadmap")) f.push(`${role}@${width} /roadmap not crawled`);
    }
  }
  for (const r of rows.filter((x) => x.path === "/roadmap")) {
    f.push(...evaluateCrawlRow(r, { budgetMs, phoneChecks }));
    if (!r.hasMain) f.push(`${r.role}@${r.width} /roadmap: no <main>`);
  }
  return f;
}

export async function signInRole(page, base, role, timeout = 30000) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByTestId(`role-${role}`).click();
  await page.waitForURL(/\/app(\?|$)/, { timeout });
  await page.waitForLoadState("networkidle");
}

export function contextFor(width) {
  return width < 768
    ? { viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width, height: 900 } };
}

/** Attach listeners that collect 4xx/5xx responses and console/page errors into `sink` (drained per page). */
export function watch(page, sink) {
  page.on("response", (r) => {
    if (r.status() >= 400) sink.responses.push({ url: r.url(), status: r.status() });
  });
  page.on("console", (m) => {
    if (m.type() === "error") sink.console.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => sink.page.push(String(e.message ?? e).slice(0, 200)));
}

/**
 * DOM scan passed to page.evaluate. classifyClip and secondaryReachable are arguments so the page
 * runs the same functions as the unit tests. Playwright serializes one function; the page does not eval.
 * Phone observations are recorded only when phoneChecks is true. Otherwise those fields are omitted,
 * and evaluateCrawlRow's default (phoneChecks false) does not read them.
 */
function scanPage(arg, classifyClip, secondaryReachable) {
  const { intendedW, emptySrc, boundarySel, phoneMax, minTap, minSecondary, minInput, phoneChecks } = arg;
  const doc = document.documentElement;
  const vw = Math.min(intendedW, window.visualViewport?.width ?? intendedW);
  const sw = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
  const empty = new RegExp(emptySrc, "i");
  const emptyHits = [...document.querySelectorAll("body *")]
    .filter((e) => e.children.length === 0 && empty.test((e.textContent ?? "").trim()))
    .filter((e) => e.getClientRects().length > 0)
    .map((e) => {
      const card = e.closest('[data-testid="co-card"]');
      return {
        text: (e.textContent ?? "").trim().slice(0, 120),
        coNumber: card ? ((card.querySelector("h3")?.textContent ?? "").match(/^\s*(CO-\d+)/)?.[1] ?? `#${card.getAttribute("data-co-number")}`) : null,
        coStatus: card?.getAttribute("data-status") ?? null,
      };
    });
  const shown = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    const r = el.getClientRects();
    return r.length > 0 && r[0].width > 0 && r[0].height > 0;
  };
  const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const out = {
    text: document.body?.innerText ?? "",
    hasMain: !!document.querySelector("main"),
    errorBoundaryMarkers: [...document.querySelectorAll(boundarySel)].map((e) => `[data-testid="${e.getAttribute("data-testid")}"]`),
    scrollWidth: sw,
    viewportW: vw,
    overflowPx: sw - Math.ceil(vw),
    emptyHits,
    seededCounts: {
      costRows: document.querySelectorAll('[data-testid="cost-tree-row"]').length,
      portfolioRows: document.querySelectorAll('[data-testid="job-link"]').length,
      costItemTiles: document.querySelectorAll('[data-testid="cost-item-cb"]').length,
      planStatus: document.querySelectorAll('[data-testid="plan-detail-status"]').length,
    },
  };
  if (!phoneChecks) return out;
  const tapMisses = [];
  let tapMissCount = 0;
  const textMisses = [];
  let textMissCount = 0;
  if (intendedW <= phoneMax) {
    for (const el of document.querySelectorAll('a, button, input, select, textarea, summary, [role="button"], [role="link"]')) {
      if (el.matches('input[type="hidden"]') || !shown(el)) continue;
      if (getComputedStyle(el).pointerEvents === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < minTap || rect.height < minTap) {
        tapMissCount += 1;
        if (tapMisses.length < 8) {
          tapMisses.push({
            tag: el.tagName.toLowerCase(),
            w: Math.floor(rect.width * 10) / 10,
            h: Math.floor(rect.height * 10) / 10,
            text: oneLine(el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").slice(0, 40),
          });
        }
      }
    }
    const pushText = (kind, px, text) => {
      textMissCount += 1;
      if (textMisses.length < 8) textMisses.push({ kind, px: Math.floor(px * 10) / 10, text: oneLine(text).slice(0, 40) });
    };
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (el.matches('input[type="hidden"]') || !shown(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < minInput) pushText("input", px, el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "input");
    }
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("input, textarea, select, script, style, noscript, template")) continue;
      let direct = "";
      for (const n of el.childNodes) if (n.nodeType === 3) direct += n.textContent;
      direct = oneLine(direct);
      if (!direct || !shown(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < minSecondary) pushText("secondary", px, direct);
    }
  }
  const fullText = (el) => oneLine(el.textContent).slice(0, 80);
  // Self or ancestor (closest) plus a descendant (querySelector). closest does not see descendants.
  const boxHas = (el, selector) => !!el.querySelector(selector) || !!el.closest(selector);
  const secondarySelector = "[data-testid='job-strip'], [data-testid='company-name'], [data-clip='secondary']";
  const isClipped = (el) => {
    const cs = getComputedStyle(el);
    const hides = cs.overflowX === "hidden" || cs.overflowX === "clip" || (cs.textOverflow === "ellipsis" && cs.overflowX !== "visible");
    return hides && el.clientWidth > 0 && el.scrollWidth > el.clientWidth;
  };
  const provenExpansion = (el) => {
    if (el.getAttribute("aria-expanded") !== "true") return false;
    const id = el.getAttribute("aria-controls");
    if (!id) return false;
    const target = document.getElementById(id);
    if (!target || target === el || !shown(target)) return false;
    return oneLine(target.textContent) === oneLine(el.textContent);
  };
  const clips = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!isClipped(el)) continue;
    if ([...el.querySelectorAll("*")].some(isClipped)) continue;
    const kind = classifyClip({
      statusInBox: boxHas(el, "[data-status]"),
      centsInBox: boxHas(el, "[data-cents]"),
      moneyText: /^\$[\d,]/.test(oneLine(el.textContent)),
      headerInBox: boxHas(el, "th, [data-clip='header']"),
      titleInBox: boxHas(el, "h1, [data-testid='page-title'], [data-clip='title']"),
      // The element or an ancestor that is the secondary label. A header is not secondary.
      // A descendant secondary label does not reclassify the clipped parent.
      secondaryBox: !!el.closest(secondarySelector),
    });
    const ellipsis = getComputedStyle(el).textOverflow === "ellipsis";
    clips.push({
      kind,
      text: fullText(el),
      ellipsis,
      reachable: secondaryReachable({
        text: el.textContent,
        title: el.getAttribute("title"),
        ariaLabel: el.getAttribute("aria-label"),
        expanded: provenExpansion(el),
      }),
    });
  }
  const primaryActions = [...document.querySelectorAll('[data-testid="next-step"], [data-testid="role-primary-action"]')].slice(0, 16).map((el) => {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const box = cs.display !== "none" && cs.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    const details = el.closest("details");
    const blocked = !!(details && !details.open && !el.closest("summary"));
    return {
      role: el.getAttribute("data-role") || "",
      text: oneLine(el.getAttribute("aria-label") || el.textContent).slice(0, 80),
      tag: el.tagName,
      visible: box && !blocked,
      inView: box && !blocked && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight + 0.5 && rect.right <= window.innerWidth + 0.5,
      blocked,
    };
  });
  // Document scroll width against the crawl viewport (320 / 390), not against clientWidth.
  // overflow-x: hidden can make scrollWidth equal clientWidth while the layout viewport grew.
  out.docScrollWidth = sw;
  out.viewportWidth = intendedW;
  out.tapMisses = tapMisses;
  out.tapMissCount = tapMissCount;
  out.textMisses = textMisses;
  out.textMissCount = textMissCount;
  out.clips = clips;
  out.clipCount = clips.length;
  out.primaryActions = primaryActions;
  return out;
}

// Built in Node. The page receives one function whose body already contains both helpers.
const measureDom = new Function(
  "arg",
  "const classifyClip = (" + classifyClip.toString() + ");\n" +
    "const secondaryReachable = (" + secondaryReachable.toString() + ");\n" +
    "return (" + scanPage.toString() + ")(arg, classifyClip, secondaryReachable);",
);

/** Full navigation to base+p; time is wall clock from goto until network idle (includes Playwright's 500 ms idle window). */
export async function measurePage(page, base, p, sink, { width, role, shotDir, phoneChecks = false } = {}) {
  sink.responses.length = 0;
  sink.console.length = 0;
  sink.page.length = 0;
  const t0 = Date.now();
  const res = await page.goto(base + p, { waitUntil: "load" });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState("networkidle");
  const idleMs = Date.now() - t0;
  const dom = await page.evaluate(measureDom, {
    intendedW: width ?? page.viewportSize()?.width ?? 1280,
    emptySrc: EMPTY_STATE.source,
    boundarySel: ERROR_BOUNDARY_SELECTOR,
    phoneMax: PHONE_MAX_PX,
    minTap: MIN_TAP_PX,
    minSecondary: MIN_SECONDARY_FONT_PX,
    minInput: MIN_INPUT_FONT_PX,
    phoneChecks: phoneChecks === true,
  });
  if (shotDir) {
    await page.screenshot({ path: path.join(shotDir, `crawl-${role}-w${width}-${p.replace(/[^a-z0-9]+/gi, "_")}.png`), fullPage: true });
  }
  return {
    role,
    width,
    path: p,
    status: res?.status() ?? 0,
    final: page.url().startsWith(base) ? page.url().slice(base.length) : page.url(),
    loadMs,
    idleMs,
    responses4xx5xx: [...sink.responses],
    consoleErrors: [...sink.console],
    pageErrors: [...sink.page],
    ...dom,
  };
}

/**
 * roles × widths × pages. Each role×width is a fresh context (fresh visitor sandbox).
 * With `drill` ({ seedItems, plan, records, access }, see drill.mjs): after each seeded job page loads,
 * the cost-item links on it are discovered into `drill.records`; after the pages, the drill-downs
 * `drill.plan` assigns to this role×width are loaded from the discovered links (rows get `drill: true`).
 * A role without access loads the drill-down URL directly so its refusal is checked.
 * With `drill.partC` ({ active, planLinked, records }): Part C crawl check 4 — per active job, one cost item
 * page (a discovered link to a plan-linked item) and one plan page (a labor row's plan link on that cost
 * item page, else the job page's plan card link); rows get `partC: "cost-item" | "plan"`.
 * With `evidence` ({ dir, budgetMs?, secrets? }): every load that fails evaluateCrawlRow, every load that
 * throws, and every job page whose drill-down discovery differs from the seed is captured into `dir`
 * (screenshot, HTML, URL with query, console/page errors, failed requests; see evidence.mjs) while the
 * page still shows it; the failing row gets `evidence: <json file>`. Capture never changes a verdict.
 */
export async function crawl(browser, base, { pages, roles = CRAWL_ROLES, widths = CRAWL_WIDTHS, shotDir, onRow, drill, evidence, phoneChecks = false } = {}) {
  const rows = [];
  const secrets = evidence ? (evidence.secrets ?? secretValues()) : [];
  for (const [ri, role] of roles.entries()) {
    for (const [wi, width] of widths.entries()) {
      const ctx = await browser.newContext(contextFor(width));
      const page = await ctx.newPage();
      const sink = { responses: [], console: [], page: [] };
      watch(page, sink);
      const failureRecorder = evidence ? startFailureRecorder(page, secrets) : null;
      let mark = 0;
      const capture = (kind, label, reason) =>
        captureFailure(page, { dir: evidence.dir, kind, label: `${role}-w${width}-${label}`, reason, recorder: failureRecorder, mark, secrets, extra: { role, width } }).catch(() => null);
      /** measurePage + evidence: a failing or throwing load is captured before the page moves on. */
      const load = async (href, extra = {}) => {
        mark = failureRecorder?.mark() ?? 0;
        let row;
        try {
          row = { ...(await measurePage(page, base, href, sink, { width, role, shotDir, phoneChecks })), ...extra };
        } catch (error) {
          if (evidence) await capture(extra.drill ? "drill" : extra.partC ? `partc-${extra.partC}` : "crawl", href, `load threw: ${String(error?.message ?? error).split("\n")[0]}`);
          throw error;
        }
        if (evidence) {
          const f = evaluateCrawlRow(row, { budgetMs: evidence.budgetMs ?? PAGE_BUDGET_MS, phoneChecks });
          if (f.length) {
            const files = await capture(row.drill ? "drill" : row.partC ? `partc-${row.partC}` : "crawl", href, f.join("; "));
            if (files?.json) row.evidence = files.json;
          }
        }
        return row;
      };
      try {
        await signInRole(page, base, role);
        const found = new Set();
        const planCards = {};
        for (const p of pages) {
          const row = await load(p);
          rows.push(row);
          onRow?.(row);
          const job = drill && p.match(/^\/app\/jobs\/([^/]+)$/)?.[1];
          if (job && drill.seedItems[job]) {
            const d = await discoverDrillLinks(page);
            const record = { role, width, job, containers: d.containers, hrefs: d.hrefs, estimateStatus: d.estimateStatus, planCardHrefs: d.planCardHrefs };
            drill.records.push(record);
            if (evidence) {
              const f = drillDiscoveryFailures([record], { [job]: drill.seedItems[job] }, { roles: [role], widths: [width], access: drill.access ?? DRILL_ROLE_ACCESS });
              if (f.length) await capture("drill-discovery", p, f.join("; "));
            }
            for (const h of d.hrefs) found.add(h);
            planCards[job] = d.planCardHrefs;
          }
        }
        const access = drill?.access ?? DRILL_ROLE_ACCESS;
        for (const it of drill?.plan.get(`${role}@${width}`) ?? []) {
          // Only discovered links are followed; an undiscovered item stays unloaded and fails coverage.
          const href = access[role] === false ? drillPath(it.job, it.code) : found.has(it.path) ? it.path : null;
          if (!href) continue;
          const row = await load(href, { drill: true });
          rows.push(row);
          onRow?.(row);
        }
        for (const job of drill?.partC?.active ?? []) {
          // Part C crawl check 4: one cost item page + one plan page for this active job at this role×width.
          const partCRecord = { role, width, job, costItemPath: null, planPath: null, planSource: null, why: {} };
          drill.partC.records.push(partCRecord);
          const code = partCItemFor(drill.partC.planLinked, job, ri, wi, widths.length);
          const want = code && drillPath(job, code);
          if (!code) partCRecord.why["cost-item"] = "seed has no plan-linked cost item";
          else if (!found.has(want)) partCRecord.why["cost-item"] = `${want} not linked from the job page`;
          let planLinks = [];
          if (want && found.has(want)) {
            partCRecord.costItemPath = want;
            const row = await load(want, { partC: "cost-item", job });
            rows.push(row);
            onRow?.(row);
            planLinks = await costItemPlanLinks(page);
          }
          const planHref = planLinks[0] ?? planCards[job]?.[0] ?? null;
          if (!planHref) {
            partCRecord.why.plan = "no plan link on the cost item's labor rows or the job page";
            continue;
          }
          partCRecord.planPath = planHref;
          partCRecord.planSource = planLinks[0] ? "cost item labor row" : "job page plan card";
          const row = await load(planHref, { partC: "plan", job });
          rows.push(row);
          onRow?.(row);
        }
      } finally {
        failureRecorder?.stop();
        await ctx.close();
      }
    }
  }
  return rows;
}
