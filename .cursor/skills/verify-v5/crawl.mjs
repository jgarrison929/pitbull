// Browser half of the nav crawl: signs in by role card and measures each page. Evaluation lives in
// checks.mjs (evaluateCrawlRow) so the must-fail tests can drive the same code against a fake server.
import path from "node:path";
import { BODY_FONT_SELECTOR, classifyClip, EMPTY_STATE, ERROR_BOUNDARY_SELECTOR, evaluateCrawlRow, MIN_BODY_FONT_PX, MIN_INPUT_FONT_PX, MIN_SECONDARY_FONT_PX, MIN_TAP_PX, PAGE_BUDGET_MS, PHONE_MAX_PX, PHONE_OVERFLOW_WIDTHS, secondaryReachable, textHasMoney, FIGURE_GUARD, FIGURE_EXCEPTIONS, COMPANY_NAME, NAME_SELECTOR } from "./checks.mjs";
import { costItemPlanLinks, discoverDrillLinks, DRILL_ROLE_ACCESS, drillDiscoveryFailures, drillPath, partCItemFor } from "./drill.mjs";
import { captureFailure, secretValues, startFailureRecorder } from "./evidence.mjs";

export const CRAWL_ROLES = ["executive", "pm", "superintendent", "foreman"];
export const CRAWL_WIDTHS = [320, 390, 768, 1280];
/** Extra widths /roadmap is also crawled at (5.0.1 acceptance check 12 used 375 and 1440). */
export const ROADMAP_EXTRA_WIDTHS = [375, 1440];

/** `/app/jobs/<job>/changes` — the job's full changes list. */
export function changesPath(job) {
  return `/app/jobs/${job}/changes`;
}

/** 5.1.0-c schedule page. Presence of this file at the verified commit turns the schedule crawl on. */
export const SCHEDULE_ROUTE_FILE = "v5/src/app/app/jobs/[number]/schedule/page.tsx";

export function schedulePath(job) {
  return `/app/jobs/${job}/schedule`;
}

export const SCHEDULE_PATH = /^\/app\/jobs\/[^/]+\/schedule$/;

/**
 * Who may open a job schedule. The 5.1.0-c spec crawls all four demo roles.
 * A role set to false is not skipped: the job page must not link Schedule, and the URL must be a denial.
 */
export const SCHEDULE_ROLE_ACCESS = { executive: true, pm: true, superintendent: true, foreman: true };

/** Widths a schedule page is crawled at: the main four, plus the extras the crawl already uses. */
export function scheduleWidths() {
  return [...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS];
}

function gitFailureText(error) {
  return `${error.stderr ?? ""}\n${error.stdout ?? ""}\n${error.message ?? ""}`;
}

function gitFailureLine(text) {
  return text.split("\n").map((s) => s.trim()).find((s) => /^fatal:|^error:/.test(s)) ?? null;
}

/**
 * Whether SCHEDULE_ROUTE_FILE is in `<sha>`. `git` is `(args) => string` and throws on a git error
 * (execFileSync). The sha must be a commit first: a bad object is an error, not "absent".
 * Absence is trustworthy only when `git ls-tree --name-only <sha> -- :(literal)<file>` exits 0.
 * Empty output means the path is not in this commit. Any non-zero exit — an unreadable tree or
 * object, including `error: Could not read <tree>` and `fatal: not a tree object` — is returned
 * so the check fails. "exists on disk, but not in" is not absence.
 */
export function scheduleRouteAtCommit(sha, git) {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
  } catch (error) {
    return { present: false, error: gitFailureLine(gitFailureText(error)) ?? "schedule route could not be read at this commit" };
  }
  let listed;
  try {
    listed = git(["ls-tree", "--name-only", sha, "--", `:(literal)${SCHEDULE_ROUTE_FILE}`]);
  } catch (error) {
    return { present: false, error: gitFailureLine(gitFailureText(error)) ?? "schedule route could not be read at this commit" };
  }
  const names = String(listed ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  return { present: names.length > 0, error: null };
}

/**
 * Main nav-crawl pages: /app, every seeded job page, that job's /changes, assistant, changelog, status and /roadmap.
 * /changes is every seeded job, every role, every crawl width. It is not gated on a version.
 * `scheduleJobNumbers` (active / approved jobs) add `/app/jobs/<job>/schedule` only when the route exists.
 */
export function navCrawlPages(seedJobNumbers, scheduleJobNumbers = []) {
  return [
    "/app",
    ...seedJobNumbers.flatMap((j) => [`/app/jobs/${j}`, changesPath(j)]),
    ...scheduleJobNumbers.map((j) => schedulePath(j)),
    "/app/assistant",
    "/changelog",
    "/status",
    "/roadmap",
  ];
}

/** Passes the nav crawl runs: every page × CRAWL_WIDTHS, then /roadmap and any schedule pages × ROADMAP_EXTRA_WIDTHS. */
export function navCrawlPlan(seedJobNumbers, scheduleJobNumbers = []) {
  const schedule = scheduleJobNumbers.map((j) => schedulePath(j));
  return [
    { pages: navCrawlPages(seedJobNumbers, scheduleJobNumbers), widths: CRAWL_WIDTHS },
    { pages: ["/roadmap", ...schedule], widths: ROADMAP_EXTRA_WIDTHS },
  ];
}

/**
 * Schedule link on a job page, and a direct load that is not a 200.
 * Allowed roles on an active job must see `/app/jobs/<job>/schedule`.
 * An excluded role, and a job that is not an active schedule job (Harbor), must not.
 */
export function scheduleNavFailures(rows, { scheduleJobs, access = SCHEDULE_ROLE_ACCESS } = {}) {
  const f = [];
  const want = new Set(scheduleJobs ?? []);
  for (const r of rows ?? []) {
    const job = r.path?.match(/^\/app\/jobs\/([^/]+)$/)?.[1];
    if (!job) continue;
    const links = r.scheduleLinks ?? [];
    const href = schedulePath(job);
    const seen = links.some((h) => String(h).split(/[?#]/)[0] === href);
    if (access[r.role] === false) {
      if (seen) f.push(`${r.role}@${r.width} ${r.path}: excluded role sees the schedule link`);
      continue;
    }
    if (want.has(job) && !seen) f.push(`${r.role}@${r.width} ${r.path}: schedule link missing`);
    if (!want.has(job) && seen) f.push(`${r.role}@${r.width} ${r.path}: schedule link on a job with no schedule`);
  }
  return f;
}

/** 403 or 404, and not the schedule body. 200 and 5xx are not a denial. */
export function scheduleDenialFailures(row) {
  const where = `${row.role}@${row.width} ${row.path}`;
  const status = row.status;
  if (status === 403 || status === 404) {
    if ((row.seededCounts?.activityRows ?? 0) > 0) return [`${where}: excluded role was shown the schedule`];
    return [];
  }
  if (status === 200) return [`${where}: excluded role was shown the schedule`];
  return [`${where}: HTTP ${status} is not a denial`];
}

/**
 * Every allowed role × width × active job has a schedule load. A missing one fails.
 * Excluded roles are not required to have a 200 load; their denial rows are judged by scheduleDenialFailures.
 */
export function scheduleCoverageFailures(rows, scheduleJobs, { roles = CRAWL_ROLES, widths = scheduleWidths(), access = SCHEDULE_ROLE_ACCESS } = {}) {
  const f = [];
  for (const role of roles) {
    if (access[role] === false) continue;
    for (const width of widths) {
      for (const job of scheduleJobs ?? []) {
        const path = schedulePath(job);
        if (!rows.some((r) => r.role === role && r.width === width && r.path === path && !r.scheduleDenial)) {
          f.push(`${role}@${width} ${path}: schedule missing`);
        }
      }
    }
  }
  return f;
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

export function contextFor(width, height = null, theme = null) {
  const ctx = width < 768
    ? { viewport: { width, height: height ?? 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width, height: height ?? 900 } };
  if (theme) ctx.colorScheme = theme;
  return ctx;
}

/**
 * 5.0.4 (main 4c9d3539) "Mobile and layout checks": viewports 320×568, 390×844 and 1280×800, light and dark.
 * ("5.0.4 adds the 568 px tall phone, the 800 px tall desktop, the dark theme pass, and the measures above.")
 */
export const SPEC_504_SIZES = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }];
export const SPEC_504_THEMES = ["light", "dark"];
/** Theme cookie read on the server for first paint (v5/src/lib/theme.ts THEME_COOKIE). */
export const THEME_COOKIE = "pcs_theme";

/** Loads one 5.0.4 theme pass must produce: roles × sizes × pages. */
export function spec504LoadCount(pages, { roles = CRAWL_ROLES, sizes = SPEC_504_SIZES } = {}) {
  return roles.length * sizes.length * pages.length;
}

/** A dark pass that did not render dark (no `dark` class on <html>) proves nothing; same for a light pass. */
export function themeFailures(rows) {
  const f = [];
  for (const r of rows) {
    if (!r.theme) continue;
    if (r.htmlTheme == null) f.push(`${r.role}@${r.width}x${r.height ?? "?"} ${r.theme} ${r.path}: theme not recorded`);
    else if (r.htmlTheme !== r.theme) f.push(`${r.role}@${r.width}x${r.height ?? "?"} ${r.theme} ${r.path}: page rendered ${r.htmlTheme}, pass is ${r.theme}`);
  }
  return f;
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
 * Job-strip clause at 320 and 390. A missing strip on /app or /app/jobs/* fails closed
 * ({ missing: true }). Other paths keep an empty hit list when the strip is absent.
 * The page runs this same function: measureDom injects it next to classifyClip.
 */
export function jobStripHits(path, hasStrip, hits) {
  const onSurface = path === "/app" || (typeof path === "string" && path.startsWith("/app/jobs/"));
  if (!hasStrip) return onSurface ? [{ missing: true }] : [];
  return Array.isArray(hits) ? hits : [];
}

/**
 * DOM scan passed to page.evaluate. classifyClip, secondaryReachable, textHasMoney and jobStripHits
 * are arguments so the page runs the same functions as the unit tests. Playwright serializes one function; the page does not eval.
 * Phone observations are recorded only when phoneChecks is true. Otherwise those fields are omitted,
 * and evaluateCrawlRow's default (phoneChecks false) does not read them.
 */
function scanPage(arg, classifyClip, secondaryReachable, textHasMoney, jobStripHits) {
  const { intendedW, emptySrc, boundarySel, phoneMax, minTap, minSecondary, minInput, minBody, bodySel, phoneChecks, phoneOverflowWidths, figureGuard, figureExceptions, nameSelector, path } = arg;
  const FIGURE_GUARD_RE = new RegExp(figureGuard);
  const FIGURE_EXCEPTION_RES = (figureExceptions ?? []).map((src) => new RegExp(src, "g"));
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
    htmlTheme: document.documentElement.classList.contains("dark") ? "dark" : "light",
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
      changeItems: document.querySelectorAll('[data-testid="job-changes-full"] li').length,
      activityRows: document.querySelectorAll('[data-testid="gantt-activity"]').length,
    },
    scheduleLinks: [...document.querySelectorAll("a[href]")]
      .map((a) => (a.getAttribute("href") ?? "").split(/[?#]/)[0])
      .filter((h) => /^\/app\/jobs\/[^/]+\/schedule$/.test(h)),
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
    // 5.0.4-c check 2: p, li, td and button ≥ 16 px unless data-text="label".
    for (const el of document.querySelectorAll(bodySel)) {
      if (!shown(el) || el.closest('[data-text="label"]')) continue;
      const text = oneLine(el.innerText || el.getAttribute("aria-label") || "");
      if (!text) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < minBody) {
        textMissCount += 1;
        if (textMisses.length < 8) textMisses.push({ kind: "body", tag: el.tagName.toLowerCase(), px: Math.floor(px * 10) / 10, text: text.slice(0, 40) });
      }
    }
  }
  const fullText = (el) => oneLine(el.textContent).slice(0, 80);
  // Self or ancestor (closest) plus a descendant (querySelector). closest does not see descendants.
  const boxHas = (el, selector) => !!el.querySelector(selector) || !!el.closest(selector);
  // 5.0.4-b check 8 (main 4c9d3539): the company name must show in full, so it is not a secondary label any more.
  const secondarySelector = "[data-testid='job-strip'], [data-clip='secondary']";
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
  // Money, a status pill, a table header, or an h1 / page title. A container that cuts one of these
  // is reported even when a different child is clipped on its own (a titled ellipsis beside the money).
  const protectedSelector = "[data-cents], [data-status], th, [data-clip='header'], h1, [data-testid='page-title'], [data-clip='title']";
  const directText = (node) => {
    let direct = "";
    for (const n of node.childNodes) if (n.nodeType === 3) direct += n.textContent;
    return oneLine(direct);
  };
  const sticksOutOf = (node, box) => {
    const r = node.getBoundingClientRect();
    if (!(r.width > 0 || r.height > 0)) return false;
    return r.right > box.right + 0.5 || r.left < box.left - 0.5;
  };
  const hidesProtected = (el) => {
    const box = el.getBoundingClientRect();
    for (const node of el.querySelectorAll("*")) {
      const protectedNode = node.matches(protectedSelector) || textHasMoney(directText(node));
      if (protectedNode && sticksOutOf(node, box)) return true;
    }
    return false;
  };
  const clips = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!isClipped(el)) continue;
    // Nested non-protected clips stay deepest-only. A container that itself cuts protected content is kept.
    if ([...el.querySelectorAll("*")].some(isClipped) && !hidesProtected(el)) continue;
    const kind = classifyClip({
      statusInBox: boxHas(el, "[data-status]"),
      centsInBox: boxHas(el, "[data-cents]"),
      moneyText: textHasMoney(oneLine(el.textContent)),
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
  // 5.0.4-a checks 1, 5, 7 and 9: every next-step label on /app (the overflow line is not a next-step element).
  const ellipsisOf = (el) => getComputedStyle(el).textOverflow === "ellipsis" || [...el.querySelectorAll("*")].some((c) => getComputedStyle(c).textOverflow === "ellipsis");
  if (path === "/app") {
    const steps = [...document.querySelectorAll('[data-testid="next-step"]')];
    out.nextStepCount = steps.length;
    out.nextSteps = steps.slice(0, 32).map((el) => {
      const rect = el.getBoundingClientRect();
      return { label: oneLine(el.innerText || el.textContent), href: el.getAttribute("href"), visible: shown(el), top: rect.top, viewportH: window.innerHeight, w: rect.width, h: rect.height, ellipsis: ellipsisOf(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });
  }
  // 5.0.4-b checks 1 and 6: one non-empty h1 and one page-purpose of 10 to 90 characters that fits.
  {
    const h1s = [...document.querySelectorAll("h1")].filter((e) => shown(e));
    const purposes = [...document.querySelectorAll('[data-testid="page-purpose"]')].filter((e) => shown(e));
    const pp = purposes[0];
    out.titles = {
      h1Count: h1s.length,
      h1Texts: h1s.map((e) => oneLine(e.innerText)).slice(0, 4),
      purposeCount: purposes.length,
      purpose: pp ? { text: oneLine(pp.innerText).slice(0, 200), len: oneLine(pp.innerText).length, scrollWidth: pp.scrollWidth, clientWidth: pp.clientWidth, ellipsis: ellipsisOf(pp), fontPx: parseFloat(getComputedStyle(pp).fontSize) } : null,
    };
  }
  // 5.0.4-b checks 2 and 3: cost index values and words per role.
  {
    const strip = document.querySelector('[data-testid="job-strip"]');
    out.indexes = {
      metricIds: [...document.querySelectorAll('[data-testid$="-cpi"], [data-testid$="-spi"]')].filter((e) => shown(e)).map((e) => e.getAttribute("data-testid")),
      stripText: strip && shown(strip) ? oneLine(strip.innerText) : null,
      stripMetricIds: strip ? [...strip.querySelectorAll('[data-testid$="-cpi"], [data-testid$="-spi"]')].filter((e) => shown(e)).map((e) => e.getAttribute("data-testid")) : [],
      stripPills: strip ? [...strip.querySelectorAll("a")].filter((e) => shown(e)).map((e) => oneLine(e.innerText)).slice(0, 16) : [],
    };
  }
  // 5.0.4-b check 7: each job-strip-label has a job number and fits.
  if (path === "/app" || path.startsWith("/app/")) {
    out.jobStripLabels = [...document.querySelectorAll('[data-testid="job-strip-label"]')].filter((e) => shown(e)).slice(0, 16).map((e) => ({ text: oneLine(e.innerText).slice(0, 80), scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }));
  }
  // 5.0.4-c check 1 and 5.0.4-e check 1: figures per [data-card] and the stray-number guard. Every card is recorded
  // with its top so the evaluator can apply "above the fold" (c-1) or "above the fold or not" (e-1 phone cost rows).
  {
    const fold = window.innerHeight;
    const strip = (text) => FIGURE_EXCEPTION_RES.reduce((t, re) => t.replace(re, ""), String(text));
    const cards = [];
    for (const card of document.querySelectorAll("[data-card]")) {
      if (!shown(card)) continue;
      const r = card.getBoundingClientRect();
      const figs = [...card.querySelectorAll("[data-figure]")].filter((e) => shown(e) && !e.closest("details:not([open]) > :not(summary)"));
      const stray = [];
      const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        // A `display: contents` element has no box of its own: its text is visible when its nearest boxed ancestor is.
        let boxed = el;
        while (boxed && boxed !== card && getComputedStyle(boxed).display === "contents") boxed = boxed.parentElement;
        if (!el || el.closest("[data-figure], script, style") || !shown(boxed) || el.closest("details:not([open]) > :not(summary)")) continue;
        if (nameSelector && el.closest(nameSelector)) continue; // #80: a name element's whole text is dropped first
        if (el.closest("[data-card]") !== card) continue;
        const m = strip(n.textContent).match(FIGURE_GUARD_RE);
        if (m) stray.push(oneLine(n.textContent).slice(0, 60));
      }
      const row = card.matches('[data-testid="cost-tree-row"]') && card.closest('[data-testid="cost-tree-scroll-mobile"]');
      const rollup = row ? Boolean(card.querySelector("button[aria-expanded]")) : false;
      cards.push({
        testid: card.getAttribute("data-testid"),
        code: card.getAttribute("data-code"),
        top: r.top,
        aboveFold: r.top < fold,
        costRow: Boolean(row),
        rollup,
        primary: figs.filter((e) => e.getAttribute("data-figure") === "primary").length,
        secondary: figs.filter((e) => e.getAttribute("data-figure") === "secondary").length,
        stray: stray.slice(0, 4),
        money: rollup ? [...card.querySelectorAll("[data-cents]")].filter((e) => shown(e) && !e.closest("details:not([open]) > :not(summary)")).map((e) => ({ text: oneLine(e.innerText), cents: e.getAttribute("data-cents"), title: e.getAttribute("title") })).slice(0, 6) : undefined,
      });
    }
    out.cards = cards.slice(0, 200);
    out.cardCount = cards.length;
  }
  // 5.0.4-b check 8 (#78): `header [data-testid="company-name"]`: no horizontal overflow, text-overflow not ellipsis,
  // collapsed innerText equal to the seed name, no aria-hidden on it or an ancestor, and the exact name visible as text
  // inside header (the DOM equivalent of `header.getByText(name, { exact: true })` being visible).
  if (path === "/app" || path.startsWith("/app/")) {
    const cn = document.querySelector('header [data-testid="company-name"]');
    if (!cn || !shown(cn)) out.companyName = { missing: true };
    else {
      let ariaHidden = false;
      for (let a = cn; a; a = a.parentElement) if (a.getAttribute && a.getAttribute("aria-hidden") === "true") ariaHidden = true;
      const header = cn.closest("header");
      const exactVisible = [...header.querySelectorAll("*")].some((e) => shown(e) && oneLine(e.textContent) === arg.companyName && ![...e.children].some((c) => oneLine(c.textContent) === arg.companyName));
      out.companyName = {
        text: oneLine(cn.innerText),
        scrollWidth: cn.scrollWidth,
        clientWidth: cn.clientWidth,
        textOverflow: getComputedStyle(cn).textOverflow,
        ariaHidden,
        exactVisible,
      };
    }
  }
  // 5.0.4-0 clause 2, same gate as the other phone observations: 320 and 390 only.
  // A strip with overflow-x:auto can keep document scrollWidth inside the viewport while a
  // flex-shrink:0 pill's box still ends past clientWidth. Clause 1 does not see that.
  if (Array.isArray(phoneOverflowWidths) && phoneOverflowWidths.includes(intendedW)) {
    const clientWidth = doc.clientWidth;
    const strip = document.querySelector("[data-testid='job-strip']");
    const stripPastRight = [];
    if (strip) {
      for (const el of strip.querySelectorAll("*")) {
        if (!shown(el)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth) {
          stripPastRight.push({
            text: oneLine(el.innerText || el.getAttribute("aria-label") || el.textContent).slice(0, 80),
            right: rect.right,
            clientWidth,
          });
        }
      }
    }
    // if (strip) alone would record [] when the element is absent and the row would pass.
    out.stripPastRight = jobStripHits(path, !!strip, stripPastRight);
  }
  return out;
}

// Built in Node. The page receives one function whose body already contains both helpers.
const measureDom = new Function(
  "arg",
  "const classifyClip = (" + classifyClip.toString() + ");\n" +
    "const secondaryReachable = (" + secondaryReachable.toString() + ");\n" +
    "const textHasMoney = (" + textHasMoney.toString() + ");\n" +
    "const jobStripHits = (" + jobStripHits.toString() + ");\n" +
    "return (" + scanPage.toString() + ")(arg, classifyClip, secondaryReachable, textHasMoney, jobStripHits);",
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
    minBody: MIN_BODY_FONT_PX,
    bodySel: BODY_FONT_SELECTOR,
    phoneChecks: phoneChecks === true,
    phoneOverflowWidths: PHONE_OVERFLOW_WIDTHS,
    figureGuard: FIGURE_GUARD.source,
    companyName: COMPANY_NAME,
    figureExceptions: FIGURE_EXCEPTIONS.map((r) => r.source),
    nameSelector: NAME_SELECTOR,
    path: p,
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
 * With `schedule` ({ jobs, deniedJobs, access }): after the page list, each denied job (and every schedule
 * job, for a role with access false) is loaded and tagged `scheduleDenial`. Those rows are a denial
 * (403 or 404), not a 200. Allowed schedule URLs belong in `pages` so they get every per-load check.
 * With `evidence` ({ dir, budgetMs?, secrets? }): every load that fails evaluateCrawlRow, every load that
 * throws, and every job page whose drill-down discovery differs from the seed is captured into `dir`
 * (screenshot, HTML, URL with query, console/page errors, failed requests; see evidence.mjs) while the
 * page still shows it; the failing row gets `evidence: <json file>`. Capture never changes a verdict.
 */
export async function crawl(browser, base, { pages, roles = CRAWL_ROLES, widths = CRAWL_WIDTHS, heights = null, theme = null, shotDir, onRow, drill, schedule, evidence, phoneChecks = false } = {}) {
  const rows = [];
  const secrets = evidence ? (evidence.secrets ?? secretValues()) : [];
  for (const [ri, role] of roles.entries()) {
    for (const [wi, width] of widths.entries()) {
      const height = heights?.[width] ?? null;
      const ctx = await browser.newContext(contextFor(width, height, theme));
      // 5.0.4 theme pass: the server reads the theme cookie for first paint, so set it before any load.
      if (theme) await ctx.addCookies([{ name: THEME_COOKIE, value: theme, url: base }]);
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
          row = { ...(await measurePage(page, base, href, sink, { width, role, shotDir: shotDir && theme ? path.join(shotDir, theme) : shotDir, phoneChecks })), ...extra };
          if (theme) Object.assign(row, { theme, height: page.viewportSize()?.height ?? height });
        } catch (error) {
          if (evidence) await capture(extra.drill ? "drill" : extra.partC ? `partc-${extra.partC}` : "crawl", href, `load threw: ${String(error?.message ?? error).split("\n")[0]}`);
          throw error;
        }
        if (evidence) {
          const f = row.scheduleDenial
            ? scheduleDenialFailures(row)
            : evaluateCrawlRow(row, { budgetMs: evidence.budgetMs ?? PAGE_BUDGET_MS, phoneChecks });
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
        if (schedule) {
          const scheduleAccess = schedule.access ?? SCHEDULE_ROLE_ACCESS;
          const denied = scheduleAccess[role] === false
            ? [...(schedule.jobs ?? []), ...(schedule.deniedJobs ?? [])]
            : (schedule.deniedJobs ?? []);
          for (const job of denied) {
            const row = await load(schedulePath(job), { scheduleDenial: true });
            rows.push(row);
            onRow?.(row);
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
