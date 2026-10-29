// 5.0.4 page checks that run on named pages (main 05cd947c, the Planner's #80): c-6 / i-6 words next to color, i-1 assistant chips,
// i-2 cost-item KPI cards, i-5 shell targets. Each pass is one fresh context per role × size × theme.
// 5.0.4-i landed in rc/5.0.4 with #77 (a3413ef9); a page that is built correctly passes i-1 to i-6.
import { CRAWL_ROLES, contextFor, signInRole, THEME_COOKIE } from "./crawl.mjs";
import { MIN_TAP_PX, FIGURE_EXCEPTIONS } from "./checks.mjs";
import { confirmIfDialog } from "./confirm-dialog.mjs";
import { resetDemo } from "./numbers.mjs";

/** c-6: "a match for `/On track|Watch|At risk|[+−]\$/`". */
export const STATUS_WORD = /On track|Watch|At risk|[+−]\$/;
/** i-2: "Each figure of $10,000.00 or more renders short (matches `/\$\d+(\.\d)?[KMB]/`)". */
export const SHORT_MONEY = /\$\d+(\.\d)?[KMB]/;
export const SHORT_MONEY_MIN_CENTS = 1_000_000;

/** d-1, the #78 table: form, submit test id (or the line-form submit), idle submit text, required fields by test id
 * (a trailing "-" is a prefix: "each line's `report-mh-<code>` and `report-qty-<code>`"). */
export const D1_TABLE = [
  { form: "ReportWorkForm", submitSel: "report-work", text: "Report day's work", fields: ["report-mh-", "report-qty-"] },
  { form: "ReturnReportForm", submitSel: "return-report", text: "Return to foreman", fields: ["return-reason"] },
  { form: "ApproveReportForm", submitSel: "approve-report", text: "Approve report", fields: [] },
  { form: "AddPlanLineForm", submitSel: "add-line-submit", text: "Add line", fields: ["add-line-activity", "add-line-qty", "add-line-workers", "add-line-hours"] },
  { form: "PlanLineEditor", submitSel: "LINE-FORM", text: "Save", fields: [] },
  { form: "Submit plan", submitSel: "submit-plan", text: "Submit plan", fields: [] },
];

export const PASSES = {
  "c-6": { name: "5.0.4-c check 6: color is never the only signal (PM, 1440×900, light, /app and 24-077)", roles: ["pm"], sizes: [{ width: 1440, height: 900 }], themes: ["light"], pages: ["/app", "/app/jobs/24-077"], probe: "statusWords" },
  "i-6": { name: "5.0.4-i check 6: 5.0.4-c check 6 passes on /app/jobs/24-077", roles: ["pm"], sizes: [{ width: 1440, height: 900 }], themes: ["light"], pages: ["/app/jobs/24-077"], probe: "statusWords" },
  "i-1": { name: "5.0.4-i check 1: assistant chips stay on screen (each role, /app, 320×568, light)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }], themes: ["light"], pages: ["/app"], probe: "chips" },
  "i-2": { name: "5.0.4-i check 2: cost-item KPI cards fit and use short money (each role, 07-300, 320×568, light and dark)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }], themes: ["light", "dark"], pages: ["/app/jobs/24-077/cost-items/07-300"], probe: "kpiCards", kpiRef: "24-077/07-300" },
  "c-1n": { name: "5.0.4-c check 1 name elements: job-name on portfolio phone cards, crew-name on 07-300 crew entries (each role, 320×568 and 390×844, light)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light"], pages: ["/app", "/app/jobs/24-077/cost-items/07-300"], probe: "nameHooks" },
  "a-2": { name: "5.0.4-a check 2: one tap to the first action (each role, 320×568/390×844/1280×800, light)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }], themes: ["light"], pages: ["/app"], probe: "firstTarget", action: "clickFirstStep" },
  "a-6": { name: "5.0.4-a check 6: seeded next-step counts after reset (each role, 320×568/390×844/1280×800, light)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }], themes: ["light"], pages: ["/app"], probe: "stepCount" },
  "d-1": { name: "5.0.4-d check 1: no required field behind a tap (foreman and superintendent, 320×568 and 390×844, light)", roles: ["foreman", "superintendent"], sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light"], pages: ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031"], probe: "requiredFields" },
  "d-1e": { name: "5.0.4-d check 1: PlanLineEditor after Edit (foreman and superintendent, 25-031, 320×568 and 390×844, light)", roles: ["foreman", "superintendent"], sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light"], pages: ["/app/jobs/25-031"], probe: "requiredFields", action: "clickEdit" },
  "a-3": { name: "5.0.4-a check 3: foreman home order (320×568, 390×844, light and dark)", roles: ["foreman"], sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app"], probe: "homeOrder" },
  "a-8": { name: "5.0.4-a check 8: collapsed assistant on the foreman home (390×844, light and dark)", roles: ["foreman"], sizes: [{ width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app"], probe: "assistantCollapsed" },
  "b-4": { name: "5.0.4-b check 4: plain words on first use (PM, 25-031, 1440×900 and 390×844, light and dark)", roles: ["pm"], sizes: [{ width: 1440, height: 900 }, { width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app/jobs/25-031"], probe: "firstUse" },
  "b-5": { name: "5.0.4-b check 5: at-risk summary (executive 390×844 and 1280×800, light and dark; foreman absent)", roles: ["executive", "foreman"], sizes: [{ width: 390, height: 844 }, { width: 1280, height: 800 }], themes: ["light", "dark"], pages: ["/app"], probe: "atRisk", cvFrom: true },
  "d-6": { name: "5.0.4-d check 6: primary plan buttons full width (390×844, light)", roles: ["foreman", "superintendent"], sizes: [{ width: 390, height: 844 }], themes: ["light"], pages: ["/app/jobs/25-031", "/app/jobs/24-077"], probe: "fullWidth" },
  "e-2": { name: "5.0.4-e check 2: no table on phones; 07-300 entry cards (each role, 320 and 390, light and dark)", roles: CRAWL_ROLES, sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031", "/app/jobs/24-077/cost-items/07-300"], probe: "phoneTables" },
  "e-4": { name: "5.0.4-e check 4: phone cost rows fit (PM and executive, 320×568 and 390×844, light and dark)", roles: ["pm", "executive"], sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light", "dark"], pages: ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031"], probe: "costRowsFit" },
  "e-5": { name: "5.0.4-e check 5: phone KPI fold and U+2212 (PM, 25-031, 320×568, light and dark)", roles: ["pm"], sizes: [{ width: 320, height: 568 }], themes: ["light", "dark"], pages: ["/app/jobs/25-031"], probe: "kpiFold" },
  "f-1": { name: "5.0.4-f check 1: plan lines as cards on phones (foreman and superintendent, 320×568 and 390×844, light)", roles: ["foreman", "superintendent"], sizes: [{ width: 320, height: 568 }, { width: 390, height: 844 }], themes: ["light"], pages: ["/app/jobs/24-077", "/app/jobs/25-031"], probe: "planCards", followPlan: true },
  "c-7": { name: "5.0.4-c check 7: tabular, end-aligned figures (PM, 1440×900, light and dark)", roles: ["pm"], sizes: [{ width: 1440, height: 900 }], themes: ["light", "dark"], pages: ["/app/jobs/24-077", "/app/jobs/24-077/cost-items/07-300", "PLAN:/app/jobs/24-077"], probe: "tabular", probeArg: "EXCEPTIONS" },
  "i-5": { name: "5.0.4-i check 5: brand link and user-menu ≥ 44×44 (each role, 390×844, light, every /app page)", roles: CRAWL_ROLES, sizes: [{ width: 390, height: 844 }], themes: ["light"], pages: null, probe: "shellTargets" },
};

// In-page probes. They run in the browser and must be self-contained.
export const PROBES = {
  statusWords: () => {
    const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const out = [];
    for (const e of document.querySelectorAll(".text-positive, .text-caution, .text-negative")) {
      if (!shown(e)) continue;
      const box = e.closest('[data-card], tr, [data-testid="cost-tree-row"]');
      out.push({ own: (e.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80), box: box ? (box.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 400) : null, cls: [...e.classList].filter((c) => /^text-(positive|caution|negative)$/.test(c)).join(" ") });
    }
    return { colored: out };
  },
  // The chip row is `assistant-chips` (#77, assistant-panel.tsx); on a build without it, the element just before the
  // assistant <form> that holds assistant-input. The chips are its buttons. 5.0.4-i check 1 names no selector.
  chips: () => {
    const cw = document.documentElement.clientWidth;
    const form = document.querySelector('[data-testid="assistant-input"]')?.closest("form");
    const row = document.querySelector('[data-testid="assistant-chips"]') ?? form?.previousElementSibling ?? null;
    if (!row) return { missing: true, clientWidth: cw };
    const chips = [...row.querySelectorAll("button")].map((b) => ({ text: (b.innerText ?? "").trim().slice(0, 40), right: b.getBoundingClientRect().right }));
    return { clientWidth: cw, rowScrollWidth: row.scrollWidth, rowClientWidth: row.clientWidth, chips };
  },
  // Scoped to the KPI strip: a KPI [data-card] is one that holds one of the 7 KPI test ids (#80: the id sits on the
  // card's primary figure). Plan or entry cards elsewhere on the page are not KPI cards.
  kpiCards: (ids) => {
    const sel = (ids ?? []).map((id) => `[data-testid="${id}"]`).join(", ");
    const cards = sel ? [...document.querySelectorAll("main [data-card]")].filter((c) => c.getClientRects().length > 0 && (c.matches(sel) || c.querySelector(sel))) : [];
    return {
      cards: cards.map((c) => ({
        testid: c.getAttribute("data-testid") ?? c.querySelector("[data-testid]")?.getAttribute("data-testid") ?? null,
        primary: c.querySelectorAll('[data-figure="primary"]').length,
        secondary: c.querySelectorAll('[data-figure="secondary"]').length,
        figures: [...c.querySelectorAll("[data-figure]")].map((f) => ({ text: (f.innerText ?? "").trim(), cents: f.getAttribute("data-cents") ?? f.querySelector("[data-cents]")?.getAttribute("data-cents") ?? null, title: f.getAttribute("title") ?? f.querySelector("[title]")?.getAttribute("title") ?? null, sw: f.scrollWidth, cw: f.clientWidth })),
      })),
      cardCount: cards.length,
    };
  },
  /** c-1 (#80) name elements that the build adds: `job-name` ("the `{p.job.name}` div inside `job-link`" on the portfolio
   * phone card) and `crew-name` ("the `{e.crew}` text, inside `cost-entry-plan-link` or the plain span"). */
  nameHooks: () => {
    // #81 renders crew-name inside the plan link as `display: contents` (no box of its own): such an element counts as
    // shown when its parent is.
    const shown = (e) => !!e && getComputedStyle(e).visibility !== "hidden" && (e.getClientRects().length > 0 || (getComputedStyle(e).display === "contents" && shown(e.parentElement)));
    const one = (s) => (s ?? "").replace(/\s+/g, " ").trim();
    const portfolio = [...document.querySelectorAll("[data-card]")].filter((c) => shown(c) && [...c.querySelectorAll('[data-testid="job-link"]')].some(shown));
    const planLinks = [...document.querySelectorAll('[data-testid="cost-entry-plan-link"]')].filter(shown);
    return {
      portfolioCards: portfolio.map((c) => { const n = [...c.querySelectorAll('[data-testid="job-name"]')].find(shown); return { text: one(c.querySelector('[data-testid="job-link"]')?.innerText).slice(0, 60), jobName: n ? one(n.innerText) : null }; }),
      planLinks: planLinks.map((a) => { const n = a.querySelector('[data-testid="crew-name"]') ?? (a.matches('[data-testid="crew-name"]') ? a : null); return { text: one(a.innerText), crewName: n ? one(n.innerText) : null }; }),
      crewNames: [...document.querySelectorAll('[data-testid="crew-name"]')].filter(shown).map((e) => one(e.innerText)),
    };
  },
  /** i-2 (#80): the 7 KPI cards by the test id on their primary figure, plus the page's own EAC and AC anchors. */
  kpiNamed: (ids) => {
    const one = (s) => (s ?? "").replace(/\s+/g, " ").trim();
    const named = {};
    for (const id of ids) {
      const e = document.querySelector(`[data-testid="${id}"]`);
      if (!e) { named[id] = null; continue; }
      const c = e.closest("[data-card]");
      named[id] = {
        primaryIsFigure: e.getAttribute("data-figure") === "primary",
        cents: e.querySelector("[data-cents]")?.getAttribute("data-cents") ?? e.getAttribute("data-cents"),
        text: one(e.innerText),
        secondaries: c ? [...c.querySelectorAll('[data-figure="secondary"]')].map((x) => one(x.innerText)) : [],
      };
    }
    return {
      named,
      forecastEac: document.querySelector('[data-testid="cost-item-forecast"]')?.getAttribute("data-eac-cents") ?? null,
      totals: [...document.querySelectorAll('[data-testid="cost-item-totals"]')].map((x) => x.getAttribute("data-total-cents")),
    };
  },
  /** i-2 desktop row (#80): "at 1440×900, `[data-testid="cost-tree-scroll"] [data-testid="cost-tree-row"][data-code="07-300"]`.
   * Its columns are the direct child `div`s: 2 Installed, 3 % complete, 4 budget, 5 Earned, 6 Actual". */
  kpiRefDesktop: (code) => {
    const one = (s) => (s ?? "").replace(/\s+/g, " ").trim();
    const r = document.querySelector(`[data-testid="cost-tree-scroll"] [data-testid="cost-tree-row"][data-code="${code}"]`);
    if (!r) return null;
    const cols = [...r.children].filter((x) => x.tagName === "DIV");
    const em = r.querySelector(`[data-testid="earned-mh-${code}"]`);
    return {
      cbCents: r.getAttribute("data-cb-cents"),
      earnedCents: cols[4]?.querySelector("[data-cents]")?.getAttribute("data-cents") ?? null,
      actualCents: cols[5]?.querySelector("[data-cents]")?.getAttribute("data-cents") ?? null,
      installedLine: one(cols[1]?.firstElementChild?.innerText ?? ""),
      earnedMh: em ? one(em.innerText) : null,
      actualMhMilli: r.getAttribute("data-actual-mh-milli"),
    };
  },
  /** i-2 phone row (#80): "at 390×844, `[data-testid="cost-list"] [data-testid="cost-tree-row"][data-code="07-300"]`". */
  kpiRefPhone: (code) => {
    const r = document.querySelector(`[data-testid="cost-list"] [data-testid="cost-tree-row"][data-code="${code}"]`);
    if (!r) return null;
    return { eacCents: r.querySelector('[data-figure="primary"] [data-cents]')?.getAttribute("data-cents") ?? null };
  },
  homeOrder: () => {
    const main = document.querySelector("main");
    const first = main?.querySelector("section");
    const steps = document.querySelector('[data-testid="next-steps"]');
    const firstStep = [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).find((e) => e.getClientRects().length > 0) ?? null;
    const assistant = [...document.querySelectorAll('[data-testid^="assistant-"]')].find((e) => /^assistant-(rail|panel|home|inline|sheet|phone|page)$/.test(e.getAttribute("data-testid")) || e.querySelector('[data-testid="assistant-input"]')) ?? document.querySelector('[data-testid="assistant-input"]');
    const strip = document.querySelector('[data-testid="job-strip"]');
    const shown = (e) => !!e && e.getClientRects().length > 0;
    return {
      firstSection: first ? first.getAttribute("data-testid") : null,
      firstStepBottom: shown(firstStep) ? firstStep.getBoundingClientRect().bottom : null,
      assistantTop: shown(assistant) ? assistant.getBoundingClientRect().top : null,
      strip: shown(strip) ? { bottom: strip.getBoundingClientRect().bottom, indexes: strip.querySelectorAll('[data-testid$="-cpi"], [data-testid$="-spi"]').length } : null,
      stepsTop: shown(steps) ? steps.getBoundingClientRect().top : null,
    };
  },
  assistantCollapsed: () => {
    const box = (e) => (e && e.getClientRects().length > 0 ? (({ width, height }) => ({ w: width, h: height }))(e.getBoundingClientRect()) : null);
    const input = document.querySelector('[data-testid="assistant-input"]');
    const form = input?.closest("form");
    return {
      input: box(input),
      mic: box(form?.querySelector('button[aria-label="Speak"]')),
      send: box(form?.querySelector('button[aria-label="Send"]')),
      messages: [...document.querySelectorAll('[data-testid="assistant-message"]')].filter((e) => e.getClientRects().length > 0).length,
      show: box(document.querySelector('[data-testid="assistant-show-conversation"]')),
    };
  },
  // b-4: the visible text nodes in document order, joined, with each term's first occurrence and its context.
  firstUse: () => {
    const shown = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; } return el.getClientRects().length > 0; };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = "";
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest("script, style, noscript, template") || !shown(el)) continue;
      text += n.textContent;
    }
    return { text: text.replace(/\s+/g, " ") };
  },
  atRisk: () => {
    const ul = document.querySelector('[data-testid="at-risk-summary"]');
    if (!ul || ul.getClientRects().length === 0) return { present: false };
    return {
      present: true,
      lines: [...ul.querySelectorAll(":scope > li")].map((li) => ({
        text: (li.innerText ?? "").replace(/\s+/g, " ").trim(),
        dollars: [...li.innerText.matchAll(/[−-]?\$[\d,.]+[KMB]?/g)].map((m) => m[0]),
        figures: [...li.querySelectorAll("[data-cents]")].map((f) => ({ text: (f.innerText ?? "").trim(), cents: f.getAttribute("data-cents"), title: f.getAttribute("title") })),
      })),
    };
  },
  fullWidth: () => {
    const out = [];
    const content = (e) => { const cs = getComputedStyle(e); return e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };
    for (const [label, el] of [["submit-plan", document.querySelector('[data-testid="submit-plan"]')], ["Report day's work", document.querySelector('[data-testid="report-work"]')]]) {
      if (!el || el.getClientRects().length === 0) continue;
      const card = el.closest('[data-card], [data-testid="plan-card"]');
      out.push({ label, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, cardContent: card ? content(card) : null });
    }
    return { buttons: out };
  },
  phoneTables: () => {
    const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const cw = document.documentElement.clientWidth;
    const main = document.querySelector("main");
    const past = main ? [...main.querySelectorAll("*")].filter((e) => shown(e) && e.getBoundingClientRect().right > cw + 0.5).length : 0;
    const cards = document.querySelector('[data-testid="cost-item-entries-cards"]');
    const entries = [...document.querySelectorAll('[data-testid="cost-entry-card"]')].filter(shown).map((c) => ({
      amountPrimary: !!c.querySelector('[data-testid="cost-entry-card-amount"][data-figure="primary"], [data-figure="primary"] [data-testid="cost-entry-card-amount"], [data-testid="cost-entry-card-amount"] [data-figure="primary"]'),
      labor: !!c.querySelector('[data-testid="cost-entry-card-mh"], [data-testid="cost-entry-card-rate"]') || /labor/i.test(c.getAttribute("data-kind") ?? c.innerText),
      mh: (() => { const e = c.querySelector('[data-testid="cost-entry-card-mh"]'); return !!e && shown(e) && !e.closest("details:not([open])"); })(),
      rate: (() => { const e = c.querySelector('[data-testid="cost-entry-card-rate"]'); return !!e && shown(e) && !e.closest("details:not([open])"); })(),
    }));
    return { tables: main ? [...main.querySelectorAll("table")].filter(shown).length : 0, past, clientWidth: cw, entryCards: cards ? shown(cards) : null, entries };
  },
  costRowsFit: () => {
    const scroll = document.querySelector('[data-testid="cost-tree-scroll-mobile"]');
    if (!scroll || scroll.getClientRects().length === 0) return { missing: true };
    const out = [];
    for (const row of scroll.querySelectorAll('[data-testid="cost-tree-row"]')) {
      const spans = [...row.querySelectorAll("[data-cents]")].filter((e) => e.getClientRects().length > 0).filter((e, _, all) => !all.some((o) => o !== e && o.contains(e)));
      const rects = spans.map((e) => e.getBoundingClientRect());
      for (const [i, e] of spans.entries()) {
        const parent = e.parentElement;
        const ps = getComputedStyle(parent);
        const pr = parent.getBoundingClientRect();
        const contentRight = pr.right - parseFloat(ps.paddingRight) - parseFloat(ps.borderRightWidth);
        out.push({ code: row.getAttribute("data-code"), text: (e.innerText ?? "").trim(), sw: e.scrollWidth, cw: e.clientWidth, right: rects[i].right, contentRight });
      }
      // side by side: same line (vertical overlap), gap between consecutive spans
      for (let i = 1; i < rects.length; i++) {
        const a = rects[i - 1], b = rects[i];
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0) out.push({ code: row.getAttribute("data-code"), gap: Math.abs(b.left - a.right) < Math.abs(a.left - b.right) ? b.left - a.right : a.left - b.right, pair: [(spans[i - 1].innerText ?? "").trim(), (spans[i].innerText ?? "").trim()] });
      }
    }
    return { spans: out };
  },
  kpiFold: () => {
    const card = (id) => document.querySelector(`[data-testid="${id}"]`)?.closest("[data-card]") ?? null;
    const top = (e) => (e ? e.getBoundingClientRect().top + window.scrollY : null);
    const hy = document.querySelector("main")?.innerText.match(/-\$/g)?.length ?? 0;
    return { eacTop: top(card("job-eac")), cpiTop: top(card("job-cpi")), hyphenMoney: hy };
  },
  // c-7 (#78): "Figures: every visible element with a `data-figure` attribute. Numeric cells: every visible `main td`
  // whose trimmed `innerText` matches `/^[+−-]?\$?\d/` and does not start with a 5.0.4-c check 1 exception (no exception
  // regex matches at position 0), and every `[data-testid="cost-tree-row"] > div:nth-child(n+2)`." "Tabular: every text
  // node with a digit … has a parent element whose computed `font-variant-numeric` contains `tabular-nums`." "End-aligned,
  // for numeric cells only: computed `text-align` is `right` or `end`, or the right edge of a `Range` over the cell's text
  // is within 2 px of the cell's content-box right edge." "MetricCard figures are checked for tabular-nums only."
  tabular: (exceptionSources) => {
    const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const exc = (exceptionSources ?? []).map((src) => new RegExp(src, "y"));
    const startsWithException = (t) => exc.some((re) => { re.lastIndex = 0; return re.test(t); });
    const figures = [...document.querySelectorAll("[data-figure]")].filter(shown);
    const numeric = [];
    for (const td of document.querySelectorAll("main td")) {
      const t = (td.innerText ?? "").trim();
      if (shown(td) && /^[+−-]?\$?\d/.test(t) && !startsWithException(t)) numeric.push(td);
    }
    for (const d of document.querySelectorAll('[data-testid="cost-tree-row"] > div:nth-child(n+2)')) if (shown(d)) numeric.push(d);
    const digitNodes = (e) => { const out = []; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (/\d/.test(n.textContent) && n.parentElement && shown(n.parentElement)) out.push(n); return out; };
    const tabularOk = (e) => digitNodes(e).every((n) => /tabular-nums/.test(getComputedStyle(n.parentElement).fontVariantNumeric));
    const firstBad = (e) => { const n = digitNodes(e).find((x) => !/tabular-nums/.test(getComputedStyle(x.parentElement).fontVariantNumeric)); return n ? getComputedStyle(n.parentElement).fontVariantNumeric : null; };
    const endAligned = (e) => {
      const cs = getComputedStyle(e);
      if (cs.textAlign === "right" || cs.textAlign === "end") return { ok: true, align: cs.textAlign };
      const r = document.createRange(); r.selectNodeContents(e);
      const rr = r.getBoundingClientRect(); const box = e.getBoundingClientRect();
      const contentRight = box.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      return { ok: Math.abs(rr.right - contentRight) <= 2, align: cs.textAlign, gap: contentRight - rr.right };
    };
    const describe = (e, kind) => ({ kind, tag: e.tagName.toLowerCase(), figure: e.getAttribute("data-figure"), text: (e.innerText ?? "").trim().slice(0, 30), tabular: tabularOk(e), fvn: firstBad(e), ...(kind === "numeric" ? { end: endAligned(e) } : {}) });
    return { cells: [...figures.slice(0, 300).map((e) => describe(e, "figure")), ...numeric.slice(0, 300).map((e) => describe(e, "numeric"))] };
  },
  // a-2 (#78), by role: superintendent `[data-testid="submit-plan"]` inside the `[data-testid="plan-card"]` whose
  // `data-plan-id` equals the `<id>` in the link's `#plan-<id>`; foreman `[data-testid="report-work"]` inside that same
  // plan card; PM `[data-testid="co-approve"]` inside the `[data-testid="co-card"]` whose `h3` starts with "CO-001 ·";
  // executive the `[data-card]` holding `job-eac`, the `[data-card]` holding `job-cpi`, and `[data-testid="job-status"]`.
  firstTarget: ({ role, href }) => {
    const vh = window.innerHeight;
    const box = (e) => { if (!e || e.getClientRects().length === 0) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, text: (e.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 60) }; };
    const targets = {};
    const planId = /#plan-([^#?]+)$/.exec(href ?? "")?.[1] ?? null;
    const anchor = { planId, anchorFound: null };
    if (role === "superintendent" || role === "foreman") {
      const card = planId ? [...document.querySelectorAll('[data-testid="plan-card"]')].find((c) => c.getAttribute("data-plan-id") === planId && c.getClientRects().length > 0) : null;
      anchor.anchorFound = planId ? !!document.getElementById(`plan-${planId}`) : false;
      const id = role === "superintendent" ? "submit-plan" : "report-work";
      const want = role === "superintendent" ? "Submit plan" : "Report day's work";
      const el = card?.querySelector(`[data-testid="${id}"]`) ?? null;
      targets[`${id} in plan-card ${planId ?? "(no #plan-<id> in link)"}`] = box(el);
      if (el && (el.innerText ?? "").trim() !== want) targets[`${id} text`] = { wrongText: (el.innerText ?? "").trim(), want };
    }
    if (role === "pm") {
      const card = [...document.querySelectorAll('[data-testid="co-card"]')].find((c) => c.getClientRects().length > 0 && (c.querySelector("h3")?.textContent ?? "").trim().startsWith("CO-001 ·"));
      anchor.anchorFound = !!document.getElementById("co-CO-001");
      const el = card?.querySelector('[data-testid="co-approve"]') ?? null;
      targets["co-approve in CO-001 co-card"] = box(el);
      if (el && (el.innerText ?? "").trim() !== "Approve") targets["co-approve text"] = { wrongText: (el.innerText ?? "").trim(), want: "Approve" };
    }
    if (role === "executive") {
      // The job page may mount a phone and a desktop copy; the visible one is the target.
      const vis = (sel) => [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0) ?? null;
      targets["[data-card] holding job-eac"] = box([...document.querySelectorAll('[data-testid="job-eac"]')].map((e) => e.closest("[data-card]")).find((c) => c && c.getClientRects().length > 0) ?? null);
      targets["[data-card] holding job-cpi"] = box([...document.querySelectorAll('[data-testid="job-cpi"]')].map((e) => e.closest("[data-card]")).find((c) => c && c.getClientRects().length > 0) ?? null);
      targets["job-status"] = box(vis('[data-testid="job-status"]'));
    }
    return { vh, targets, anchor };
  },
  stepCount: () => ({ count: [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).length, labels: [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 100)), overflow: /\d+ more on the Jobs list/.test(document.querySelector('[data-testid="next-steps"]')?.innerText ?? "") }),
  // d-1 (#78): the table of forms by submit test id and idle text. Every input/select/textarea with `required` in the
  // form is visible ("not inside a closed `details`, not `display:none`, non-zero box") while the submit is visible.
  // The table's listed required fields must exist in the form and carry `required`.
  requiredFields: (table) => {
    const hiddenBy = (e) => { if (e.getClientRects().length === 0) return "zero box"; for (let a = e; a && a !== document.body; a = a.parentElement) { if (a.tagName === "DETAILS" && !a.open && !(e.closest("summary") && e.closest("summary").parentElement === a)) return "inside a closed details"; if (getComputedStyle(a).display === "none") return "display:none"; } const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? null : "zero box"; };
    const out = [];
    for (const t of table) {
      const submits = t.submitSel === "LINE-FORM" ? [...document.querySelectorAll('[data-testid="line-form"] button[type="submit"]')] : [...document.querySelectorAll(`[data-testid="${t.submitSel}"]`)];
      for (const b of submits) {
        if (hiddenBy(b)) continue;
        const form = b.closest("form") ?? (t.submitSel === "LINE-FORM" ? b.closest('[data-testid="line-form"]') : null);
        const scope = t.submitSel === "LINE-FORM" ? (b.closest('[data-testid="line-form"]') ?? form) : form;
        const req = scope ? [...scope.querySelectorAll("input[required], select[required], textarea[required]")] : [];
        const listed = [];
        for (const want of t.fields) {
          const els = scope ? [...scope.querySelectorAll(want.endsWith("-") ? `[data-testid^="${want}"]` : `[data-testid="${want}"]`)] : [];
          listed.push({ want, n: els.length, notRequired: els.filter((e) => !e.required).map((e) => e.getAttribute("data-testid")) });
        }
        out.push({ form: t.form, text: (b.innerText ?? "").trim(), wantText: t.text, inForm: !!form, required: req.map((e) => ({ name: e.getAttribute("data-testid") || e.name || e.id || e.tagName.toLowerCase(), hidden: hiddenBy(e) })), listed });
      }
    }
    return { forms: out };
  },
  namedTargets: (sel) => {
    const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("details:not([open]) > :not(summary)");
    const out = {};
    for (const [label, q] of Object.entries(sel ?? {})) {
      const els = q.startsWith("BUTTON:") ? [...document.querySelectorAll("main button")].filter((b) => (b.innerText ?? "").trim() === q.slice(7)) : [...document.querySelectorAll(q)];
      out[label] = els.filter(shown).slice(0, 40).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, fontPx: parseFloat(getComputedStyle(e).fontSize), text: (e.innerText || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 40) }; });
    }
    return out;
  },
  planLinks: () => [...document.querySelectorAll('[data-testid="plan-card"]')].map((c) => ({ status: c.getAttribute("data-status"), text: (c.innerText ?? "").replace(/\s+/g, " ").slice(0, 120), href: c.querySelector('a[href*="/plans/"]')?.getAttribute("href") ?? null })).filter((x) => x.href),
  firstPlanDetailLink: () => document.querySelector('[data-testid="plan-detail-link"]')?.getAttribute("href") ?? null,
  planCards: () => {
    const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const cw = document.documentElement.clientWidth;
    const main = document.querySelector("main");
    const visible = (e) => shown(e) && !e.closest("details:not([open]) > :not(summary)");
    const labelOf = (f) => { const p = f.previousElementSibling; return p && p.getAttribute("data-text") === "label" ? (p.innerText ?? "").trim() : ""; };
    const one = (t) => (t ?? "").replace(/\s+/g, " ").trim();
    const lines = [...document.querySelectorAll('[data-testid="plan-detail-line"]')].filter(shown).map((l) => {
      // f-1 (Planner ruling 2026-10-27, #86): the reported figure is `plan-detail-line-reported`.
      const rep = l.querySelector('[data-testid="plan-detail-line-reported"]');
      return {
        figures: [...l.querySelectorAll("[data-figure]")].filter(visible).map((f) => ({ text: one(f.innerText), label: labelOf(f) })),
        reported: rep ? { visible: visible(rep), text: one(rep.innerText) } : null,
      };
    });
    const status = document.querySelector('[data-testid="plan-detail-status"]');
    const scrollers = main ? [...main.querySelectorAll("*")].filter((e) => shown(e) && e.scrollWidth > e.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)).length : 0;
    return { tables: main ? [...main.querySelectorAll("table")].filter(shown).length : 0, past: main ? [...main.querySelectorAll("*")].filter((e) => shown(e) && e.getBoundingClientRect().right > cw + 0.5).length : 0, scrollers, lines, planStatus: status ? one(status.getAttribute("data-status") || status.innerText) : null };
  },
  shellTargets: () => {
    const box = (e) => (e && e.getClientRects().length > 0 ? (({ width, height }) => ({ w: width, h: height }))(e.getBoundingClientRect()) : null);
    const brand = [...document.querySelectorAll('a[aria-label="Pitbull home"]')].find((e) => e.getClientRects().length > 0) ?? null;
    return { brand: box(brand), userMenu: box(document.querySelector('[data-testid="user-menu"]')) };
  },
};

// 5.0.4-c check 3, the named list (Pitbull UX A2, T1–T4, T6–T8; T5 is 5.0.4-i check 5 above). The crawl's tap check
// already fails every interactive element under 44×44 on every page (limit 0); these passes name each element so a
// regression is easy to find. #78 c-3: "every visible interactive element listed above, outside `p` text, has
// `getBoundingClientRect()` width ≥ 44 and height ≥ 44", so a named element that is not visible is not measured.
const PHONES = [{ width: 320, height: 568 }, { width: 390, height: 844 }];
const named = (key, roles, pages, sel, extra = {}) => ({ name: `5.0.4-c check 3 (${key}): named tap targets ≥ 44×44 at 320 and 390`, roles, sizes: PHONES, themes: ["light"], pages, probe: "namedTargets", probeArg: sel, ...extra });
export const NAMED_TAPS = {
  "c-3.A2": named("A2", ["foreman"], ["/app"], { "brand link": 'a[href="/app"][aria-label]', "user-menu": '[data-testid="user-menu"]', "next-step link": '[data-testid="next-step"]', "assistant chip": '[data-testid="assistant-chips"] button' }),
  "c-3.T1": named("T1", ["foreman"], ["/app/jobs/24-077"], { "actualMh input": 'input[name^="actualMh"]', "actualQty input": 'input[name^="actualQty"]' }, { minFontPx: 16 }),
  "c-3.T2": named("T2", ["foreman", "superintendent"], ["/app/jobs/25-031"], { "submit-plan": '[data-testid="submit-plan"]', "plan line Edit": "BUTTON:Edit", "plan line Remove": "BUTTON:Remove" }),
  "c-3.T3": named("T3", ["pm", "executive"], ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031"], { "lock-claim": '[data-testid="lock-claim"]', "percent input": 'input[name="percent"]', "reason input": 'input[name="reason"], textarea[name="reason"]' }),
  "c-3.T4": named("T4", ["pm"], ["/app/jobs/26-010"], { "approve-estimate": '[data-testid="approve-estimate"]', "import file input": 'input[type="file"]', "Import estimate": "BUTTON:Import estimate", "cost-tree-filter": '[data-testid="cost-tree-filter"]', "value-set button": '[data-testid^="value-set-"]' }),
  "c-3.T6": named("T6", CRAWL_ROLES, ["/app/jobs/24-077/cost-items/07-300"], { "cost-entry-plan-link": '[data-testid="cost-entry-plan-link"]', "cost-item-back": '[data-testid="cost-item-back"]', "forecast select": "main select", Apply: "BUTTON:Apply" }),
  "c-3.T7": named("T7", CRAWL_ROLES, ["/app/jobs/24-077"], { "plan cost-code link": '[data-testid="plan-detail-line"] a[href*="/cost-items/"]' }, { followPlan: true }),
  "c-3.T8": named("T8", CRAWL_ROLES, ["/roadmap"], { "version link": 'main a[href^="/roadmap/"]' }),
};
Object.assign(PASSES, NAMED_TAPS);

/**
 * f-1 plan ids, read from the plan cards on the job page after reset. 24-077: the first plan card. 25-031: the Cedar
 * tomorrow plan, which the seed leaves `draft` and which is the only draft plan card there
 * (#78 f-1: "on the first plan page of 24-077 and on the Cedar tomorrow plan page of 25-031 (Verify reads both ids from
 * the plan links on the job pages after reset)"; the seed leaves the Cedar tomorrow plan `draft`, #78 5.0.4-a rules).
 */
export function pickPlanLink(jobPath, links) {
  if (jobPath.endsWith("/24-077")) return links[0]?.href ?? null;
  if (jobPath.endsWith("/25-031")) {
    const drafts = links.filter((l) => l.status === "draft");
    return drafts.length === 1 ? drafts[0].href : null;
  }
  return null;
}

/** The seeded jobs. #78 "Seed addition": "2 active jobs at risk by `overallStatus` (24-077 and 25-031; 24-118 grades
 * `watch`)". */
export const SEED_JOBS = ["24-077", "24-118", "25-031"];
export const SEED_AT_RISK = ["24-077", "25-031"];

/**
 * b-5 reference: each seeded job's at-risk flag and cost variance to the cent, read as the executive from the job page's
 * `job-earned` and `job-actual` data-cents. Cost variance = EV − AC (`v5/src/lib/ev.ts`, costVarianceCents).
 */
export async function readCostVariances(page, base) {
  const out = {};
  for (const job of SEED_JOBS) {
    await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    out[job] = await page.evaluate(() => {
      const c = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const v = e.getAttribute("data-cents") ?? e.querySelector("[data-cents]")?.getAttribute("data-cents"); return v == null ? null : Number(v); };
      const ev = c("job-earned"), ac = c("job-actual");
      return { cv: ev == null || ac == null ? null : ev - ac };
    });
    out[job].atRisk = SEED_AT_RISK.includes(job);
  }
  return out;
}

/** i-2 (#80): "The 07-300 row is read as the PM, after the same **Reset demo**". Desktop at 1440×900; phone at 390×844,
 * scrolling `cost-tree-scroll-mobile` "until the row mounts, because the list is virtualized". */
export async function readKpiRef(browser, base, spec) {
  const [job, code] = spec.split("/");
  const read = async (width, height, fn) => {
    const ctx = await browser.newContext(contextFor(width, height, "light"));
    try {
      await ctx.addCookies([{ name: THEME_COOKIE, value: "light", url: base }]);
      const page = await ctx.newPage();
      await signInRole(page, base, "pm");
      await resetDemo(page, base);
      await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      return await fn(page);
    } catch (error) {
      return { error: String(error?.message ?? error).split("\n")[0] };
    } finally {
      await ctx.close();
    }
  };
  const desktop = await read(1440, 900, (page) => page.evaluate(PROBES.kpiRefDesktop, code));
  const phone = await read(390, 844, async (page) => {
    for (let i = 0; i < 60; i++) {
      const got = await page.evaluate(PROBES.kpiRefPhone, code);
      if (got) return got;
      const more = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="cost-tree-scroll-mobile"]');
        if (!s) return false;
        const before = s.scrollTop;
        s.scrollTop = before + Math.max(100, s.clientHeight / 2);
        if (s.scrollTop === before) { window.scrollBy(0, Math.max(100, window.innerHeight / 2)); return window.scrollY + window.innerHeight < document.documentElement.scrollHeight || s.scrollTop !== before; }
        return true;
      });
      await page.waitForTimeout(100);
      if (!more && i > 2) break;
    }
    return null;
  });
  return { job, code, desktop, phone };
}

/**
 * d-1 (S19): the plan line whose editor d-1 opens. The draft Cedar plan on 25-031 holds the pour line 04-210.
 * The app labels each line's Edit button `aria-label="Edit <code> <activity>"`, so its accessible name is
 * "Edit 04-210 Pour Pier 3 column, lift 2", not "Edit" (S9's exact-name match never resolved on staging: 4/4
 * click timeouts at 174d35be). The match is scoped to that one plan-line row and needs a button whose accessible
 * name starts with the word "Edit", so "Remove", "Editor" or an Edit control on another line or outside the row
 * can never be clicked instead.
 */
export const D1_LINE_CODE = "04-210";
export const EDIT_NAME = /^\s*Edit\b/;
export function planLineRow(page, code = D1_LINE_CODE) {
  return page.locator(`main [data-testid="plan-line"][data-code="${code}"]`).filter({ visible: true }).first();
}
export function editButton(page, code = D1_LINE_CODE) {
  return planLineRow(page, code).getByRole("button", { name: EDIT_NAME }).filter({ visible: true }).first();
}

/** S4: true when every a-2 target for the role is on the page and the link's anchor (if any) exists. */
export function firstTargetReady(data) {
  const t = Object.values(data?.targets ?? {});
  return t.length > 0 && t.every(Boolean) && data?.anchor?.anchorFound !== false;
}

/**
 * S4: poll PROBES.firstTarget until firstTargetReady or the timeout. Returns { ready, waitedMs }. Never throws: the
 * probe that follows records whatever is (not) there, and evaluateFirstTarget fails a target that never rendered.
 */
export async function waitForFirstTarget(page, { role, href }, { timeout = 15000, pollMs = 100 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const data = await page.evaluate(PROBES.firstTarget, { role, href }).catch(() => null);
    if (firstTargetReady(data)) {
      // Rendered. Let a hash scroll finish: the target boxes must hold still for one poll (at most 2 s more).
      let last = JSON.stringify(data.targets);
      for (const t1 = Date.now(); Date.now() - t1 < 2000;) {
        await page.waitForTimeout(pollMs);
        const now = JSON.stringify((await page.evaluate(PROBES.firstTarget, { role, href }).catch(() => null))?.targets ?? null);
        if (now === last) break;
        last = now;
      }
      return { ready: true, waitedMs: Date.now() - t0 };
    }
    if (Date.now() - t0 >= timeout) return { ready: false, waitedMs: Date.now() - t0 };
    await page.waitForTimeout(pollMs);
  }
}

/** One fresh context per role × size × theme: sign in, load each page to network idle, run the probe. */
export async function pagePass(browser, base, pass) {
  const rows = [];
  let cvRef = null;
  let kpiRef = null;
  for (const theme of pass.themes) {
    for (const role of pass.roles) {
      for (const { width, height } of pass.sizes) {
        const ctx = await browser.newContext(contextFor(width, height, theme));
        await ctx.addCookies([{ name: THEME_COOKIE, value: theme, url: base }]);
        const page = await ctx.newPage();
        try {
          await signInRole(page, base, role);
          if (pass.cvFrom && role === "executive" && !cvRef) cvRef = cvRef ?? (await readCostVariances(page, base));
          if (pass.kpiRef && !kpiRef) kpiRef = await readKpiRef(browser, base, pass.kpiRef);
          for (const p of pass.pages) {
            const row = { role, width, height, theme, path: p };
            try {
              let target = p;
              if (pass.followPlan || p.startsWith("PLAN:")) {
                const jobPath = p.replace(/^PLAN:/, "");
                await page.goto(base + jobPath, { waitUntil: "load" });
                await page.waitForLoadState("networkidle");
                const links = await page.evaluate(PROBES.planLinks);
                // c-7: "the first plan page on 24-077 (from the first `plan-detail-link` on `/app/jobs/24-077`)"
                const pick = p.startsWith("PLAN:") ? await page.evaluate(PROBES.firstPlanDetailLink) : pickPlanLink(jobPath, links);
                if (!pick) throw new Error(`no plan link to follow on ${p} (${links.length} plan cards)`);
                target = pick;
                row.path = `${jobPath} → ${pick}`;
              }
              const res = await page.goto(base + target, { waitUntil: "load" });
              await page.waitForLoadState("networkidle");
              row.status = res?.status() ?? null;
              if (pass.action === "clickFirstStep") {
                await page.waitForLoadState("networkidle");
                const first = page.locator('[data-testid="next-step"]:visible').first();
                row.clicked = { label: ((await first.innerText({ timeout: 10000 })) ?? "").replace(/\s+/g, " ").trim(), href: await first.getAttribute("href") };
                const before = page.url();
                await first.click();
                await page.waitForURL((u) => u.toString() !== before, { timeout: 30000 });
                await page.waitForLoadState("networkidle");
                row.landed = page.url().replace(base, "");
                // S4: a soft navigation changes the URL before the next page renders, so waitForURL and networkidle
                // return at once. Wait until the role's targets (and the #plan-<id> / co-CO-001 anchor) are on the
                // page. A target that never renders is still probed after the wait and still fails.
                row.targetWait = await waitForFirstTarget(page, { role, href: row.clicked.href });
              }
              if (pass.action === "clickEdit") {
                // d-1: "PlanLineEditor (after **Edit**)". S19: the Edit button on plan line 04-210, by an accessible
                // name that starts with "Edit" (the app's aria-label is "Edit 04-210 <activity>"). The editor half
                // counts as executed only when that row's line-form is open; evaluateRequiredFields fails it otherwise.
                const edit = editButton(page);
                row.editorOpened = false;
                await edit.waitFor({ state: "visible", timeout: 10000 });
                row.clicked = { label: ((await edit.getAttribute("aria-label")) ?? (await edit.innerText()) ?? "").replace(/\s+/g, " ").trim(), line: D1_LINE_CODE };
                await edit.click({ timeout: 10000 });
                await planLineRow(page).locator('[data-testid="line-form"]').filter({ visible: true }).first().waitFor({ timeout: 10000 });
                row.editorOpened = true;
              }
              row.htmlTheme = await page.evaluate(() => (document.documentElement.classList.contains("dark") ? "dark" : "light"));
              const arg = pass.probe === "firstTarget" ? { role, href: row.clicked?.href ?? null }
                : pass.probe === "requiredFields" ? D1_TABLE
                : pass.probe === "kpiCards" ? KPI_CARDS
                : pass.probeArg === "EXCEPTIONS" ? FIGURE_EXCEPTIONS.map((re) => re.source)
                : pass.probeArg ?? null;
              row.data = await page.evaluate(PROBES[pass.probe], arg);
              if (pass.kpiRef) row.kpiNamed = await page.evaluate(PROBES.kpiNamed, KPI_CARDS);
              if (pass.kpiRef) row.kpiRef = kpiRef;
              if (pass.cvFrom) row.cvRef = cvRef;
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

const at = (r) => `${r.role}@${r.width}x${r.height} ${r.theme} ${r.path}`;

export function evaluateStatusWords(r) {
  const f = [];
  for (const c of r.data?.colored ?? []) {
    if (STATUS_WORD.test(c.own) || (c.box && STATUS_WORD.test(c.box))) continue;
    f.push(`${at(r)}: ${c.cls} "${c.own}" has no status word or signed $ in its text or its card/row`);
  }
  return f;
}

export function evaluateChips(r) {
  const d = r.data ?? {};
  if (d.missing) return [`${at(r)}: assistant chip row not found`];
  const f = [];
  const off = (d.chips ?? []).filter((c) => !(c.right <= d.clientWidth));
  if (off.length) f.push(`${at(r)}: ${off.length} of ${d.chips.length} chips past clientWidth ${d.clientWidth} (first "${off[0].text}" right ${Math.round(off[0].right)})`);
  if (!(d.rowScrollWidth <= d.rowClientWidth)) f.push(`${at(r)}: chip row scrollWidth ${d.rowScrollWidth} > clientWidth ${d.rowClientWidth}`);
  return f;
}

/** i-2 (#80): the 7 KPI cards, each cross-checked against the 07-300 row of the 24-077 job page. */
export const KPI_CARDS = ["cost-item-eac", "cost-item-cb", "cost-item-ev", "cost-item-ac", "cost-item-installed", "cost-item-earned-mh", "cost-item-actual-mh"];
/** `qty()` and `mh()` in v5/src/lib/ev.ts. */
export const fmtQty = (milli) => (milli / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const fmtMh = (milli) => (milli / 1000).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function evaluateKpiCards(r) {
  const f = [];
  const cards = r.data?.cards ?? [];
  if (!cards.length) f.push(`${at(r)}: no KPI [data-card] on the cost-item page`);
  for (const c of cards) {
    const id = c.testid ?? "card";
    if (c.primary !== 1) f.push(`${at(r)}: ${id} has ${c.primary} primary figures (want 1)`);
    if (c.secondary > 2) f.push(`${at(r)}: ${id} has ${c.secondary} secondary figures (want ≤ 2)`);
    for (const g of c.figures) {
      if (!(g.sw <= g.cw)) f.push(`${at(r)}: ${id} figure "${g.text}" scrollWidth ${g.sw} > clientWidth ${g.cw}`);
      const cents = g.cents == null ? null : Number(g.cents);
      if (cents != null && Math.abs(cents) >= SHORT_MONEY_MIN_CENTS && !SHORT_MONEY.test(g.text)) f.push(`${at(r)}: ${id} figure "${g.text}" (${cents}¢ ≥ $10,000.00) is not short money`);
    }
  }
  return f.concat(evaluateKpiCrossCheck(r));
}

/** i-2 (#80) card → 07-300 row table. Money to the cent; Installed, Earned MH and Actual MH "equal as displayed". */
export function evaluateKpiCrossCheck(r) {
  const f = [];
  const w = at(r);
  const k = r.kpiNamed?.named ?? {};
  const d = r.kpiRef?.desktop;
  const p = r.kpiRef?.phone;
  const row = `${r.kpiRef?.job ?? "24-077"} ${r.kpiRef?.code ?? "07-300"} row`;
  if (!r.kpiNamed) return [`${w}: i-2 cross-check: KPI cards not read`];
  if (!d || d.error) f.push(`${w}: i-2: desktop ${row} not read at 1440×900${d?.error ? ` (${d.error})` : ""}`);
  if (!p || p.error) f.push(`${w}: i-2: phone ${row} did not mount in cost-list at 390×844${p?.error ? ` (${p.error})` : ""}`);
  for (const id of KPI_CARDS) if (!k[id]) f.push(`${w}: i-2: ${id} missing`);
  else if (!k[id].primaryIsFigure) f.push(`${w}: i-2: ${id} is not on a [data-figure="primary"] element`);
  const money = (id, want, src) => {
    if (!k[id]) return;
    if (k[id].cents == null) f.push(`${w}: i-2: ${id} has no [data-cents] in its primary figure`);
    else if (want == null) f.push(`${w}: i-2: ${id}: ${src} not readable`);
    else if (String(k[id].cents) !== String(want)) f.push(`${w}: i-2: ${id} data-cents ${k[id].cents} ≠ ${src} ${want}`);
  };
  if (p && !p.error) money("cost-item-eac", p.eacCents, `phone ${row} primary data-cents`);
  if (k["cost-item-eac"] && String(k["cost-item-eac"].cents) !== String(r.kpiNamed.forecastEac)) f.push(`${w}: i-2: cost-item-eac data-cents ${k["cost-item-eac"].cents} ≠ cost-item-forecast data-eac-cents ${r.kpiNamed.forecastEac}`);
  if (d && !d.error) {
    money("cost-item-cb", d.cbCents, `desktop ${row} data-cb-cents`);
    money("cost-item-ev", d.earnedCents, `desktop ${row} column 5 data-cents`);
    money("cost-item-ac", d.actualCents, `desktop ${row} column 6 data-cents`);
    const inst = /^(\S+) \/ (\S+) (.+)$/.exec(d.installedLine ?? "");
    if (k["cost-item-installed"]) {
      if (!inst) f.push(`${w}: i-2: desktop ${row} column 2 first line "${d.installedLine}" is not "X / Y UNIT"`);
      else {
        if (k["cost-item-installed"].text !== `${inst[1]} ${inst[3]}`) f.push(`${w}: i-2: cost-item-installed "${k["cost-item-installed"].text}" ≠ "${inst[1]} ${inst[3]}" (desktop ${row} "${d.installedLine}")`);
        if (!k["cost-item-installed"].secondaries.includes(`${inst[2]} budgeted`)) f.push(`${w}: i-2: cost-item-installed secondary [${k["cost-item-installed"].secondaries.join(" | ")}] lacks "${inst[2]} budgeted"`);
      }
    }
    if (k["cost-item-earned-mh"]) {
      const m = d.earnedMh == null ? ["", "0.0"] : /^(\S+) MH earned$/.exec(d.earnedMh);
      if (!m) f.push(`${w}: i-2: desktop ${row} earned-mh text "${d.earnedMh}" is not "N MH earned"`);
      else if (k["cost-item-earned-mh"].text !== m[1]) f.push(`${w}: i-2: cost-item-earned-mh "${k["cost-item-earned-mh"].text}" ≠ ${m[1]} (desktop ${row} ${d.earnedMh == null ? "has no earned-mh element: 0.0" : `"${d.earnedMh}"`})`);
    }
    if (k["cost-item-actual-mh"]) {
      if (d.actualMhMilli == null || d.actualMhMilli === "") f.push(`${w}: i-2: hook missing: data-actual-mh-milli on the desktop ${row} (required by #80); cost-item-actual-mh "${k["cost-item-actual-mh"].text}" cannot be cross-checked`);
      else if (k["cost-item-actual-mh"].text !== fmtMh(Number(d.actualMhMilli))) f.push(`${w}: i-2: cost-item-actual-mh "${k["cost-item-actual-mh"].text}" ≠ mh(${d.actualMhMilli}) "${fmtMh(Number(d.actualMhMilli))}"`);
    }
  }
  const totals = r.kpiNamed.totals ?? [];
  if (k["cost-item-ac"]) {
    if (!totals.length) f.push(`${w}: i-2: cost-item-totals missing (AC must equal its data-total-cents)`);
    for (const t of totals) if (String(t) !== String(k["cost-item-ac"].cents)) f.push(`${w}: i-2: cost-item-ac data-cents ${k["cost-item-ac"].cents} ≠ cost-item-totals data-total-cents ${t}`);
  }
  return f;
}

/** #80 c-1 hooks. A missing hook FAILS ("hook missing"); it is never skipped. The executive's portfolio and the 07-300
 * page (seeded crew entries) must show at least one, so an empty page cannot pass. */
export function evaluateNameHooks(r) {
  const d = r.data ?? {};
  const f = [];
  if (r.path === "/app") {
    const cards = d.portfolioCards ?? [];
    if (r.role === "executive" && !cards.length) f.push(`${at(r)}: c-1: no portfolio phone card (job-link in a [data-card]) to hold job-name`);
    for (const c of cards) if (!c.jobName) f.push(`${at(r)}: c-1: hook missing: job-name in portfolio card "${c.text}" (required by #80)`);
  } else {
    const links = d.planLinks ?? [];
    for (const l of links) if (l.text !== "Daily report" && l.crewName !== l.text) f.push(`${at(r)}: c-1: hook missing: crew-name ${l.crewName == null ? "absent from" : `"${l.crewName}" is not the whole text of`} cost-entry-plan-link "${l.text}" (required by #80)`);
    if (!(d.crewNames ?? []).length) f.push(`${at(r)}: c-1: hook missing: no visible crew-name on the 07-300 cost entries (required by #80)`);
    for (const t of d.crewNames ?? []) if (!t) f.push(`${at(r)}: c-1: crew-name is empty`);
  }
  return f;
}

export function evaluateShellTargets(r) {
  const f = [];
  for (const [k, b] of [["brand link", r.data?.brand], ["user-menu", r.data?.userMenu]]) {
    if (!b) f.push(`${at(r)}: ${k} not visible`);
    else if (b.w < MIN_TAP_PX || b.h < MIN_TAP_PX) f.push(`${at(r)}: ${k} ${Math.floor(b.w)}×${Math.floor(b.h)} < ${MIN_TAP_PX}×${MIN_TAP_PX}`);
  }
  return f;
}

export function evaluateHomeOrder(r) {
  const d = r.data ?? {};
  const f = [];
  if (d.firstSection !== "next-steps") f.push(`${at(r)}: first section in main is ${d.firstSection ?? "none"}, not next-steps`);
  if (d.firstStepBottom == null) f.push(`${at(r)}: no visible next-step`);
  if (d.assistantTop == null) f.push(`${at(r)}: assistant panel not visible`);
  else if (d.firstStepBottom != null && !(d.assistantTop >= d.firstStepBottom)) f.push(`${at(r)}: assistant top ${Math.round(d.assistantTop)} is above the first next step's bottom ${Math.round(d.firstStepBottom)}`);
  if (d.strip) {
    if (d.stepsTop == null || !(d.strip.bottom <= d.stepsTop)) f.push(`${at(r)}: job-strip bottom ${Math.round(d.strip.bottom)} is not above next-steps top ${d.stepsTop == null ? "missing" : Math.round(d.stepsTop)}`);
    if (d.strip.indexes !== 0) f.push(`${at(r)}: job-strip holds ${d.strip.indexes} -cpi/-spi elements (want 0)`);
  }
  return f;
}

export const MAX_COLLAPSED_MESSAGES = 3;

export function evaluateAssistantCollapsed(r) {
  const d = r.data ?? {};
  const f = [];
  for (const [k, b] of [["assistant-input", d.input], ["mic button", d.mic], ["send button", d.send]]) {
    if (!b) f.push(`${at(r)}: ${k} not visible`);
    else if (b.w < MIN_TAP_PX || b.h < MIN_TAP_PX) f.push(`${at(r)}: ${k} ${Math.floor(b.w)}×${Math.floor(b.h)} < ${MIN_TAP_PX}×${MIN_TAP_PX}`);
  }
  if (d.messages > MAX_COLLAPSED_MESSAGES) f.push(`${at(r)}: ${d.messages} assistant-message elements (want ≤ ${MAX_COLLAPSED_MESSAGES})`);
  if (!d.show) f.push(`${at(r)}: assistant-show-conversation not visible`);
  else if (d.show.h < MIN_TAP_PX) f.push(`${at(r)}: assistant-show-conversation ${Math.floor(d.show.h)} px tall < ${MIN_TAP_PX}`);
  return f;
}

export const FIRST_USE = [
  ["CPI", "Cost performance (CPI)"],
  ["SPI", "Schedule performance (SPI)"],
  ["EV", "Earned value (EV)"],
  ["AC", "Actual cost (AC)"],
  ["PV", "Planned value (PV)"],
  ["EAC", "Estimate at completion (EAC)"],
];

/** b-4: the first visible whole-word occurrence of each term must sit inside its spelled-out label. */
export function firstUseFailures(text) {
  const f = [];
  for (const [term, phrase] of FIRST_USE) {
    const m = new RegExp(`(?<![A-Za-z])${term}(?![A-Za-z])`).exec(text);
    if (!m) { f.push(`"${term}" never appears`); continue; }
    const start = m.index - (phrase.length - term.length - 1);
    if (text.slice(start, start + phrase.length) !== phrase) f.push(`first "${term}" is in "…${text.slice(Math.max(0, m.index - 30), m.index + term.length + 10)}…", not "${phrase}"`);
  }
  return f;
}

export function evaluateFirstUse(r) {
  return firstUseFailures(r.data?.text ?? "").map((x) => `${at(r)}: ${x}`);
}

const JOB_NUMBER = /\b\d{2}-\d{3}\b/;

export function evaluateAtRisk(r) {
  const d = r.data ?? {};
  if (r.role === "foreman") return d.present ? [`${at(r)}: at-risk-summary is present for the foreman`] : [];
  if (!d.present) return [`${at(r)}: at-risk-summary absent for the executive`];
  const f = [];
  const ref = r.cvRef ?? {};
  const want = Object.entries(ref).filter(([, v]) => v?.atRisk).map(([k]) => k).sort();
  if (!Object.keys(ref).length || Object.values(ref).some((v) => v == null || v.atRisk == null || v.cv == null)) f.push(`${at(r)}: at-risk/cost-variance reference unreadable (${JSON.stringify(ref)})`);
  const got = d.lines.map((l) => l.text.match(JOB_NUMBER)?.[0] ?? null);
  if (got.includes(null)) f.push(`${at(r)}: at-risk line without a job number: "${d.lines[got.indexOf(null)].text}"`);
  if (JSON.stringify([...got].sort()) !== JSON.stringify(want)) f.push(`${at(r)}: at-risk lines name [${got.join(", ")}], seed at-risk jobs are [${want.join(", ")}]`);
  for (const [i, l] of d.lines.entries()) {
    if (!/over cost|behind schedule/.test(l.text)) f.push(`${at(r)}: line "${l.text}" says neither "over cost" nor "behind schedule"`);
    if (got[i] === "24-077" && !/over cost/.test(l.text)) f.push(`${at(r)}: 24-077 line "${l.text}" lacks "over cost"`);
    if (l.dollars.length !== l.figures.length) f.push(`${at(r)}: line "${l.text}" has ${l.dollars.length} dollar figures but ${l.figures.length} [data-cents] elements`);
    for (const g of l.figures) {
      if (!g.title) f.push(`${at(r)}: "${g.text}" in "${l.text}" has no title`);
      const cv = ref[got[i]]?.cv;
      if (cv == null || Number(g.cents) !== cv) f.push(`${at(r)}: "${g.text}" data-cents ${g.cents} ≠ ${got[i]} cost variance ${cv ?? "unknown"}`);
    }
  }
  return f;
}

export function evaluateFullWidth(r) {
  const f = [];
  // #80 d-6 names 25-031 for the foreman and the superintendent and 24-077 for the foreman only.
  if (r.role === "superintendent" && r.path.endsWith("/24-077")) return f;
  const btns = r.data?.buttons ?? [];
  const want = r.path.endsWith("/24-077") ? ["Report day's work"] : ["submit-plan"];
  for (const k of want) if (!btns.some((b) => b.label === k)) f.push(`${at(r)}: ${k} not visible`);
  for (const b of btns) {
    if (b.cardContent == null) f.push(`${at(r)}: ${b.label} has no enclosing card`);
    else if (Math.abs(b.w - b.cardContent) > 1) f.push(`${at(r)}: ${b.label} width ${b.w.toFixed(1)} ≠ card content box ${b.cardContent.toFixed(1)} (± 1 px)`);
    if (b.h < MIN_TAP_PX) f.push(`${at(r)}: ${b.label} ${Math.floor(b.h)} px tall < ${MIN_TAP_PX}`);
  }
  return f;
}

export function evaluatePhoneTables(r) {
  const d = r.data ?? {};
  const f = [];
  if (d.tables) f.push(`${at(r)}: ${d.tables} visible table(s) in main`);
  if (d.past) f.push(`${at(r)}: ${d.past} element(s) in main past clientWidth ${d.clientWidth}`);
  if (r.path.endsWith("/cost-items/07-300")) {
    if (!d.entryCards) f.push(`${at(r)}: cost-item-entries-cards not visible`);
    if (!d.entries?.length) f.push(`${at(r)}: no visible cost-entry-card`);
    for (const [i, e] of (d.entries ?? []).entries()) {
      if (!e.amountPrimary) f.push(`${at(r)}: entry ${i + 1}: cost-entry-card-amount is not its primary figure`);
      if (e.labor && !(e.mh && e.rate)) f.push(`${at(r)}: labor entry ${i + 1}: MH ${e.mh ? "visible" : "hidden"}, rate ${e.rate ? "visible" : "hidden"} without a tap`);
    }
  }
  return f;
}

export const MIN_MONEY_GAP_PX = 8;

export function evaluateCostRowsFit(r) {
  const d = r.data ?? {};
  if (d.missing) return [`${at(r)}: cost-tree-scroll-mobile not visible`];
  const f = [];
  for (const s of d.spans ?? []) {
    if ("gap" in s) { if (s.gap < MIN_MONEY_GAP_PX) f.push(`${at(r)}: ${s.code} "${s.pair[0]}" and "${s.pair[1]}" ${s.gap.toFixed(1)} px apart (< ${MIN_MONEY_GAP_PX})`); continue; }
    if (!(s.sw <= s.cw)) f.push(`${at(r)}: ${s.code} "${s.text}" scrollWidth ${s.sw} > clientWidth ${s.cw}`);
    if (s.right > s.contentRight + 0.5) f.push(`${at(r)}: ${s.code} "${s.text}" right ${s.right.toFixed(1)} past its parent's content box ${s.contentRight.toFixed(1)}`);
  }
  return f;
}

export function evaluateKpiFold(r) {
  const d = r.data ?? {};
  const f = [];
  for (const [k, t] of [["job-eac", d.eacTop], ["job-cpi", d.cpiTop]]) {
    if (t == null) f.push(`${at(r)}: card holding ${k} not found`);
    else if (!(t < r.height)) f.push(`${at(r)}: card holding ${k} top ${Math.round(t)} is not above ${r.height}`);
  }
  if (d.hyphenMoney) f.push(`${at(r)}: main innerText has ${d.hyphenMoney} "-$" (want U+2212)`);
  return f;
}

/** f-1 (#86): before the first report the reported figure reads exactly this. */
export const NOT_REPORTED_YET = "Not reported yet";
/** f-1 (#86): after a report, "Reported 12 CY · 22.0 MH": a real quantity, a unit, and real MH. No "—" placeholder. */
export const REPORTED_FIGURE = /^Reported \d[\d,]*(\.\d+)? \S+ · \d[\d,]*(\.\d+)? MH$/;

/**
 * f-1: each phone plan line shows planned qty and planned MH as visible figures, plus a visible reported figure
 * `[data-testid="plan-detail-line-reported"]` that reads exactly "Not reported yet" before the first report, or the
 * reported quantity and MH after it. "Reported — · — MH" or any other placeholder fails. `draft` (the plan is a draft,
 * e.g. the Cedar tomorrow plan) allows only "Not reported yet".
 */
export function planLineFailures(line, { draft = false } = {}) {
  const f = [];
  const has = (re) => line.figures.some((g) => re.test(`${g.label} ${g.text}`.trim()));
  if (!has(/(^|\s)Planned (?!MH)\S/)) f.push("planned quantity");
  // MH shows either under its own "Planned MH" label or as the MH value inside the planned figure.
  if (!has(/Planned MH|(^|\s)Planned .*\d MH\b/)) f.push("planned MH");
  const r = line.reported;
  if (!r) f.push('reported figure (no [data-testid="plan-detail-line-reported"])');
  else if (!r.visible) f.push(`reported figure (plan-detail-line-reported "${r.text}" is not visible)`);
  else if (draft) { if (r.text !== NOT_REPORTED_YET) f.push(`reported figure "${r.text}" on a draft plan (want exactly "${NOT_REPORTED_YET}")`); }
  else if (r.text !== NOT_REPORTED_YET && !REPORTED_FIGURE.test(r.text)) f.push(`reported figure "${r.text}" (want "${NOT_REPORTED_YET}" before the first report, or "Reported <qty> <unit> · <MH> MH" after it)`);
  return f;
}

export function evaluatePlanCards(r) {
  const d = r.data ?? {};
  const f = [];
  if (d.tables) f.push(`${at(r)}: ${d.tables} visible table(s) in main`);
  if (d.past) f.push(`${at(r)}: ${d.past} element(s) past clientWidth`);
  if (d.scrollers) f.push(`${at(r)}: ${d.scrollers} element(s) in main scroll sideways`);
  if (!d.lines?.length) f.push(`${at(r)}: no visible plan-detail-line`);
  // The Cedar tomorrow plan (25-031) is a draft (#78/#86); a plan page whose status reads draft is one too.
  const draft = /^\/app\/jobs\/25-031\b/.test(String(r.path)) || /draft/i.test(d.planStatus ?? "");
  for (const [i, l] of (d.lines ?? []).entries()) {
    const miss = planLineFailures(l, { draft });
    if (miss.length) f.push(`${at(r)}: plan line ${i + 1} lacks visible ${miss.join(", ")} (figures: ${l.figures.map((g) => `${g.label}|${g.text}`).join("; ")})`);
  }
  return f;
}

export function evaluateNamedTargets(r, pass) {
  const f = [];
  for (const [label, els] of Object.entries(r.data ?? {})) {
    for (const e of els) {
      if (e.w < MIN_TAP_PX || e.h < MIN_TAP_PX) f.push(`${at(r)}: ${label} "${e.text}" ${Math.floor(e.w)}×${Math.floor(e.h)} < ${MIN_TAP_PX}×${MIN_TAP_PX}`);
      if (pass?.minFontPx && e.fontPx < pass.minFontPx) f.push(`${at(r)}: ${label} "${e.text}" text ${e.fontPx}px < ${pass.minFontPx}px`);
    }
  }
  return f;
}

export function evaluateTabular(r) {
  const f = [];
  const cells = r.data?.cells ?? [];
  if (!cells.length) f.push(`${at(r)}: no figure or numeric cell found`);
  for (const c of cells) {
    const id = `${c.kind} ${c.tag}${c.figure ? `[data-figure=${c.figure}]` : ""} "${c.text}"`;
    if (!c.tabular) f.push(`${at(r)}: ${id}: a digit text node's parent has font-variant-numeric "${c.fvn}" (no tabular-nums)`);
    if (c.kind === "numeric" && !c.end?.ok) f.push(`${at(r)}: ${id}: text-align "${c.end?.align}" and its text ends ${c.end?.gap == null ? "?" : c.end.gap.toFixed(1)} px from the content-box right (> 2 px)`);
  }
  return f;
}

export function evaluateFirstTarget(r) {
  const d = r.data ?? {};
  const f = [];
  if (!r.clicked) return [`${at(r)}: first next-step not clicked`];
  const where = `${at(r)}: after "${r.clicked.label}" → ${r.landed}`;
  if ((r.role === "superintendent" || r.role === "foreman") && !d.anchor?.planId) f.push(`${where}: link ${r.clicked.href} has no #plan-<id>`);
  if (d.anchor && d.anchor.anchorFound === false && r.role !== "executive") f.push(`${where}: anchor id ${r.role === "pm" ? '"co-CO-001"' : `"plan-${d.anchor.planId}"`} not on the page`);
  const t = Object.entries(d.targets ?? {});
  if (!t.length) f.push(`${at(r)}: no target defined for ${r.role}`);
  for (const [k, b] of t) {
    if (b && "wrongText" in b) { f.push(`${where}: ${k} reads "${b.wrongText}" (want "${b.want}")`); continue; }
    if (!b) f.push(`${where}: ${k} not found`);
    else if (!(b.top >= 0 && b.bottom <= d.vh)) f.push(`${where}: ${k} top ${Math.round(b.top)} bottom ${Math.round(b.bottom)} not inside viewport 0..${d.vh}`);
  }
  return f;
}

/** a-6 (#78 "Seed addition"): superintendent 2, foreman 2, pm 4, executive 4; "All 4 fit under the 5-item limit, so
 * neither role shows the overflow line." */
export const SEEDED_NEXT_STEPS = { superintendent: 2, foreman: 2, pm: 4, executive: 4 };

export function evaluateStepCount(r) {
  const n = r.data?.count ?? 0;
  const f = [];
  if (n !== SEEDED_NEXT_STEPS[r.role]) f.push(`${at(r)}: ${n} next steps after reset (want ${SEEDED_NEXT_STEPS[r.role]}): ${(r.data?.labels ?? []).join(" | ")}`);
  if (r.data?.overflow) f.push(`${at(r)}: next-steps shows an overflow line (want none)`);
  return f;
}

export function evaluateRequiredFields(r, pass) {
  const f = [];
  // S19: d-1's editor half is NOT EXECUTED unless Edit was clicked, the line-form opened, and the probe saw the
  // PlanLineEditor's visible Save. A row that never got there FAILS; it can never pass on an empty probe.
  if (pass?.action === "clickEdit") {
    if (r.editorOpened !== true) f.push(`${at(r)}: NOT EXECUTED: PlanLineEditor did not open after Edit on ${D1_LINE_CODE}`);
    else if (!(r.data?.forms ?? []).some((x) => x.form === "PlanLineEditor")) f.push(`${at(r)}: NOT EXECUTED: no visible PlanLineEditor (line-form Save) after Edit on ${D1_LINE_CODE}`);
  }
  for (const form of r.data?.forms ?? []) {
    const id = `${form.form} (${form.wantText})`;
    if (form.text !== form.wantText) f.push(`${at(r)}: ${id}: visible submit reads "${form.text}" (want "${form.wantText}")`);
    for (const x of form.required) if (x.hidden) f.push(`${at(r)}: ${id}: required field ${x.name} is ${x.hidden} while its submit is visible`);
    for (const l of form.listed) {
      if (!l.n) f.push(`${at(r)}: ${id}: no ${l.want.endsWith("-") ? `${l.want}<code>` : l.want} field in the form`);
      for (const nr of l.notRequired) f.push(`${at(r)}: ${id}: ${nr} has no required attribute`);
    }
  }
  return f;
}

const EVAL = {
  requiredFields: evaluateRequiredFields,
  firstTarget: evaluateFirstTarget,
  stepCount: evaluateStepCount,
  tabular: evaluateTabular,
  namedTargets: evaluateNamedTargets,
  statusWords: evaluateStatusWords, nameHooks: evaluateNameHooks, chips: evaluateChips, kpiCards: evaluateKpiCards, shellTargets: evaluateShellTargets,
  homeOrder: evaluateHomeOrder, assistantCollapsed: evaluateAssistantCollapsed, firstUse: evaluateFirstUse, atRisk: evaluateAtRisk,
  fullWidth: evaluateFullWidth, phoneTables: evaluatePhoneTables, costRowsFit: evaluateCostRowsFit, kpiFold: evaluateKpiFold, planCards: evaluatePlanCards,
};

/** Failures for one pass's rows: load errors, non-200, wrong theme, then the probe's own rule. */
export function evaluatePassRows(pass, rows) {
  const f = [];
  for (const r of rows) {
    if (r.error) { f.push(`${at(r)}: ${r.error}`); continue; }
    if (r.status !== 200) f.push(`${at(r)}: HTTP ${r.status}`);
    if (r.htmlTheme !== r.theme) f.push(`${at(r)}: page rendered ${r.htmlTheme}, pass is ${r.theme}`);
    f.push(...EVAL[pass.probe](r, pass));
  }
  return f;
}

/**
 * 5.0.4-a check 4, done state. One fresh sandbox: the foreman reports 24-077 (Report day's work with the form's
 * defaults) and submits the Cedar tomorrow draft on 25-031, then reloads /app: 0 next-step and a next-steps-done text
 * longer than 20 characters containing "24-077". Then the superintendent signs in in the same context (same sandbox)
 * and the "Submit tomorrow's plan" item is gone. The sandbox is reset after.
 */
export const DONE_MIN_CHARS = 20;
export async function doneStatePass(browser, base, { width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext(contextFor(width, height, "light"));
  const page = await ctx.newPage();
  const out = { steps: [] };
  try {
    await signInRole(page, base, "foreman");
    await page.goto(`${base}/app/jobs/24-077`, { waitUntil: "networkidle" });
    await page.getByTestId("report-work").click();
    await confirmIfDialog(page, { settled: page.getByTestId("report-summary") });
    await page.getByTestId("report-summary").waitFor({ timeout: 30000 });
    out.steps.push("foreman reported 24-077");
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const draft = page.locator('[data-testid="plan-card"][data-status="draft"]');
    out.drafts = await draft.count();
    const id = await draft.first().getAttribute("data-plan-id");
    await draft.first().getByTestId("submit-plan").click();
    const issued = page.locator(`[data-testid="plan-card"][data-plan-id="${id}"][data-status="issued"]`);
    await confirmIfDialog(page, { settled: issued });
    await issued.waitFor({ timeout: 30000 });
    out.steps.push(`foreman submitted plan ${id}`);
    await page.goto(`${base}/app`, { waitUntil: "networkidle" });
    out.foreman = await page.evaluate(() => ({ steps: [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).length, done: (document.querySelector('[data-testid="next-steps-done"]')?.innerText ?? null) }));
    await signInRole(page, base, "superintendent");
    out.superLabels = await page.evaluate(() => [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim()));
    await resetDemo(page, base);
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

export function evaluateDoneState(d) {
  if (d.error) return [`a-4: ${d.error} (after: ${d.steps.join("; ") || "nothing"})`];
  const f = [];
  if (d.drafts !== 1) f.push(`a-4: ${d.drafts} draft plan cards on 25-031 (want the one Cedar tomorrow draft)`);
  if (d.foreman?.steps !== 0) f.push(`a-4: foreman has ${d.foreman?.steps} next-step items after both journeys (want 0)`);
  const done = d.foreman?.done;
  if (done == null) f.push("a-4: next-steps-done missing for the foreman");
  else {
    if (!(done.trim().length > DONE_MIN_CHARS)) f.push(`a-4: next-steps-done "${done}" is ${done.trim().length} characters (want > ${DONE_MIN_CHARS})`);
    if (!done.includes("24-077")) f.push(`a-4: next-steps-done "${done}" lacks "24-077"`);
  }
  const left = (d.superLabels ?? []).filter((l) => /Submit tomorrow's plan/.test(l));
  if (left.length) f.push(`a-4: superintendent still sees "${left[0]}"`);
  return f;
}

/**
 * 5.0.4-g checks 1 and 2 (demo path). 5.0.4-g is not on rc/5.0.4, so both FAIL there (no `demo-path`). g-1: each role,
 * every link in the panel returns HTTP 200 with no 4xx/5xx request on the target, and its path without `#` is in
 * `allowed` (navCrawlPages(seedJobNumbers) + drillItemList(seedItems) paths + /login). g-2: Dismiss, reload, sign out
 * and back in to the same sandbox: 0 `demo-path`; after Reset demo: 1. The panel's Dismiss control is the button named
 * "Dismiss" inside `demo-path` (the spec's word; no test id).
 */
export async function demoPathPass(browser, base, allowed, { roles = CRAWL_ROLES, width = 1280, height = 800 } = {}) {
  const out = { links: [], dismiss: null };
  for (const role of roles) {
    const ctx = await browser.newContext(contextFor(width, height, "light"));
    const page = await ctx.newPage();
    try {
      await signInRole(page, base, role);
      const hrefs = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo-path"] a[href]')].map((a) => a.getAttribute("href")));
      if (!hrefs.length) out.links.push({ role, missing: true });
      for (const href of hrefs) {
        const bad = [];
        const onRes = (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(base, "")}`); };
        page.on("response", onRes);
        let status = null;
        try {
          const res = await page.goto(new URL(href, base).toString(), { waitUntil: "load" });
          await page.waitForLoadState("networkidle");
          status = res?.status() ?? null;
        } catch (error) { bad.push(String(error?.message ?? error).split("\n")[0]); }
        page.off("response", onRes);
        const p = new URL(href, base).pathname;
        out.links.push({ role, href, path: p, status, bad, allowed: allowed.has(p) });
        await page.goto(`${base}/app`, { waitUntil: "networkidle" });
      }
      if (role === roles[0]) {
        const count = () => page.locator('[data-testid="demo-path"]').count();
        const d = { before: await count() };
        const btn = page.locator('[data-testid="demo-path"]').getByRole("button", { name: "Dismiss" });
        if (d.before && (await btn.count())) {
          await btn.click();
          await page.waitForLoadState("networkidle");
          await page.reload({ waitUntil: "networkidle" });
          d.afterReload = await count();
          await signInRole(page, base, role);
          d.afterSignIn = await count();
          await resetDemo(page, base);
          await page.goto(`${base}/app`, { waitUntil: "networkidle" });
          d.afterReset = await count();
        } else d.noDismiss = true;
        out.dismiss = d;
      }
    } finally {
      await ctx.close();
    }
  }
  return out;
}

export function evaluateDemoPath(d) {
  const f = [];
  for (const l of d.links) {
    if (l.missing) { f.push(`g-1 ${l.role}: demo-path missing or has no links`); continue; }
    if (l.status !== 200) f.push(`g-1 ${l.role}: ${l.href} HTTP ${l.status}`);
    for (const b of l.bad) f.push(`g-1 ${l.role}: ${l.href}: ${b}`);
    if (!l.allowed) f.push(`g-1 ${l.role}: ${l.href} path ${l.path} not in the allowed set`);
  }
  const x = d.dismiss;
  if (!x || x.noDismiss || !x.before) f.push(`g-2: demo-path ${x?.before ? "has no Dismiss button" : "missing"}`);
  else {
    if (x.afterReload !== 0) f.push(`g-2: ${x.afterReload} demo-path after Dismiss + reload (want 0)`);
    if (x.afterSignIn !== 0) f.push(`g-2: ${x.afterSignIn} demo-path after sign out/in (want 0)`);
    if (x.afterReset !== 1) f.push(`g-2: ${x.afterReset} demo-path after Reset demo (want 1)`);
  }
  return f;
}
