// Pure evaluators for verify-v5. No network, no Playwright: every function takes observed values
// and returns failures, so checks.test.mjs can prove each one fails on bad input.

/** Trust-bar banned words, matched case-insensitively against visible text (innerText). */
export const BANNED_VISIBLE = [
  { id: "coming soon", re: /coming\s+soon/i },
  { id: "TODO", re: /\btodo\b/i },
  { id: "lorem", re: /lorem/i },
  { id: "placeholder", re: /placeholder/i },
  { id: "ERP", re: /\berp\b/i },
  { id: "not implemented", re: /not\s+implemented/i },
  // Word-bounded so "stubborn", "Stubbs", "wipe", "wiper" do not match.
  { id: "stub", re: /\bstub(s|bed)?\b/i },
  { id: "FIXME", re: /\bfixme\b/i },
  { id: "TBD", re: /\btbd\b/i },
  { id: "WIP", re: /\bwip\b/i },
];

/** @returns {{ id: string, match: string }[]} */
export function bannedHits(text) {
  const hits = [];
  for (const ban of BANNED_VISIBLE) {
    const m = String(text ?? "").match(ban.re);
    if (m) hits.push({ id: ban.id, match: m[0] });
  }
  return hits;
}

/** Visible error-boundary / crash wording (Next.js and app boundaries). */
export const ERROR_BOUNDARY = [
  /Application error/i,
  /Something went wrong/i,
  /Unhandled Runtime Error/i,
  /This page could not be found/i,
  /client-side exception/i,
  /Internal Server Error/i,
  // Next 16's built-in error screens (app-error / global-error) and the app's own App Router boundary
  // (v5/src/components/app/route-error-fallback.tsx, product PR #15: "Page load failed" / "Shell load failed").
  /This page couldn.t load/i,
  /A server error occurred/i,
  /Page load failed/i,
  /Shell load failed/i,
];

/**
 * Stable markers of an error boundary in the DOM: the app's route-error / global-error fallback
 * (data-testid from PR #15). Any match fails the load, whatever the text says.
 */
export const ERROR_BOUNDARY_SELECTOR = '[data-testid="route-error"], [data-testid="global-error"]';

/**
 * A leaf element whose whole text is an empty-state message. Prose that merely contains
 * the word "empty" is not an empty state, so only whole-leaf matches count.
 */
export const EMPTY_STATE = /^(no\s.{0,40}?\b(yet|found|to show|available)\b|nothing\s(here|yet|to show)\b|no data\b|0 jobs\b)/i;

/**
 * Seeded states that are legitimately empty, by name. An empty-state hit is allowed only when it
 * sits inside exactly this change-order card, with exactly this status, on exactly this job page.
 */
export const ALLOWED_EMPTY = [
  { path: "/app/jobs/24-077", coNumber: "CO-001", coStatus: "voided", text: /^No lines yet\b/ },
  { path: "/app/jobs/24-118", coNumber: "CO-001", coStatus: "draft", text: /^No lines yet\b/ },
];

/** @param {{ path: string, text: string, coNumber?: string|null, coStatus?: string|null }} hit */
export function emptyHitAllowed(hit) {
  return ALLOWED_EMPTY.some(
    (a) =>
      a.path === hit.path &&
      a.coNumber === hit.coNumber &&
      a.coStatus === hit.coStatus &&
      a.text.test(hit.text),
  );
}

export const PAGE_BUDGET_MS = 1500;

/** Document scrollWidth is compared to the crawl viewport only at these phone widths. */
export const PHONE_OVERFLOW_WIDTHS = [320, 390];
/** Tap targets, text size, one-tap actions, and the secondary-label clipping exception apply at and under this width. */
export const PHONE_MAX_PX = 480;
/**
 * Desktop width. With phone checks on, any clipped text fails at and above this.
 * With phone checks off, only protected clips fail at and above this
 * (see evaluateDesktopProtectedClips).
 */
export const DESKTOP_MIN_PX = 768;
/** Interactive controls at phone widths must be at least this square, in CSS pixels. */
export const MIN_TAP_PX = 44;
/**
 * Smallest readable text at phone widths, in CSS pixels. Every visible text node is held to this
 * floor (secondary labels included). Inputs, textareas and selects are held to MIN_INPUT_FONT_PX.
 */
export const MIN_SECONDARY_FONT_PX = 12;
/** Body inputs. Below 16px, iOS Safari zooms the page on focus. */
export const MIN_INPUT_FONT_PX = 16;

/**
 * Verb-first primary action each role must be able to reach in one tap from /app on a phone.
 * The first action for that role (data-testid next-step or role-primary-action, data-role) must start with it.
 */
export const PRIMARY_ACTION_VERB = {
  executive: /^\s*Open\b/,
  pm: /^\s*Approve\b/,
  superintendent: /^\s*Submit\b/,
  foreman: /^\s*Report\b/,
};

/**
 * Kind of a clipped box. Protected content wins over a secondary label:
 * a status pill, money (`data-cents` or a `$` amount anywhere in the text), a table header, or an h1 / page title
 * anywhere in the box (the element, an ancestor that is that thing, or a descendant).
 * A secondary label is only the job strip, the company name, or `data-clip="secondary"`.
 * Being inside `header` does not make a clip secondary.
 */
export function classifyClip({ statusInBox, centsInBox, moneyText, headerInBox, titleInBox, secondaryBox }) {
  if (statusInBox) return "status";
  if (centsInBox || moneyText) return "money";
  if (headerInBox) return "header";
  if (titleInBox) return "title";
  if (secondaryBox) return "secondary";
  return "text";
}

/** A dollar amount anywhere in the text. `$` followed by a digit (`Budget $1,234,567`). `$` alone is not money. */
export function textHasMoney(text) {
  return /\$\d[\d,]*/.test(String(text ?? ""));
}

/** Own title or aria-label must equal the full text after trimming, or a proven expansion is open. */
export function secondaryReachable({ text, title, ariaLabel, expanded }) {
  const full = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!full) return false;
  const eq = (value) => String(value ?? "").replace(/\s+/g, " ").trim() === full;
  if (eq(title) || eq(ariaLabel)) return true;
  return expanded === true;
}

/**
 * Phone layout observations from the crawl (missing fields are skipped, so a row that predates them
 * still passes). measurePage records them only when phone checks are on (`--rc` for 5.0.4 or later,
 * or `--phone-checks`). The default crawl omits them.
 * docScrollWidth / viewportWidth: max(documentElement, body) scrollWidth vs the crawl viewport (320 or 390).
 * tapMisses: { tag, w, h, text } under 44×44 at phone widths.
 * textMisses: { kind: "secondary"|"input", px, text }.
 * clips: { kind: "money"|"status"|"header"|"title"|"secondary"|"text", text, reachable, ellipsis }.
 * clipCount: every clipped element. When it is greater than clips.length, a later clip was not listed.
 * primaryActions: { role, text, tag, visible, inView, blocked } from the landing page.
 */
export function evaluatePhoneUx(row) {
  const f = [];
  const where = `${row.role}@${row.width} ${row.path}`;
  const width = row.width;
  if (PHONE_OVERFLOW_WIDTHS.includes(width) && Number.isFinite(row.docScrollWidth) && Number.isFinite(row.viewportWidth)) {
    if (!(row.docScrollWidth <= row.viewportWidth)) {
      f.push(`${where}: document scrollWidth ${px(row.docScrollWidth)}px > viewport ${px(row.viewportWidth)}px`);
    }
  }
  if (Number.isFinite(width) && width <= PHONE_MAX_PX) {
    for (const t of row.tapMisses ?? []) {
      f.push(`${where}: tap target ${t.tag} ${px(t.w)}×${px(t.h)}px < ${MIN_TAP_PX}×${MIN_TAP_PX} ("${clipLabel(t.text)}")`);
    }
    const tapShown = row.tapMisses?.length ?? 0;
    if ((row.tapMissCount ?? tapShown) > tapShown) f.push(`${where}: ${row.tapMissCount} tap targets under ${MIN_TAP_PX}×${MIN_TAP_PX}`);
    for (const t of row.textMisses ?? []) {
      if (t.kind === "input") f.push(`${where}: input text ${px(t.px)}px < ${MIN_INPUT_FONT_PX}px ("${clipLabel(t.text)}")`);
      else f.push(`${where}: secondary text ${px(t.px)}px < ${MIN_SECONDARY_FONT_PX}px ("${clipLabel(t.text)}")`);
    }
    const textShown = row.textMisses?.length ?? 0;
    if ((row.textMissCount ?? textShown) > textShown) f.push(`${where}: ${row.textMissCount} text nodes under the phone size floor`);
  }
  const clipShown = row.clips?.length ?? 0;
  if ((row.clipCount ?? clipShown) > clipShown) f.push(`${where}: ${row.clipCount} clipped elements, only ${clipShown} listed`);
  const phone = Number.isFinite(width) && width <= PHONE_MAX_PX;
  const desktop = Number.isFinite(width) && width >= DESKTOP_MIN_PX;
  for (const c of row.clips ?? []) {
    const label = clipLabel(c.text);
    if (c.kind === "money") f.push(`${where}: clipped money "${label}"`);
    else if (c.kind === "status") f.push(`${where}: clipped status pill "${label}"`);
    else if (c.kind === "header") f.push(`${where}: clipped table header "${label}"`);
    else if (c.kind === "title") f.push(`${where}: clipped page title "${label}"`);
    else if (desktop) f.push(`${where}: clipped text at ${width}px "${label}"`);
    else if (c.kind === "secondary" && phone && c.ellipsis === true && c.reachable === true) {
      // At ≤480 only, a secondary label may ellipsize when its own title or aria-label equals the full text, or a proven expansion is open.
    } else if (c.kind === "secondary" && phone && c.ellipsis !== true) f.push(`${where}: clipped secondary label "${label}" is a hard clip`);
    else if (c.kind === "secondary") f.push(`${where}: clipped secondary label "${label}" with no reachable full text`);
    else f.push(`${where}: clipped text "${label}"`);
  }
  if (row.path === "/app" && Number.isFinite(width) && width <= PHONE_MAX_PX && Array.isArray(row.primaryActions)) {
    const verb = PRIMARY_ACTION_VERB[row.role];
    const first = verb ? (row.primaryActions ?? []).find((a) => a.role === row.role) : null;
    const text = clipLabel(first?.text);
    if (!first || !verb.test(String(first.text ?? ""))) f.push(`${where}: no one-tap primary action for ${row.role} on the landing page`);
    else if (!(first.visible && first.inView && !first.blocked && (first.tag === "A" || first.tag === "BUTTON"))) {
      f.push(`${where}: primary action for ${row.role} is not one tap ("${text}")`);
    }
  }
  return f;
}

function px(n) {
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(Math.floor(x * 10) / 10);
}
function clipLabel(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/**
 * Money, status pill, table header, and page title clipped by their own element
 * at ≥ DESKTOP_MIN_PX. Runs on every crawl, including when phone checks are off.
 * Secondary ellipsis and other text stay in evaluatePhoneUx.
 * A row whose clip list is shorter than clipCount fails, so a cap cannot hide one.
 */
export function evaluateDesktopProtectedClips(row) {
  const f = [];
  const where = `${row.role}@${row.width} ${row.path}`;
  const width = row.width;
  if (!(Number.isFinite(width) && width >= DESKTOP_MIN_PX)) return f;
  const clipShown = row.clips?.length ?? 0;
  if ((row.clipCount ?? clipShown) > clipShown) f.push(`${where}: ${row.clipCount} clipped elements, only ${clipShown} listed`);
  for (const c of row.clips ?? []) {
    const label = clipLabel(c.text);
    if (c.kind === "money") f.push(`${where}: clipped money "${label}"`);
    else if (c.kind === "status") f.push(`${where}: clipped status pill "${label}"`);
    else if (c.kind === "header") f.push(`${where}: clipped table header "${label}"`);
    else if (c.kind === "title") f.push(`${where}: clipped page title "${label}"`);
  }
  return f;
}

/**
 * One crawled page load → list of failure strings (empty = pass).
 * row: { role, width, path, status, final, idleMs, responses4xx5xx: [{url,status}], consoleErrors: [],
 *        pageErrors: [], text, overflowPx, emptyHits: [{text, coNumber, coStatus}], seededCounts,
 *        errorBoundaryMarkers: [selector-matched testids], docScrollWidth, viewportWidth, tapMisses,
 *        textMisses, clips, primaryActions }
 */
export function evaluateCrawlRow(row, { budgetMs = PAGE_BUDGET_MS, phoneChecks = false } = {}) {
  const f = [];
  const where = `${row.role}@${row.width} ${row.path}`;
  if (row.status !== 200) f.push(`${where}: navigation HTTP ${row.status}`);
  if (row.final && row.final.split(/[?#]/)[0] !== row.path) f.push(`${where}: landed on ${row.final}`);
  for (const r of row.responses4xx5xx ?? []) f.push(`${where}: HTTP ${r.status} ${r.url}`);
  for (const e of row.consoleErrors ?? []) f.push(`${where}: console error ${e}`);
  for (const e of row.pageErrors ?? []) f.push(`${where}: page error ${e}`);
  for (const re of ERROR_BOUNDARY) if (re.test(row.text ?? "")) f.push(`${where}: error boundary "${(row.text.match(re) ?? [])[0]}"`);
  for (const m of row.errorBoundaryMarkers ?? []) f.push(`${where}: error boundary marker ${m}`);
  for (const h of bannedHits(row.text)) f.push(`${where}: banned "${h.match}" (${h.id})`);
  if (!(row.overflowPx <= 0)) f.push(`${where}: horizontal overflow ${row.overflowPx}px`);
  if (!(row.idleMs <= budgetMs)) f.push(`${where}: ${row.idleMs} ms > ${budgetMs} ms budget`);
  for (const h of row.emptyHits ?? []) {
    if (!emptyHitAllowed({ path: row.path, ...h })) {
      f.push(`${where}: empty state "${h.text}"${h.coNumber ? ` in ${h.coNumber} (${h.coStatus})` : ""}`);
    }
  }
  const c = row.seededCounts ?? {};
  if (row.path === "/app" && !(c.portfolioRows > 0)) f.push(`${where}: portfolio has no job rows`);
  // Cost-item drill-downs (#706) render the item's tiles, not the job cost tree; every other job path keeps the cost-rows rule.
  // Plan pages (#706, read-only) render the plan's status and lines.
  // A job schedule (5.1.0-c) is crawled with the same 1.5 s budget and the other per-load checks. It renders
  // the Gantt (`gantt-activity`), not the cost tree, the way a plan page renders plan status.
  const costItemPage = /^\/app\/jobs\/[^/]+\/cost-items\/[^/]+$/.test(row.path);
  const planPage = /^\/app\/jobs\/[^/]+\/plans\/[^/]+$/.test(row.path);
  const schedulePage = /^\/app\/jobs\/[^/]+\/schedule$/.test(row.path);
  if (row.path.startsWith("/app/jobs/") && !costItemPage && !planPage && !schedulePage && !(c.costRows > 0)) f.push(`${where}: job has no cost rows`);
  if (costItemPage && !(c.costItemTiles > 0)) f.push(`${where}: cost item page has no budget tile`);
  if (planPage && !(c.planStatus > 0)) f.push(`${where}: plan page has no plan status`);
  if (schedulePage && !(c.activityRows > 0)) f.push(`${where}: schedule page has no activities`);
  // Phone layout (tap targets, text size, secondary ellipsis, any desktop text) is off unless
  // --rc (5.0.4 or later) or --phone-checks. Protected clips at desktop widths still run.
  if (!phoneChecks) f.push(...evaluateDesktopProtectedClips(row));
  if (phoneChecks) f.push(...evaluatePhoneUx(row));
  return f;
}

export function slowestRow(rows) {
  return rows.reduce((a, r) => (a && a.idleMs >= r.idleMs ? a : r), null);
}

/** M2: after import + approve on 26-010, OB = CB = CE = expected total and every code matches. */
export function evaluateM2(observed, expected) {
  const f = [];
  for (const k of ["original", "current", "estimate"]) {
    if (observed[k] !== expected.total) f.push(`${k} ${observed[k]}¢ ≠ ${expected.total}¢`);
  }
  const mismatches = [];
  for (const [code, v] of Object.entries(expected.tree)) {
    const r = observed.rows?.[code];
    if (!r || r.ob !== v.cents || r.cb !== v.cents || r.ce !== v.cents || r.mh !== v.mhMilli) {
      mismatches.push({ code, expected: v, got: r ?? null });
    }
  }
  if (mismatches.length) f.push(`${mismatches.length} per-code mismatches: ${mismatches.slice(0, 4).map((m) => m.code).join(", ")}`);
  return { failures: f, mismatches };
}

/** M4: EAC == AC + (CB − EV), exact integer cents. */
export function evaluateM4({ ev, ac, cb, eac }) {
  const all = [ev, ac, cb, eac].every(Number.isSafeInteger);
  const expectEac = all ? ac + (cb - ev) : null;
  const f = [];
  if (!all) f.push(`missing value: EV ${ev}, AC ${ac}, CB ${cb}, EAC ${eac}`);
  else if (eac !== expectEac) f.push(`EAC ${eac}¢ ≠ AC + (CB − EV) = ${expectEac}¢ (off by ${eac - expectEac}¢)`);
  return { failures: f, expectEac };
}

export const M5_CO_CENTS = 6_000_000;

/** M5: approving CO-001 on 25-031 moves CB and EAC by exactly +6,000,000¢, OB by 0; reset restores seed. */
export function evaluateM5({ before, after, afterReset, coCents }, expectedDelta = M5_CO_CENTS) {
  const f = [];
  if (coCents !== expectedDelta) f.push(`CO-001 total ${coCents}¢ ≠ ${expectedDelta}¢`);
  const d = (k) => after?.[k] - before?.[k];
  if (d("cb") !== expectedDelta) f.push(`current budget moved ${d("cb")}¢, want +${expectedDelta}¢`);
  if (d("eac") !== expectedDelta) f.push(`EAC moved ${d("eac")}¢, want +${expectedDelta}¢`);
  if (d("ob") !== 0) f.push(`original budget moved ${d("ob")}¢, want 0`);
  for (const k of ["ob", "cb", "eac"]) {
    if (afterReset?.[k] !== before?.[k]) f.push(`reset left ${k} ${afterReset?.[k]}¢, seed ${before?.[k]}¢`);
  }
  return { failures: f, deltas: { cb: d("cb"), eac: d("eac"), ob: d("ob") } };
}

const HEX = /^[0-9a-f]+$/;
/**
 * Deployed commit as shown (40 chars, or a 12-char prefix) vs the expected full 40-char SHA.
 * A prefix must also resolve, via git, to exactly the expected commit (unambiguous).
 * @param {string} shown
 * @param {string} expectedFull
 * @param {(prefix: string) => string|null} resolve git rev-parse of the prefix; null when unknown or ambiguous
 */
export function shaMatches(shown, expectedFull, resolve) {
  const s = String(shown ?? "").trim().toLowerCase();
  const e = String(expectedFull ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(e)) return { ok: false, detail: `expected is not a full 40-char SHA: "${e}"` };
  if (!HEX.test(s) || s.length < 7) return { ok: false, detail: `shown "${s}" is not a commit SHA` };
  if (s.length === 40) return { ok: s === e, full: s, detail: s === e ? s : `${s} ≠ ${e}` };
  if (!e.startsWith(s)) return { ok: false, detail: `${s} is not a prefix of ${e}` };
  const full = resolve(s);
  if (!full) return { ok: false, detail: `${s} does not resolve to one commit (unknown or ambiguous)` };
  return { ok: full === e, full, detail: full === e ? `${s} → ${full}` : `${s} → ${full} ≠ ${e}` };
}

export const MAX_GREEN_AGE_HOURS = 24;

/**
 * Red-main handling. v5Commits newest first: [{ sha, committedAt (ISO), gate: "success"|"failure"|"pending"|"missing" }].
 * Returns the last green v5 commit and results with severity PASS | WARN | FAIL. A red main HEAD is WARN and stays
 * in the summary; staging ≠ last green, or last green older than the limit while newer v5 commits wait, is FAIL.
 */
export function evaluateMain({ head, v5Commits, deployedFull, now = Date.now(), maxAgeHours = MAX_GREEN_AGE_HOURS }) {
  const results = [];
  const add = (severity, name, detail) => results.push({ severity, name, detail });
  const lastGreen = v5Commits.find((c) => c.gate === "success") ?? null;
  const reds = [head, v5Commits[0]].filter((c, i, a) => c && a.findIndex((x) => x?.sha === c.sha) === i);
  for (const c of reds) {
    const label = c === head ? "main HEAD" : "newest v5 commit";
    if (c.gate === "failure") add("WARN", `${label} red: ${c.sha}, CI failing`, `ci-gate failure on ${c.sha}`);
    else if (c.gate !== "success") add("WARN", `${label} CI not green yet: ${c.sha}`, `ci-gate ${c.gate}`);
  }
  if (!lastGreen) {
    add("FAIL", "last green main commit found", `no ci-gate success among ${v5Commits.length} newest v5 commits`);
    return { lastGreen, results };
  }
  add("PASS", "last green main commit found", `${lastGreen.sha} (${lastGreen.committedAt})`);
  // Age = how long the last green has been superseded by v5 work that is not green: time since the oldest
  // v5 commit newer than last green. A quiet main (last green is the newest v5 commit) never goes stale.
  const idx = v5Commits.indexOf(lastGreen);
  const firstNewer = idx > 0 ? v5Commits[idx - 1] : null;
  const ageH = firstNewer ? (now - Date.parse(firstNewer.committedAt)) / 3_600_000 : 0;
  const stale = Boolean(firstNewer) && !(ageH <= maxAgeHours);
  add(
    stale ? "FAIL" : "PASS",
    `last green not superseded by red/pending v5 work for over ${maxAgeHours} h`,
    firstNewer
      ? `${lastGreen.sha.slice(0, 12)} superseded ${ageH.toFixed(1)} h ago by ${firstNewer.sha.slice(0, 12)} (${idx} newer v5 commit(s) not green)`
      : `${lastGreen.sha.slice(0, 12)} is the newest v5 commit`,
  );
  if (deployedFull !== undefined) {
    add(
      deployedFull === lastGreen.sha ? "PASS" : "FAIL",
      "staging serves the last green main commit",
      `deployed ${deployedFull ?? "(unresolved)"} vs last green ${lastGreen.sha}`,
    );
  }
  return { lastGreen, results };
}

/** Stress seed job the V5_SEED_STRESS=1 path appends (v5/src/seed/stress.ts STRESS_JOB_NUMBER). */
export const STRESS_JOB_NUMBER = "99-010";

/**
 * V5_SEED_STRESS=1 seed → failure strings (empty = pass). Guards the 0013 regression where stress crews
 * were not copied and createSandbox threw on daily_plans_crew_id_crews_id_fk.
 * observed: { error, landedOn, http5xx: string[], orphanPlans, stressJobs, stressCrews, stressPlansOnStressCrew }
 */
export function evaluateStressSeed(o) {
  const f = [];
  if (o.error) f.push(`stress seed sign-in threw: ${o.error}`);
  for (const r of o.http5xx ?? []) f.push(`stress seed sign-in got ${r}`);
  if (!o.error && !/^\/app(\?|$)/.test(o.landedOn ?? "")) f.push(`stress seed sign-in landed on ${o.landedOn ?? "(nothing)"}, not /app`);
  if (!(o.orphanPlans === 0)) f.push(`${o.orphanPlans ?? "?"} daily_plans.crew_id reference a missing crew`);
  if (!(o.stressJobs === 1)) f.push(`stress job ${STRESS_JOB_NUMBER} rows in the new sandbox: ${o.stressJobs ?? "?"} (want 1)`);
  if (!(o.stressCrews === 1)) f.push(`"Stress Crew" rows in the new sandbox: ${o.stressCrews ?? "?"} (want 1)`);
  if (!(o.stressPlansOnStressCrew > 0)) f.push(`no stress plan points at "Stress Crew" (${o.stressPlansOnStressCrew ?? "?"})`);
  return f;
}

/**
 * Runs one verify flow; a thrown error becomes a FAIL via `check(name, false, firstLine)` instead of
 * ending the run (verify.mjs's step()). Never swallows: every throw is recorded.
 */
export async function runStep(check, name, fn) {
  try {
    await fn();
  } catch (error) {
    check(name, false, String(error?.message ?? error).split("\n")[0]);
  }
}

// ---- Production: the deployed commit must be the newest v5 release tag ----
// Production (demo.pcserp.app, app.pcserp.app) runs a release tag, not main. Staging keeps the
// last-green-main rule above. Production has no skip path: no tag, a red tag, a tag off main, or any
// other deployed commit is a FAIL, and it never falls back to last green main.

/** Hosts that are production: pcserp.app and every subdomain of it (demo., app.). */
export const PRODUCTION_HOST = /(^|\.)pcserp\.app$/i;

/**
 * Which rule a run uses. `flag` is --target: "auto" (host decides), "production" or "staging".
 * Returns { target, error }. --target staging on a production host and --main-ci off on a production
 * target are errors, so neither can skip the release check.
 */
export function resolveTarget(url, flag = "auto", mainCi = "auto") {
  if (!["auto", "production", "staging"].includes(flag)) return { target: null, error: `--target must be auto, production or staging (got ${flag})` };
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return { target: null, error: `--url is not a URL: ${url}` };
  }
  const prodHost = PRODUCTION_HOST.test(host);
  if (flag === "staging" && prodHost) return { target: null, error: `${host} is production; --target staging cannot be used against it` };
  const target = flag === "auto" ? (prodHost ? "production" : "staging") : flag;
  if (target === "production" && mainCi === "off") return { target: null, error: "production always reads main CI and the release tag's ci-gate; --main-ci off is not allowed" };
  return { target, error: null };
}

/** "v5.MINOR.PATCH" (no leading zeros, no suffix) → [5, minor, patch]; anything else → null. */
export function parseV5Tag(name) {
  const m = /^v5\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(name ?? ""));
  return m ? [5, Number(m[1]), Number(m[2])] : null;
}

/**
 * Newest v5 release tag by semver (never by creation date or listing order). Non-v5 and malformed
 * tags are ignored. tags: [{ name, sha }]. Returns { name, sha } or null.
 */
export function newestV5Tag(tags) {
  let best = null;
  for (const t of tags ?? []) {
    const v = parseV5Tag(t?.name);
    if (!v || !/^[0-9a-f]{40}$/.test(String(t.sha ?? ""))) continue;
    if (!best || v[1] > best.v[1] || (v[1] === best.v[1] && v[2] > best.v[2])) best = { v, name: t.name, sha: t.sha };
  }
  return best ? { name: best.name, sha: best.sha } : null;
}

/**
 * Production release rule → [{ severity: PASS|FAIL, name, detail }].
 * newest: newestV5Tag(...) or null; gate: ci-gate conclusion on the tag commit; onMain: tag commit is
 * an ancestor of main (true/false/null when unknown); deployedFull: the deployed full SHA (null if unresolved).
 */
export function evaluateRelease({ newest, gate, onMain, deployedFull }) {
  if (!newest) {
    return [{ severity: "FAIL", name: "newest v5 release tag found", detail: "no v5.MINOR.PATCH tag on origin; production never falls back to last green main" }];
  }
  const short = newest.sha.slice(0, 12);
  return [
    { severity: "PASS", name: "newest v5 release tag found", detail: `${newest.name} → ${newest.sha}` },
    { severity: gate === "success" ? "PASS" : "FAIL", name: "release tag ci-gate green", detail: `ci-gate ${gate ?? "unknown"} on ${newest.name} (${short})` },
    { severity: onMain === true ? "PASS" : "FAIL", name: "release tag commit is on main", detail: `${newest.name} (${short}) ${onMain === true ? "is an ancestor of main" : onMain === false ? "is NOT an ancestor of main" : "ancestry unknown"}` },
    {
      severity: deployedFull === newest.sha ? "PASS" : "FAIL",
      name: "production serves the newest v5 release tag",
      detail: `deployed ${deployedFull ?? "(unresolved)"} vs ${newest.name} ${newest.sha}`,
    },
  ];
}

/**
 * Expected deployed commit. A pinned --commit wins (the release/last-green rules below still apply).
 * Production: the newest v5 release tag's commit, or "" when there is none (every commit check then
 * fails); it never falls back to last green main. Staging: last green v5 commit, else `fallback()`.
 */
export function expectedCommitFor({ target, pinned, release, mainCi, fallback }) {
  if (pinned) return pinned;
  if (target === "production") return release?.newest?.sha ?? "";
  return mainCi?.v5Commits?.find((c) => c.gate === "success")?.sha || fallback();
}

/**
 * Commit-rule results for a staging or production run → [{ severity, name, detail }].
 * Staging: evaluateMain with the deployed commit (unchanged last-green rule). Production: evaluateMain's
 * main-health results (last green found, staleness, red HEAD WARN) without the staging comparison,
 * plus evaluateRelease. mainCi / release are null when their read failed (`mainCiError` / `releaseError`).
 */
export function commitResults({ target, mainCi, mainCiError, release, releaseError, deployedFull, now = Date.now(), maxAgeHours = MAX_GREEN_AGE_HOURS }) {
  const results = [];
  if (mainCiError || !mainCi) results.push({ severity: "FAIL", name: "main CI read (ci-gate per v5 commit)", detail: mainCiError ?? "no data" });
  else {
    const production = target === "production";
    results.push(...evaluateMain({ head: mainCi.head, v5Commits: mainCi.v5Commits, deployedFull: production ? undefined : deployedFull, now, maxAgeHours }).results);
  }
  if (target === "production") {
    if (releaseError || !release) results.push({ severity: "FAIL", name: "release tags read (git ls-remote, ci-gate, ancestry)", detail: releaseError ?? "no data" });
    else results.push(...evaluateRelease({ ...release, deployedFull }));
  }
  return results;
}
