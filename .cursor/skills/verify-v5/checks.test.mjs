#!/usr/bin/env node
// Must-fail self-tests for the pure checks in checks.mjs. Each new check must FAIL on bad input and
// PASS on the good twin of that input. No network, no Playwright. Run: node checks.test.mjs
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitResults,
  E1_PATHS,
  expectedCommitFor,
  newestV5Tag,
  resolveTarget,
  bannedHits,
  emptyHitAllowed,
  classifyClip,
  DESKTOP_MIN_PX,
  evaluateCrawlRow,
  evaluatePhoneUx,
  evaluateM2,
  evaluateM4,
  evaluateM5,
  evaluateMain,
  evaluateStressSeed,
  runStep,
  MIN_INPUT_FONT_PX,
  MIN_SECONDARY_FONT_PX,
  MIN_BODY_FONT_PX,
  MIN_TAP_PX,
  PHONE_MAX_PX,
  PHONE_OVERFLOW_WIDTHS,
  PRIMARY_ACTION_VERB,
  secondaryReachable,
  shaMatches,
  textHasMoney,
} from "./checks.mjs";
import { parseLsRemoteTags } from "./main-ci.mjs";
import { evaluateCostIndexes, evaluateNextSteps, evaluateTitlesAndLabels, NEXT_STEP_VERBS, PURPOSE_MAX_CHARS, PURPOSE_MIN_CHARS } from "./checks.mjs";
import { AXE_PASSES, C8_TAGS, evaluateAxeRows, loadAxeSource, TOGGLE_NAME } from "./axe.mjs";
import { contextFor, crawl504Want, E1_EXTRA, e1ExtraCoverageFailures, SPEC_504_SIZES, SPEC_504_THEMES, spec504LoadCount, THEME_COOKIE, themeFailures } from "./crawl.mjs";
import { CONFIRM_DIALOG_CANCEL, CONFIRM_DIALOG_CONFIRM, CONFIRM_DIALOG_ROLE, CONFIRM_GRACE_MS, confirmDecision, confirmIfDialog, watchForDialog } from "./confirm-dialog.mjs";
import { countJourneyTaps, evaluateJourneyTaps, JOURNEY_TAP_LIMIT } from "./journeys.mjs";
import { parsePostgresUrl } from "./db-url.mjs";
import { capRawText, captureFailure, RAW_TEXT_CAP, redactHeaders, redactText, redactUrl, safeJson, secretValues, startFailureRecorder } from "./evidence.mjs";
import { evaluateResetTimes, RESET_BUDGET_MS, RESET_IDLE_CAP_MS, RESET_IDLE_MS, RESET_SAMPLES, RESET_TIMEOUT_MS, runResetTimeStep } from "./reset-time.mjs";
import { execFileSync } from "node:child_process";
import { PORTFOLIO_ROWS_TIMEOUT_MS, PORTFOLIO_SETTLE_MS, PORTFOLIO_STEP, portfolioOk, runPortfolioStep, waitForRowCount } from "./portfolio.mjs";
import { CRAWL_ROLES, CRAWL_WIDTHS, changesPath, expectedNavLoads, jobStripHits, navCrawlPages, navCrawlPlan, ROADMAP_EXTRA_WIDTHS, roadmapCoverageFailures, SCHEDULE_PATH, SCHEDULE_ROLE_ACCESS, SCHEDULE_ROUTE_FILE, scheduleCoverageFailures, scheduleDenialFailures, scheduleNavFailures, schedulePath, scheduleRouteAtCommit, scheduleWidths } from "./crawl.mjs";
import { csvLeafCodes, drillCoverageFailures, drillDiscoveryFailures, drillItemCount, drillItemList, drillLoadPlan, drillPath, expectedDrillLoads, partCFailures, partCItemFor, seedChildEnv, leakedSeedEnvKeys, SEED_CHILD_ENV_ALLOW, seedDrillItems } from "./drill.mjs";
import {
  acceptanceItems,
  attributeChecks,
  attributeFailure,
  browserFailureCheck,
  buildRcChecks,
  deployedForMainRule,
  failureSegments,
  appliedMigrationTags,
  evaluateAppliedJournal,
  evaluateRcAcceptance,
  SPEC504_EXECUTED_ITEMS,
  evaluateRcHead,
  evaluateRcMigrations,
  journalAppliesCleanly,
  journalSkipFailures,
  migrationsAdded,
  RESERVED_GAPS,
  parseRcMerges,
  phoneChecksEnabled,
  readRcHistory,
  readStatusColorHits,
  resolveRcMode,
  STATUS_COLOR_PATTERN,
  statusColorCheck,
} from "./rc.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const mustFail = (name, failures) => {
  assert.ok(failures.length > 0, `must-fail case passed: ${name}`);
  results.push(`FAILS as expected: ${name} → ${failures[0]}`);
};
const mustPass = (name, failures) => {
  assert.deepEqual(failures, [], `good case failed: ${name}`);
  results.push(`passes: ${name}`);
};

/** Temporary git repo with a journal and, when asked, docs/v5/specs/5.0.4-*.md. */
function specFixture(withSpec) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "verify-v5-spec-"));
  const run = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  run(["init", "-b", "main"]);
  run(["config", "user.email", "verify-v5@example.com"]);
  run(["config", "user.name", "verify-v5"]);
  const journal = path.join(dir, "v5/drizzle/meta/_journal.json");
  mkdirSync(path.dirname(journal), { recursive: true });
  writeFileSync(journal, JSON.stringify({ entries: [{ tag: "0015", when: 15 }] }));
  const specs = path.join(dir, "docs/v5/specs");
  mkdirSync(specs, { recursive: true });
  writeFileSync(path.join(specs, "README.md"), "# specs\n");
  if (withSpec) {
    writeFileSync(
      path.join(specs, "5.0.4-clear-next-steps-and-mobile-polish.md"),
      "### Acceptance check for 5.0.4-0\n\nDocument scrollWidth stays within the phone viewport.\n",
    );
  }
  run(["add", "."]);
  run(["-c", "commit.gpgsign=false", "commit", "-m", "fixture"]);
  return { dir, sha: run(["rev-parse", "HEAD"]).trim() };
}

// ---- banned words ----
for (const bad of ["Coming soon", "coming  soon", "This is a stub", "STUB data", "stubs", "FIXME", "fixme: wire it", "TBD", "tbd", "WIP", "wip", "TODO", "Lorem ipsum", "placeholder", "ERP", "an erp", "Not implemented"]) {
  assert.ok(bannedHits(bad).length > 0, `banned must catch ${JSON.stringify(bad)}`);
}
for (const ok of ["Superintendent", "Interpretation", "toddler", "stubborn", "Stubbs Excavating", "wipe down forms", "windshield wiper", "Fixed", "TBDX", "enterprise", "Sherpa", "stubble"]) {
  assert.deepEqual(bannedHits(ok), [], `false positive on ${JSON.stringify(ok)}: ${JSON.stringify(bannedHits(ok))}`);
}
results.push("banned list: 17 bad strings caught, 12 legit words clean");

// ---- crawl row ----
const good = {
  role: "pm", width: 390, path: "/app/jobs/25-031", status: 200, final: "/app/jobs/25-031", idleMs: 900,
  responses4xx5xx: [], consoleErrors: [], pageErrors: [], text: "Cedar Creek bridge. Superintendent notes.",
  overflowPx: 0, emptyHits: [], seededCounts: { costRows: 12, portfolioRows: 0 },
};
mustPass("good crawl row", evaluateCrawlRow(good));
mustFail("page text 'coming soon'", evaluateCrawlRow({ ...good, text: "Schedule — coming soon" }));
mustFail("page text 'stub'", evaluateCrawlRow({ ...good, text: "Forecast stub" }));
mustFail("navigation HTTP 500", evaluateCrawlRow({ ...good, status: 500 }));
mustFail("sub-request HTTP 500", evaluateCrawlRow({ ...good, responses4xx5xx: [{ url: "/api/x", status: 500 }] }));
mustFail("sub-request HTTP 404", evaluateCrawlRow({ ...good, responses4xx5xx: [{ url: "/_next/x.js", status: 404 }] }));
mustFail("slow page 1501 ms", evaluateCrawlRow({ ...good, idleMs: 1501 }));
mustPass("page at exactly 1500 ms", evaluateCrawlRow({ ...good, idleMs: 1500 }));
mustFail("console error", evaluateCrawlRow({ ...good, consoleErrors: ["TypeError: x is undefined"] }));
mustFail("page error", evaluateCrawlRow({ ...good, pageErrors: ["boom"] }));
mustFail("error boundary", evaluateCrawlRow({ ...good, text: "Application error: a client-side exception has occurred" }));
mustFail("horizontal overflow 1px", evaluateCrawlRow({ ...good, overflowPx: 1 }));
mustFail("bounced to /login", evaluateCrawlRow({ ...good, final: "/login" }));
mustFail("job page with 0 cost rows", evaluateCrawlRow({ ...good, seededCounts: { costRows: 0 } }));
mustFail("portfolio with 0 job rows", evaluateCrawlRow({ ...good, path: "/app", final: "/app", seededCounts: { portfolioRows: 0 } }));
mustFail("unexpected empty state", evaluateCrawlRow({ ...good, emptyHits: [{ text: "No changes yet.", coNumber: null, coStatus: null }] }));

// ---- allowed empty states, by name only ----
const voided = { text: "No lines yet. Price it per cost item.", coNumber: "CO-001", coStatus: "voided" };
const draft = { text: "No lines yet. Price it per cost item.", coNumber: "CO-001", coStatus: "draft" };
mustPass("Voided CO-001 on 24-077 allowed", evaluateCrawlRow({ ...good, path: "/app/jobs/24-077", final: "/app/jobs/24-077", emptyHits: [voided] }));
mustPass("Draft CO-001 on 24-118 allowed", evaluateCrawlRow({ ...good, path: "/app/jobs/24-118", final: "/app/jobs/24-118", emptyHits: [draft] }));
mustFail("Voided CO-001 empty on 24-118 (wrong job)", evaluateCrawlRow({ ...good, path: "/app/jobs/24-118", final: "/app/jobs/24-118", emptyHits: [voided] }));
mustFail("Priced CO-001 empty on 24-077 (wrong status)", evaluateCrawlRow({ ...good, path: "/app/jobs/24-077", final: "/app/jobs/24-077", emptyHits: [{ ...voided, coStatus: "priced" }] }));
mustFail("CO-002 empty on 24-077 (wrong CO)", evaluateCrawlRow({ ...good, path: "/app/jobs/24-077", final: "/app/jobs/24-077", emptyHits: [{ ...voided, coNumber: "CO-002" }] }));
mustFail("other empty text inside allowed CO", evaluateCrawlRow({ ...good, path: "/app/jobs/24-077", final: "/app/jobs/24-077", emptyHits: [{ ...voided, text: "No approvals yet" }] }));
assert.equal(emptyHitAllowed({ path: "/app/jobs/25-031", ...draft }), false);

// ---- phone layout: overflow, tap, text, clipping, one-tap (missing fields are skipped) ----
{
  assert.deepEqual(PHONE_OVERFLOW_WIDTHS, [320, 390]);
  assert.equal(PHONE_MAX_PX, 480);
  assert.equal(DESKTOP_MIN_PX, 768);
  assert.equal(MIN_TAP_PX, 44);
  assert.equal(MIN_SECONDARY_FONT_PX, 14);
  assert.equal(MIN_BODY_FONT_PX, 16);
  assert.equal(MIN_INPUT_FONT_PX, 16);
  assert.deepEqual(Object.keys(PRIMARY_ACTION_VERB), ["executive", "pm", "superintendent", "foreman"]);
  const src = readFileSync(path.join(here, "checks.mjs"), "utf8");
  for (const [name, value] of [
    ["PHONE_OVERFLOW_WIDTHS", "\\[320, 390\\]"],
    ["PHONE_MAX_PX", "480"],
    ["DESKTOP_MIN_PX", "768"],
    ["MIN_TAP_PX", "44"],
    ["MIN_SECONDARY_FONT_PX", "14"],
    ["MIN_BODY_FONT_PX", "16"],
    ["MIN_INPUT_FONT_PX", "16"],
  ]) {
    assert.equal((src.match(new RegExp(`\\b${name}\\s*=`, "g")) ?? []).length, 1, `${name} assigned once`);
    assert.match(src, new RegExp(`^export const ${name} = ${value};$`, "m"), `${name} must be the literal ${value}`);
  }
  assert.match(src, /^export function evaluatePhoneUx\(row\) \{$/m, "evaluatePhoneUx takes only the row");
  assert.match(src, /phoneChecks = false/, "phone checks default off");
  assert.match(src, /if \(phoneChecks\) f\.push\(\.\.\.evaluatePhoneUx\(row\)\)/, "evaluateCrawlRow calls evaluatePhoneUx only when asked");
  const crawlSrc = readFileSync(path.join(here, "crawl.mjs"), "utf8");
  for (const field of ["docScrollWidth", "viewportWidth", "tapMisses", "textMisses", "clips", "primaryActions", "clipCount", "stripPastRight", "changeItems"]) {
    assert.ok(crawlSrc.includes(field), `measurePage must record ${field}`);
  }
  assert.match(crawlSrc, /phoneOverflowWidths\.includes\(intendedW\)/, "job-strip right edge is recorded only at the phone overflow widths");
  assert.match(crawlSrc, /rect\.right > clientWidth/, "job-strip clause compares getBoundingClientRect().right to clientWidth");
  assert.match(crawlSrc, /classifyClip\(/, "the crawl classifies clips with classifyClip");
  assert.match(crawlSrc, /secondaryReachable\(/, "the crawl decides reachability with secondaryReachable");
  assert.match(crawlSrc, /textHasMoney\(/, "a $ amount anywhere in the clipped text is money");
  assert.match(crawlSrc, /hidesProtected/, "a container that cuts protected content is still reported");
  assert.doesNotMatch(crawlSrc, /some\(isClipped\)\) continue;/, "a clipped child must not hide a container that cuts protected content");
  assert.doesNotMatch(crawlSrc, /clips\.length < 8/, "a clip cap must not drop a later clip");
  assert.doesNotMatch(crawlSrc, /closest\("a\[href\]"\)/, "a link is not a reachable full text");
  assert.doesNotMatch(crawlSrc, /data-clip='secondary'\], header/, "a header is not a secondary label");
  const phone = {
    ...good, width: 320, docScrollWidth: 320, viewportWidth: 320,
    tapMisses: [], textMisses: [], clips: [], primaryActions: [], pastRight: { count: 0, items: [] }, scrollX: [],
  };
  // Whole-page right edge (lead review of #84): any visible element past clientWidth at 320/390, outside [data-scroll-x].
  {
    const hit = { tag: "div", testid: "kpi-strip", text: "EAC $1.2M", right: 402, clientWidth: 390 };
    const past = evaluatePhoneUx({ ...phone, width: 390, docScrollWidth: 390, viewportWidth: 390, pastRight: { count: 1, items: [hit] } });
    mustFail("element past clientWidth outside job-strip at 390", past);
    assert.match(past.join("\n"), /div\[data-testid="kpi-strip"\] "EAC \$1\.2M" right 402 > clientWidth 390/);
    const many = evaluatePhoneUx({ ...phone, pastRight: { count: 30, items: [{ ...hit, right: 330, clientWidth: 320 }] } });
    assert.ok(many.some((x) => /30 elements past the right edge, 1 listed/.test(x)), JSON.stringify(many));
    const sx = evaluatePhoneUx({ ...phone, scrollX: [{ tag: "div", testid: "cost-table", text: "03-210 Footing" }] });
    mustFail("visible [data-scroll-x] on a phone", sx);
    assert.match(sx.join("\n"), /visible \[data-scroll-x\] div\[data-testid="cost-table"\]/);
    const missing = evaluatePhoneUx({ ...phone, pastRight: undefined, scrollX: undefined });
    mustFail("right-edge scan not recorded", missing);
    assert.ok(missing.some((x) => /right-edge scan not recorded/.test(x)) && missing.some((x) => /\[data-scroll-x\] scan not recorded/.test(x)));
    mustPass("right edge outside the phone widths is not this clause", evaluatePhoneUx({ ...phone, width: 1280, docScrollWidth: 1280, viewportWidth: 1280, pastRight: { count: 1, items: [{ ...hit, right: 1400, clientWidth: 1280 }] }, scrollX: [{ tag: "div", testid: null, text: "x" }] }));
    assert.match(crawlSrc, /el\.closest\("\[data-scroll-x\]"\) \|\| !shown\(el\)/, "the right-edge scan skips only [data-scroll-x] regions and hidden elements");
  }
  const allowedSecondary = { kind: "secondary", text: "Cedar Creek Bridge", reachable: true, ellipsis: true };
  mustPass("phone observations within the floors", evaluatePhoneUx(phone));
  mustPass(
    "default crawl ignores phone failures",
    evaluateCrawlRow({
      ...phone,
      docScrollWidth: 422,
      stripPastRight: [{ text: "I-5 Culvert 24-077", right: 373, clientWidth: 320 }],
      tapMisses: [{ tag: "button", w: 20, h: 20, text: "Go" }],
      textMisses: [{ kind: "secondary", px: 11, text: "Portfolio" }],
      clips: [{ kind: "money", text: "$1,234.56", reachable: true, ellipsis: true }],
      primaryActions: [],
    }),
  );
  const stripPast = evaluatePhoneUx({ ...phone, stripPastRight: [{ text: "I-5 Culvert 24-077", right: 373, clientWidth: 320 }] });
  mustFail("job-strip element past clientWidth at 320", stripPast);
  assert.match(stripPast[0], /job-strip element "I-5 Culvert 24-077" right 373 > clientWidth 320/, stripPast[0]);
  const strip390 = evaluatePhoneUx({ ...phone, width: 390, docScrollWidth: 390, viewportWidth: 390, stripPastRight: [{ text: "I-5 Culvert 24-077", right: 410, clientWidth: 390 }] });
  mustFail("job-strip element past clientWidth at 390", strip390);
  assert.match(strip390[0], /job-strip element "I-5 Culvert 24-077" right 410 > clientWidth 390/);
  mustPass("job-strip wrapped inside clientWidth", evaluatePhoneUx({ ...phone, stripPastRight: [] }));
  mustPass("job-strip observation missing is skipped", evaluatePhoneUx(phone));
  mustPass("job-strip past the edge at 1280 is outside the clause", evaluatePhoneUx({ ...phone, width: 1280, docScrollWidth: 1280, viewportWidth: 1280, stripPastRight: [{ text: "I-5 Culvert 24-077", right: 1400, clientWidth: 1280 }] }));
  assert.match(crawlSrc, /out\.stripPastRight = jobStripHits\(/, "scanPage must record a missing job strip");
  assert.deepEqual(jobStripHits("/status", false, []), [], "pages outside /app and /app/jobs do not require the strip");
  assert.deepEqual(jobStripHits("/phone/overflow", false, []), []);
  const stripGone = (path, width) => evaluateCrawlRow({
    ...good,
    path,
    final: path,
    width,
    seededCounts: path === "/app" ? { portfolioRows: 4, costRows: 0 } : good.seededCounts,
    docScrollWidth: width,
    viewportWidth: width,
    tapMisses: [],
    textMisses: [],
    clips: [],
    stripPastRight: jobStripHits(path, false, []),
  }, { phoneChecks: true }).filter((f) => /job-strip missing/.test(f));
  const gone320 = stripGone("/app", 320);
  mustFail("job strip removed at 320 with phone checks on", gone320);
  assert.match(gone320[0], /job-strip missing/);
  const gone390 = stripGone("/app/jobs/25-031", 390);
  mustFail("job strip removed at 390 with phone checks on", gone390);
  assert.match(gone390[0], /job-strip missing/);
  mustPass("job strip missing ignored with phone checks off", evaluateCrawlRow({ ...good, stripPastRight: [{ missing: true }] }));
  mustFail("document scrollWidth 422px at viewport 320", evaluatePhoneUx({ ...phone, docScrollWidth: 422 }));
  mustFail("document scrollWidth 400px at viewport 390", evaluatePhoneUx({ ...phone, width: 390, docScrollWidth: 400, viewportWidth: 390 }));
  mustPass("422px document inside a 1280 viewport", evaluatePhoneUx({ ...phone, width: 1280, docScrollWidth: 422, viewportWidth: 1280 }));
  mustFail("tap target 20×20", evaluatePhoneUx({ ...phone, tapMisses: [{ tag: "button", w: 20, h: 20, text: "Go" }] }));
  mustFail("tap target 44×43.9", evaluatePhoneUx({ ...phone, tapMisses: [{ tag: "a", w: 44, h: 43.9, text: "Portfolio" }] }));
  mustPass("tap target exactly 44×44 is not a miss", evaluatePhoneUx(phone));
  mustFail("secondary text 11px", evaluatePhoneUx({ ...phone, textMisses: [{ kind: "secondary", px: 11, text: "Portfolio" }] }));
  // 5.0.4-c check 2 (main 4c9d3539): the floor is 14 px, so 13 px (passed under the old 12 px floor) fails.
  mustFail("secondary text 13px (5.0.4-c check 2 floor 14)", evaluatePhoneUx({ ...phone, textMisses: [{ kind: "secondary", px: 13, text: "Portfolio" }] }));
  mustFail("body text p 15px (5.0.4-c check 2 body 16)", evaluatePhoneUx({ ...phone, textMisses: [{ kind: "body", tag: "p", px: 15, text: "Paragraph" }] }));
  mustFail("input text 14px", evaluatePhoneUx({ ...phone, textMisses: [{ kind: "input", px: 14, text: "Hours" }] }));
  mustFail("clipped money, even with a title", evaluatePhoneUx({ ...phone, clips: [{ kind: "money", text: "$1,234.56", reachable: true, ellipsis: true }] }));
  mustFail("clipped money at 1280", evaluatePhoneUx({ ...phone, width: 1280, clips: [{ kind: "money", text: "$1,234.56", reachable: true, ellipsis: true }] }));
  mustFail("clipped status pill 'At risk'", evaluatePhoneUx({ ...phone, clips: [{ kind: "status", text: "At risk", reachable: true, ellipsis: true }] }));
  mustFail("clipped table header 'Actual'", evaluatePhoneUx({ ...phone, clips: [{ kind: "header", text: "Actual", reachable: true, ellipsis: true }] }));
  mustFail("clipped page title", evaluatePhoneUx({ ...phone, clips: [{ kind: "title", text: "Cedar Creek Bridge", reachable: true, ellipsis: true }] }));
  mustFail("desktop ellipsis even with a title", evaluatePhoneUx({ ...phone, width: 1280, clips: [{ ...allowedSecondary }] }));
  mustFail("phone secondary ellipsis with no reachable full text", evaluatePhoneUx({ ...phone, clips: [{ kind: "secondary", text: "Cedar Creek Bridge", reachable: false, ellipsis: true }] }));
  mustFail("phone secondary hard clip", evaluatePhoneUx({ ...phone, clips: [{ kind: "secondary", text: "Cedar Creek Bridge", reachable: true, ellipsis: false }] }));
  mustPass("phone secondary ellipsis with a title", evaluatePhoneUx({ ...phone, clips: [{ ...allowedSecondary }] }));
  const eight = Array.from({ length: 8 }, () => ({ ...allowedSecondary }));
  const capped = evaluatePhoneUx({ ...phone, clips: eight, clipCount: 9 });
  mustFail("9th clip hidden past a list of 8", capped);
  assert.ok(capped.some((x) => /9 clipped elements, only 8 listed/.test(x)), `cap must be named; got ${JSON.stringify(capped)}`);
  assert.equal(classifyClip({ centsInBox: true, secondaryBox: true }), "money", "money inside a secondary box is money");
  assert.equal(classifyClip({ moneyText: true, secondaryBox: true }), "money");
  assert.equal(classifyClip({ statusInBox: true, secondaryBox: true }), "status", "a status pill inside a secondary box is a status pill");
  assert.equal(classifyClip({ headerInBox: true, secondaryBox: true }), "header", "a th inside a secondary box is a table header");
  assert.equal(classifyClip({ titleInBox: true, secondaryBox: true }), "title", "an h1 inside a secondary box is a page title");
  assert.equal(classifyClip({ secondaryBox: true }), "secondary");
  assert.equal(classifyClip({}), "text");
  assert.equal(textHasMoney("$1,234.56"), true);
  assert.equal(textHasMoney("$1,234,567.89"), true);
  assert.equal(textHasMoney("Budget $1,234,567"), true, "a $ amount anywhere in the text is money");
  assert.equal(textHasMoney("Cedar Creek Bridge"), false);
  assert.equal(textHasMoney("$"), false);
  assert.equal(textHasMoney("$,000"), false);
  assert.equal(secondaryReachable({ text: "Cedar Creek Bridge", title: "Cedar Creek Bridge" }), true);
  assert.equal(secondaryReachable({ text: "Cedar Creek Bridge", ariaLabel: "  Cedar   Creek Bridge " }), true);
  assert.equal(secondaryReachable({ text: "Cedar Creek Bridge", title: "See Cedar Creek Bridge" }), false, "a title that merely contains the text is not the full text");
  assert.equal(secondaryReachable({ text: "Cedar Creek Bridge", expanded: true }), true);
  assert.equal(secondaryReachable({ text: "Cedar Creek Bridge" }), false);
  assert.equal(phoneChecksEnabled({}), false);
  assert.equal(phoneChecksEnabled({ rc: null, flag: false }), false);
  assert.equal(phoneChecksEnabled({ flag: true }), true);
  assert.equal(phoneChecksEnabled({ rc: { version: "5.0.4", sha: "a".repeat(40) } }), true);
  const action = (role, text, extra = {}) => ({ role, text, tag: "A", visible: true, inView: true, blocked: false, ...extra });
  const landing = (role, actions) => ({
    ...phone, role, path: "/app", final: "/app", seededCounts: { portfolioRows: 4, costRows: 0 },
    primaryActions: actions ?? [
      action("executive", "Open the at-risk job"),
      action("pm", "Approve CO-001"),
      action("superintendent", "Submit tomorrow's plan"),
      action("foreman", "Report today's quantities"),
    ],
  });
  for (const role of ["executive", "pm", "superintendent", "foreman"]) mustPass(`${role} one-tap primary action`, evaluatePhoneUx(landing(role)));
  mustFail("primary action inside a closed disclosure", evaluatePhoneUx(landing("pm", [action("pm", "Approve CO-001", { visible: false, inView: false, blocked: true })])));
  mustFail("landing page with no primary action", evaluatePhoneUx(landing("foreman", [])));
  mustFail("primary action below the fold", evaluatePhoneUx(landing("superintendent", [action("superintendent", "Submit tomorrow's plan", { inView: false })])));
  mustPass("desktop landing does not require a one-tap action", evaluatePhoneUx({ ...landing("pm", []), width: 1280 }));
  // The old overflow check is unchanged: 1px still fails, and a phone pass does not clear it.
  mustFail("horizontal overflow 1px still fails beside a clean document width", evaluateCrawlRow({ ...phone, overflowPx: 1 }));
  mustFail("phone checks on does not clear a 1px overflow", evaluateCrawlRow({ ...phone, overflowPx: 1 }, { phoneChecks: true }));
}

// ---- M2 ----
const exp = JSON.parse(readFileSync(path.join(here, "fixtures", "m2-awkward-expected.json"), "utf8"));
assert.equal(exp.total, 10_071_336);
const rows = Object.fromEntries(Object.entries(exp.tree).map(([c, v]) => [c, { ob: v.cents, cb: v.cents, ce: v.cents, mh: v.mhMilli }]));
const m2good = { original: 10_071_336, current: 10_071_336, estimate: 10_071_336, rows };
mustPass("M2 exact totals + 15 codes", evaluateM2(m2good, exp).failures);
mustFail("M2 current total 10,071,335", evaluateM2({ ...m2good, current: 10_071_335 }, exp).failures);
mustFail("M2 original total 0", evaluateM2({ ...m2good, original: 0 }, exp).failures);
mustFail("M2 estimate null", evaluateM2({ ...m2good, estimate: null }, exp).failures);
mustFail("M2 one code off by 1¢", evaluateM2({ ...m2good, rows: { ...rows, "02-100": { ...rows["02-100"], cb: rows["02-100"].cb + 1 } } }, exp).failures);
mustFail("M2 missing code", evaluateM2({ ...m2good, rows: Object.fromEntries(Object.entries(rows).slice(1)) }, exp).failures);

// ---- M4 ----
// Post-0014 seed (5.0.2 Part A crew rates): AC 821,896,625 + (CB 1,289,740,000 − EV 639,558,000).
const m4good = { ev: 639_558_000, ac: 821_896_625, cb: 1_289_740_000, eac: 1_472_078_625 };
mustPass("M4 staging seed values", evaluateM4(m4good).failures);
mustFail("M4 pre-0014 EAC 1,469,630,250 with post-0014 AC", evaluateM4({ ...m4good, eac: 1_469_630_250 }).failures);
mustFail("M4 EAC off by +1¢", evaluateM4({ ...m4good, eac: m4good.eac + 1 }).failures);
mustFail("M4 EAC off by −1¢", evaluateM4({ ...m4good, eac: m4good.eac - 1 }).failures);
mustFail("M4 EAC missing", evaluateM4({ ...m4good, eac: null }).failures);

// ---- M5 ----
const before = { ob: 1_289_740_000, cb: 1_289_740_000, eac: 1_472_078_625 };
const m5good = { before, after: { ob: before.ob, cb: before.cb + 6_000_000, eac: before.eac + 6_000_000 }, afterReset: { ...before }, coCents: 6_000_000 };
mustPass("M5 +6,000,000¢ and reset", evaluateM5(m5good).failures);
mustFail("M5 CB delta 5,999,999", evaluateM5({ ...m5good, after: { ...m5good.after, cb: before.cb + 5_999_999 } }).failures);
mustFail("M5 EAC delta 5,999,999", evaluateM5({ ...m5good, after: { ...m5good.after, eac: before.eac + 5_999_999 } }).failures);
mustFail("M5 CO total 5,999,999", evaluateM5({ ...m5good, coCents: 5_999_999 }).failures);
mustFail("M5 original moved", evaluateM5({ ...m5good, after: { ...m5good.after, ob: before.ob + 6_000_000 } }).failures);
mustFail("M5 reset did not restore", evaluateM5({ ...m5good, afterReset: { ...m5good.after } }).failures);

// ---- nav crawl plan: /roadmap in the main crawl ----
{
  const jobs = ["24-118", "25-031", "24-077", "26-010"];
  const pages = navCrawlPages(jobs);
  const changesPages = jobs.map((j) => changesPath(j));
  assert.deepEqual(pages, [
    "/app",
    "/app/jobs/24-118", "/app/jobs/24-118/changes",
    "/app/jobs/25-031", "/app/jobs/25-031/changes",
    "/app/jobs/24-077", "/app/jobs/24-077/changes",
    "/app/jobs/26-010", "/app/jobs/26-010/changes",
    "/app/assistant", "/changelog", "/status", "/roadmap",
  ]);
  for (const p of changesPages) assert.ok(pages.includes(p), p);
  const plan = navCrawlPlan(jobs);
  assert.deepEqual(plan[0].widths, [320, 390, 768, 1280]);
  assert.deepEqual(plan[1], { pages: ["/roadmap"], widths: [375, 1440] });
  // 4 roles × 13 pages × 4 widths = 208, plus /roadmap × 4 roles × 2 extra widths = 8.
  // 13 = /app + 4 job pages + 4 /changes + assistant + changelog + status + /roadmap.
  assert.equal(expectedNavLoads(plan), 216);
  const omitted = plan.map((pass) => ({ ...pass, pages: pass.pages.filter((p) => !p.endsWith("/changes")) }));
  assert.equal(expectedNavLoads(omitted), 152, "a plan without /changes is the old 152-load count");
  assert.notEqual(expectedNavLoads(omitted), expectedNavLoads(plan), "dropping /changes fails the load count");
  results.push("nav crawl plan: 13 pages incl. /changes and /roadmap × 4 widths + /roadmap × 375/1440 → 216 loads; without /changes the count is 152");
  const row = (role, width) => ({ ...good, role, width, path: "/roadmap", final: "/roadmap", seededCounts: {}, hasMain: true });
  const full = CRAWL_ROLES.flatMap((r) => [...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS].map((w) => row(r, w)));
  mustPass("/roadmap crawled for 4 roles × 6 widths", roadmapCoverageFailures(full));
  mustFail("/roadmap missing pm@1440", roadmapCoverageFailures(full.filter((r) => !(r.role === "pm" && r.width === 1440))));
  mustFail("/roadmap missing foreman@375", roadmapCoverageFailures(full.filter((r) => !(r.role === "foreman" && r.width === 375))));
  mustFail("/roadmap without <main>", roadmapCoverageFailures(full.map((r, i) => (i === 0 ? { ...r, hasMain: false } : r))));
  mustFail("/roadmap 1501 ms", roadmapCoverageFailures(full.map((r, i) => (i === 3 ? { ...r, idleMs: 1501 } : r))));
  mustFail("/roadmap banned word", roadmapCoverageFailures(full.map((r, i) => (i === 5 ? { ...r, text: "5.0.2 coming soon" } : r))));
  mustFail("/roadmap error boundary", roadmapCoverageFailures(full.map((r, i) => (i === 7 ? { ...r, text: "Something went wrong" } : r))));
}

// ---- 5.1.0-c /schedule in the nav crawl (gated on the route file, not a version) ----
{
  const jobs = ["24-118", "25-031", "24-077", "26-010"];
  const active = ["24-077", "24-118", "25-031"];
  const off = navCrawlPlan(jobs);
  assert.deepEqual(off[0].pages, [
    "/app",
    "/app/jobs/24-118", "/app/jobs/24-118/changes",
    "/app/jobs/25-031", "/app/jobs/25-031/changes",
    "/app/jobs/24-077", "/app/jobs/24-077/changes",
    "/app/jobs/26-010", "/app/jobs/26-010/changes",
    "/app/assistant", "/changelog", "/status", "/roadmap",
  ]);
  assert.deepEqual(off[1], { pages: ["/roadmap"], widths: [375, 1440] });
  assert.equal(expectedNavLoads(off), 216, "no schedule jobs leaves the 216-load plan");
  const plan = navCrawlPlan(jobs, active);
  const schedulePages = active.map((j) => `/app/jobs/${j}/schedule`);
  assert.deepEqual(plan[0].pages, [
    "/app",
    "/app/jobs/24-118", "/app/jobs/24-118/changes",
    "/app/jobs/25-031", "/app/jobs/25-031/changes",
    "/app/jobs/24-077", "/app/jobs/24-077/changes",
    "/app/jobs/26-010", "/app/jobs/26-010/changes",
    ...schedulePages,
    "/app/assistant", "/changelog", "/status", "/roadmap",
  ]);
  assert.deepEqual(plan[0].pages.filter((p) => SCHEDULE_PATH.test(p)), schedulePages);
  assert.deepEqual(plan[1].pages, ["/roadmap", ...schedulePages]);
  assert.ok(!plan[0].pages.some((p) => p.includes("26-010/schedule")), "Harbor is not a schedule page");
  assert.deepEqual(plan[0].widths, [320, 390, 768, 1280]);
  assert.deepEqual(plan[1].widths, [375, 1440]);
  assert.deepEqual(scheduleWidths(), [320, 390, 768, 1280, 375, 1440]);
  // 4 roles × (16 pages × 4 widths + 4 pages × 2 extra widths) = 288.
  // 16 = /app + 4 job pages + 4 /changes + 3 active /schedule + assistant + changelog + status + /roadmap.
  // The extra pass is /roadmap plus those same 3 /schedule pages. Without /schedule the count stays 216.
  assert.equal(expectedNavLoads(plan), 288);
  const withoutChanges = plan.map((pass) => ({ ...pass, pages: pass.pages.filter((p) => !p.endsWith("/changes")) }));
  assert.equal(expectedNavLoads(withoutChanges), 224, "dropping /changes from the schedule plan is the 224-load count");
  const verifySrc = readFileSync(path.join(here, "verify.mjs"), "utf8");
  assert.match(verifySrc, /scheduleRouteAtCommit\(expectedFull/);
  assert.match(verifySrc, /scheduleGate\.present \? seedTargets\.active : \[\]/);
  assert.doesNotMatch(verifySrc, /5\.1\.0/, "the crawl gate is not a version string");
  const gateSrc = scheduleRouteAtCommit.toString();
  assert.match(gateSrc, /cat-file/);
  assert.match(gateSrc, /ls-tree/);
  assert.match(gateSrc, /:\(literal\)/);
  assert.match(gateSrc, /SCHEDULE_ROUTE_FILE/);
  assert.doesNotMatch(gateSrc, /exists on disk, but not in/, "an unreadable tree is not treated as absent");
  assert.doesNotMatch(gateSrc, /5\.1\.0/);
  assert.equal(SCHEDULE_ROUTE_FILE, "v5/src/app/app/jobs/[number]/schedule/page.tsx");
  assert.deepEqual(SCHEDULE_ROLE_ACCESS, { executive: true, pm: true, superintendent: true, foreman: true });
  const repo = path.resolve(here, "../../..");
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const gitAt = (cwd) => (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.deepEqual(scheduleRouteAtCommit(head, gitAt(repo)), { present: false, error: null }, "this commit has no schedule route");
  const fix = specFixture(false);
  try {
    const absentOnDisk = scheduleRouteAtCommit(fix.sha, gitAt(fix.dir));
    assert.deepEqual(absentOnDisk, { present: false, error: null });
    const page = path.join(fix.dir, "v5/src/app/app/jobs/[number]/schedule/page.tsx");
    mkdirSync(path.dirname(page), { recursive: true });
    writeFileSync(page, "export default function Page(){return null}\n");
    const onDiskOnly = scheduleRouteAtCommit(fix.sha, gitAt(fix.dir));
    assert.deepEqual(onDiskOnly, { present: false, error: null }, "a file only in the worktree is not in the commit");
    execFileSync("git", ["add", "."], { cwd: fix.dir });
    execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "schedule route"], { cwd: fix.dir });
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: fix.dir, encoding: "utf8" }).trim();
    assert.deepEqual(scheduleRouteAtCommit(sha, gitAt(fix.dir)), { present: true, error: null });
    const bad = scheduleRouteAtCommit("f".repeat(40), gitAt(fix.dir));
    assert.equal(bad.present, false);
    assert.match(bad.error ?? "", /^fatal:/, `an unreadable commit fails closed; got ${JSON.stringify(bad)}`);
    const srcTree = execFileSync("git", ["rev-parse", `${sha}:v5/src`], { cwd: fix.dir, encoding: "utf8" }).trim();
    const rootTree = execFileSync("git", ["rev-parse", `${sha}^{tree}`], { cwd: fix.dir, encoding: "utf8" }).trim();
    const broken = [];
    try {
      for (const [label, oid, re] of [
        ["b8 missing v5/src tree object", srcTree, /Could not read/],
        ["b7 missing root tree object", rootTree, /not a tree object/],
      ]) {
        const dir = mkdtempSync(path.join(os.tmpdir(), "verify-v5-tree-"));
        broken.push(dir);
        cpSync(fix.dir, dir, { recursive: true });
        const objectFile = path.join(dir, ".git", "objects", oid.slice(0, 2), oid.slice(2));
        assert.equal(existsSync(objectFile), true, `${label}: loose object ${oid} must be deleted, not a packed no-op`);
        rmSync(objectFile);
        const gate = scheduleRouteAtCommit(sha, gitAt(dir));
        assert.equal(gate.present, false, label);
        assert.match(gate.error ?? "", re, `${label} must fail closed; got ${JSON.stringify(gate)}`);
        mustFail(label, [gate.error]);
      }
    } finally {
      for (const dir of broken) rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    rmSync(fix.dir, { recursive: true, force: true });
  }
  results.push("schedule gate: route file at the verified commit; absent on this HEAD; present only once committed; bad sha, missing v5/src tree, and missing root tree fail closed");

  const sched = {
    ...good,
    path: "/app/jobs/25-031/schedule",
    final: "/app/jobs/25-031/schedule",
    seededCounts: { costRows: 0, activityRows: 5 },
    text: "A Mobilize. B. C Pier columns. D. E.",
  };
  mustPass("schedule page with activities and no cost rows", evaluateCrawlRow(sched));
  mustPass("schedule page at exactly 1500 ms", evaluateCrawlRow({ ...sched, idleMs: 1500 }));
  mustFail("schedule page with no activities", evaluateCrawlRow({ ...sched, seededCounts: { costRows: 12, activityRows: 0 } }));
  mustFail("schedule page 1501 ms", evaluateCrawlRow({ ...sched, idleMs: 1501 }));
  mustFail("schedule page 'coming soon'", evaluateCrawlRow({ ...sched, text: "Coming soon" }));
  mustFail("schedule page HTTP 500", evaluateCrawlRow({ ...sched, status: 500 }));
  mustFail("schedule page horizontal overflow", evaluateCrawlRow({ ...sched, overflowPx: 1 }));
  mustFail("schedule page ERP", evaluateCrawlRow({ ...sched, text: "Export to ERP" }));
  mustFail("schedule page error boundary", evaluateCrawlRow({ ...sched, text: "Application error: a client-side exception has occurred" }));
  mustFail("job page still needs cost rows", evaluateCrawlRow({ ...good, seededCounts: { costRows: 0, activityRows: 5 } }));
  const clipped = { ...sched, width: 320, clips: [{ kind: "money", text: "$1,234.56", ellipsis: true, reachable: false }], clipCount: 1 };
  mustPass("schedule clip ignored when phone checks are off", evaluateCrawlRow(clipped));
  mustFail("schedule clip fails when phone checks are on", evaluateCrawlRow(clipped, { phoneChecks: true }));

  const jobRow = (job, links, role = "pm", width = 390) => ({
    role, width, path: `/app/jobs/${job}`, scheduleLinks: links,
  });
  const linked = CRAWL_ROLES.flatMap((role) => CRAWL_WIDTHS.map((width) => jobRow("25-031", [schedulePath("25-031")], role, width)));
  const harbor = CRAWL_ROLES.flatMap((role) => CRAWL_WIDTHS.map((width) => jobRow("26-010", [], role, width)));
  mustPass("schedule link on each active job, none on Harbor", scheduleNavFailures([...linked, ...harbor], { scheduleJobs: active }));
  mustFail("schedule link missing at one width", scheduleNavFailures(linked.map((r) => (r.role === "pm" && r.width === 320 ? { ...r, scheduleLinks: [] } : r)), { scheduleJobs: ["25-031"] }));
  mustFail("schedule link on a job with no schedule", scheduleNavFailures([jobRow("26-010", [schedulePath("26-010")])], { scheduleJobs: active }));
  const foremanOff = { ...SCHEDULE_ROLE_ACCESS, foreman: false };
  mustFail("excluded role sees the schedule link", scheduleNavFailures([jobRow("25-031", [schedulePath("25-031")], "foreman", 320)], { scheduleJobs: active, access: foremanOff }));
  mustPass("excluded role with no schedule link", scheduleNavFailures([jobRow("25-031", [], "foreman", 320)], { scheduleJobs: active, access: foremanOff }));

  const load = (role, width, job) => ({ role, width, path: schedulePath(job) });
  const covered = CRAWL_ROLES.flatMap((role) => scheduleWidths().flatMap((width) => active.map((job) => load(role, width, job))));
  mustPass("schedule crawled for 4 roles × 6 widths × active jobs", scheduleCoverageFailures(covered, active));
  mustFail("schedule missing for an allowed role at one width", scheduleCoverageFailures(covered.filter((r) => !(r.role === "foreman" && r.width === 768 && r.path.endsWith("/25-031/schedule"))), active));
  for (const width of scheduleWidths()) {
    const failures = scheduleCoverageFailures(covered.filter((r) => r.width !== width), active);
    mustFail(`schedule missing at width ${width}`, failures);
    assert.ok(failures.some((m) => m.includes(`@${width} `)), `dropping width ${width} must name that width: ${failures[0] ?? "(none)"}`);
  }
  for (const role of CRAWL_ROLES) {
    const failures = scheduleCoverageFailures(covered.filter((r) => r.role !== role), active);
    mustFail(`schedule missing for role ${role}`, failures);
    assert.ok(failures.some((m) => m.startsWith(`${role}@`)), `dropping role ${role} must name that role: ${failures[0] ?? "(none)"}`);
  }
  mustPass("excluded role is not required to have a 200 schedule load", scheduleCoverageFailures(covered.filter((r) => r.role !== "foreman"), active, { access: foremanOff }));

  const denial = { role: "pm", width: 390, path: schedulePath("26-010"), status: 404, seededCounts: { activityRows: 0 } };
  mustPass("direct schedule URL 404 is a denial", scheduleDenialFailures(denial));
  mustPass("direct schedule URL 403 is a denial", scheduleDenialFailures({ ...denial, status: 403 }));
  mustFail("direct schedule URL 500 is not a denial", scheduleDenialFailures({ ...denial, status: 500 }));
  mustFail("direct schedule URL 200 showed the schedule", scheduleDenialFailures({ ...denial, status: 200 }));
  mustFail("direct schedule URL 404 that still lists activities", scheduleDenialFailures({ ...denial, seededCounts: { activityRows: 1 } }));
  assert.match(scheduleNavFailures([jobRow("25-031", [], "pm", 768)], { scheduleJobs: ["25-031"] })[0], /pm@768 \/app\/jobs\/25-031: schedule link missing/);
  assert.match(scheduleCoverageFailures(covered.filter((r) => !(r.role === "foreman" && r.width === 768 && r.path.endsWith("/25-031/schedule"))), active)[0], /foreman@768 \/app\/jobs\/25-031\/schedule: schedule missing/);
  assert.match(scheduleDenialFailures({ ...denial, status: 500 })[0], /HTTP 500 is not a denial/);
  assert.match(evaluateCrawlRow({ ...sched, idleMs: 1501 })[0], /1501 ms > 1500 ms budget/);
  assert.match(evaluateCrawlRow({ ...sched, text: "coming soon" })[0], /banned "coming soon"/);
}

// ---- #706 cost-item drill-downs in the nav crawl ----
{
  /** Must fail, and for the named reason (not just "something failed"). */
  // Soft: every drill must-fail is checked and all that went green are reported together (asserted at the end of this block).
  const wentGreen = [];
  const mustFailWith = (name, failures, re) => {
    const hit = failures.find((x) => re.test(x));
    if (hit) results.push(`FAILS as expected: ${name} → ${hit}`);
    else wentGreen.push(`MUST-FAIL WENT GREEN: ${name} (want ${re}; got ${JSON.stringify(failures.slice(0, 3))})`);
  };
  // Seed derivation: seed() leaves, Harbor-style CSV import replaces a job's leaves, a CO's new code is a leaf only once approved.
  const seedRows = {
    jobs: [{ id: "j1", number: "24-118" }, { id: "j2", number: "25-031" }, { id: "j3", number: "26-010" }],
    costItems: [
      { jobId: "j1", code: "02", isLeaf: false }, { jobId: "j1", code: "02-100", isLeaf: true }, { jobId: "j1", code: "03-200" },
      { jobId: "j2", code: "04-210", isLeaf: true },
      { jobId: "j3", code: "02-100", isLeaf: true }, { jobId: "j3", code: "09-999", isLeaf: true },
    ],
  };
  const runs = [
    { action: "estimate.importCsv", input: { job: "26-010", csv: "code,parent_code,description\n02,,Earthwork\n02-100,02,Excavation\n02-200,02,Backfill\n" } },
    { action: "changeOrder.price", input: { job: "25-031", changeOrder: "CO-001", coLines: [{ code: "91-100" }] } },
    { action: "changeOrder.price", input: { job: "24-118", changeOrder: "CO-003", coLines: [{ code: "91-300" }] } },
    { action: "changeOrder.approve", input: { job: "24-118", changeOrder: "CO-003" } },
  ];
  assert.deepEqual(csvLeafCodes("code,parent_code\n02,\n02-100,02\n03-100,\n"), ["02-100", "03-100"]);
  const items = seedDrillItems(seedRows, runs);
  assert.deepEqual(items, { "24-118": ["02-100", "03-200", "91-300"], "25-031": ["04-210"], "26-010": ["02-100", "02-200"] });
  results.push("seed drill items: parents skipped, isLeaf default true, CSV import replaces, only the approved CO's code is a leaf");
  assert.equal(drillPath("24-118", "02 100/x"), "/app/jobs/24-118/cost-items/02%20100%2Fx");

  // Load plan: every role loads every item exactly once; each item is loaded at every width across the 4 roles.
  const big = { A: Array.from({ length: 13 }, (_, i) => `01-${100 + i}`), B: ["02-100", "02-200", "02-300"] };
  const plan = drillLoadPlan(big, { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS });
  assert.equal(plan.size, CRAWL_ROLES.length * CRAWL_WIDTHS.length);
  for (const role of CRAWL_ROLES) {
    const loaded = CRAWL_WIDTHS.flatMap((w) => plan.get(`${role}@${w}`).map((x) => x.path)).sort();
    assert.deepEqual(loaded, drillItemList(big).map((x) => x.path).sort(), `${role} loads every item once`);
    for (const w of CRAWL_WIDTHS) assert.ok(plan.get(`${role}@${w}`).length >= 4, `${role}@${w} gets a share`);
  }
  for (const it of drillItemList(big)) {
    const widths = CRAWL_WIDTHS.filter((w) => CRAWL_ROLES.some((r) => plan.get(`${r}@${w}`).some((x) => x.path === it.path)));
    assert.deepEqual(widths, CRAWL_WIDTHS, `${it.path} loaded at every width across roles`);
  }
  assert.equal(expectedDrillLoads(big, CRAWL_ROLES), 64);
  results.push("drill load plan: 4 roles × 16 items → 64 loads, each role all items once, each item at all 4 widths");

  // Discovery: exact set per role × width × seeded job page.
  const rec = (role, width, job, hrefs = big[job].map((c) => drillPath(job, c))) => ({ role, width, job, hrefs });
  const allRecs = CRAWL_ROLES.flatMap((r) => CRAWL_WIDTHS.flatMap((w) => Object.keys(big).map((j) => rec(r, w, j))));
  const opts = { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS };
  mustPass("drill discovery finds every seeded item for 4 roles × 4 widths", drillDiscoveryFailures(allRecs, big, opts));
  const short = allRecs.map((r) => (r.role === "foreman" && r.width === 320 && r.job === "A" ? { ...r, hrefs: r.hrefs.slice(0, 10) } : r));
  mustFailWith("drill discovery finds fewer items than seeded (10 of 13)", drillDiscoveryFailures(short, big, opts), /foreman@320 \/app\/jobs\/A: found 10 of 13 seeded cost-item drill-downs; missing 01-110, 01-111, 01-112/);
  mustFailWith("drill discovery finds nothing on a job page", drillDiscoveryFailures(allRecs.map((r) => (r.job === "B" ? { ...r, hrefs: [] } : r)), big, opts), /found 0 of 3/);
  mustFailWith("drill discovery skipped for one role×width×job", drillDiscoveryFailures(allRecs.filter((r) => !(r.role === "pm" && r.width === 768 && r.job === "B")), big, opts), /pm@768 \/app\/jobs\/B: drill-down discovery did not run/);
  mustFailWith("drill discovery finds an unseeded item", drillDiscoveryFailures(allRecs.map((r, i) => (i === 0 ? { ...r, hrefs: [...r.hrefs, drillPath("A", "99-999")] } : r)), big, opts), /unexpected \/app\/jobs\/A\/cost-items\/99-999/);
  const noExec = { ...Object.fromEntries(CRAWL_ROLES.map((r) => [r, true])), executive: false };
  mustFailWith("role without drill-down access still sees links", drillDiscoveryFailures(allRecs, big, { ...opts, access: noExec }), /executive@320 .*role without drill-down access sees 13 cost-item links/);
  mustPass("role without drill-down access sees none", drillDiscoveryFailures(allRecs.map((r) => (r.role === "executive" ? { ...r, hrefs: [] } : r)), big, { ...opts, access: noExec }));

  // Coverage: every seeded item loaded per role, each drill row passes the per-load checks.
  const drow = (role, width, it, extra = {}) => ({ ...good, role, width, path: it.path, final: it.path, seededCounts: { costItemTiles: 1 }, drill: true, ...extra });
  const rows = [...plan].flatMap(([k, its]) => its.map((it) => drow(k.split("@")[0], Number(k.split("@")[1]), it)));
  mustPass("every seeded drill-down loaded by every role and clean", drillCoverageFailures(rows, big, { roles: CRAWL_ROLES }));
  const target = drillPath("A", "01-105");
  const hit = (fn) => rows.map((r) => (r.role === "pm" && r.path === target ? fn(r) : r));
  mustFailWith("drill-down returns HTTP 500", drillCoverageFailures(hit((r) => ({ ...r, status: 500 })), big, { roles: CRAWL_ROLES }), /pm@\d+ \/app\/jobs\/A\/cost-items\/01-105: navigation HTTP 500/);
  mustFailWith("drill-down over 1.5 s (1501 ms)", drillCoverageFailures(hit((r) => ({ ...r, idleMs: 1501 })), big, { roles: CRAWL_ROLES }), /01-105: 1501 ms > 1500 ms budget/);
  // Right at the budget boundary: 1499 and 1500 pass, 1501 fails (above), so any loosening is caught.
  mustPass("drill-down at 1499 ms (just under budget)", drillCoverageFailures(hit((r) => ({ ...r, idleMs: 1499 })), big, { roles: CRAWL_ROLES }));
  mustPass("drill-down at 1500 ms (exactly the budget)", drillCoverageFailures(hit((r) => ({ ...r, idleMs: 1500 })), big, { roles: CRAWL_ROLES }));
  mustFailWith("drill-down shows banned ERP", drillCoverageFailures(hit((r) => ({ ...r, text: "Cost item · ERP export" })), big, { roles: CRAWL_ROLES }), /01-105: banned "ERP" \(ERP\)/);
  mustFailWith("drill-down sub-request 500", drillCoverageFailures(hit((r) => ({ ...r, responses4xx5xx: [{ url: "/api/x", status: 500 }] })), big, { roles: CRAWL_ROLES }), /01-105: HTTP 500 \/api\/x/);
  mustFailWith("drill-down error boundary", drillCoverageFailures(hit((r) => ({ ...r, text: "Something went wrong" })), big, { roles: CRAWL_ROLES }), /01-105: error boundary/);
  mustFailWith("drill-down overflow", drillCoverageFailures(hit((r) => ({ ...r, overflowPx: 3 })), big, { roles: CRAWL_ROLES }), /01-105: horizontal overflow 3px/);
  mustFailWith("drill-down with no cost-item tile", drillCoverageFailures(hit((r) => ({ ...r, seededCounts: { costItemTiles: 0 } })), big, { roles: CRAWL_ROLES }), /01-105: cost item page has no budget tile/);
  mustFailWith("seeded drill-down never loaded by one role", drillCoverageFailures(rows.filter((r) => !(r.role === "superintendent" && r.path === target)), big, { roles: CRAWL_ROLES }), /superintendent \/app\/jobs\/A\/cost-items\/01-105: seeded cost item never loaded/);
  // A Part C cost-item load of the same path (no `drill: true`) must not count as that role's drill-down load.
  const partCOnly = rows.flatMap((r) => (r.role === "superintendent" && r.path === target ? [{ ...r, drill: undefined, partC: "cost-item", job: "A" }] : [r]));
  mustFailWith("drill-down covered only by a Part C cost-item load", drillCoverageFailures(partCOnly, big, { roles: CRAWL_ROLES }), /superintendent \/app\/jobs\/A\/cost-items\/01-105: seeded cost item never loaded/);
  mustFailWith("drill-down covered only by an unflagged row", drillCoverageFailures(rows.map((r) => (r.role === "pm" && r.path === target ? { ...r, drill: false } : r)), big, { roles: CRAWL_ROLES }), /pm \/app\/jobs\/A\/cost-items\/01-105: seeded cost item never loaded/);
  mustFailWith("role without access shown the cost item", drillCoverageFailures(rows, big, { roles: CRAWL_ROLES, access: noExec }), /executive@\d+ .*role without drill-down access was shown the cost item/);
  mustPass("role without access refused (404) on every item", drillCoverageFailures(rows.map((r) => (r.role === "executive" ? { ...r, status: 404, seededCounts: { costItemTiles: 0 } } : r)), big, { roles: CRAWL_ROLES, access: noExec }));
  // The job-page cost-rows rule still applies to job pages (and anything under /app/jobs/ that is not a cost item).
  mustFailWith("job page still needs cost rows", [evaluateCrawlRow({ ...good, seededCounts: { costRows: 0, costItemTiles: 1 } })].flat(), /job has no cost rows/);
  const changesRow = { ...good, path: "/app/jobs/25-031/changes", final: "/app/jobs/25-031/changes", text: "Luis Ortega changed the pour", seededCounts: { costRows: 0, changeItems: 3 } };
  mustPass("job changes page with items does not need cost rows", evaluateCrawlRow(changesRow));
  mustPass("job changes page at 1500 ms", evaluateCrawlRow({ ...changesRow, idleMs: 1500 }));
  mustFailWith("job changes page with 0 items", evaluateCrawlRow({ ...changesRow, seededCounts: { costRows: 12, changeItems: 0 } }), /changes page has 0 items/);
  mustFailWith("job changes page 1501 ms", evaluateCrawlRow({ ...changesRow, idleMs: 1501 }), /1501 ms > 1500 ms budget/);
  mustFailWith("job changes page TODO", evaluateCrawlRow({ ...changesRow, text: "TODO wire the list" }), /banned "TODO"/);
  mustFailWith("job changes page HTTP 500", evaluateCrawlRow({ ...changesRow, status: 500 }), /navigation HTTP 500/);
  assert.equal(drillItemCount(big), 16);
  for (const l of wentGreen) console.log(l);
  assert.deepEqual(wentGreen, [], `${wentGreen.length} drill-down must-fail case(s) passed`);
}

// ---- 5.0.2 Part C crawl check 4: one cost item page + one plan page per active job, 4 roles × 4 viewports ----
{
  const wentGreen = [];
  const mustFailWith = (name, failures, re) => {
    const hit = failures.find((x) => re.test(x));
    if (hit) results.push(`FAILS as expected: ${name} → ${hit}`);
    else wentGreen.push(`MUST-FAIL WENT GREEN: ${name} (want ${re}; got ${JSON.stringify(failures.slice(0, 3))})`);
  };
  const active = ["24-077", "24-118", "25-031"];
  const planLinked = { "24-077": ["03-210", "07-120"], "24-118": ["03-200"], "25-031": ["04-210", "04-310", "07-410"] };
  // Rotation: 25-031's 3 plan-linked items are all opened across role × width.
  const picks = new Set(CRAWL_ROLES.flatMap((_, ri) => CRAWL_WIDTHS.map((__, wi) => partCItemFor(planLinked, "25-031", ri, wi, 4))));
  assert.deepEqual([...picks].sort(), ["04-210", "04-310", "07-410"]);
  assert.equal(partCItemFor({}, "24-118", 0, 0, 4), null);
  const disc = CRAWL_ROLES.flatMap((role) => CRAWL_WIDTHS.flatMap((width) => [...active, "26-010"].map((job) => ({ role, width, job, estimateStatus: job === "26-010" ? "draft" : "approved" }))));
  const recs = [];
  const rows = [];
  for (const role of CRAWL_ROLES) {
    for (const width of CRAWL_WIDTHS) {
      for (const job of active) {
        const costItemPath = drillPath(job, planLinked[job][0]);
        const planPath = `/app/jobs/${job}/plans/0000000${job.replace("-", "")}`;
        recs.push({ role, width, job, costItemPath, planPath, why: {} });
        rows.push({ ...good, role, width, path: costItemPath, final: costItemPath, partC: "cost-item", seededCounts: { costItemTiles: 1 } });
        rows.push({ ...good, role, width, path: planPath, final: planPath, partC: "plan", seededCounts: { planStatus: 1 } });
      }
    }
  }
  const o = { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS };
  mustPass("Part C check 4: 3 active jobs × 4 roles × 4 viewports, cost item + plan page each", partCFailures(rows, recs, disc, active, o));
  const isPlan = (r, role, job) => r.partC === "plan" && r.role === role && r.width === 768 && r.path.includes(job);
  mustFailWith("Part C check 4: missing plan page", partCFailures(rows.filter((r) => !isPlan(r, "foreman", "24-118")), recs, disc, active, o), /^Part C crawl check 4: foreman@768 24-118 has no reachable plan page/);
  mustFailWith(
    "Part C check 4: plan page unreachable (no link)",
    partCFailures(rows, recs.map((r) => (r.role === "pm" && r.job === "24-077" ? { ...r, planPath: null, why: { plan: "no plan link on the cost item's labor rows or the job page" } } : r)), disc, active, o),
    /pm@\d+ 24-077 has no reachable plan page \(no plan link/,
  );
  mustFailWith("Part C check 4: slow plan page (1501 ms)", partCFailures(rows.map((r) => (isPlan(r, "executive", "25-031") ? { ...r, idleMs: 1501 } : r)), recs, disc, active, o), /^Part C crawl check 4: executive@768 \/app\/jobs\/25-031\/plans\/\S+: 1501 ms > 1500 ms budget/);
  mustFailWith("Part C check 4: plan page HTTP 500", partCFailures(rows.map((r) => (isPlan(r, "superintendent", "24-118") ? { ...r, status: 500 } : r)), recs, disc, active, o), /^Part C crawl check 4: superintendent@768 \/app\/jobs\/24-118\/plans\/\S+: navigation HTTP 500/);
  mustPass("Part C check 4: plan page at 1499 ms", partCFailures(rows.map((r) => (isPlan(r, "executive", "25-031") ? { ...r, idleMs: 1499 } : r)), recs, disc, active, o));
  mustPass("Part C check 4: plan page at 1500 ms", partCFailures(rows.map((r) => (isPlan(r, "executive", "25-031") ? { ...r, idleMs: 1500 } : r)), recs, disc, active, o));
  const isCost = (r) => r.partC === "cost-item" && r.role === "pm" && r.width === 390 && r.path.includes("24-118");
  mustFailWith("Part C check 4: cost item page at 1501 ms", partCFailures(rows.map((r) => (isCost(r) ? { ...r, idleMs: 1501 } : r)), recs, disc, active, o), /pm@390 \/app\/jobs\/24-118\/cost-items\/03-200: 1501 ms > 1500 ms budget/);
  mustPass("Part C check 4: cost item page at 1499 ms", partCFailures(rows.map((r) => (isCost(r) ? { ...r, idleMs: 1499 } : r)), recs, disc, active, o));
  mustFailWith("Part C check 4: plan page HTTP 404", partCFailures(rows.map((r) => (isPlan(r, "pm", "24-077") ? { ...r, status: 404 } : r)), recs, disc, active, o), /pm@768 \/app\/jobs\/24-077\/plans\/\S+: navigation HTTP 404/);
  mustFailWith("Part C check 4: banned string on plan page", partCFailures(rows.map((r) => (isPlan(r, "pm", "24-077") ? { ...r, text: "Daily plan · TBD" } : r)), recs, disc, active, o), /plans\/\S+: banned "TBD"/);
  mustFailWith("Part C check 4: plan page without its status", partCFailures(rows.map((r) => (isPlan(r, "pm", "24-077") ? { ...r, seededCounts: {} } : r)), recs, disc, active, o), /plan page has no plan status/);
  mustFailWith("Part C check 4: missing cost item page", partCFailures(rows.filter((r) => !(r.partC === "cost-item" && r.role === "superintendent" && r.width === 320 && r.path.includes("25-031"))), recs, disc, active, o), /superintendent@320 25-031 has no reachable cost item page/);
  mustFailWith("Part C check 4: slow cost item page", partCFailures(rows.map((r) => (r.partC === "cost-item" && r.role === "pm" && r.width === 390 && r.path.includes("24-118") ? { ...r, idleMs: 1600 } : r)), recs, disc, active, o), /pm@390 \/app\/jobs\/24-118\/cost-items\/03-200: 1600 ms > 1500 ms budget/);
  mustFailWith("Part C check 4: active-job set differs from the seed (job page shows 26-010 approved)", partCFailures(rows, recs, disc.map((d) => (d.job === "26-010" && d.role === "pm" && d.width === 1280 ? { ...d, estimateStatus: "approved" } : d)), active, o), /pm@1280 active jobs on the job pages \[24-077, 24-118, 25-031, 26-010\] ≠ seed \[24-077, 24-118, 25-031\]/);
  mustFailWith("Part C check 4: active-job set differs from the seed (24-077 not approved)", partCFailures(rows, recs, disc.map((d) => (d.job === "24-077" && d.role === "foreman" && d.width === 320 ? { ...d, estimateStatus: "draft" } : d)), active, o), /foreman@320 active jobs .* ≠ seed/);
  mustFailWith("Part C check 4: seed active job never crawled", partCFailures(rows, recs, disc, [...active, "26-099"], o), /26-099 has no reachable cost item page/);
  for (const l of wentGreen) console.log(l);
  assert.deepEqual(wentGreen, [], `${wentGreen.length} Part C check 4 must-fail case(s) passed`);
}

// ---- seed subprocess env: allowlist only, never VERIFY_TOKEN or other secrets ----
{
  const canary = "canary-not-a-real-secret";
  const parent = { PATH: "/usr/bin", HOME: "/home/x", TZ: "UTC", VERIFY_TOKEN: canary, DATABASE_URL: canary, GH_TOKEN: canary, GITHUB_TOKEN: canary, NODE_OPTIONS: "--require /tmp/evil.cjs", V5_SEED_STRESS: "1", AWS_SECRET_ACCESS_KEY: canary };
  const env = seedChildEnv(parent);
  assert.deepEqual(env, { PATH: "/usr/bin", HOME: "/home/x", TZ: "UTC" }, `seed child env must be the allowlisted keys only; got keys ${Object.keys(env)}`);
  assert.ok(!("VERIFY_TOKEN" in env), "seed child env must not carry VERIFY_TOKEN");
  assert.ok(!Object.values(env).includes(canary), "no secret value may reach the seed child env");
  for (const k of ["VERIFY_TOKEN", "DATABASE_URL", "GH_TOKEN", "GITHUB_TOKEN", "NODE_OPTIONS", "V5_SEED_STRESS"]) assert.ok(!SEED_CHILD_ENV_ALLOW.includes(k), `${k} must never be allowlisted`);
  assert.deepEqual(leakedSeedEnvKeys(["PATH", "HOME", "TZ", "TSX_ADDED"], parent), [], "allowlisted keys and child-added keys are not leaks");
  assert.deepEqual(leakedSeedEnvKeys(["PATH", "VERIFY_TOKEN", "DATABASE_URL"], parent), ["DATABASE_URL", "VERIFY_TOKEN"], "a child that sees VERIFY_TOKEN / DATABASE_URL must be reported");
  results.push("passes: seed subprocess env is allowlist-only (VERIFY_TOKEN, DATABASE_URL, GH_TOKEN, NODE_OPTIONS, V5_SEED_STRESS dropped); a leaked VERIFY_TOKEN is reported");
}

// ---- stress seed (V5_SEED_STRESS=1) ----
{
  const ok = { landedOn: "/app", http5xx: [], orphanPlans: 0, stressJobs: 1, stressCrews: 1, stressPlansOnStressCrew: 1 };
  mustPass("stress seed signs in, stress crew + plan, 0 orphans", evaluateStressSeed(ok));
  // The 0013 regression: stress crews not copied → createSandbox throws on daily_plans_crew_id_crews_id_fk.
  mustFail("stress seed sign-in threw (FK)", evaluateStressSeed({ ...ok, error: 'insert or update on table "daily_plans" violates foreign key constraint "daily_plans_crew_id_crews_id_fk"', landedOn: "/login", stressJobs: undefined, stressCrews: undefined, stressPlansOnStressCrew: undefined }));
  mustFail("stress seed sign-in 500", evaluateStressSeed({ ...ok, http5xx: ["HTTP 500 POST /login"] }));
  mustFail("stress seed stayed on /login", evaluateStressSeed({ ...ok, landedOn: "/login" }));
  mustFail("daily_plans.crew_id → missing crew", evaluateStressSeed({ ...ok, orphanPlans: 1 }));
  mustFail("orphan count unknown", evaluateStressSeed({ ...ok, orphanPlans: undefined }));
  mustFail("stress job not seeded", evaluateStressSeed({ ...ok, stressJobs: 0 }));
  mustFail("Stress Crew not seeded", evaluateStressSeed({ ...ok, stressCrews: 0 }));
  mustFail("stress plan not on Stress Crew", evaluateStressSeed({ ...ok, stressPlansOnStressCrew: 0 }));
}

// ---- SHA ----
const A = "94cebb602e675342141a2d0378164ad2399217af";
const B = "4f40243fd4addc85e953adc9a50d428bc9084649";
const known = { [A.slice(0, 12)]: A, [B.slice(0, 12)]: B };
const resolve = (p) => known[p] ?? null;
const sha = (shown, exp2, r = resolve) => (shaMatches(shown, exp2, r).ok ? [] : [shaMatches(shown, exp2, r).detail]);
mustPass("12-char prefix resolves to expected", sha(A.slice(0, 12), A));
mustPass("40-char exact", sha(A, A));
mustFail("12-char prefix of a different commit", sha(B.slice(0, 12), A));
mustFail("40-char mismatch", sha(B, A));
mustFail("12-char prefix that git resolves elsewhere", sha(A.slice(0, 12), A, () => B));
mustFail("ambiguous/unknown prefix", sha(A.slice(0, 12), A, () => null));
mustFail("expected is only 12 chars", sha(A.slice(0, 12), A.slice(0, 12)));
mustFail("empty shown", sha("", A));
mustFail("6-char prefix too short", sha(A.slice(0, 6), A));

// ---- red main / last green ----
const now = Date.parse("2026-10-25T03:00:00Z");
const c = (sha2, gate, hoursAgo) => ({ sha: sha2, gate, committedAt: new Date(now - hoursAgo * 3_600_000).toISOString() });
const sev = (r, s) => r.results.filter((x) => x.severity === s);
{
  const r = evaluateMain({ head: c(A, "success", 1), v5Commits: [c(A, "success", 1)], deployedFull: A, now });
  mustPass("staging = last green = HEAD", sev(r, "FAIL").map((x) => x.name));
  assert.equal(sev(r, "WARN").length, 0);
}
{
  const r = evaluateMain({ head: c(A, "success", 1), v5Commits: [c(A, "success", 1), c(B, "success", 5)], deployedFull: B, now });
  mustFail("staging behind last green", sev(r, "FAIL").map((x) => `${x.name}: ${x.detail}`));
}
{
  const r = evaluateMain({ head: c(A, "failure", 2), v5Commits: [c(A, "failure", 2), c(B, "success", 5)], deployedFull: B, now });
  const warns = sev(r, "WARN");
  assert.ok(warns.some((w) => w.name === `main HEAD red: ${A}, CI failing`), "red HEAD must be a labeled WARN");
  mustPass("red HEAD, staging = last green (WARN only)", sev(r, "FAIL").map((x) => x.name));
  results.push(`WARN visible: ${warns[0].name}`);
}
{
  const r = evaluateMain({ head: c(A, "failure", 30), v5Commits: [c(A, "failure", 30), c(B, "success", 40)], deployedFull: B, now });
  mustFail("last green superseded by red work for 30 h > 24 h", sev(r, "FAIL").map((x) => `${x.name}: ${x.detail}`));
  const r2 = evaluateMain({ head: c(A, "failure", 30), v5Commits: [c(A, "failure", 30), c(B, "success", 40)], deployedFull: B, now, maxAgeHours: 48 });
  mustPass("same with --max-green-age-hours 48", sev(r2, "FAIL").map((x) => x.name));
}
{
  const r = evaluateMain({ head: c(A, "success", 100), v5Commits: [c(A, "success", 100)], deployedFull: A, now });
  mustPass("quiet main, last green is newest (100 h old)", sev(r, "FAIL").map((x) => x.name));
}
{
  const r = evaluateMain({ head: c(A, "failure", 1), v5Commits: [c(A, "failure", 1), c(B, "failure", 2)], deployedFull: B, now });
  mustFail("no green v5 commit at all", sev(r, "FAIL").map((x) => x.name));
}
{
  const r = evaluateMain({ head: c(A, "success", 1), v5Commits: [c(A, "success", 1)], deployedFull: null, now });
  mustFail("deployed prefix unresolvable", sev(r, "FAIL").map((x) => x.name));
}

// ---- portfolio loads from Postgres: bounded wait + settle window, never loosen the count ----
// Fake locator on a virtual clock: `schedule` is [[atMs, count | Error], ...]; count() returns the
// latest entry at or before the current virtual time (an Error entry rejects). No real sleeping.
{
  const virtual = (schedule) => {
    let t = 0;
    const count = async () => {
      const v = schedule.filter(([at]) => at <= t).at(-1)?.[1] ?? 0;
      if (v instanceof Error) throw v;
      return v;
    };
    return { locator: { count }, clock: { now: () => t, sleep: async (ms) => { t += ms; } }, elapsed: () => t };
  };
  const GOOD = { sandbox: "1b7bffa3", cpi: "0.93−$3.1M", noDevFooter: true };
  // Explicit 10 s / 750 ms here; the defaults are locked separately below.
  const portfolio = async (schedule, expected = 4) => {
    const v = virtual(schedule);
    const w = await waitForRowCount(v.locator, expected, { timeoutMs: 10_000, settleMs: 750, ...v.clock });
    const ok = portfolioOk({ ...GOOD, rows: w.rows, settled: w.settled, expected });
    return { ...w, ok, failures: ok ? [] : [`${PORTFOLIO_STEP}: ${w.rows} jobs (seed expects ${expected}, settled ${w.settled})`] };
  };
  // Transient counts must fail (review of 3a651d68): passing through 4 is not settling at 4.
  const up = await portfolio([[0, 0], [500, 4], [800, 5]]);
  mustFail("portfolio: 0→4→5 (settles at 5)", up.failures);
  assert.deepEqual([up.rows, up.settled], [5, false]);
  const vanish = await portfolio([[0, 0], [500, 4], [600, 0]]);
  mustFail("portfolio: 0→4→0 (rows vanish)", vanish.failures);
  assert.deepEqual([vanish.rows, vanish.settled], [0, false]);
  // #701 flake: 0 rows right after Escape, all 4 a moment later. Passes once 4 holds for 750 ms.
  const late = await portfolio([[0, 0], [1500, 4]]);
  mustPass("portfolio: rows arrive 1.5 s late (the #701 race)", late.failures);
  assert.ok(late.rows === 4 && late.waitedMs >= 1500 + 750 && late.waitedMs < 1500 + 750 + 200, `settles 750 ms after rows land (waited ${late.waitedMs} ms)`);
  mustPass("portfolio: rows trickle in 0→1→3→4", (await portfolio([[0, 0], [300, 1], [800, 3], [2000, 4]])).failures);
  mustPass("portfolio: 0→4→5→4, then steady at 4", (await portfolio([[0, 0], [500, 4], [800, 5], [1200, 4]])).failures);
  const now = await portfolio([[0, 4]]);
  mustPass("portfolio: rows already there (settle only)", now.failures);
  assert.equal(now.waitedMs, 750);
  mustFail("portfolio: 4 flaps with 3 every 500 ms", (await portfolio(Array.from({ length: 30 }, (_, i) => [i * 500, i % 2 ? 3 : 4]))).failures);
  const edge = await portfolio([[0, 0], [9_500, 4]]);
  mustFail("portfolio: 4 lands 500 ms before the timeout (cannot settle in time)", edge.failures);
  assert.deepEqual([edge.rows, edge.settled], [4, false], "rows at the deadline are reported, but unsettled fails");
  // Real shortfalls still fail after the bounded wait.
  const none = await portfolio([[0, 0]]);
  mustFail("portfolio: 0 rows forever", none.failures);
  assert.ok(none.rows === 0 && none.waitedMs === 10_000, `0 rows waits exactly the bounded timeout then fails (waited ${none.waitedMs} ms)`);
  mustFail("portfolio: 3 of 4 rows forever", (await portfolio([[0, 3]])).failures);
  mustFail("portfolio: 3 rows, 4th after the timeout", (await portfolio([[0, 3], [10_500, 4]])).failures);
  mustFail("portfolio: 5 rows (more than the seed)", (await portfolio([[0, 5]])).failures);
  // The rest of the rule is unchanged: right count but no sandbox / bad CPI / dev footer / not settled fails.
  for (const [name, bad] of [["no sandbox", { sandbox: "" }], ["CPI missing", { cpi: undefined }], ["dev footer shown", { noDevFooter: false }], ["not settled", { settled: false }], ["settled missing", { settled: undefined }], ["5 rows claimed settled", { rows: 5 }], ["3 rows claimed settled", { rows: 3 }], ["0 rows claimed settled", { rows: 0 }], ["0 rows settled against expected 0", { rows: 0, expected: 0 }], ["0 rows settled, expected missing", { rows: 0, expected: undefined }]]) {
    const ok = portfolioOk({ ...GOOD, rows: 4, settled: true, expected: 4, ...bad });
    mustFail(`portfolio: rule rejects ${name}`, ok ? [] : [name]);
  }
  for (const bad of [0, -1, NaN, "4", undefined]) {
    await assert.rejects(waitForRowCount({ count: async () => 0 }, bad), /positive integer/, `expected ${String(bad)} must be refused`);
  }
  results.push("passes: waitForRowCount refuses expected 0, -1, NaN, \"4\", undefined");
  // A settle window <= 0 or a NaN timeout must be refused, not treated as "settled on the first poll" / "no deadline".
  for (const [name, opts] of [["settleMs 0", { settleMs: 0 }], ["settleMs -1", { settleMs: -1 }], ["settleMs NaN", { settleMs: NaN }], ["timeoutMs NaN", { timeoutMs: NaN }], ["timeoutMs 0", { timeoutMs: 0 }], ["timeoutMs -5", { timeoutMs: -5 }], ["timeoutMs Infinity", { timeoutMs: Infinity }], ["timeoutMs \"10000\"", { timeoutMs: "10000" }], ["intervalMs 0", { intervalMs: 0 }]]) {
    let polls = 0;
    await assert.rejects(waitForRowCount({ count: async () => (polls++, 4) }, 4, opts), /must be a finite number > 0/, `${name} must be refused`);
    assert.equal(polls, 0, `${name} must be refused before any count()`);
  }
  results.push("passes: waitForRowCount refuses settleMs 0/-1/NaN, timeoutMs NaN/0/-5/Infinity/\"10000\", intervalMs 0");

  // (b) Defaults locked: no timeoutMs/settleMs passed, only the virtual clock.
  assert.equal(PORTFOLIO_ROWS_TIMEOUT_MS, 10_000, "default overall timeout is 10 s");
  assert.equal(PORTFOLIO_SETTLE_MS, 750, "default settle window is 750 ms");
  {
    const v = virtual([[0, 0]]);
    const w = await waitForRowCount(v.locator, 4, v.clock);
    assert.deepEqual(w, { rows: 0, settled: false, waitedMs: 10_000 }, `default timeout must be 10 s; got ${JSON.stringify(w)}`);
    const s = virtual([[0, 4]]);
    const ws = await waitForRowCount(s.locator, 4, s.clock);
    assert.deepEqual(ws, { rows: 4, settled: true, waitedMs: 750 }, `default settle must be 750 ms; got ${JSON.stringify(ws)}`);
    const t = virtual([[0, 0], [500, 4], [800, 5]]);
    assert.equal((await waitForRowCount(t.locator, 4, t.clock)).settled, false, "defaults must reject 0→4→5");
    results.push("passes: defaults locked (10 s timeout → 0 rows at 10000 ms, 750 ms settle → 4 rows at 750 ms, 0→4→5 unsettled)");
  }

  // (a) A count() error during the wait propagates and is recorded as FAIL by runStep (verify.mjs's step()).
  const fakePage = (schedule) => {
    const v = virtual(schedule);
    const el = (text) => ({ click: async () => {}, textContent: async () => text, count: async () => 0 });
    const page = {
      keyboard: { press: async () => {} },
      getByText: () => el(""),
      getByTestId: (id) =>
        id === "portfolio-table"
          ? { getByTestId: () => ({ filter: () => v.locator }) }
          : el({ "sandbox-id": "1b7bffa3", "kpi-cpi": "0.93−$3.1M" }[id] ?? ""),
    };
    return { page, clock: v.clock };
  };
  const closed = new Error("Target page, context or browser has been closed");
  for (const [at, schedule] of [[0, [[0, closed], [50, 4]]], [400, [[0, 0], [400, closed]]]]) {
    // at 0: only the first count() rejects (later polls would show 4); at 400: a later poll rejects mid-wait.
    const { page, clock } = fakePage(schedule);
    await assert.rejects(waitForRowCount(page.getByTestId("portfolio-table").getByTestId("job-link").filter(), 4, clock), /has been closed/, `count() error at ${at} ms must reject waitForRowCount`);
    const recorded = [];
    const record = (name, ok, detail) => recorded.push({ name, ok: Boolean(ok), detail });
    await runStep(record, PORTFOLIO_STEP, async () => {
      const r = await runPortfolioStep(page, { expected: 4, seedJobNumbers: ["24-118"], ...clock });
      record(PORTFOLIO_STEP, r.ok, r.detail);
    });
    assert.deepEqual(recorded, [{ name: PORTFOLIO_STEP, ok: false, detail: "Target page, context or browser has been closed" }], `count error must be a FAIL; got ${JSON.stringify(recorded)}`);
    mustFail(`portfolio: count() rejects at ${at} ms → step FAIL`, recorded.filter((r) => !r.ok).map((r) => r.detail));
    // And the same step on a late-but-settled fake page passes (runPortfolioStep, not a hand-rolled count).
    const late2 = fakePage([[0, 0], [1500, 4]]);
    const r = await runPortfolioStep(late2.page, { expected: 4, seedJobNumbers: ["24-118"], ...late2.clock });
    mustPass("portfolio: runPortfolioStep on a late fake page", r.ok ? [] : [r.detail]);
  }

  // (c) verify.mjs wiring: its portfolio step must be the one runPortfolioStep call driven above and in
  // portfolio-mustfail.test.mjs, and its step() must be runStep. A hand-rolled count (the old
  // immediate `.count()`) or a bypassed wait in verify.mjs fails here.
  {
    const src = readFileSync(path.join(here, "verify.mjs"), "utf8");
    assert.match(src, /^const step = \(name, fn\) => runStep\(check, name, fn\);$/m, "verify.mjs step() must delegate to runStep");
    const start = src.indexOf("await step(PORTFOLIO_STEP,");
    assert.ok(start > 0, "verify.mjs must run the portfolio step as step(PORTFOLIO_STEP, …)");
    const body = src.slice(start, src.indexOf("\n  });", start));
    assert.match(body, /await runPortfolioStep\(page, \{ expected: expectedJobCount, seedJobNumbers, textTimeoutMs: T \}\)/, "portfolio step must call runPortfolioStep with the seed count and no timeout/settle override");
    assert.match(body, /check\(PORTFOLIO_STEP, r\.ok, r\.detail\)/, "portfolio step must record runPortfolioStep's verdict");
    for (const banned of [/\.count\(\)/, /job-link/, /waitForRowCount/, /timeoutMs|settleMs/]) {
      assert.doesNotMatch(body, banned, `verify.mjs portfolio step must not count rows itself or override the wait (${banned})`);
    }
    assert.equal((src.match(/"portfolio loads from Postgres"/g) ?? []).length, 0, "no second hand-written portfolio check in verify.mjs");
    results.push("passes: verify.mjs portfolio step = runStep + runPortfolioStep (no own count, no wait override)");
  }
}

// ---- production: expects the newest v5 release tag (semver), never last green main ----
{
  const H = (ch) => ch.repeat(40);
  const T500 = H("1"), T501 = H("2"), T509 = H("3"), T5010 = H("4"), T502 = H("5"), T510 = H("6"), MAIN = H("7"), GREEN = H("8"), NOTAG = H("9"), OLDGREEN = H("a");
  const tnow = Date.parse("2026-10-25T13:00:00Z");
  const cm = (s, gate, hoursAgo) => ({ sha: s, gate, committedAt: new Date(tnow - hoursAgo * 3_600_000).toISOString() });
  // main is ahead of the release: HEAD is a green #711-style commit; the tag commit is older and green.
  const mainCi = { head: cm(MAIN, "success", 1), v5Commits: [cm(MAIN, "success", 1), cm(T501, "success", 3)] };
  const fails = (rs) => rs.filter((r) => r.severity === "FAIL").map((r) => `${r.name}: ${r.detail}`);
  const rel = (newest, gate = "success", onMain = true) => ({ tags: [], newest, gate, onMain });
  const v501 = { name: "v5.0.1", sha: T501 };
  const prod = (deployedFull, release = rel(v501), extra = {}) => commitResults({ target: "production", mainCi, release, deployedFull, now: tnow, ...extra });
  const stage = (deployedFull, mc = mainCi) => commitResults({ target: "staging", mainCi: mc, deployedFull, now: tnow });

  // (1) Newest tag by semver, not by creation date or listing order; non-v5 and malformed ignored.
  const listed = [
    { name: "v5.1.0", sha: T510 }, // created before v5.0.2 and listed first
    { name: "v5.0.2", sha: T502 },
    { name: "v5.0.10", sha: T5010 },
    { name: "v5.0.9", sha: T509 },
  ];
  assert.deepEqual(newestV5Tag(listed), { name: "v5.1.0", sha: T510 });
  assert.deepEqual(newestV5Tag([...listed].reverse()), { name: "v5.1.0", sha: T510 }, "listing order must not matter");
  assert.deepEqual(newestV5Tag([{ name: "v5.0.9", sha: T509 }, { name: "v5.0.10", sha: T5010 }]), { name: "v5.0.10", sha: T5010 }, "v5.0.10 > v5.0.9 (numeric, not string)");
  assert.deepEqual(newestV5Tag([{ name: "v5.0.10", sha: T5010 }, { name: "v5.0.9", sha: T509 }]), { name: "v5.0.10", sha: T5010 });
  assert.deepEqual(newestV5Tag([{ name: "v5.0.2", sha: T502 }, { name: "v5.0.10", sha: T5010 }, { name: "v5.1.0", sha: T510 }, { name: "v5.0.9", sha: T509 }]), { name: "v5.1.0", sha: T510 }, "v5.1.0 > v5.0.10");
  results.push("passes: newest v5 tag by semver (v5.0.10 > v5.0.9 both orders; v5.1.0 created/listed before v5.0.2 still wins)");
  const junk = [
    { name: "v6.0.0", sha: H("b") }, { name: "v4.9.9", sha: H("b") }, { name: "v5", sha: H("b") }, { name: "v5.0", sha: H("b") },
    { name: "v5.0.99-rc1", sha: H("b") }, { name: "v5.01.0", sha: H("b") }, { name: "v5.0.07", sha: H("b") }, { name: "V5.0.98", sha: H("b") },
    { name: "v5.0.97.1", sha: H("b") }, { name: "v5.0.x", sha: H("b") }, { name: "release-5.0.96", sha: H("b") }, { name: " v5.0.95", sha: H("b") },
    { name: "v5.0.94", sha: "05246e2ef47d" }, { name: undefined, sha: H("b") }, null,
  ];
  assert.deepEqual(newestV5Tag([...junk, v501]), v501, "non-v5 and malformed tags (and a short sha) are ignored");
  assert.equal(newestV5Tag(junk), null, "only junk tags → no v5 tag");
  results.push(`passes: ${junk.length} non-v5/malformed tags ignored (v6.0.0, v4.9.9, v5.0, v5.0.99-rc1, v5.01.0, V5.0.98, …)`);
  assert.deepEqual(parseLsRemoteTags(`${H("c")}\trefs/tags/v5.0.1\n${T501}\trefs/tags/v5.0.1^{}\n${T500}\trefs/tags/v5.0.0\n`), [{ name: "v5.0.1", sha: T501 }, { name: "v5.0.0", sha: T500 }]);
  assert.deepEqual(parseLsRemoteTags(`${T501}\trefs/tags/v5.0.1^{}\n${H("c")}\trefs/tags/v5.0.1\n`), [{ name: "v5.0.1", sha: T501 }], "peeled commit wins in either order");
  results.push("passes: ls-remote tags peeled to their commit (annotated v5.0.1 → commit, not tag object)");

  // Pass cases.
  mustPass("prod on the newest tag (v5.0.1) while main is ahead", fails(prod(T501)));
  assert.ok(!prod(T501).some((r) => /staging serves/.test(r.name)), "production never runs the last-green-main comparison");
  mustPass("staging on last green main", fails(stage(MAIN)));

  // (3) and the other production must-fails.
  mustFail("prod serves an older tag's commit (v5.0.0)", fails(prod(T500)));
  mustFail("prod serves main HEAD instead of the tag", fails(prod(MAIN)));
  mustFail("prod serves a commit with no tag", fails(prod(NOTAG)));
  mustFail("prod deployed commit unresolvable", fails(prod(null)));
  mustFail("prod tag ci-gate red", fails(prod(T501, rel(v501, "failure"))));
  mustFail("prod tag ci-gate pending", fails(prod(T501, rel(v501, "pending"))));
  mustFail("prod tag ci-gate missing", fails(prod(T501, rel(v501, "missing"))));
  mustFail("prod tag not on main", fails(prod(T501, rel(v501, "success", false))));
  mustFail("prod tag ancestry unknown", fails(prod(T501, rel(v501, "success", null))));
  mustFail("prod release read failed", fails(commitResults({ target: "production", mainCi, release: null, releaseError: "git ls-remote: network down", deployedFull: T501, now: tnow })));
  mustFail("prod with main CI read failed", fails(commitResults({ target: "production", mainCi: null, mainCiError: "gh api: 502", release: rel(v501), deployedFull: T501, now: tnow })));
  {
    // Prod serving last green main while it has the right tag must still fail (no last-green fallback).
    const f = fails(prod(GREEN, rel(v501), { mainCi: { head: cm(GREEN, "success", 1), v5Commits: [cm(GREEN, "success", 1)] } }));
    mustFail("prod serves last green main, not the tag", f);
  }
  // (2) No v5 tag: FAIL outright with a clear message, and no fallback to last green main.
  {
    const r = prod(MAIN, rel(null, null, null));
    const f = fails(r);
    mustFail("prod with no v5 tag (serving last green main)", f);
    assert.ok(f.some((x) => /newest v5 release tag found: no v5\.MINOR\.PATCH tag on origin; production never falls back to last green main/.test(x)), `clear no-tag message; got ${JSON.stringify(f)}`);
    let fellBack = false;
    const exp = expectedCommitFor({ target: "production", release: rel(null), mainCi, fallback: () => ((fellBack = true), MAIN) });
    assert.equal(exp, "", "production with no tag expects nothing, so every commit check fails");
    assert.equal(fellBack, false, "production must never call the last-green/default fallback");
    assert.equal(shaMatches(MAIN, exp, () => MAIN).ok, false, "/health commit check fails when there is no tag");
    results.push("FAILS as expected: prod with no v5 tag → expected commit \"\" (no fallback), /health commit check fails");
  }
  assert.equal(expectedCommitFor({ target: "production", release: rel(v501), mainCi, fallback: () => MAIN }), T501, "production expects the tag commit");
  assert.equal(expectedCommitFor({ target: "staging", release: rel(v501), mainCi, fallback: () => NOTAG }), MAIN, "staging expects last green main");
  // Staging unchanged.
  mustFail("staging serves an older green commit", fails(stage(OLDGREEN, { head: cm(MAIN, "success", 1), v5Commits: [cm(MAIN, "success", 1), cm(OLDGREEN, "success", 5)] })));
  mustFail("staging serves the release tag while main is ahead", fails(stage(T501)));
  assert.ok(!stage(MAIN).some((r) => /release tag/.test(r.name)), "staging does not run release-tag checks");

  // Target selection: pcserp.app hosts are production; no skip path.
  const tgt = (u, f, m) => resolveTarget(u, f, m);
  assert.deepEqual(tgt("https://demo.pcserp.app"), { target: "production", error: null });
  assert.deepEqual(tgt("https://app.pcserp.app/"), { target: "production", error: null });
  assert.deepEqual(tgt("https://pcserp.app"), { target: "production", error: null });
  assert.deepEqual(tgt("https://DEMO.PCSERP.APP"), { target: "production", error: null });
  assert.deepEqual(tgt("https://pitbull-web-staging.up.railway.app"), { target: "staging", error: null });
  assert.deepEqual(tgt("http://localhost:3100"), { target: "staging", error: null });
  assert.deepEqual(tgt("https://pcserp.app.evil.example"), { target: "staging", error: null });
  assert.deepEqual(tgt("https://notpcserp.app"), { target: "staging", error: null });
  assert.deepEqual(tgt("https://pitbull-web-staging.up.railway.app", "production"), { target: "production", error: null });
  assert.match(tgt("https://demo.pcserp.app", "staging").error, /is production; --target staging cannot be used/);
  assert.match(tgt("https://demo.pcserp.app", "auto", "off").error, /--main-ci off is not allowed/);
  assert.match(tgt("https://x.up.railway.app", "production", "off").error, /--main-ci off is not allowed/);
  assert.match(tgt("https://demo.pcserp.app", "prod").error, /--target must be/);
  results.push("passes: target = production for pcserp.app (+ subdomains), staging otherwise; --target staging on prod and --main-ci off on prod are refused");

  // verify.mjs wiring tripwire: the run uses these functions, forces main CI on for production, and has
  // no hand-rolled last-green expectation or direct evaluateMain call that could bypass the release rule.
  {
    const src = readFileSync(path.join(here, "verify.mjs"), "utf8");
    assert.match(src, /const \{ target, error: targetError \} = resolveTarget\(baseUrl, args\.target, args\["main-ci"\]\);/);
    assert.match(src, /if \(targetError\) \{\n\s+console\.error\(targetError\);\n\s+process\.exit\(1\);/);
    assert.match(src, /const mainCiOn = production \|\| /, "production must force main CI on");
    assert.match(src, /release = await readRelease\(repo, newestV5Tag\);/);
    assert.match(src, /const expectedFull = \(rc\n\s+\? rc\.sha\n\s+: expectedCommitFor\(\{ target, pinned: args\.commit, release, mainCi, fallback: \(\) => resolveDefaultCommit\(repo\) \}\)\)/);
    assert.match(src, /const results = commitResults\(\{ target, mainCi, mainCiError, release, releaseError, deployedFull: deployedForMainRule\(rc\?\.sha, deployedFull\),/);
    assert.match(src, /evaluateRcHead\(\{ rcSha: rc\.sha, shown: status\.commit/);
    assert.match(src, /attributeChecks\(checks, merges\)/);
    assert.match(src, /"phone-checks": \{ type: "boolean", default: false \}/);
    assert.match(src, /phoneChecksEnabled\(\{ rc, flag: args\["phone-checks"\] \}\)/);
    assert.match(src, /browserFailureCheck\(statusCommitShown/);
    assert.match(src, /evaluateCrawlRow\(r, \{ budgetMs, phoneChecks \}\)/);
    assert.doesNotMatch(src, /evaluateMain\(/, "verify.mjs must not call evaluateMain directly");
    assert.doesNotMatch(src, /v5Commits\.find/, "verify.mjs must not pick the expected commit itself");
    assert.doesNotMatch(src, /"(skip|no)-release|skipRelease|skip_release/i, "no release skip flag");
    results.push("passes: verify.mjs uses resolveTarget → readRelease → expectedCommitFor → commitResults (no bypass)");
  }
}

// ---- sandbox reset median ≤ 1.5 s (5 resets): hard FAIL, no warn mode, locked budget ----
{
  const S = (...ms) => ms.map((m) => ({ ms: m }));
  const ev = (samples) => evaluateResetTimes(samples);
  const verdict = (r) => (r.ok ? [] : r.failures);
  // Budget and sample count are locked; the evaluator takes no budget argument.
  assert.equal(RESET_BUDGET_MS, 1500, "reset budget is 1,500 ms");
  assert.equal(RESET_SAMPLES, 5, "reset check takes 5 samples");
  assert.equal(RESET_IDLE_MS, 500, "info-only idle window is 500 ms (the crawl's networkidle window); not part of ready or the pass rule");
  assert.equal(RESET_TIMEOUT_MS, 20_000, "each sample is bounded by 20 s");
  assert.equal(RESET_IDLE_CAP_MS, 3000, "info-only idle watch is capped 3 s after ready");
  results.push("passes: reset constants locked (budget 1500 ms, 5 samples, 20 s timeout, info-only idle 500 ms window capped at 3000 ms)");
  // Median at the edge.
  mustFail("reset median 1,501 ms", verdict(ev(S(1501, 1501, 1501, 1501, 1501))));
  mustFail("reset median 1,644 ms (staging at b836e49c)", verdict(ev(S(1600, 1700, 1644, 1580, 1690))));
  mustPass("reset median 1,500 ms", verdict(ev(S(1500, 1500, 1500, 1500, 1500))));
  mustPass("reset median 700 ms", verdict(ev(S(650, 700, 720, 690, 800))));
  // Median, not min/mean/max.
  mustPass("one slow outlier (9,000 ms) among 5 fast resets", verdict(ev(S(700, 700, 9000, 700, 700))));
  mustFail("3 of 5 resets slow (1,700 ms)", verdict(ev(S(700, 1700, 700, 1700, 1700))));
  mustFail("median 1,600 ms though the mean is 1,000 ms", verdict(ev(S(1600, 100, 1600, 100, 1600))));
  assert.equal(ev(S(1600, 1700, 1644, 1580, 1690)).median, 1644);
  // Sample count and errors.
  mustFail("4 samples", verdict(ev(S(700, 700, 700, 700))));
  mustFail("6 samples", verdict(ev(S(700, 700, 700, 700, 700, 700))));
  mustFail("no samples", verdict(ev([])));
  mustFail("one reset errored among 4 fast", verdict(ev([...S(700, 700), { error: "Target closed" }, ...S(700, 700)])));
  mustFail("one reset timed out among 4 fast", verdict(ev([...S(700, 700, 700, 700), { error: "reset not ready after 20000 ms" }])));
  mustFail("NaN sample", verdict(ev([...S(700, 700, 700, 700), { ms: NaN }])));
  mustFail("budget argument is ignored (1,644 ms median with budgetMs 5000)", verdict(evaluateResetTimes(S(1644, 1644, 1644, 1644, 1644), { budgetMs: 5000 })));
  {
    const r = ev(S(1200, 1300, 1250, 1400, 1100));
    assert.equal(r.detail, "resets 1200, 1300, 1250, 1400, 1100 ms; median 1250 ms (budget 1500 ms)", "detail lists all 5 values and the median");
    results.push("passes: detail reports all 5 values and the median");
  }

  // runResetTimeStep end to end on a fake page with a virtual clock (1 ms polls). Times are ms after the
  // Reset demo click. Per reset: urlAt (redirect to /app?reset=1, default serverMs), seededAt (new
  // seeded-at, default serverMs; Infinity = never changes), contentFrom/contentUntil (<main> visible
  // with `rows` job rows; default: always, i.e. the old page's content stays up), rows (default 4),
  // busyUntil (one request in flight from the click, default serverMs). READY = all of url + new
  // seeded-at + main + 4 rows; idle-inclusive (info) = last request settled + 500.
  const fakeResetPage = (resets) => {
    let t = 0;
    let n = -1;
    let clickAt = null;
    let url = "/app";
    let seeded = "seed-0";
    let pending = null;
    const handlers = { request: new Set(), requestfinished: new Set(), requestfailed: new Set(), response: new Set() };
    const emit = (e, r) => handlers[e]?.forEach((f) => f(r));
    const cur = () => {
      const r = resets[n] ?? {};
      const serverMs = r.serverMs ?? 0;
      return { urlAt: serverMs, seededAt: serverMs, contentFrom: 0, contentUntil: Infinity, rows: 4, busyUntil: serverMs, redirect: "/app?reset=1", readMs: 0, readThrows: null, throwIn: "all", postFailAt: null, postFailText: null, ...r };
    };
    const since = () => (clickAt === null ? -1 : t - clickAt);
    const makeResetPost = () => ({
      method: () => "POST",
      url: () => "http://fake/app",
      isNavigationRequest: () => true,
      headers: () => ({ "next-action": "fake-reset" }),
      failure: () => (cur().postFailText ? { errorText: cur().postFailText } : null),
    });
    const tick = () => {
      if (clickAt === null) return;
      const r = cur();
      if (since() >= r.urlAt) url = r.redirect;
      if (since() >= r.seededAt) seeded = `seed-${n + 1}`;
      if (pending && r.postFailAt != null && since() >= r.postFailAt) {
        emit("requestfailed", pending);
        pending = null;
      }
      if (pending && since() >= r.busyUntil) {
        emit(r.failed ? "requestfailed" : "requestfinished", pending);
        pending = null;
      }
    };
    // readThrows [from, until): page reads in that window throw (element detached mid-render).
    // throwIn: "all" = every read throws, or "seeded" / "main" / "rows" = only that read throws.
    const maybeThrow = (which) => {
      const r = cur();
      if (clickAt === null || !r.readThrows) return;
      const [from, until] = r.readThrows;
      if (since() >= from && since() < until && (r.throwIn === "all" || r.throwIn === which)) throw new Error("Element is not attached to the DOM");
    };
    const contentUp = () => clickAt === null || (since() >= cur().contentFrom && since() < cur().contentUntil);
    const rowsLoc = { filter: () => ({ count: async () => { maybeThrow("rows"); return contentUp() ? cur().rows : 0; } }) };
    const page = {
      url: () => `http://fake${url}`,
      goto: async (u) => {
        url = new URL(u).pathname;
        clickAt = null;
        t += 40;
      },
      // One readiness check is one page.evaluate snapshot: a slow poll costs readMs, and a throw in any
      // of its reads fails the whole snapshot.
      evaluate: async () => {
        if (clickAt !== null) {
          t += cur().readMs;
          tick();
        }
        for (const which of ["seeded", "main", "rows"]) maybeThrow(which);
        return { href: `http://fake${url}`, after: seeded, hasSeeded: true, main: contentUp(), rows: contentUp() ? cur().rows : 0 };
      },
      on: (e, f) => handlers[e].add(f),
      off: (e, f) => handlers[e].delete(f),
      locator: () => ({
        first: () => ({ isVisible: async () => { maybeThrow("main"); return contentUp(); } }),
        getByTestId: () => ({ getByTestId: () => rowsLoc }),
      }),
      getByTestId: () => ({
        getAttribute: async () => {
          if (clickAt !== null) {
            t += cur().readMs; // a slow poll: the read itself takes readMs
            tick();
          }
          maybeThrow("seeded");
          return seeded;
        },
        click: async () => { t += 10; },
      }),
      getByRole: () => ({
        click: async () => {
          n += 1;
          const r = resets[n];
          if (r.error) throw new Error(r.error);
          clickAt = t;
          // Reset-shaped POST only when testing watchResetPost fail-fast; else bare object for idle.
          pending = r.postFailAt != null ? makeResetPost() : {};
          emit("request", pending);
          tick();
        },
      }),
    };
    return { page, opts: { expectedRows: 4, pollMs: 1, now: () => t, sleep: async (ms) => { t += ms; tick(); } } };
  };
  const step = async (resets) => {
    const f = fakeResetPage(resets);
    return runResetTimeStep(f.page, "http://fake", f.opts);
  };
  const five = (r) => Array.from({ length: 5 }, () => ({ ...r }));
  const fast = (ms) => five({ serverMs: ms });
  const stepAt = async (resets) => {
    const f = fakeResetPage(resets);
    const r = await runResetTimeStep(f.page, "http://fake", f.opts);
    return { r, end: f.opts.now() };
  };
  // Each check is atomic: a check whose page read throws never counts as ready, and nothing from an
  // earlier check is carried into a later one (review 5644099342). Content is ready at 300 ms; the
  // redirect lands at 1,450 ms, on checks whose reads throw until 1,600 ms.
  {
    const mix = { serverMs: 300, urlAt: 1450, readThrows: [1450, 1600] };
    const r = await step(five(mix));
    assert.deepEqual(r.values, [1600, 1600, 1600, 1600, 1600], `ready only on the first whole check after the throws (1,600 ms), never 1,450 from mixed checks; got ${JSON.stringify(r.values)}`);
    mustFail("runResetTimeStep: content ready, URL arrives on checks whose reads throw (1,450 → 1,600 ms)", verdict(r));
    for (const throwIn of ["seeded", "main", "rows"]) {
      mustFail(`runResetTimeStep: URL arrives while only the ${throwIn} read throws`, verdict(await step(five({ ...mix, throwIn }))));
    }
    mustPass("runResetTimeStep: same page, reads throw 100-200 ms, all ready by 900 ms", verdict(await step(five({ serverMs: 900, readThrows: [100, 200] }))));
    const stuck = await step([...fast(700).slice(0, 4), { serverMs: 300, urlAt: 1450, readThrows: [1450, Infinity] }]);
    mustFail("runResetTimeStep: reads throw from the redirect on (content was ready before)", verdict(stuck));
    assert.match(stuck.failures[0], /^reset 5 failed: reset not ready after 20000 ms \(url \/app\?reset=1, page read failed: Element is not attached to the DOM\)$/, stuck.failures[0]);
  }
  // The informational idle time can never change the verdict, and its watch is capped 3 s after ready.
  {
    const r = await step(five({ serverMs: 900, busyUntil: 3300 }));
    assert.deepEqual([r.values[0], r.idleValues[0]], [900, 3800], `ready 900, idle 3800; got ${JSON.stringify([r.values, r.idleValues])}`);
    mustPass("runResetTimeStep: ready 900 ms, idle-inclusive 3,800 ms → passes", verdict(r));
    const capped = await step(five({ serverMs: 900, busyUntil: 4500 }));
    assert.deepEqual(capped.idleValues, ["capped", "capped", "capped", "capped", "capped"], `idle 5,000 ms is past the 3 s cap; got ${JSON.stringify(capped.idleValues)}`);
    assert.match(capped.detail, /idle-inclusive capped, capped, capped, capped, capped ms \(capped = not quiet 3000 ms after ready\), median n\/a ms$/, capped.detail);
    mustPass("runResetTimeStep: ready 900 ms, idle would be 5,000 ms (capped) → passes", verdict(capped));
    const q = await step(five({ serverMs: 1600, busyUntil: 0 }));
    assert.equal(q.idleValues[0], 1600, "idle can't be earlier than ready");
    mustFail("runResetTimeStep: ready 1,600 ms with an instantly quiet network", verdict(q));
    mustFail("runResetTimeStep: ready 1,600 ms with idle 2,500 ms", verdict(await step(five({ serverMs: 1600, busyUntil: 2000 }))));
    mustFail("runResetTimeStep: ready 1,600 ms with idle capped", verdict(await step(five({ serverMs: 1600, busyUntil: 8500 }))));
    const { r: never, end } = await stepAt(five({ serverMs: 900, busyUntil: Infinity }));
    assert.deepEqual(never.idleValues, ["capped", "capped", "capped", "capped", "capped"]);
    mustPass("runResetTimeStep: ready 900 ms, network never idle (capped) → passes", verdict(never));
    // 5 × (setup 40+10+10 + ready 900 + cap 3000) = 19,800 virtual ms: the idle watch can't stall a run.
    assert.ok(end <= 5 * (60 + 900 + RESET_IDLE_CAP_MS) + 5, `never-idle run must stop at the cap (ended at ${end} ms)`);
    results.push(`passes: info-only idle watch stops at the 3,000 ms cap (never-idle run of 5 ended at ${end} virtual ms)`);
    assert.deepEqual(evaluateResetTimes(five({ ms: 900, idleMs: 5000 })), evaluateResetTimes(five({ ms: 900 })));
    results.push("passes: evaluateResetTimes(ready 900, idle 5,000) = evaluateResetTimes(ready 900)");
    // The evaluator ignores idleMs entirely.
    assert.deepEqual(evaluateResetTimes(five({ ms: 900, idleMs: 99999 })), evaluateResetTimes(five({ ms: 900 })));
    assert.deepEqual(evaluateResetTimes(five({ ms: 1600, idleMs: 1 })), evaluateResetTimes(five({ ms: 1600 })));
    results.push("passes: evaluateResetTimes ignores idleMs (900 ms with idle 99,999 = 900 ms; 1,600 ms with idle 1 = 1,600 ms)");
  }

  {
    const r = await step(fast(1500));
    assert.deepEqual(r.values, [1500, 1500, 1500, 1500, 1500], `ready at the new seeded-at = 1500 ms each; got ${JSON.stringify(r.values)}`);
    assert.deepEqual(r.idleValues, [2000, 2000, 2000, 2000, 2000], `info idle = last request + 500; got ${JSON.stringify(r.idleValues)}`);
    mustPass("runResetTimeStep: 5 × 1,500 ms ready (idle 2,000 ms is info only)", verdict(r));
    assert.match(r.detail, /^resets 1500, 1500, 1500, 1500, 1500 ms; median 1500 ms \(budget 1500 ms\); info only, not in the pass rule: idle-inclusive 2000, 2000, 2000, 2000, 2000 ms, median 2000 ms$/, r.detail);
    results.push("passes: detail = 5 ready values + median, then the labelled info-only idle values + median");
  }
  mustFail("runResetTimeStep: 5 × 1,501 ms", verdict(await step(fast(1501))));
  mustFail("runResetTimeStep: 1,644 ms median", verdict(await step(fast(1644))));
  mustPass("runResetTimeStep: 700 ms median", verdict(await step(fast(700))));
  mustPass("runResetTimeStep: one 8,500 ms outlier", verdict(await step([...fast(700).slice(0, 4), { serverMs: 8500 }])));
  mustFail("runResetTimeStep: 3 of 5 slow", verdict(await step([{ serverMs: 700 }, { serverMs: 1700 }, { serverMs: 700 }, { serverMs: 1700 }, { serverMs: 1700 }])));
  {
    const r = await step([...fast(700).slice(0, 2), { error: "Reset demo button detached" }, ...fast(700).slice(0, 2)]);
    mustFail("runResetTimeStep: one reset click throws", verdict(r));
    assert.ok(r.failures.some((x) => /reset 3 failed: Reset demo button detached/.test(x)) && r.samples.length === 5, `error recorded as sample 3; got ${JSON.stringify(r)}`);
  }
  mustPass("runResetTimeStep: request failed still settles (idle info counts it)", verdict(await step(fast(700).map((x) => ({ ...x, failed: true })))));
  // #20 fail-fast must ignore net::ERR_ABORTED (Next soft-nav after reset redirect) and still fail-fast hard disconnects.
  {
    const abortedOk = await step(five({ serverMs: 700, postFailAt: 100, postFailText: "net::ERR_ABORTED" }));
    mustPass("runResetTimeStep: reset POST net::ERR_ABORTED then ready (no fail-fast)", verdict(abortedOk));
    assert.deepEqual(abortedOk.values, [700, 700, 700, 700, 700], JSON.stringify(abortedOk));
    assert.ok(!/net::ERR_ABORTED/.test(abortedOk.detail), abortedOk.detail);
  }
  {
    // Abort, and the page never navigates / never becomes ready. The ignore stays; the timeout reason names the abort.
    const dead = await step(five({ serverMs: 700, postFailAt: 100, postFailText: "net::ERR_ABORTED", seededAt: Infinity, urlAt: Infinity }));
    mustFail("runResetTimeStep: reset POST net::ERR_ABORTED and never navigates", verdict(dead));
    assert.equal(dead.values.length, 0, JSON.stringify(dead));
    const deadHits = dead.failures.filter((f) => /^reset \d+ failed:/.test(f));
    assert.equal(deadHits.length, 5, JSON.stringify(dead.failures));
    assert.ok(deadHits.every((f) => /reset POST \/app net::ERR_ABORTED at \d+ ms, then not ready after 20000 ms \(url \/app, seeded-at unchanged, main visible, 4\/4 job rows\)/.test(f)), JSON.stringify(dead.failures));
  }
  {
    const changed = await step(five({ serverMs: 700, postFailAt: 100, postFailText: "net::ERR_NETWORK_CHANGED", seededAt: Infinity }));
    mustFail("runResetTimeStep: reset POST net::ERR_NETWORK_CHANGED fails fast", verdict(changed));
    const hits = changed.failures.filter((f) => /^reset \d+ failed:/.test(f));
    assert.equal(hits.length, 5, JSON.stringify(changed.failures));
    assert.ok(hits.every((f) => /reset failed fast at \d+ ms: reset POST \/app failed: net::ERR_NETWORK_CHANGED/.test(f)), JSON.stringify(changed.failures));
    assert.ok(!changed.failures.some((f) => /after 20000 ms/.test(f)), "NETWORK_CHANGED must not wait for the timeout");
  }
  {
    const hard = await step(five({ serverMs: 700, postFailAt: 100, postFailText: "net::ERR_CONNECTION_RESET", seededAt: Infinity }));
    mustFail("runResetTimeStep: reset POST ERR_CONNECTION_RESET fails fast", verdict(hard));
    const hardHits = hard.failures.filter((f) => /^reset \d+ failed:/.test(f));
    assert.equal(hardHits.length, 5, JSON.stringify(hard.failures));
    assert.ok(hardHits.every((f) => /reset failed fast at \d+ ms: reset POST \/app failed: net::ERR_CONNECTION_RESET/.test(f)), JSON.stringify(hard.failures));
    assert.ok(!hard.failures.some((f) => /after 20000 ms/.test(f)), "hard POST failure must not wait for the timeout");
  }

  // Stale page: main content is up the whole time but seeded-at never changes → never ready → timeout.
  {
    const r = await step([...fast(700).slice(0, 4), { serverMs: 700, seededAt: Infinity }]);
    mustFail("runResetTimeStep: stale page (main content shown, seeded-at never changes)", verdict(r));
    assert.ok(r.failures.some((x) => /reset 5 failed: reset not ready after 20000 ms \(url \/app\?reset=1, seeded-at unchanged, main visible, 4\/4 job rows\)/.test(x)), JSON.stringify(r.failures));
    const all = await step(five({ serverMs: 300, seededAt: Infinity }));
    mustFail("runResetTimeStep: every reset stale", verdict(all));
    assert.equal(all.values.length, 0, "a stale page never yields a ready time");
  }
  // Ready must not fire before seeded-at changes: URL and content are there at 300 ms, seeded-at at 1,600 ms.
  {
    const r = await step(five({ serverMs: 300, seededAt: 1600 }));
    assert.deepEqual(r.values, [1600, 1600, 1600, 1600, 1600], `ready waits for the new seeded-at; got ${JSON.stringify(r.values)}`);
    mustFail("runResetTimeStep: content at 300 ms, new seeded-at at 1,600 ms", verdict(r));
    mustPass("runResetTimeStep: content at 300 ms, new seeded-at at 900 ms", verdict(await step(five({ serverMs: 300, seededAt: 900 }))));
  }
  // Main content missing: seeded-at changes but no <main>/rows → not ready.
  {
    const r = await step([...fast(700).slice(0, 4), { serverMs: 700, contentFrom: Infinity }]);
    mustFail("runResetTimeStep: seeded-at new but no main content", verdict(r));
    assert.ok(r.failures.some((x) => /reset 5 failed: reset not ready after 20000 ms \(url \/app\?reset=1, seeded-at new, main missing, 0\/4 job rows\)/.test(x)), JSON.stringify(r.failures));
    mustFail("runResetTimeStep: seeded-at new, main visible but 0 job rows", verdict(await step([...fast(700).slice(0, 4), { serverMs: 700, rows: 0 }])));
    mustFail("runResetTimeStep: seeded-at new, 3 of 4 job rows", verdict(await step([...fast(700).slice(0, 4), { serverMs: 700, rows: 3 }])));
    // Content drops at the click (full re-render) and comes back at 1,600 ms → ready at 1,600 ms.
    const late = await step(five({ serverMs: 700, contentFrom: 1600 }));
    assert.deepEqual(late.values, [1600, 1600, 1600, 1600, 1600], `ready waits for main content; got ${JSON.stringify(late.values)}`);
    mustFail("runResetTimeStep: new seeded-at at 700 ms, main content at 1,600 ms", verdict(late));
  }
  for (const bad of [0, undefined, "4"]) {
    const f = fakeResetPage(fast(700));
    const r = await runResetTimeStep(f.page, "http://fake", { ...f.opts, expectedRows: bad });
    mustFail(`runResetTimeStep: expectedRows ${String(bad)} refused`, verdict(r));
  }
  // rows must equal the seed count exactly: 5 rows is not ready.
  mustFail("runResetTimeStep: seeded-at new, 5 of 4 job rows", verdict(await step([...fast(700).slice(0, 4), { serverMs: 700, rows: 5 }])));
  mustFail("runResetTimeStep: every reset shows 5 job rows", verdict(await step(five({ serverMs: 700, rows: 5 }))));
  // URL condition: path must be <base>/app with reset=1.
  {
    const r = await step(five({ serverMs: 300, urlAt: 1600 }));
    assert.deepEqual(r.values, [1600, 1600, 1600, 1600, 1600], `seeded-at and rows before the redirect: ready waits for /app?reset=1; got ${JSON.stringify(r.values)}`);
    mustFail("runResetTimeStep: seeded-at + rows at 300 ms, redirect at 1,600 ms", verdict(r));
    const never = await step([...fast(700).slice(0, 4), { serverMs: 700, urlAt: Infinity }]);
    mustFail("runResetTimeStep: seeded-at + rows new, never redirected", verdict(never));
    assert.ok(never.failures.some((x) => /reset 5 failed: reset not ready after 20000 ms \(url \/app, seeded-at /.test(x)), JSON.stringify(never.failures));
    for (const to of ["/app/jobs/25-031?reset=1", "/login?reset=1", "/app?reset=0", "/app?other=1", "/apps?reset=1"]) {
      mustFail(`runResetTimeStep: redirect to ${to} (seeded-at + rows new)`, verdict(await step([...fast(700).slice(0, 4), { serverMs: 700, redirect: to }])));
    }
    mustPass("runResetTimeStep: redirect to /app?foo=2&reset=1", verdict(await step(five({ serverMs: 700, redirect: "/app?foo=2&reset=1" }))));
  }
  // The 20 s timeout bounds the whole sample: ready at exactly 20,000 ms counts; anything later fails.
  {
    const at = await step([...fast(700).slice(0, 4), { serverMs: 20_000 }]);
    assert.equal(at.samples[4].ms, 20_000, `ready at exactly 20,000 ms is a sample; got ${JSON.stringify(at.samples[4])}`);
    mustPass("runResetTimeStep: one sample ready at exactly 20,000 ms (median 700)", verdict(at));
    const over = await step([...fast(700).slice(0, 4), { serverMs: 20_001 }]);
    mustFail("runResetTimeStep: one sample ready at 20,001 ms", verdict(over));
    assert.ok(over.failures.some((x) => /reset 5 failed: reset not ready after 20000 ms/.test(x)), JSON.stringify(over.failures));
    // Slow poll: each read takes 700 ms; seeded-at lands at 19,800 ms, the read that sees it ends after 20 s.
    const slow = await step([...fast(700).slice(0, 4), { serverMs: 19_800, readMs: 700 }]);
    mustFail("runResetTimeStep: slow poll sees ready after 20 s", verdict(slow));
    assert.ok(slow.failures.some((x) => /reset 5 failed: reset ready at 20\d\d\d ms, after the 20000 ms timeout/.test(x)), JSON.stringify(slow.failures));
    assert.equal(slow.samples[4].ms, undefined, "a post-20 s ready is never recorded as a time");
  }
  // The rule can't be overridden: no env var, argv or argument changes the budget, sample count or caps.
  {
    const f = fakeResetPage(fast(1644));
    const withArgs = await runResetTimeStep(f.page, "http://fake", { ...f.opts, budgetMs: 9999, budget: 9999, samples: 1, RESET_BUDGET_MS: 9999 });
    assert.equal(withArgs.samples.length, 5);
    mustFail("runResetTimeStep: 1,644 ms median with budgetMs/samples arguments", verdict(withArgs));
    const envs = { RESET_BUDGET_MS: "9999", VERIFY_RESET_BUDGET_MS: "9999", RESET_SAMPLES: "1", RESET_TIMEOUT_MS: "1", RESET_IDLE_CAP_MS: "1", BUDGET_MS: "9999", VERIFY_V5_RESET_BUDGET: "9999" };
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", `
      const m = await import(${JSON.stringify(path.join(here, "reset-time.mjs"))});
      const v = m.evaluateResetTimes(Array.from({ length: 5 }, () => ({ ms: 1644 })));
      process.stdout.write(JSON.stringify([m.RESET_BUDGET_MS, m.RESET_SAMPLES, m.RESET_TIMEOUT_MS, m.RESET_IDLE_CAP_MS, v.ok]));
    `, "--", "--reset-budget-ms", "9999", "--budget", "9999"], { encoding: "utf8", env: { ...process.env, ...envs } });
    assert.deepEqual(JSON.parse(out), [1500, 5, 20_000, 3000, false], `env vars/argv must not change the rule; got ${out}`);
    results.push("passes: env vars (RESET_BUDGET_MS=9999, RESET_SAMPLES=1, …) and argv (--reset-budget-ms 9999) leave budget 1500, 5 samples, 20 s, 3 s cap; 1,644 ms still fails");
    const src = readFileSync(path.join(here, "reset-time.mjs"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /process\.|\bargv\b|\benv\b|import\.meta|parseArgs|globalThis/, "reset-time.mjs must not read env, argv or globals");
    for (const [name, value] of [["RESET_BUDGET_MS", "1500"], ["RESET_SAMPLES", "5"], ["RESET_TIMEOUT_MS", "20_000"], ["RESET_IDLE_CAP_MS", "3000"], ["RESET_IDLE_MS", "500"]]) {
      assert.equal((code.match(new RegExp(`\\b${name}\\s*=`, "g")) ?? []).length, 1, `${name} assigned exactly once`);
      assert.match(code, new RegExp(`^export const ${name} = ${value};$`, "m"), `${name} must be the literal ${value}`);
    }
    assert.match(code, /^export function evaluateResetTimes\(samples\) \{$/m, "evaluateResetTimes takes only samples");
    assert.doesNotMatch(code, /"reset-(budget|skip|warn)|resetBudget|skipReset|budgetMs|samplesOverride/, "no budget/sample override names in reset-time.mjs");
    results.push("passes: reset-time.mjs source has no env/argv/global read; the 5 constants are literals assigned once; evaluateResetTimes(samples) only");
  }

  // verify.mjs really runs this step, records it as a check (not a warning), with no override.
  {
    const src = readFileSync(path.join(here, "verify.mjs"), "utf8");
    const start = src.indexOf("  await step(RESET_STEP, async () => {");
    assert.ok(start > 0, "verify.mjs must run step(RESET_STEP, …) at flow level");
    const body = src.slice(start, src.indexOf("\n  });", start));
    assert.match(body, /const r = await runResetTimeStep\(page, base, \{ expectedRows: expectedJobCount \}\);/, "verify.mjs must call runResetTimeStep(page, base, { expectedRows: expectedJobCount }) with no other options");
    assert.match(body, /check\(RESET_STEP, r\.ok, r\.detail\);/, "the reset verdict must be a check (hard FAIL)");
    assert.doesNotMatch(body, /warnings\.push|WARN|\bif \(|\?\?|\|\||r\.ok \|\||true\)/, "no warn-only or conditional path in the reset step");
    assert.equal(src.split("runResetTimeStep(").length - 1, 1, "exactly one runResetTimeStep call");
    assert.doesNotMatch(src, /"reset-(budget|skip|warn)|resetBudget|skipReset|RESET_BUDGET_MS\s*=/, "no flag or override for the reset budget");
    const flowsAt = src.indexOf("async function flows(");
    assert.ok(flowsAt > 0 && start > flowsAt, "reset step lives in flows(), which every target runs");
    results.push("passes: verify.mjs step(RESET_STEP) → runResetTimeStep(page, base, { expectedRows }) → check(RESET_STEP, r.ok, r.detail), no flag/warn path");
  }
}

// ---- error boundaries: Next's built-in screens and the app's PR #15 fallback fail a crawl load ----
{
  const good = { role: "pm", width: 1280, path: "/changelog", status: 200, final: "/changelog", idleMs: 500, responses4xx5xx: [], consoleErrors: [], pageErrors: [], text: "Changelog 5.0.2", overflowPx: 0, emptyHits: [], seededCounts: {}, errorBoundaryMarkers: [] };
  mustPass("crawl row: clean /changelog (no boundary text, no marker)", evaluateCrawlRow(good));
  for (const [label, row, re] of [
    ["route boundary heading 'Page load failed'", { text: "Pitbull\nPage load failed\nThis screen failed to render. Try again.\nTry again\nDemo login" }, /error boundary "Page load failed"/],
    ["global boundary heading 'Shell load failed'", { text: "Shell load failed\nTry again" }, /error boundary "Shell load failed"/],
    ["route-error marker with reworded text", { text: "Could not show this job", errorBoundaryMarkers: ['[data-testid="route-error"]'] }, /error boundary marker \[data-testid="route-error"\]/],
    ["global-error marker", { errorBoundaryMarkers: ['[data-testid="global-error"]'] }, /error boundary marker \[data-testid="global-error"\]/],
    ["Next 16 built-in 'This page couldn’t load'", { text: "This page couldn’t load\nA server error occurred. Reload to try again." }, /error boundary "This page couldn’t load"/],
  ]) {
    const f = evaluateCrawlRow({ ...good, ...row });
    assert.ok(f.some((x) => re.test(x)), `${label} must fail with ${re}; got ${JSON.stringify(f)}`);
    results.push(`FAILS as expected: crawl row with ${label} → ${f.find((x) => re.test(x))}`);
  }
}

// ---- DATABASE_URL: special-character passwords parse to the right parts, and redaction hides them ----
{
  for (const pw of ["ab/cd", "p@ss/word", "Zq:/?#@%x", 'ab"cd\\ef']) {
    const url = `postgres://pv_user:${pw}@db.internal:5544/pv_db?sslmode=disable`;
    const p = parsePostgresUrl(url);
    assert.deepEqual(p && { user: p.user, password: p.password, host: p.host, port: p.port, database: p.database }, { user: "pv_user", password: pw, host: "db.internal", port: "5544", database: "pv_db" }, `parts for ${JSON.stringify(pw)}`);
    const w = new URL(p.connectionString); // the WHATWG parse postgres.js does must see the same host and user
    assert.deepEqual([w.hostname, w.port, decodeURIComponent(w.username), decodeURIComponent(w.password), w.pathname], ["db.internal", "5544", "pv_user", pw, "/pv_db"]);
    const secrets = secretValues({ DATABASE_URL: url });
    const msg = `TypeError: Invalid URL { input: '${url}' } pw=${pw} enc=${encodeURIComponent(pw)} ${p.connectionString}`;
    const red = redactText(msg, secrets);
    for (const leak of [pw, encodeURIComponent(pw), url]) assert.ok(!red.includes(leak), `redactText must hide ${JSON.stringify(leak)}: ${red}`);
    // verify.mjs / captureFailure redact after JSON.stringify — " and \ in the password become \" \\.
    const jsonBlob = JSON.stringify({ err: url, pw });
    const jsonRed = redactText(jsonBlob, secrets);
    const jsonPw = JSON.stringify(pw).slice(1, -1);
    const jsonUrl = JSON.stringify(url).slice(1, -1);
    for (const leak of [pw, jsonPw, url, jsonUrl, encodeURIComponent(pw)]) {
      assert.ok(!jsonRed.includes(leak), `redactText(JSON.stringify(...)) must hide ${JSON.stringify(leak)}: ${jsonRed}`);
    }
    results.push(`passes: DATABASE_URL password ${JSON.stringify(pw)} → pv_user@db.internal:5544/pv_db; plain and JSON-stringified echoes are fully redacted`);
  }
  assert.equal(parsePostgresUrl("postgres://only-user@"), null);
  assert.equal(parsePostgresUrl("mysql://u:p@h/db"), null);
  results.push("FAILS as expected: unusable postgres URLs parse to null (never handed to postgres())");
  const red = redactText("Authorization: Bearer abc.DEF-123 postgres://u:p@h:1/d x", []);
  assert.ok(!/abc\.DEF-123|u:p@/.test(red), red);
  results.push(`passes: redactText drops Bearer values and postgres:// userinfo with no secret list → ${red}`);
  const u = redactUrl("http://u:pw@h.test/app?reset=1&token=t0k&state=abcdefghij0123456789XYZ&q=hello", []);
  assert.equal(u, "http://h.test/app?reset=1&token=REDACTED&state=REDACTED&q=hello");
  results.push(`passes: redactUrl keeps reset=1 and plain values, drops userinfo, secret-named and token-looking values → ${u}`);
  const h = redactHeaders({ Authorization: "Bearer x", cookie: "sid=1", "x-verify-token": "v", accept: "text/html" }, []);
  assert.deepEqual(h, { Authorization: "[redacted]", cookie: "[redacted]", "x-verify-token": "[redacted]", accept: "text/html" });
  results.push("passes: redactHeaders drops Authorization / Cookie / token headers, keeps the rest");
  const sv = secretValues({ VERIFY_TOKEN: "vt-canary-123456", GH_TOKEN: "ghp_canary123456", HOME: "/home/x", PORT: "3100" });
  assert.ok(sv.includes("vt-canary-123456") && sv.includes("ghp_canary123456") && !sv.includes("/home/x") && !sv.includes("3100"), JSON.stringify(sv));
  results.push("passes: secretValues takes VERIFY_TOKEN / GH_TOKEN, not HOME or PORT");
}

// ---- secrets with " and \ : redacted before serializing, so no escaped form survives (lead review 5646583341) ----
{
  const pw = String.raw`ab"cd\ef`;
  const url = `postgres://u:${pw}@h:5432/d`;
  const token = String.raw`vt"canary\9999-not-real`;
  const secrets = secretValues({ DATABASE_URL: url, VERIFY_TOKEN: token });
  const jsonEsc = (x) => JSON.stringify(x).slice(1, -1);
  // Every form that must never be written: raw, JSON-escaped (once, twice), URL-encoded, HTML-escaped.
  const forms = [pw, url, token].flatMap((x) => [x, jsonEsc(x), jsonEsc(jsonEsc(x)), encodeURIComponent(x), jsonEsc(encodeURIComponent(x)), x.replace(/"/g, "&quot;")]);
  forms.push(String.raw`ab\"cd\\ef`, "ab&quot;cd\\ef"); // the exact strings the lead saw survive
  const leaked = (text) => forms.filter((f) => text.includes(f));
  {
    const value = { err: url, msg: `connect failed for ${url}`, nested: [{ why: `password ${pw}` }, new Error(`boom ${url}`)], [`key ${pw}`]: token, auth: `Bearer ${token}` };
    const out = safeJson(value, secrets);
    assert.deepEqual(leaked(out), [], `safeJson must not leak a " / \\ secret in any form; got ${out}`);
    assert.doesNotThrow(() => JSON.parse(out), "safeJson output is still valid JSON");
    // A postgres URL that is not in the secret list (e.g. echoed by a driver error): only redacting the raw
    // string catches it; once JSON-escaped, the quote ends the userinfo pattern before the @.
    const other = String.raw`postgres://other:xy"zz\qq@db.test:5432/x`;
    const o = safeJson({ error: `connect failed: ${other}`, list: [other] }, []);
    assert.ok(!o.includes("xy") && !o.includes("zz") && !o.includes("qq@"), `safeJson must redact an unlisted postgres URL whose password has " and \\ ; got ${o}`);
    results.push(`passes: safeJson redacts a " and \\ password (${JSON.stringify(pw)}) and token before stringifying; no raw or escaped form, valid JSON`);
  }
  {
    // captureFailure (evidence.mjs) with a page double: reason, url, html, and the `extra` field all carry the secret.
    const dir = mkdtempSync(path.join(os.tmpdir(), "esc-evidence-"));
    const page = {
      context: () => ({ cookies: async () => [] }),
      screenshot: async ({ path: p }) => writeFileSync(p, "png"),
      content: async () => `<p>${pw}</p><p>${pw.replace(/"/g, "&quot;")}</p><script>var u = ${JSON.stringify(url)}; var t = ${JSON.stringify(JSON.stringify(token))};</script>`,
      url: () => `http://h.test/app?reset=1&note=${encodeURIComponent(pw)}`,
    };
    const files = await captureFailure(page, { dir, kind: "reset", label: "esc", reason: `reset failed: ${url} / ${jsonEsc(url)}`, secrets, extra: { err: url, deep: { list: [url, `x ${jsonEsc(pw)}`] } } });
    assert.ok(files.json && files.html && files.png, JSON.stringify(files));
    const written = readdirSync(dir).map((f) => readFileSync(path.join(dir, f), "utf8"));
    const hits = written.flatMap((t) => leaked(t));
    rmSync(dir, { recursive: true, force: true });
    assert.deepEqual(hits, [], `captureFailure must not write a " / \\ secret in any form (json, html, extra); got ${JSON.stringify(hits)}`);
    results.push("passes: captureFailure writes no raw or escaped \" / \\ secret to json (incl. extra), html or the url");
  }
  {
    // Raw text (stdout, crash lines): the whole userinfo goes even when it holds a quote.
    const line = redactText(`FAIL stress seed: crashed: Invalid URL ${url} (input "${url}")`, []);
    assert.ok(!line.includes(pw) && !line.includes("cd\\ef"), `raw-text userinfo with " must be redacted with no secret list; got ${line}`);
    assert.deepEqual(leaked(redactText(`crash ${url} ${jsonEsc(url)} ${token}`, secrets)), []);
    results.push("passes: stdout/crash text: a \" / \\ password URL is redacted (pattern and secret forms)");
  }
}

// ---- HTML serializer forms: text nodes escape & nbsp < > only, attributes & nbsp " (and < > in newer Chromium) ----
// The exact strings the lead saw survive in real Chromium .html captures (re-review 5646855343); the real
// Chromium check is in crawl-mustfail.test.mjs.
{
  for (const [pw, saved] of [[`x</>&"y`, `x&lt;/&gt;&amp;"y`], [`a&"b12`, `a&amp;"b12`], [`p<'q12`, `p&lt;'q12`], [`x</>&"y'z`, `x&lt;/&gt;&amp;&quot;y'z`], [`x</>&"y'z`, `x</>&amp;&quot;y'z`], [`n\u00a0b<"&12`, `n&nbsp;b&lt;"&amp;12`]]) {
    const out = redactText(`<p>${saved}</p><a title="${saved}">`, [pw]);
    assert.ok(!out.includes(saved), `redactText must catch ${JSON.stringify(pw)} serialized as ${JSON.stringify(saved)}; got ${out}`);
    results.push(`passes: HTML-serialized ${JSON.stringify(saved)} of ${JSON.stringify(pw)} is redacted`);
  }
}

// ---- every encoding a secret can take on the way into evidence (lead re-review 5647038738) ----
// Encoders here are written independently of evidence.mjs; leakedIn() is a separate brute-force decoder
// (any chain of HTML / JS-JSON / percent / + decodings, depth <= 4) so a form nobody listed still fails.
{
  const PASSWORDS = [`x</>&"y'z`, `x</>&"y`, `a&"b12`, `p<'q12`, `n\u00a0b<"&12`, `ab&cd1234`, `p q&1+2'`];
  const hex4 = (c) => c.charCodeAt(0).toString(16).padStart(4, "0");
  const html = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const htmlText = (x) => x.replace(/&/g, "&amp;").replace(/\u00a0/g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const htmlAttr = (x) => x.replace(/&/g, "&amp;").replace(/\u00a0/g, "&nbsp;").replace(/"/g, "&quot;");
  const json = (x) => JSON.stringify(x).slice(1, -1);
  const uAll = (x) => x.replace(/[^A-Za-z0-9]/g, (c) => `\\u${hex4(c)}`);
  const uAllUpper = (x) => x.replace(/[^A-Za-z0-9]/g, (c) => `\\u${hex4(c).toUpperCase()}`);
  const uNext = (x) => x.replace(/[&<>\u2028\u2029]/g, (c) => `\\u${hex4(c)}`); // Next.js htmlEscapeJsonString
  const lower = (x) => x.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
  const urlPath = (x) => new URL(`http://h.test/p/${x}`).pathname.slice(3);
  const query = (x) => new URL(`http://h.test/s?note=${x}`).search.slice(6);
  const usp = (x) => new URLSearchParams({ note: x }).toString().slice(5);
  const FORMS = {
    raw: (x) => x,
    "HTML-escaped (all five)": html,
    "HTML text node (& nbsp < >)": htmlText,
    "HTML attribute (& nbsp \")": htmlAttr,
    "HTML double-escaped (srcdoc)": (x) => html(html(x)),
    "HTML triple-escaped (srcdoc in srcdoc)": (x) => html(html(html(x))),
    "JSON-escaped": json,
    "JSON-escaped twice": (x) => json(json(x)),
    "JS \\u, all non-alnum (lowercase hex)": uAll,
    "JS \\u, all non-alnum (uppercase hex)": uAllUpper,
    "JS \\u, Next.js <>& subset": uNext,
    "JS \\u, Next.js subset, uppercase hex": (x) => uNext(x).replace(/\\u([0-9a-f]{4})/g, (m, h) => `\\u${h.toUpperCase()}`),
    "Next.js flight push (JSON twice, then <>& as \\u)": (x) => uNext(json(json(x))),
    "Next.js flight push, JSON-escaped again": (x) => json(uNext(json(json(x)))),
    "URL path (browser encoding)": urlPath,
    "URL query (browser encoding)": query,
    encodeURIComponent: encodeURIComponent,
    "encodeURIComponent, lowercase hex": (x) => lower(encodeURIComponent(x)),
    "URLSearchParams (%27, + for space)": usp,
    "URLSearchParams, lowercase hex": (x) => lower(usp(x)),
    "percent-encoded twice (%25)": (x) => encodeURIComponent(encodeURIComponent(x)),
    "URL path, JSON-escaped": (x) => json(urlPath(x)),
    "URLSearchParams in an HTML attribute": (x) => htmlAttr(usp(x)),
    "encodeURIComponent, HTML-escaped": (x) => html(encodeURIComponent(x)),
    "JSON-escaped, HTML text node": (x) => htmlText(json(x)),
    "HTML-escaped, JSON-escaped": (x) => json(html(x)),
  };
  const dec = [
    (t) => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);?/gi, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" })[e.toLowerCase()] ?? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))),
    (t) => t.replace(/\\(u[0-9a-f]{4}|["\\/'])/gi, (m, e) => (e.length === 5 ? String.fromCharCode(parseInt(e.slice(1), 16)) : e)),
    (t) => t.replace(/(%[0-9a-f]{2})+/gi, (m) => { try { return decodeURIComponent(m); } catch { return m; } }),
    (t) => t.replace(/\+/g, " "),
  ];
  const leakedIn = (t, pw) => {
    let frontier = new Set([t]);
    const seen = new Set(frontier);
    for (let d = 0; d <= 4; d++) {
      for (const x of frontier) if (x.includes(pw)) return true;
      const next = new Set();
      for (const x of frontier) for (const f of dec) { const o = f(x); if (!seen.has(o)) (seen.add(o), next.add(o)); }
      frontier = next;
    }
    return false;
  };
  for (const [name, enc] of Object.entries(FORMS)) {
    const checked = [];
    for (const pw of PASSWORDS) {
      const form = enc(pw);
      if (name !== "raw" && form === pw) continue; // this password has nothing that form escapes
      assert.ok(leakedIn(form, pw), `test decoder must see ${JSON.stringify(pw)} in its ${name} form ${JSON.stringify(form)}`);
      const text = `log: failed at <a href="/x">${form}</a> and "${form}" end`;
      const out = redactText(text, [pw]);
      assert.ok(!out.includes(form), `redactText must catch the ${name} form ${JSON.stringify(form)} of ${JSON.stringify(pw)}; got ${out}`);
      assert.ok(!leakedIn(out, pw), `nothing in redactText output may decode to ${JSON.stringify(pw)} (${name}); got ${out}`);
      assert.ok(out.includes("[redacted]") && out.startsWith("log: failed at <a href=\"/x\">") && out.endsWith(" end"), `only the secret is replaced (${name}); got ${out}`);
      const j = safeJson({ url: `http://h.test/p/${form}`, msg: form }, [pw]);
      assert.ok(!leakedIn(j, pw) && !j.includes(form), `safeJson must catch the ${name} form of ${JSON.stringify(pw)}; got ${j}`);
      assert.doesNotThrow(() => JSON.parse(j), `safeJson stays valid JSON (${name})`);
      checked.push(form);
    }
    assert.ok(checked.length >= 1, `${name}: at least one password exercises it`);
    results.push(`passes: ${name} form redacted for ${checked.length} passwords (redactText + safeJson), e.g. ${JSON.stringify(checked[0])}`);
  }
  // The exact strings the lead saw survive (re-review 5647038738).
  for (const [pw, saved] of [[`ab&cd1234`, String.raw`ab\u0026cd1234`], [`x</>&"y'z`, `x%3C/%3E&%22y'z`], [`x</>&"y'z`, `x%3c/%3e%26%22y%27z`], [`x</>&"y'z`, `x%3C%2F%3E%26%22y%27z`]]) {
    const out = redactText(`<script>self.__next_f.push([1,"${saved}"])</script> ${saved}`, [pw]);
    assert.ok(!out.includes(saved) && !leakedIn(out, pw), `redactText must catch ${JSON.stringify(saved)}; got ${out}`);
    results.push(`passes: ${JSON.stringify(saved)} (lead's survivor) is redacted`);
  }
  // Benign text next to a secret is untouched, and an unrelated encoded string is not redacted.
  {
    const out = redactText(`a&amp;b %3Cok%3E \\u0026 q=1+2 ${encodeURIComponent("ab&cd1234")}`, ["ab&cd1234"]);
    assert.equal(out, "a&amp;b %3Cok%3E \\u0026 q=1+2 [redacted]");
    results.push(`passes: scrubbing leaves unrelated escapes alone → ${out}`);
  }
  // Console / page error text is cut only after redaction, so no prefix of a secret is kept.
  {
    const dir = mkdtempSync(path.join(os.tmpdir(), "cut-evidence-"));
    const handlers = {};
    const page = { on: (ev, fn) => (handlers[ev] = fn), off: () => {}, context: () => ({ cookies: async () => [] }), screenshot: async ({ path: p }) => writeFileSync(p, "png"), content: async () => "<p>x</p>", url: () => "http://h.test/" };
    const rec = startFailureRecorder(page);
    handlers.console({ type: () => "error", text: () => "z".repeat(1996) + "ab&cd1234" });
    await captureFailure(page, { dir, kind: "crawl", label: "cut", reason: "r", recorder: rec, secrets: ["ab&cd1234"] });
    const j = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => readFileSync(path.join(dir, f), "utf8")).join("");
    rmSync(dir, { recursive: true, force: true });
    assert.ok(!j.includes("zab") && j.includes("zzzz[red"), `a console error cut at 2000 chars must not keep a secret prefix; got ...${j.slice(-200)}`);
    results.push("passes: console text is redacted before it is cut to 2000 chars (no secret prefix kept)");
  }
}

// ---- safeJson writes real arrays (no false [circular]), scrubs only JSON strings, and the raw cap can't keep a secret prefix ----
{
  const shared = [{ url: "/api/x", status: 500 }];
  const out = safeJson({ slowest: { path: "/app", responses4xx5xx: shared }, rows: [{ path: "/app", responses4xx5xx: shared }] });
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.slowest.responses4xx5xx, shared);
  assert.deepEqual(parsed.rows[0].responses4xx5xx, shared);
  assert.ok(!out.includes("[circular]"), out);
  const cyc = {};
  cyc.self = cyc;
  const cycled = safeJson({ box: cyc });
  assert.ok(cycled.includes('"[circular]"'), cycled);
  assert.doesNotThrow(() => JSON.parse(cycled));
  results.push("passes: a row array shared with slowest is written in both places; a real cycle is [circular] and still parses");

  const structural = `": "`;
  const intact = safeJson({ a: "safe", n: 1, list: ["ok"] }, [structural]);
  assert.deepEqual(JSON.parse(intact), { a: "safe", n: 1, list: ["ok"] });
  assert.match(intact, /"a": "safe"/);
  const inside = safeJson({ a: `x": "y` }, [structural]);
  assert.equal(JSON.parse(inside).a, "x[redacted]y");
  assert.doesNotThrow(() => JSON.parse(inside));
  results.push('passes: safeJson scrubs secrets only inside JSON string values; a secret of ": " leaves the structure parseable');

  const pw = `a"b12`;
  const saved = `a&quotb12`;
  const text = redactText(`note ${saved} end`, [pw]);
  assert.ok(!text.includes(saved) && !text.includes(pw) && text.includes("[redacted]"), text);
  const htmlJson = safeJson({ html: saved, keep: "a&quot;still" }, [pw]);
  assert.doesNotThrow(() => JSON.parse(htmlJson));
  assert.ok(!htmlJson.includes(pw) && !htmlJson.includes("quotb"), htmlJson);
  assert.ok(htmlJson.includes("a&quot;still") || JSON.parse(htmlJson).keep === "a&quot;still");
  results.push("passes: named HTML entity without a trailing ';' (&quot) is redacted; JSON.parse succeeds");

  const secret = "canary-secret-9999";
  const raw = "z".repeat(RAW_TEXT_CAP - 4) + secret;
  const capped = capRawText(raw, [secret]);
  assert.ok(capped.includes("[redacted]") && !capped.includes(secret) && !capped.includes(secret.slice(0, 4)), capped.slice(-40));
  const encSecret = "a&bXY12";
  const enc = "q".repeat(RAW_TEXT_CAP - 2) + "a&amp;bXY12";
  const cappedEnc = capRawText(enc, [encSecret]);
  assert.ok(cappedEnc.includes("[redacted]") && !cappedEnc.includes(encSecret) && !cappedEnc.includes("a&amp;") && !cappedEnc.endsWith("a&"), cappedEnc.slice(-40));
  const handlers = {};
  const page = { on: (ev, fn) => (handlers[ev] = fn), off: () => {} };
  const rec = startFailureRecorder(page, [secret]);
  handlers.console({ type: () => "error", text: () => raw });
  const stored = rec.since(0)[0].text;
  rec.stop();
  assert.ok(stored.includes("[redacted]") && !stored.includes(secret) && !stored.includes("cana"), stored.slice(-40));
  results.push("passes: a secret straddling RAW_TEXT_CAP (raw and &amp; form) is redacted in the kept head");
}

// ---- RC handover (5.0.4). 5.0.2 and 5.0.3 stay per PR. No check above is relaxed. ----
{
  const rcSha = "a".repeat(40);
  const other = "b".repeat(40);
  const wrong = evaluateRcHead({ rcSha, shown: other });
  mustFail("staging serves a different SHA than the rc head", wrong.failures);
  assert.match(wrong.failures[0], new RegExp(`staging serves ${other}, rc head is ${rcSha}`));
  mustPass("staging /status serves the rc head", evaluateRcHead({ rcSha, shown: rcSha.toUpperCase() }).failures);
  const prefix = "a".repeat(12);
  mustPass(
    "rc head prefix resolves to the same SHA",
    evaluateRcHead({ rcSha, shown: prefix, resolve: (p) => (p === prefix ? rcSha : other) }).failures,
  );
  const wrongPrefix = evaluateRcHead({ rcSha, shown: prefix, resolve: () => other });
  mustFail("rc head prefix resolves to a different SHA", wrongPrefix.failures);
  assert.match(wrongPrefix.failures[0], /staging serves/);

  assert.equal(resolveRcMode({ sha: "" }).rc, null);
  assert.equal(resolveRcMode({ sha: "" }).error, null);
  assert.match(resolveRcMode({ version: "5.0.2" }).error, /5\.0\.2 stays on the per-PR flow/);
  assert.equal(resolveRcMode({ version: "5.0.2" }).rc, null);
  assert.match(resolveRcMode({ version: "5.0.2", sha: "" }).error, /5\.0\.2 stays on the per-PR flow/);
  assert.match(resolveRcMode({ version: "5.0.3", sha: "" }).error, /5\.0\.3 stays on the per-PR flow/);
  assert.match(resolveRcMode({ version: "5.0.2", sha: rcSha }).error, /5\.0\.2 stays on the per-PR flow/);
  assert.match(resolveRcMode({ version: "5.0.3", sha: rcSha }).error, /5\.0\.3 stays on the per-PR flow/);
  assert.equal(resolveRcMode({ version: "5.1.0", sha: rcSha }).rc.branch, "rc/5.1.0");
  assert.equal(resolveRcMode({ version: "5.0.5", sha: rcSha }).rc.branch, "rc/5.0.5");
  assert.match(resolveRcMode({ version: "5.0.1", sha: rcSha }).error, /RC flow starts at 5\.0\.4/);
  assert.match(resolveRcMode({ sha: "abc" }).error, /full 40-char/);
  assert.match(resolveRcMode({ sha: rcSha, commit: other }).error, /disagrees/);
  assert.match(resolveRcMode({ sha: rcSha, target: "production" }).error, /production keeps the release-tag/);
  assert.equal(resolveRcMode({ sha: rcSha, commit: rcSha.toUpperCase(), target: "staging" }).rc.branch, "rc/5.0.4");
  results.push("passes: 5.0.2 and 5.0.3 stay per PR even with no --rc; 5.0.4 and later are an RC; a short SHA, a disagreeing --commit, and production are refused");
  for (const version of ["5.0.2", "5.0.3"]) {
    let refused;
    try {
      refused = execFileSync(process.execPath, [path.join(here, "verify.mjs"), "--self-check", "--rc-version", version], {
        encoding: "utf8",
        env: { ...process.env, VERIFY_TOKEN: "" },
        timeout: 60_000,
      });
      refused = { status: 0, stdout: refused, stderr: "" };
    } catch (error) {
      refused = { status: error.status, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
    }
    assert.equal(refused.status, 1, `--rc-version ${version} without --rc must exit 1`);
    assert.match(`${refused.stderr}\n${refused.stdout}`, new RegExp(`${version.replaceAll(".", "\\.")} stays on the per-PR flow`));
    assert.doesNotMatch(refused.stdout, /self-check ok/, `refused ${version} must not print self-check ok`);
    results.push(`FAILS as expected: --self-check --rc-version ${version} (no --rc) → ${version} stays on the per-PR flow`);
  }
  const down = browserFailureCheck(null, "net::ERR_CONNECTION_REFUSED\n    at goto");
  assert.equal(down.ok, false);
  assert.equal(down.name, "/status unreachable");
  assert.match(down.detail, /ERR_CONNECTION_REFUSED/);
  assert.doesNotMatch(down.detail, /\n/);
  const later = browserFailureCheck("abc123", "page closed");
  assert.equal(later.name, "browser run stopped");
  assert.equal(browserFailureCheck(undefined, "").detail, "no error message");
  results.push("FAILS as expected: /status not read → /status unreachable; a later browser throw is browser run stopped");

  assert.equal(deployedForMainRule(rcSha, other), undefined);
  assert.equal(deployedForMainRule(null, other), other);
  const quietMain = evaluateMain({
    head: { sha: rcSha, gate: "success", committedAt: "2026-10-01T00:00:00Z" },
    v5Commits: [{ sha: rcSha, gate: "success", committedAt: "2026-10-01T00:00:00Z" }],
    deployedFull: undefined,
  });
  assert.ok(!quietMain.results.some((r) => r.name === "staging serves the last green main commit"));
  const behind = evaluateMain({
    head: { sha: rcSha, gate: "success", committedAt: "2026-10-01T00:00:00Z" },
    v5Commits: [{ sha: rcSha, gate: "success", committedAt: "2026-10-01T00:00:00Z" }],
    deployedFull: other,
  });
  assert.ok(behind.results.some((r) => r.name === "staging serves the last green main commit" && r.severity === "FAIL"));
  results.push("passes: an RC sha skips the last-green comparison; a per-PR run still fails when staging is behind");

  const overflow = "foreman@320 /app: document scrollWidth 422px > viewport 320px";
  const merges = [
    { number: 31, sha: "c".repeat(40), subject: "plans (#31)", files: ["v5/src/server/plans.ts"] },
    { number: 24, sha: "d".repeat(40), subject: "fix(v5): phone overflow (#24)", files: ["v5/src/app/layout.tsx", "v5/src/components/app/shell.tsx"] },
  ];
  const named = attributeFailure(overflow, merges);
  assert.deepEqual(named.prs, [24]);
  assert.ok(!named.prs.includes(31));
  const traced = attributeChecks(
    [
      { name: "nav crawl: 4 roles × pages × 320/390/768/1280", ok: false, detail: overflow },
      { name: "/health db ok", ok: true, detail: "ok" },
    ],
    merges,
  );
  assert.match(traced[0].detail, /— PR #24$/);
  assert.ok(!traced[0].detail.includes("#31"), traced[0].detail);
  assert.equal(traced[1].detail, "ok");
  assert.deepEqual(traced[1].prs, []);
  const missed = attributeFailure(overflow, [merges[0]]);
  assert.deepEqual(missed.prs, []);
  assert.match(missed.detail, /no merged PR on the rc changes/);
  const tracedMiss = attributeChecks([{ name: "nav crawl", ok: false, detail: overflow }], [merges[0]]);
  assert.match(tracedMiss[0].detail, /no merged PR on the rc changes/);
  assert.ok(!tracedMiss[0].detail.includes("#31"));
  mustFail("failure traced to the PR that changed the mapped files", [`PR #${named.prs[0]}`]);
  results.push("passes: document scrollWidth names PR #24 (layout.tsx, shell.tsx) and does not name PR #31 (plans.ts)");

  const clipLine = 'foreman@320 /app: clipped money "$1,234.56"';
  const twoMerges = [
    { number: 24, sha: "d".repeat(40), subject: "fix(v5): phone overflow (#24)", files: ["v5/src/app/layout.tsx"] },
    { number: 40, sha: "e".repeat(40), subject: "format money (#40)", files: ["v5/src/components/app/format.tsx"] },
  ];
  const summary = "4/4 page loads, 2 failures; slowest 80 ms (pm@320 /app), budget 1500 ms";
  const combined = `${summary} — ${overflow}; ${clipLine}`;
  const firstRule = attributeFailure(`nav crawl ${combined}`, twoMerges);
  assert.deepEqual(firstRule.prs, [24], `the combined detail must still hit only the first rule; got ${JSON.stringify(firstRule)}`);
  assert.deepEqual(failureSegments(combined), [`${summary} — ${overflow}`, `${summary} — ${clipLine}`]);
  const splitTrace = attributeChecks([{ name: "nav crawl", ok: false, detail: combined }], twoMerges);
  assert.deepEqual(splitTrace[0].prs, [24, 40], `each failure line names its own PR; got ${JSON.stringify(splitTrace[0])}`);
  assert.match(splitTrace[0].detail, /4\/4 page loads, 2 failures; slowest 80 ms \(pm@320 \/app\), budget 1500 ms — foreman@320 \/app: document scrollWidth 422px > viewport 320px — PR #24/);
  assert.match(splitTrace[0].detail, /4\/4 page loads, 2 failures; slowest 80 ms \(pm@320 \/app\), budget 1500 ms — foreman@320 \/app: clipped money "\$1,234\.56" — PR #40/);
  assert.ok(!splitTrace[0].detail.includes("#31"));
  results.push("FAILS as expected: two crawl lines → PR #24 (layout.tsx) and PR #40 (format.tsx), not the first rule alone");

  const unmapped = attributeFailure("portfolio row count was 3", merges);
  assert.deepEqual(unmapped.prs, []);
  assert.equal(unmapped.detail, "no file map for this check");

  const cssOnly = [{ number: 25, sha: "a".repeat(40), subject: "type scale (#25)", files: ["v5/src/app/globals.css"] }];
  for (const [name, text] of [
    ["clipped table header", 'pm@1280 /app: clipped table header "Actual"'],
    ["tap target", "foreman@320 /app: tap target button 20×20px < 44×44 (\"Go\")"],
    ["document scrollWidth", overflow],
  ]) {
    const hit = attributeFailure(text, cssOnly);
    assert.deepEqual(hit.prs, [25], `${name} must name the globals.css PR; got ${JSON.stringify(hit)}`);
    assert.ok(!hit.prs.includes(31));
  }
  const cssTrace = attributeChecks([{ name: "nav crawl", ok: false, detail: 'pm@1280 /app: clipped table header "Actual"' }], cssOnly);
  assert.match(cssTrace[0].detail, /PR #25$/);
  mustFail("clipped failure traced to the PR that only changed globals.css", ["PR #25"]);
  results.push("FAILS as expected: clipped table header, tap target, and document scrollWidth name PR #25 when only globals.css changed");

  const parsed = parseRcMerges(`${"e".repeat(40)}\tMerge pull request #24 from org/branch\n${"f".repeat(40)}\tnotes with no number\nnot-a-sha\tphone overflow (#9)\n${"1".repeat(40)}\tphone overflow (#18)\n`);
  assert.deepEqual(parsed.map((m) => m.number), [24, 18]);

  const added = [{ tag: "0016_rc", when: 16 }];
  const clean = [{ idx: 15, tag: "0015", when: 15 }, { idx: 16, tag: "0016_rc", when: 16 }];
  assert.equal(journalAppliesCleanly(clean), true);
  assert.equal(journalAppliesCleanly([{ when: 20 }, { when: 10 }]), false);
  const outOfOrder = [
    { idx: 20, tag: "0020_schedule_activities", when: 1793030000000 },
    { idx: 23, tag: "0023_later", when: 1793060000000 },
    { idx: 21, tag: "0021_skipped", when: 1793040000000 },
  ];
  const skipped = journalSkipFailures(outOfOrder);
  assert.ok(skipped.includes("0021 would be skipped"), JSON.stringify(skipped));
  mustFail("journal ordered 0020, 0023, 0021", skipped.filter((f) => f === "0021 would be skipped"));
  assert.deepEqual(RESERVED_GAPS, ["0022"]);
  const gap = [
    { idx: 20, tag: "0020_schedule_activities", when: 1793030000000 },
    { idx: 23, tag: "0023_later", when: 1793060000000 },
  ];
  const unreserved = journalSkipFailures(gap);
  mustFail("unreserved journal gap", unreserved);
  assert.deepEqual(unreserved, ["0021 is an unreserved gap"]);
  const reservedGap = [
    { idx: 21, tag: "0021_before_gap", when: 1 },
    { idx: 23, tag: "0023_after_gap", when: 2 },
  ];
  mustPass("reserved journal gap 0022", journalSkipFailures(reservedGap));
  const equalWhen = [
    { idx: 4, tag: "0004_a", when: 100 },
    { idx: 5, tag: "0005_b", when: 100 },
  ];
  const equalWhenFails = journalSkipFailures(equalWhen);
  mustFail("equal journal when would be skipped", equalWhenFails);
  assert.deepEqual(equalWhenFails, ["0005 would be skipped"]);
  const fallingIdx = [
    { idx: 21, tag: "0021_later", when: 1 },
    { idx: 20, tag: "0020_earlier", when: 2 },
  ];
  const falling = journalSkipFailures(fallingIdx);
  mustFail("journal idx is not strictly rising", falling);
  assert.deepEqual(falling, ["0020 idx is not strictly rising"]);
  const dupTag = [
    { idx: 7, tag: "0007_same", when: 1 },
    { idx: 7, tag: "0007_same", when: 2 },
  ];
  mustFail("duplicate journal tag", journalSkipFailures(dupTag).filter((f) => /duplicate tag /.test(f)));
  const dupIdx = [
    { idx: 8, tag: "0008_one", when: 1 },
    { idx: 8, tag: "0008_two", when: 2 },
  ];
  mustFail("duplicate journal idx", journalSkipFailures(dupIdx).filter((f) => /duplicate idx /.test(f)));
  const prefixMiss = [{ idx: 9, tag: "0010_wrong", when: 1 }];
  const prefixFails = journalSkipFailures(prefixMiss);
  mustFail("journal tag prefix does not match idx", prefixFails);
  assert.deepEqual(prefixFails, ["0010 tag prefix 0010 does not match idx 0009"]);
  const appliedAll = outOfOrder.map((e) => e.tag);
  const orderFails = evaluateAppliedJournal({ journal: outOfOrder, statusLabel: appliedAll.join(", "), healthMigrations: appliedAll });
  assert.ok(orderFails.some((f) => f === "0021 would be skipped"), JSON.stringify(orderFails));
  const missingStatus = evaluateAppliedJournal({
    journal: [{ tag: "0020_schedule_activities", when: 1793030000000 }, { tag: "0019_crews_contract", when: 1793020000000 }],
    statusLabel: "0019_crews_contract",
    healthMigrations: ["0019_crews_contract", "0020_schedule_activities"],
  });
  assert.ok(missingStatus.some((f) => /0020_schedule_activities is not applied/.test(f)), JSON.stringify(missingStatus));
  assert.ok(missingStatus.some((f) => /0020 would be skipped|0019 would be skipped/.test(f)) || missingStatus.some((f) => /not applied/.test(f)));
  const statusOnly = evaluateAppliedJournal({
    journal: [{ tag: "0020_schedule_activities", when: 1793030000000 }],
    statusLabel: "0019_crews_contract",
    healthMigrations: ["0020_schedule_activities"],
  });
  mustFail("/status list missing 0020_schedule_activities", statusOnly);
  assert.ok(statusOnly.some((f) => /0020_schedule_activities is not applied on \/status/.test(f)), JSON.stringify(statusOnly));
  const extra = evaluateAppliedJournal({
    journal: [{ tag: "0020_schedule_activities", when: 1793030000000 }],
    statusLabel: "0020_schedule_activities, 0099_extra",
    healthMigrations: ["0020_schedule_activities"],
  });
  assert.ok(extra.some((f) => /\/status applied tag 0099_extra is not in the journal/.test(f)), JSON.stringify(extra));
  const healthMiss = evaluateAppliedJournal({
    journal: [{ tag: "0020_schedule_activities", when: 1793030000000 }],
    statusLabel: "0020_schedule_activities",
    healthMigrations: [],
  });
  assert.ok(healthMiss.some((f) => /0020_schedule_activities is not applied on \/health/.test(f)), JSON.stringify(healthMiss));
  assert.deepEqual(evaluateAppliedJournal({ journal: gap, statusLabel: gap.map((e) => e.tag).join(", "), healthMigrations: gap.map((e) => e.tag) }), ["0021 is an unreserved gap"]);
  assert.deepEqual(evaluateAppliedJournal({ journal: reservedGap, statusLabel: reservedGap.map((e) => e.tag).join(", "), healthMigrations: reservedGap.map((e) => e.tag) }), []);
  const one = [{ idx: 0, tag: "0000_init", when: 1 }];
  const unread = evaluateAppliedJournal({ readError: "journal at abc could not be read: git show failed", journal: one, statusLabel: "0000_init", healthMigrations: ["0000_init"] });
  mustFail("unreadable journal", unread);
  assert.deepEqual(unread, ["journal at abc could not be read: git show failed"]);
  const noStatus = evaluateAppliedJournal({ journal: one, statusLabel: null, healthMigrations: ["0000_init"] });
  mustFail("missing /status migrations label", noStatus.filter((f) => f === "/status applied migrations are missing"));
  assert.deepEqual(noStatus, ["/status applied migrations are missing"]);
  const noHealth = evaluateAppliedJournal({ journal: one, statusLabel: "0000_init" });
  mustFail("/health without migrations", noHealth.filter((f) => f === "/health applied migrations are missing"));
  assert.deepEqual(noHealth, ["/health applied migrations are missing"]);
  const unavail = evaluateAppliedJournal({ journal: one, statusLabel: "unavailable", healthMigrations: "unavailable" });
  mustFail("applied migrations unavailable", unavail.filter((f) => /applied migrations are unavailable/.test(f)));
  assert.deepEqual(unavail, ["/status applied migrations are unavailable", "/health applied migrations are unavailable"]);
  const headJournal = JSON.parse(execFileSync("git", ["show", "HEAD:v5/drizzle/meta/_journal.json"], { cwd: path.resolve(here, "../../.."), encoding: "utf8" }));
  assert.deepEqual(journalSkipFailures(headJournal.entries), []);
  const headTags = headJournal.entries.map((e) => e.tag);
  assert.deepEqual(evaluateAppliedJournal({ journal: headJournal.entries, statusLabel: headTags.join(", "), healthMigrations: headTags }), []);
  const twentyTwo = Array.from({ length: 22 }, (_, i) => ({
    idx: i,
    tag: `${String(i).padStart(4, "0")}_no_gap`,
    when: 1_700_000_000_000 + i,
  }));
  const tags22 = twentyTwo.map((e) => e.tag);
  assert.equal(twentyTwo.length, 22);
  assert.deepEqual(journalSkipFailures(twentyTwo), []);
  mustPass("22-entry journal with no gaps", evaluateAppliedJournal({ journal: twentyTwo, statusLabel: tags22.join(", "), healthMigrations: tags22 }));
  results.push("passes: HEAD journal applies with no skipped entries when every tag is applied; entry count and last tag are not pinned; reserved gap 0022 is allowed; an unreserved gap fails; 0021 out of order would be skipped; a /status list missing 0020 is not applied");
  const verifyJournal = readFileSync(path.join(here, "verify.mjs"), "utf8");
  assert.match(verifyJournal, /evaluateAppliedJournal\(\{/);
  assert.match(verifyJournal, /journal migrations applied in order/);
  assert.match(verifyJournal, /!Array\.isArray\(entries\) \|\| entries\.length === 0/, "empty or missing journal must fail closed");
  assert.match(verifyJournal, /journal at \$\{expectedFull\} is missing or empty/);
  assert.doesNotMatch(verifyJournal, /\.entries \?\? \[\]/);
  assert.doesNotMatch(verifyJournal, /if \(rc\) \{[^}]*status-migrations/s, "status-migrations is read on every run, not only --rc");
  assert.deepEqual(migrationsAdded([{ tag: "0015" }], clean).map((m) => m.tag), ["0016_rc"]);
  const notApplied = evaluateRcMigrations({ added, journal: clean, appliedLabel: "0015", healthOk: true });
  mustFail("rc migration is not applied", notApplied);
  assert.ok(notApplied.some((f) => f.includes("migration 0016_rc is not applied")));
  const unhealthy = evaluateRcMigrations({ added, journal: clean, appliedLabel: "0015, 0016_rc", healthOk: false });
  mustFail("app is not healthy after the rc migrations", unhealthy);
  const stuck = evaluateRcMigrations({ added, journal: [{ when: 20 }, { when: 10, tag: "0016_rc" }], appliedLabel: "0016_rc", healthOk: true });
  mustFail("rc journal timestamps do not strictly increase", stuck);
  assert.deepEqual(evaluateRcMigrations({ added: [], journal: clean, appliedLabel: null, healthOk: false }), []);
  mustPass("rc migrations applied and /health ok", evaluateRcMigrations({ added, journal: clean, appliedLabel: "0015, 0016_rc", healthOk: true }));
  results.push("passes: no added migration does not invent a second health failure");

  const spec = readFileSync(path.join(here, "../../../docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md"), "utf8");
  const items = acceptanceItems(spec);
  for (const section of ["5.0.4-0", "5.0.4-a", "5.0.4-b", "5.0.4-c", "5.0.4-d", "5.0.4-e", "5.0.4-f", "5.0.4-g"]) {
    assert.ok(items.some((item) => item.section === section), `missing acceptance section ${section}`);
  }
  assert.equal(items.filter((item) => item.section === "5.0.4-f").length, 1);
  // Spec now has a numbered check under ### Checks for 5.0.4-f (#78/#80); acceptanceItems uses that title.
  assert.equal(items.find((item) => item.section === "5.0.4-f").title, "Plan lines as cards on phones.");
  assert.deepEqual(acceptanceItems("### Checks for 5.0.4-z\n\nA paragraph with no numbered titles.\n\n## Next\n"), [{ section: "5.0.4-z", title: "Checks for 5.0.4-z" }]);
  const pending = evaluateRcAcceptance(items, ["5.0.4-0"]);
  assert.ok(!pending.some((line) => line.startsWith("5.0.4-0:")));
  assert.ok(pending.some((line) => line.startsWith("5.0.4-a:") && line.includes("not executed")));
  assert.ok(pending.some((line) => line.startsWith("5.0.4-f:") && line.includes("not executed")));
  // skm2b: executed 5.0.4 items count as executed one by one; the field intel and g-3 items stay "not executed".
  {
    const spec80 = readFileSync(path.join(here, "../../../docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md"), "utf8");
    const all = acceptanceItems(spec80);
    const left = evaluateRcAcceptance(all, ["5.0.4-0", ...SPEC504_EXECUTED_ITEMS]);
    assert.ok(all.some((i) => i.section === "5.0.4-i"), "rc/5.0.4 carries the #80 spec (5.0.4-i present)");
    assert.deepEqual(left, [], "every #80 acceptance item is executed (field504.mjs covers d 2/10/3+11 and g-3)");
    assert.ok(evaluateRcAcceptance(all, ["5.0.4-0", ...SPEC504_EXECUTED_ITEMS.filter((x) => x !== "5.0.4-g: State is real.")]).some((l) => /State is real/.test(l)), "an item dropped from the executed list is reported not executed");
    assert.ok(evaluateRcAcceptance(all, ["5.0.4-a: Seeded count."]).every((l) => !l.includes('"Seeded count."')));
  }
  const history = {
    branch: "rc/5.0.4",
    merges,
    added,
    journal: clean,
    spec,
    specPath: "docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md",
  };
  const clip320 = 'pm@320 /app: clipped money "$1"';
  const clip1280 = 'pm@1280 /app: clipped text at 1280px "Actual"';
  const built = buildRcChecks({ history, crawlRan: true, crawlFailures: [overflow, clip320, clip1280], migrationsLabel: "0015", healthOk: true });
  const byName = Object.fromEntries(built.map((c) => [c.name, c]));
  assert.equal(byName["rc migrations apply and the app is healthy"].ok, false);
  assert.match(byName["rc migrations apply and the app is healthy"].detail, /migration 0016_rc is not applied/);
  assert.equal(byName["acceptance 5.0.4-0"].ok, false);
  assert.match(byName["acceptance 5.0.4-0"].detail, /document scrollWidth/);
  assert.ok(!byName["acceptance 5.0.4-0"].detail.includes("not executed"));
  assert.equal(byName["acceptance 5.0.4-a"].ok, false);
  assert.match(byName["acceptance 5.0.4-a"].detail, /not executed/);
  assert.equal(byName["ellipsis/clipping at ≤480"].ok, false);
  assert.match(byName["ellipsis/clipping at ≤480"].detail, /clipped money/);
  assert.ok(!byName["ellipsis/clipping at ≤480"].detail.includes("1280"));
  const idle = buildRcChecks({ history, crawlRan: false, crawlFailures: [], migrationsLabel: "0015, 0016_rc", healthOk: true });
  assert.ok(idle.some((c) => c.name === "acceptance 5.0.4-0" && !c.ok && /not executed/.test(c.detail)));
  assert.ok(idle.some((c) => c.name === "ellipsis/clipping at ≤480" && !c.ok && /nav crawl did not run/.test(c.detail)));
  const stripFail = 'pm@320 /app: job-strip element "I-5 Culvert 24-077" right 373 > clientWidth 320';
  const stripRc = buildRcChecks({ history: { ...history, added: [] }, crawlRan: true, crawlFailures: [stripFail], migrationsLabel: "(none)", healthOk: true });
  const stripItem = stripRc.find((c) => c.name === "acceptance 5.0.4-0");
  assert.equal(stripItem.ok, false);
  assert.match(stripItem.detail, /job-strip element "I-5 Culvert 24-077" right 373 > clientWidth 320/);
  mustFail("acceptance 5.0.4-0 fails when a job-strip element is past clientWidth", [stripItem.detail]);
  const missingStrip = "pm@320 /app: job-strip missing";
  const missRc = buildRcChecks({ history: { ...history, added: [] }, crawlRan: true, crawlFailures: [missingStrip], migrationsLabel: "(none)", healthOk: true });
  const missItem = missRc.find((c) => c.name === "acceptance 5.0.4-0");
  assert.equal(missItem.ok, false);
  assert.match(missItem.detail, /job-strip missing/);
  mustFail("acceptance 5.0.4-0 fails when the job strip is missing", [missItem.detail]);
  const cleanCrawl = buildRcChecks({ history: { ...history, added: [] }, crawlRan: true, crawlFailures: [clip1280], migrationsLabel: "(none)", healthOk: true });
  assert.equal(cleanCrawl.find((c) => c.name === "acceptance 5.0.4-0").ok, true);
  assert.equal(cleanCrawl.find((c) => c.name === "ellipsis/clipping at ≤480").ok, true);
  assert.equal(cleanCrawl.find((c) => c.name === "rc migrations apply and the app is healthy").ok, true);
  assert.ok(cleanCrawl.some((c) => c.name === "acceptance 5.0.4-g" && !c.ok));
  results.push("passes: 5.0.4-0 is executed by the crawl; 5.0.4-a through 5.0.4-g stay not executed; a desktop clip is not the ≤480 check");

  const sha = "9".repeat(40);
  const foundRepo = specFixture(true);
  const calls = [];
  const git = (args) => {
    calls.push(args.join(" "));
    if (args[0] === "log") {
      assert.deepEqual(args.slice(0, 3), ["log", "--first-parent", "--format=%H%x09%s"]);
      return `${"e".repeat(40)}\tMerge pull request #24 from org/phone\n${"f".repeat(40)}\tchore: notes\n${"1".repeat(40)}\tplans (#31)\n`;
    }
    if (args[0] === "diff") return args[2].startsWith("e") ? "v5/src/app/layout.tsx\nv5/src/components/app/shell.tsx\n" : "v5/src/server/plans.ts\n";
    if (args[0] === "show" && args[1].startsWith("origin/main:")) return JSON.stringify({ entries: [{ tag: "0015", when: 15 }] });
    if (args[0] === "show" && args[1] === `${sha}:v5/drizzle/meta/_journal.json`) return JSON.stringify({ entries: clean });
    if (args[0] === "ls-tree" || (args[0] === "show" && String(args[1]).includes(":docs/"))) {
      const forwarded = args.map((part) => part.replaceAll(sha, foundRepo.sha));
      return execFileSync("git", forwarded, { cwd: foundRepo.dir, encoding: "utf8" });
    }
    throw new Error(args.join(" "));
  };
  let hist;
  try {
    hist = readRcHistory({ sha, git });
  } finally {
    rmSync(foundRepo.dir, { recursive: true, force: true });
  }
  assert.deepEqual(hist.merges.map((m) => m.number), [24, 31]);
  assert.deepEqual(hist.merges[0].files, ["v5/src/app/layout.tsx", "v5/src/components/app/shell.tsx"]);
  assert.deepEqual(hist.added.map((m) => m.tag), ["0016_rc"]);
  assert.equal(hist.specPath, "docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md");
  assert.match(hist.spec, /### Acceptance check for 5\.0\.4-0/);
  assert.ok(calls.some((c) => c === `ls-tree -r --name-only ${sha} docs/v5/specs/`), calls.join("\n"));
  assert.ok(calls.some((c) => c.startsWith("log --first-parent")));
  results.push("passes: readRcHistory lists merged PRs #24 and #31 and the migration added over main");

  const present = specFixture(true);
  const absent = specFixture(false);
  try {
    const presentGit = (args) => execFileSync("git", args, { cwd: present.dir, encoding: "utf8" });
    const found = readRcHistory({ sha: present.sha, git: presentGit, mainRef: "main" });
    assert.equal(found.specPath, "docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md");
    assert.match(found.spec, /### Acceptance check for 5\.0\.4-0/);
    const directoryOnly = execFileSync("git", ["ls-tree", "--name-only", present.sha, "docs/v5/specs"], { cwd: present.dir, encoding: "utf8" }).trim();
    assert.equal(directoryOnly, "docs/v5/specs", "without -r or a trailing slash, git lists the directory and the spec file is missed");
    const absentGit = (args) => execFileSync("git", args, { cwd: absent.dir, encoding: "utf8" });
    const missing = readRcHistory({ sha: absent.sha, git: absentGit, mainRef: "main" });
    assert.equal(missing.specPath, null);
    assert.equal(missing.spec, "");
    const noSpec = buildRcChecks({ history: missing, crawlRan: false, crawlFailures: [], migrationsLabel: "(none)", healthOk: true });
    const acceptance = noSpec.find((c) => c.name === "rc acceptance items");
    assert.ok(acceptance && !acceptance.ok, JSON.stringify(noSpec));
    assert.match(acceptance.detail, /no spec at this SHA/);
    mustFail("no spec at this SHA", [acceptance.detail]);
  } finally {
    rmSync(present.dir, { recursive: true, force: true });
    rmSync(absent.dir, { recursive: true, force: true });
  }
  results.push("passes: real git ls-tree -r finds docs/v5/specs/5.0.4-*.md at the SHA");

  const verify = path.join(here, "verify.mjs");
  const repo = path.resolve(here, "../../..");
  const smoke = execFileSync(process.execPath, [verify, "--self-check", "--rc", rcSha], { encoding: "utf8", cwd: repo });
  assert.equal(smoke, `self-check ok expected=${rcSha} rc=5.0.4 branch=rc/5.0.4\n`);
  results.push(`passes: --self-check --rc prints the rc head (${smoke.trim()})`);
  const plain = execFileSync(process.execPath, [verify, "--self-check"], { encoding: "utf8", cwd: repo });
  assert.match(plain, /^self-check ok expected=[0-9a-f]{40}\n$/);
  assert.ok(!plain.includes(" rc="));
  const refuse = (argv, pattern) => {
    let failed = false;
    try {
      execFileSync(process.execPath, [verify, ...argv], { encoding: "utf8", cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      failed = true;
      assert.equal(error.status, 1, argv.join(" "));
      assert.match(`${error.stderr ?? ""}`, pattern, argv.join(" "));
    }
    assert.ok(failed, `expected exit 1 for ${argv.join(" ")}`);
  };
  refuse(["--self-check", "--rc", rcSha, "--rc-version", "5.0.2"], /5\.0\.2 stays on the per-PR flow/);
  refuse(["--self-check", "--rc", rcSha, "--rc-version", "5.0.3"], /5\.0\.3 stays on the per-PR flow/);
  refuse(["--self-check", "--rc", "abc"], /full 40-char/);
  refuse(["--self-check", "--rc", rcSha, "--commit", other], /disagrees/);
  refuse(["--self-check", "--rc", rcSha, "--url", "https://demo.pcserp.app"], /production keeps the release-tag/);
  results.push("passes: verify.mjs --rc refuses 5.0.2, 5.0.3, a short SHA, a disagreeing --commit, and production");
}

// ---- ConfirmDialog (PR #65): confirm only when present; a dialog that cannot be confirmed throws ----
{
  assert.equal(CONFIRM_DIALOG_ROLE, "alertdialog");
  assert.equal(CONFIRM_DIALOG_CONFIRM, "confirm-dialog-confirm");
  assert.equal(CONFIRM_DIALOG_CANCEL, "confirm-dialog-cancel");
  const D = (o) => confirmDecision({ dialogVisible: false, settledVisible: false, elapsedMs: 0, budgetMs: 1000, hasSettled: true, ...o });
  assert.equal(D({ dialogVisible: true }), "confirm");
  assert.equal(D({ dialogVisible: true, settledVisible: true }), "confirm", "dialog wins over settled");
  assert.equal(D({ dialogVisible: true, elapsedMs: 5000 }), "confirm");
  assert.equal(D({ settledVisible: true }), "settled");
  assert.equal(D({ settledVisible: true, hasSettled: false }), "wait", "no settled locator: settled is ignored");
  assert.equal(D({ elapsedMs: 999 }), "wait");
  assert.equal(D({ elapsedMs: 1000 }), "timeout");
  assert.equal(D({ elapsedMs: 1000, hasSettled: false }), "absent");

  // Fake page on a fake clock. dialogAt / settledAt: ms after the click when each becomes visible.
  const fake = ({ dialogAt = null, settledAt = null, confirm = "ok", hides = true, visibleThrows = [] } = {}) => {
    let t = 0;
    let closed = false;
    let polls = 0;
    const calls = { confirm: 0, cancel: 0, waitHidden: 0 };
    const dialog = {
      isVisible: async () => {
        const err = visibleThrows[polls++];
        if (err) throw new Error(err);
        return dialogAt !== null && t >= dialogAt && !closed;
      },
      getByTestId: (id) => ({
        click: async () => {
          if (id === CONFIRM_DIALOG_CANCEL) calls.cancel++;
          if (id !== CONFIRM_DIALOG_CONFIRM) return;
          calls.confirm++;
          if (confirm === "throw") throw new Error("locator.click: Timeout 30000ms exceeded.\n  waiting for getByTestId('confirm-dialog-confirm')");
          if (hides) closed = true;
        },
      }),
      waitFor: async ({ state }) => {
        calls.waitHidden++;
        if (state === "hidden" && (closed || dialogAt === null)) return;
        throw new Error("locator.waitFor: Timeout 30000ms exceeded.");
      },
    };
    const page = {
      getByRole: (role) => {
        assert.equal(role, "alertdialog");
        return dialog;
      },
    };
    const settled = { isVisible: async () => settledAt !== null && t >= settledAt };
    return { page, settled, calls, clock: { now: () => t, sleep: async (ms) => { t += ms; } }, at: () => t };
  };
  const opts = (f, o = {}) => ({ timeout: 30000, ...f.clock, ...o });

  // Main before #65: the click posts, the approved card shows, the confirm button is never clicked.
  let f = fake({ settledAt: 400 });
  let r = await confirmIfDialog(f.page, opts(f, { settled: f.settled }));
  assert.deepEqual([r.dialog, r.outcome, f.calls.confirm, f.calls.waitHidden], [false, "settled", 0, 0]);
  assert.equal(r.waitedMs, 400);

  // #65: the dialog opens, confirm is clicked exactly once, then the dialog must hide.
  f = fake({ dialogAt: 200 });
  r = await confirmIfDialog(f.page, opts(f, { settled: f.settled }));
  assert.deepEqual([r.dialog, f.calls.confirm, f.calls.cancel, f.calls.waitHidden], [true, 1, 0, 1]);

  // Both visible on the same poll (dialog over an already-updated card): still confirm.
  f = fake({ dialogAt: 100, settledAt: 100 });
  r = await confirmIfDialog(f.page, opts(f, { settled: f.settled }));
  assert.deepEqual([r.dialog, f.calls.confirm], [true, 1]);

  // A dialog that appears but whose confirm click fails must throw, never fall through.
  f = fake({ dialogAt: 100, confirm: "throw" });
  await assert.rejects(confirmIfDialog(f.page, opts(f, { settled: f.settled })), /ConfirmDialog appeared but its confirm click failed: locator\.click: Timeout/);
  assert.equal(f.calls.confirm, 1);

  // Confirm clicked but the dialog stays open: throw.
  f = fake({ dialogAt: 100, hides: false });
  await assert.rejects(confirmIfDialog(f.page, opts(f, { settled: f.settled })), /confirm was clicked, but the dialog did not hide/);

  // Settled given, neither the dialog nor the post within the timeout: throw (the #65 30 s timeout, named).
  f = fake();
  await assert.rejects(confirmIfDialog(f.page, opts(f, { settled: f.settled, timeout: 1500 })), /neither the dialog nor the posted state appeared within 1500 ms/);
  assert.equal(f.calls.confirm, 0);

  // No settled locator: a bounded grace wait, then absent (the caller's own wait proves the post).
  f = fake();
  r = await confirmIfDialog(f.page, opts(f));
  assert.deepEqual([r.dialog, r.outcome], [false, "absent"]);
  assert.ok(r.waitedMs >= CONFIRM_GRACE_MS && r.waitedMs < CONFIRM_GRACE_MS + 200, `grace wait ${r.waitedMs} ms`);
  f = fake({ dialogAt: 1500 });
  r = await confirmIfDialog(f.page, opts(f));
  assert.deepEqual([r.dialog, f.calls.confirm], [true, 1], "a dialog inside the grace window is confirmed");

  // A read that throws mid-navigation is one not-visible poll; a strict-mode violation is rethrown.
  f = fake({ dialogAt: 0, visibleThrows: ["Execution context was destroyed"] });
  r = await confirmIfDialog(f.page, opts(f, { settled: f.settled }));
  assert.deepEqual([r.dialog, f.calls.confirm], [true, 1]);
  f = fake({ dialogAt: 0, visibleThrows: ["strict mode violation: getByRole('alertdialog') resolved to 2 elements"] });
  await assert.rejects(confirmIfDialog(f.page, opts(f, { settled: f.settled })), /strict mode violation/);

  // watchForDialog alone never clicks anything (the must-fail probes use it to leave the dialog open).
  f = fake({ dialogAt: 300 });
  const w = await watchForDialog(f.page, opts(f, { settled: f.settled }));
  assert.deepEqual([w.outcome, w.waitedMs, f.calls.confirm, f.calls.cancel], ["dialog", 300, 0, 0]);

  // Every skill drive that clicks a confirmed action calls confirmIfDialog right after the click.
  // PR #65: CO approve/reject/void, plan-line remove, plan approve/return. PR #71: Approve estimate
  // (approve-estimate) and Lock Period (lock-claim) on the job page.
  const TRIGGER = /co-(approve|reject|void)\b|remove-plan-line|approve-report|return-report|approve-estimate|lock-claim|name: \/\^(Approve|Reject|Void|Remove)\$\/|name: \/\^?(Approve estimate|Lock( Period| \\w)?)|name: "(Approve report|Return to foreman|Remove|Reject|Void|Approve estimate|Lock Period[^"]*)"|getByText\("(Approve estimate|Lock Period[^"]*)"\)/;
  const scanDrive = (src) => {
    const lines = src.split("\n");
    const out = { triggers: 0, bypass: [] };
    lines.forEach((line, i) => {
      if (!TRIGGER.test(line) || !line.includes(".click(")) return;
      out.triggers++;
      if (!/await confirmIfDialog\(page,/.test(lines.slice(i + 1, i + 4).join("\n"))) out.bypass.push(i + 1);
    });
    return out;
  };
  // The scan itself must catch a bypass (bad twin) and pass the routed drive (good twin), for each #71 trigger.
  const twins = [
    ['await page.getByTestId("approve-estimate").click();', "Approve estimate (test id)"],
    ['await page.getByTestId("lock-claim").click();', "Lock Period (test id)"],
    ['await page.getByRole("button", { name: /^Approve estimate$/ }).click();', "Approve estimate (role name)"],
    ['await page.getByRole("button", { name: "Lock Period 2" }).click();', "Lock Period (role name)"],
    ['await page.getByRole("button", { name: /^Lock Period 2$/ }).click();', "Lock Period (role regex)"],
  ];
  for (const [click, label] of twins) {
    const bad = scanDrive(`    ${click}\n    await page.waitForFunction(() => true, null, { timeout: T });\n`);
    assert.deepEqual([bad.triggers, bad.bypass.length], [1, 1], `scan must flag a ${label} click that bypasses confirmIfDialog`);
    const good = scanDrive(`    ${click}\n    await confirmIfDialog(page, { settled: s, timeout: T });\n`);
    assert.deepEqual([good.triggers, good.bypass.length], [1, 0], `scan must pass a ${label} click routed through confirmIfDialog`);
  }
  const drives = readdirSync(here).filter((n) => n.endsWith(".mjs") && !n.endsWith(".test.mjs") && !n.endsWith(".mustfail.mjs") && n !== "confirm-dialog.mjs");
  assert.ok(drives.includes("numbers.mjs") && !drives.includes("job-confirm.mustfail.mjs"), "drive list: numbers.mjs in, must-fail probes out");
  let triggers = 0;
  const kinds = new Set();
  for (const name of drives) {
    const src = readFileSync(path.join(here, name), "utf8");
    const r = scanDrive(src);
    triggers += r.triggers;
    for (const k of ["approve-estimate", "lock-claim", "co-card"]) if (src.includes(k)) kinds.add(k);
    assert.deepEqual(r.bypass, [], `${name}: line(s) ${r.bypass.join(", ")} click a confirmed action without confirmIfDialog`);
  }
  assert.ok(triggers >= 2, "the CO-001 approve drive and the M2 Approve estimate drive in numbers.mjs are found by the trigger scan");
  assert.ok(kinds.has("approve-estimate"), "the M2 Approve estimate click is in a scanned drive");
  const numbersSrc = readFileSync(path.join(here, "numbers.mjs"), "utf8");
  assert.match(
    numbersSrc,
    /await card\.getByRole\("button", \{ name: \/\^Approve\$\/ \}\)\.click\(\);\n.*\n    await confirmIfDialog\(page, \{ settled: byLabel\(page\.locator\('\[data-testid="co-card"\]\[data-status="approved"\]'\)\)\.first\(\), timeout: T \}\);\n    await byLabel\(page\.locator\('\[data-testid="co-card"\]\[data-status="approved"\]'\)\)\.first\(\)\.waitFor\(\{ timeout: T \}\);/,
  );
  // M2: confirm, then the unchanged approved-status wait (the M2 pass rule lives in evaluateM2, untouched).
  assert.match(
    numbersSrc,
    /await page\.getByTestId\("approve-estimate"\)\.click\(\);\n.*\n    await confirmIfDialog\(page, \{ settled: page\.locator\('\[data-testid="estimate-status"\]\[data-status="approved"\]'\), timeout: T \}\);\n    await page\.waitForFunction\(\n      \(\) => document\.querySelector\('\[data-testid="estimate-status"\]'\)\?\.getAttribute\("data-status"\) === "approved",/,
  );
  results.push(`passes: confirmIfDialog confirms only a present ConfirmDialog, throws when confirm fails or the dialog stays, ${triggers} confirmed-action click(s) in the drives call it (incl. M2 Approve estimate), the scan flags ${twins.length} Approve estimate / Lock Period bypass twins`);
}

// ---- journey tap rule: a ConfirmDialog confirm click confirmIfDialog saw open is not a tap (once per action) ----
{
  assert.equal(JOURNEY_TAP_LIMIT, 3);
  const tap = (label) => ({ kind: "tap", label });
  const conf = (action, o = {}) => ({ kind: "confirm", action, sawOpen: true, role: "alertdialog", label: `confirm ${action}`, ...o });
  const real = [tap("role card pm"), tap("25-031"), tap("co-approve CO-001")];
  // control: 3 real taps + the one confirm of a dialog that was seen open → 3 counted, 1 excluded
  let c = countJourneyTaps([...real, conf("co-approve CO-001")]);
  assert.deepEqual([c.counted, c.excluded.map((e) => e.label)], [3, ["confirm co-approve CO-001"]]);
  assert.deepEqual(evaluateJourneyTaps([...real, conf("co-approve CO-001")]), []);
  assert.deepEqual(evaluateJourneyTaps(real), [], "no dialog (before #65/#71): 3 taps pass");
  assert.equal(countJourneyTaps([...real, conf("x", { role: "dialog" })]).counted, 3, "role=dialog is a dialog too");
  // (e) one extra non-confirm tap still FAILs, with or without the excluded confirm (no blanket +1)
  assert.match(evaluateJourneyTaps([real[0], tap("user menu (extra)"), ...real.slice(1)]).join(), /4 counted taps > 3/);
  assert.match(evaluateJourneyTaps([real[0], tap("user menu (extra)"), ...real.slice(1), conf("co-approve CO-001")]).join(), /4 counted taps > 3/);
  // (f) a second confirm click on the same action is counted
  c = countJourneyTaps([...real, conf("co-approve CO-001"), conf("co-approve CO-001", { label: "confirm again" })]);
  assert.deepEqual([c.counted, c.excluded.length], [4, 1]);
  assert.match(evaluateJourneyTaps([...real, conf("a"), conf("a")]).join(), /4 counted taps > 3 .*confirm a/);
  // a confirm the helper did not see open, or not on a dialog role, or with no action id, is an ordinary tap
  for (const bad of [conf("a", { sawOpen: false }), conf("a", { role: "button" }), conf("a", { role: undefined }), conf("", {}), { kind: "tap", label: "confirm-looking tap", action: "a", sawOpen: true, role: "alertdialog" }]) {
    assert.equal(countJourneyTaps([...real, bad]).counted, 4, `not exempt: ${JSON.stringify(bad)}`);
  }
  // one exemption per action, not per journey: two different confirmed actions each drop one click
  assert.equal(countJourneyTaps([tap("a"), conf("x"), conf("y")]).counted, 1);
  // journeys.mjs: the real path routes the trigger through confirmIfDialog and logs only what it saw open
  const js = readFileSync(path.join(here, "journeys.mjs"), "utf8");
  assert.match(js, /await log\.tap\(t\.locator, t\.action\);[\s\S]{0,1200}const r = await confirmIfDialog\(page, \{ settled: t\.settled, timeout: T \}\);\n\s*dialog = r\.dialog;\n\s*log\.confirmed\(t\.action, r\);/);
  assert.match(js, /if \(r\.dialog\) entries\.push\(\{ kind: "confirm", action, sawOpen: true/);
  results.push("passes: journey taps exclude only one seen-open ConfirmDialog confirm per action; FAILS as expected: one extra tap (4 > 3), a second confirm on the same action (4 > 3), unseen/non-dialog confirms counted");
}

// ---- every skill test is named in the Run-it block and in a ci.yml job ----
{
  const repo = path.resolve(here, "../../..");
  const skill = readFileSync(path.join(here, "SKILL.md"), "utf8");
  const runIt = skill.split("## Run it")[1]?.split(/^## /m)[0] ?? "";
  const ci = readFileSync(path.join(repo, ".github/workflows/ci.yml"), "utf8");
  const tests = readdirSync(here).filter((name) => name.endsWith(".test.mjs")).sort();
  assert.ok(tests.includes("stress-seed-mustfail.test.mjs"));
  assert.ok(runIt.includes("stress-seed-mustfail.test.mjs"), "Run-it must list stress-seed-mustfail");
  assert.match(skill, /verify-v5 must-fail browser/);
  assert.match(skill, /verify-v5-mustfail/);
  assert.doesNotMatch(skill, /verify-v5-skill` job runs it \(with the crawl and portfolio must-fail files\)/);
  for (const name of tests) {
    assert.ok(runIt.includes(name), `${name} must be named in the SKILL.md Run-it block`);
    assert.ok(ci.includes(name), `${name} must be named in a ci.yml job`);
  }
  assert.match(skill, /pass \(stale/);
  assert.match(skill, /nothing may create, start, or stop a container/);
  results.push(`passes: ${tests.length} skill tests are named in Run-it and in ci.yml; stale ci-gate and staging run conditions are documented`);
}

for (const line of results) console.log(line);
console.log(`ok: checks.test.mjs (${results.length} cases)`);

// ---- Dockerfile pin tracks v5/package-lock.json @playwright/test ----
{
  const docker = readFileSync(path.join(here, "Dockerfile"), "utf8");
  const lock = JSON.parse(readFileSync(path.join(here, "../../../v5/package-lock.json"), "utf8"));
  const pw = lock.packages["node_modules/@playwright/test"].version;
  const from = docker.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:[0-9a-f]{64}$/m);
  assert.ok(from, "Dockerfile must pin the playwright image by tag and digest");
  assert.equal(from[1], pw, `Dockerfile playwright v${from[1]} must equal package-lock @playwright/test ${pw}`);
  assert.match(docker, /fonts-dejavu-core/);
  assert.match(docker, /faketime/);
  console.log(`ok: Dockerfile pins playwright v${pw} by digest with fonts-dejavu-core + faketime`);
}

// ---- 5.0.4-c check 5 (main 4c9d3539): no text-amber-/text-red-/text-green-/bg-amber- under v5/src/{components,app} ----
{
  assert.equal(STATUS_COLOR_PATTERN, "text-(amber|red|green)-|bg-amber-");
  const repo = mkdtempSync(path.join(os.tmpdir(), "pv-c5-"));
  const g = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  g(["init", "-q"]);
  const put = (rel, body) => { mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); writeFileSync(path.join(repo, rel), body); };
  const commit = (msg) => { g(["add", "-A"]); g(["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", msg]); return g(["rev-parse", "HEAD"]).trim(); };
  put("v5/src/components/app/cost-table.tsx", 'export const A = <span className="text-caution">0.93</span>;\n');
  put("v5/src/lib/elsewhere.ts", 'export const outOfScope = "text-red-500";\n'); // outside the two dirs: not a hit
  const clean = commit("tokens only");
  const cleanHits = readStatusColorHits({ sha: clean, git: g });
  assert.deepEqual(cleanHits, [], "control: status tokens only must have 0 hits");
  assert.equal(statusColorCheck(cleanHits).ok, true);
  for (const [cls, rel] of [["text-amber-700 dark:text-amber-400", "v5/src/components/app/cost-table.tsx"], ["text-red-600", "v5/src/app/app/jobs/[number]/cost-items/[code]/page.tsx"], ["text-green-700", "v5/src/components/x.tsx"], ["bg-amber-50", "v5/src/app/y.tsx"]]) {
    put(rel, `export const B = <span className="${cls}">0.93</span>;\n`);
    const bad = commit(`mutant ${cls}`);
    const hits = readStatusColorHits({ sha: bad, git: g });
    const c = statusColorCheck(hits);
    assert.equal(c.ok, false, `mutant ${cls} in ${rel} must FAIL; got ${JSON.stringify(c)}`);
    assert.ok(hits.some((h) => h.startsWith(`${rel}:`)), `hit names ${rel}; got ${JSON.stringify(hits)}`);
    put(rel, 'export const B = <span className="text-caution">0.93</span>;\n');
    commit(`revert ${cls}`);
  }
  assert.equal(statusColorCheck(null, "boom").ok, false, "a grep that did not run is a FAIL, not a pass");
  rmSync(repo, { recursive: true, force: true });
  console.log("passes: 5.0.4-c check 5 control (tokens only, a hit outside v5/src/{components,app} ignored); FAILS as expected: text-amber-, text-red-, text-green-, bg-amber- mutants; a grep that did not run fails");
}

// ---- 5.0.4-a checks 1, 5, 9 (main 4c9d3539) on /app next-step labels ----
{
  assert.deepEqual(NEXT_STEP_VERBS, ["Submit", "Report", "Approve", "Review", "Decide", "Open"]);
  const step = (label, top = 200) => ({ label, href: "/app/jobs/25-031", visible: true, top, viewportH: 844 });
  // Control: the label templates in rc/5.0.4 v5/src/server/next-steps.ts (a83dcb1c), filled with seed values.
  const control = [
    "Submit tomorrow's plan: Bridge Crew 2 on 25-031",
    "Approve 1 daily report: Interchange Crew 1 on 24-118",
    "Report today's quantities for Culvert Crew (24-077)",
    "Approve CO-001 on 25-031: $60,000.00",
    "Approve the estimate for Harbor (26-010)",
    "Review the forecast on 07-300 (24-077): spending more than it earns",
    "Open I-5 Culvert (24-077): $255K over cost",
    "Decide CO-002 on 24-118: $1,250.50",
  ];
  const OK200 = { "/app/jobs/25-031": 200 };
  for (const width of [320, 390, 1280]) {
    const row = { role: "pm", width, path: "/app", nextSteps: control.map((l) => step(l)), nextStepCount: control.length, nextStepHrefStatus: OK200 };
    assert.deepEqual(evaluateNextSteps(row), [], `control labels at ${width}`);
  }
  const one = (label, width = 390, extra = {}) => evaluateNextSteps({ role: "pm", width, path: "/app", nextSteps: [step(label)], nextStepCount: 1, nextStepHrefStatus: OK200, ...extra });
  const mf = (name, f, re) => assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`);
  mf("a-5 verb outside the set", one("Check the Cedar plan on 25-031"), /check 5: .* starts with "Check"/);
  mf("a-5 lower-case verb", one("submit tomorrow's plan: Bridge Crew 2 on 25-031"), /check 5: .* starts with "submit"/);
  mf("a-5 at 320 too", one("Go to 25-031", 320), /check 5/);
  mf("a-9 no job number", one("Submit tomorrow's plan: Bridge Crew 2"), /check 9: .* has no job number/);
  mf("a-9 CO short money", one("Approve CO-001 on 25-031: $60K"), /check 9: .* has no exact amount/);
  mf("a-9 CO no cents", one("Decide CO-001 on 25-031: $60,000", 1280), /check 9: .* has no exact amount/);
  assert.deepEqual(one("Submit tomorrow's plan: Bridge Crew 2", 320), [], "a-9 is scoped to 390 and 1280 (spec sizes); check 5 still runs at 320");
  mf("a-1 none above the fold", evaluateNextSteps({ role: "pm", width: 320, path: "/app", nextSteps: [step("Submit plan on 25-031", 900)], nextStepCount: 1 }), /check 1: 0 next-step above the fold/);
  mf("a-1 no next steps", evaluateNextSteps({ role: "pm", width: 1280, path: "/app", nextSteps: [], nextStepCount: 0 }), /check 1: 0 next-step above the fold/);
  // a-1 href clause (lead review of #84): every next-step href answers 200 in the crawl.
  mf("a-1 href 404", one(control[0], 390, { nextStepHrefStatus: { "/app/jobs/25-031": 404 } }), /check 1: .* href \/app\/jobs\/25-031 answered 404 \(want 200\)/);
  mf("a-1 href redirect", one(control[0], 390, { nextStepHrefStatus: { "/app/jobs/25-031": 307 } }), /answered 307/);
  mf("a-1 href not requested", one(control[0], 390, { nextStepHrefStatus: undefined }), /check 1: .* href \/app\/jobs\/25-031 not requested/);
  mf("a-1 next step without href", evaluateNextSteps({ role: "pm", width: 390, path: "/app", nextSteps: [{ ...step(control[0]), href: null }], nextStepCount: 1, nextStepHrefStatus: {} }), /check 1: .* has no href/);
  mf("unread next steps", evaluateNextSteps({ role: "pm", width: 1280, path: "/app", nextSteps: [step(control[0])], nextStepCount: 40 }), /40 next-step elements, only 1 read/);
  assert.deepEqual(evaluateNextSteps({ role: "pm", width: 390, path: "/app/jobs/25-031", nextSteps: [step("bad")] }), [], "only /app");
  console.log("passes: 5.0.4-a checks 1/5/9 control (rc next-steps.ts label templates at 320/390/1280); FAILS as expected: verb outside the set, lower-case verb, no job number, CO short money, CO without cents, none above the fold, unread next steps");
}

// ---- 5.0.4 theme/size pass (main 4c9d3539 "Mobile and layout checks"): 320×568, 390×844, 1280×800 × light/dark ----
{
  assert.deepEqual(SPEC_504_SIZES, [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1280, height: 800 }]);
  assert.deepEqual(SPEC_504_THEMES, ["light", "dark"]);
  assert.equal(THEME_COOKIE, "pcs_theme");
  assert.deepEqual(contextFor(320, 568, "dark").viewport, { width: 320, height: 568 });
  assert.equal(contextFor(320, 568, "dark").colorScheme, "dark");
  assert.deepEqual(contextFor(1280, 800).viewport, { width: 1280, height: 800 });
  assert.deepEqual(contextFor(390), { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, "the main nav crawl context is unchanged");
  assert.deepEqual(contextFor(1280), { viewport: { width: 1280, height: 900 } }, "the main nav crawl context is unchanged");
  assert.equal(spec504LoadCount(["/app", "/status"]), 4 * 3 * 2);
  const r = (theme, htmlTheme) => ({ role: "pm", width: 390, height: 844, path: "/app", theme, htmlTheme });
  assert.deepEqual(themeFailures([r("dark", "dark"), r("light", "light"), { role: "pm", width: 390, path: "/app" }]), []);
  assert.ok(/page rendered light, pass is dark/.test(themeFailures([r("dark", "light")])[0] ?? ""), "dark pass on a light page must FAIL");
  assert.ok(/theme not recorded/.test(themeFailures([r("dark", undefined)])[0] ?? ""), "an unrecorded theme must FAIL");
  const vsrc = readFileSync(path.join(here, "verify.mjs"), "utf8");
  assert.match(vsrc, /if \(phoneChecks\) \{\n\s+await step\("5\.0\.4 crawl: 4 roles × 320×568\/390×844\/1280×800 × light\/dark"/, "the 5.0.4 pass runs when phone checks are on");
  assert.match(vsrc, /failures\.length === 0 && rows\.length === want/, "the 5.0.4 pass needs every load and 0 failures");
  console.log("passes: 5.0.4 theme/size pass constants, contexts (main nav crawl unchanged), load count; FAILS as expected: dark pass on a light page, unrecorded theme");
}

// ---- 5.0.4 axe evaluators (c-4, c-8, i-3, i-4) ----
{
  assert.deepEqual(C8_TAGS, ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  assert.deepEqual(AXE_PASSES["c-8"].sizes, [{ width: 1440, height: 900 }, { width: 390, height: 844 }]);
  assert.deepEqual(AXE_PASSES["c-8"].pages, ["/app/jobs/24-077", "/app/jobs/26-010", "/app/jobs/24-077/cost-items/07-300"]);
  assert.deepEqual(AXE_PASSES["i-3"].pages, ["/app/jobs/26-010"]);
  assert.deepEqual(AXE_PASSES["i-4"].roles, ["pm", "executive", "superintendent"]);
  assert.deepEqual(AXE_PASSES["i-4"].sizes, [{ width: 1440, height: 900 }]);
  assert.deepEqual(AXE_PASSES["i-4"].pages, ["/app/jobs/24-077", "/app/jobs/24-118", "/app/jobs/25-031"]);
  for (const n of ["Collapse 02 Earthwork", "Expand 03 Concrete"]) assert.ok(TOGGLE_NAME.test(n), n);
  for (const n of ["Expand", "Collapse", "", "Expand 02", "collapse 02 Earthwork"]) assert.ok(!TOGGLE_NAME.test(n), `"${n}" must not pass`);
  const ok = { role: "pm", width: 390, height: 844, theme: "dark", path: "/app/jobs/26-010", status: 200, htmlTheme: "dark", violations: [], toggles: ["Collapse 02 Earthwork"] };
  assert.deepEqual(evaluateAxeRows([ok], { toggles: true }), []);
  const mf = (name, rows, re, opts) => { const f = evaluateAxeRows(rows, opts); assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); };
  mf("one violation", [{ ...ok, violations: [{ id: "color-contrast", impact: "serious", count: 1, targets: ["p"] }] }], /axe color-contrast \(serious\) × 1/);
  mf("axe did not run", [{ ...ok, violations: undefined }], /axe did not run/);
  mf("wrong theme", [{ ...ok, htmlTheme: "light" }], /page rendered light, pass is dark/);
  mf("HTTP 500", [{ ...ok, status: 500 }], /HTTP 500/);
  mf("load threw", [{ ...ok, error: "timeout" }], /timeout/);
  mf("toggle named Expand", [{ ...ok, toggles: ["Expand"] }], /tree toggle name "Expand"/, { toggles: true });
  mf("no toggles", [{ ...ok, toggles: [] }], /no visible cost-tree toggle/, { toggles: true });
  const missing = loadAxeSource(mkdtempSync(path.join(os.tmpdir(), "pv-noaxe-")));
  assert.ok(missing.error && /axe-core not loadable/.test(missing.error), "no axe-core is an error, not a skip");
  const vsrc = readFileSync(path.join(here, "verify.mjs"), "utf8");
  assert.match(vsrc, /const failures = axe\.error \? \[axe\.error\]/, "a missing axe-core FAILS the axe checks");
  console.log("passes: 5.0.4 axe pass definitions match c-8/i-3/i-4 as written; FAILS as expected: a violation, axe not run, wrong theme, HTTP 500, a load error, an 'Expand' toggle, no toggles, axe-core missing");
}

// ---- 5.0.4-a check 7, 5.0.4-b checks 1, 6, 7 ----
{
  assert.equal(PURPOSE_MIN_CHARS, 10);
  assert.equal(PURPOSE_MAX_CHARS, 90);
  const purpose = (text, o = {}) => ({ text, len: text.length, scrollWidth: 280, clientWidth: 280, ellipsis: false, fontPx: 14, ...o });
  const good = (width, o = {}) => ({ role: "foreman", width, path: "/app/jobs/24-077", titles: { h1Count: 1, h1Texts: ["I-5 Culvert"], purposeCount: 1, purpose: purpose("Plan field work, track cost against budget, and decide on changes for this job.") }, jobStripLabels: [{ text: "I-5 Culvert 24-077 Report due", scrollWidth: 200, clientWidth: 200 }], ...o });
  for (const w of [320, 390, 768, 1280]) assert.deepEqual(evaluateTitlesAndLabels(good(w)), [], `control at ${w}`);
  const mf = (name, row, re) => { const f = evaluateTitlesAndLabels(row); assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); };
  const t = (o) => ({ ...good(320).titles, ...o });
  mf("b-1 two h1", good(1280, { titles: t({ h1Count: 2, h1Texts: ["a", "b"] }) }), /check 1: 2 visible h1/);
  mf("b-1 no h1", good(390, { titles: t({ h1Count: 0, h1Texts: [] }) }), /check 1: 0 visible h1/);
  mf("b-1 empty h1", good(390, { titles: t({ h1Texts: [""] }) }), /check 1: the h1 is empty/);
  mf("b-1 no purpose", good(320, { titles: t({ purposeCount: 0, purpose: null }) }), /check 1: 0 page-purpose/);
  mf("b-1 purpose 9 chars", good(320, { titles: t({ purpose: purpose("Too short") }) }), /check 1: page-purpose is 9 characters/);
  mf("b-1 purpose 91 chars", good(1280, { titles: t({ purpose: purpose("x".repeat(91)) }) }), /check 1: page-purpose is 91 characters/);
  assert.deepEqual(evaluateTitlesAndLabels(good(1280, { titles: t({ purpose: purpose("x".repeat(90)) }) })), [], "90 chars passes");
  assert.deepEqual(evaluateTitlesAndLabels(good(1280, { titles: t({ purpose: purpose("x".repeat(10)) }) })), [], "10 chars passes");
  mf("b-6 purpose spills", good(320, { titles: t({ purpose: purpose("Plan field work and more", { scrollWidth: 300 }) }) }), /check 6: page-purpose scrollWidth 300 > clientWidth 280/);
  mf("b-6 purpose ellipsis", good(320, { titles: t({ purpose: purpose("Plan field work and more", { ellipsis: true }) }) }), /check 6: .*ellipsis/);
  mf("b-6 purpose 13px", good(320, { titles: t({ purpose: purpose("Plan field work and more", { fontPx: 13 }) }) }), /check 6: page-purpose font-size 13px < 14px/);
  mf("b-7 label without number", good(320, { jobStripLabels: [{ text: "I-5 Culvert", scrollWidth: 100, clientWidth: 100 }] }), /check 7: job-strip-label "I-5 Culvert" has no job number/);
  mf("b-7 label spills", good(320, { jobStripLabels: [{ text: "I-5 Culvert 24-077", scrollWidth: 140, clientWidth: 100 }] }), /check 7: .*scrollWidth 140 > clientWidth 100/);
  const step = (o) => ({ label: "Submit tomorrow's plan: Bridge Crew 2 on 25-031", visible: true, w: 358, h: 48, ellipsis: false, scrollWidth: 300, clientWidth: 300, ...o });
  const app = (o) => ({ role: "foreman", width: 390, path: "/app", nextSteps: [step(o)] });
  assert.deepEqual(evaluateTitlesAndLabels(app({})), []);
  mf("a-7 43px tall", app({ h: 43 }), /check 7: next-step .* 358×43 < 44×44/);
  mf("a-7 ellipsis", app({ ellipsis: true }), /check 7: .*ellipsis/);
  mf("a-7 label spills", app({ scrollWidth: 320 }), /check 7: .*scrollWidth 320 > clientWidth 300/);
  console.log("passes: 5.0.4-a check 7 and 5.0.4-b checks 1/6/7 controls (incl. 10 and 90 chars); FAILS as expected: 2/0 h1, empty h1, no purpose, 9 and 91 chars, purpose spill/ellipsis/13px, label without job number, label spill, next step 43 px, ellipsis, spill");
}

// ---- 5.0.4-b checks 2 and 3: cost indexes per role ----
{
  const ix = (o = {}) => ({ metricIds: [], stripText: "I-5 Culvert 24-077 Report due · Cedar Creek 25-031 No plan today", stripPills: ["I-5 Culvert 24-077 Report due", "Cedar Creek 25-031 No plan today"], ...o });
  const row = (role, p, text, o = {}, width = 390) => ({ role, width, path: p, text, indexes: ix(o) });
  // controls
  assert.deepEqual(evaluateCostIndexes(row("foreman", "/app/jobs/24-077", "Report today's quantities")), []);
  assert.deepEqual(evaluateCostIndexes(row("foreman", "/changelog", "5.0.4 adds CPI and SPI labels")), [], "prose pages may say CPI/SPI");
  assert.deepEqual(evaluateCostIndexes(row("superintendent", "/app/jobs/25-031", "Cost performance (CPI) 0.98 Schedule performance (SPI) 1.01", { metricIds: ["job-cpi", "job-spi"] })), []);
  assert.deepEqual(evaluateCostIndexes(row("superintendent", "/roadmap", "CPI on the job page")), []);
  assert.deepEqual(evaluateCostIndexes(row("pm", "/app", "At risk −$3.1M CPI 0.93", { metricIds: ["kpi-cpi"] })), [], "PM keeps CPI");
  const mf = (name, r, re) => { const f = evaluateCostIndexes(r); assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); };
  mf("b-2 foreman metric value", row("foreman", "/app", "x", { metricIds: ["job-cpi"] }), /check 2: foreman sees 1 cost index value/);
  mf("b-2 foreman metric on prose page", row("foreman", "/status", "x", { metricIds: ["kpi-spi"] }), /check 2: foreman sees 1 cost index value/);
  mf("b-2 foreman At risk", row("foreman", "/app", "24-077 At risk"), /check 2: foreman sees "At risk"/);
  mf("b-2 foreman dollar delta (U+2212)", row("foreman", "/app/jobs/24-077", "variance −$3,100"), /check 2: foreman sees a dollar delta "−\$3"/);
  mf("b-2 foreman dollar delta (hyphen)", row("foreman", "/changelog", "variance -$3,100"), /dollar delta "-\$3"/);
  mf("b-2 foreman word CPI", row("foreman", "/app/assistant", "Your CPI is 0.93"), /check 2: foreman sees the word CPI/);
  mf("b-2 foreman word SPI", row("foreman", "/app", "SPI 1.01"), /check 2: foreman sees the word SPI/);
  mf("b-2 pill lacks name", row("foreman", "/app/jobs/24-077", "x", { stripPills: ["24-077 Report due"] }), /lacks "I-5 Culvert"/);
  mf("b-2 pill no state", row("foreman", "/app/jobs/24-077", "x", { stripPills: ["I-5 Culvert 24-077"] }), /shows 0 of/);
  mf("b-3 super metric inside JobStrip on a job page", row("superintendent", "/app/jobs/25-031", "Cost performance (CPI) 0.98", { metricIds: ["job-cpi", "job-spi", "strip-cpi"], stripMetricIds: ["strip-cpi"] }), /inside JobStrip \(strip-cpi\)/);
  mf("b-2 pill two states", row("foreman", "/app/jobs/24-077", "x", { stripPills: ["I-5 Culvert 24-077 Report due Reported"] }), /shows 2 of/);
  mf("b-2 no 24-077 pill", row("foreman", "/app/jobs/24-077", "x", { stripPills: [] }), /no 24-077 pill/);
  mf("b-3 super CPI in strip on job page", row("superintendent", "/app/jobs/24-077", "x", { stripText: "I-5 Culvert 24-077 CPI 0.93" }), /check 3: superintendent sees CPI\/SPI in the job strip/);
  mf("b-3 super CPI word on /app", row("superintendent", "/app", "CPI 0.93"), /check 3: superintendent sees the word CPI/);
  mf("b-3 super metric on cost-item", row("superintendent", "/app/jobs/24-077/cost-items/07-300", "x", { metricIds: ["item-cpi"] }), /check 3: superintendent sees 1 cost index value/);
  mf("b-3 super SPI on plan page", row("superintendent", "/app/jobs/25-031/plans/abc", "SPI 1.01"), /check 3: superintendent sees the word SPI/);
  mf("b-3 super metric on prose page", row("superintendent", "/changelog", "x", { metricIds: ["kpi-cpi"] }), /on a prose page/);
  mf("b-3 super 25-031 missing job-spi", row("superintendent", "/app/jobs/25-031", "x", { metricIds: ["job-cpi"] }), /job-spi 0 time\(s\) on 25-031/);
  mf("b-3 super 25-031 job-cpi twice", row("superintendent", "/app/jobs/25-031", "x", { metricIds: ["job-cpi", "job-cpi", "job-spi"] }), /job-cpi 2 time\(s\)/);
  console.log("passes: 5.0.4-b checks 2/3 controls (foreman prose page, superintendent 25-031 once each, PM keeps CPI); FAILS as expected: foreman metric/At risk/−$/-$/CPI/SPI, 24-077 pill name/state/missing, superintendent strip/word/metric on cost-item, plan, prose, 25-031 counts");
}

// ---- 5.0.4-e check 1: the 04-210 cost item page is in crawl504 (lead review of #84) ----
{
  const pages = ["/app", "/app/jobs/25-031"];
  assert.equal(crawl504Want(pages), (4 * 3 * 2 + 2 * 2) * 2, "crawl504 want counts the 8 04-210 loads");
  const full = [];
  for (const theme of SPEC_504_THEMES) for (const role of E1_EXTRA.roles) for (const { width } of E1_EXTRA.sizes) full.push({ path: E1_EXTRA.path, role, width, theme });
  assert.equal(full.length, 8);
  assert.deepEqual(e1ExtraCoverageFailures(full), []);
  const short = e1ExtraCoverageFailures(full.filter((r) => !(r.role === "executive" && r.width === 320 && r.theme === "dark")));
  assert.deepEqual(short, ["5.0.4-e check 1: no dark executive@320 load of /app/jobs/25-031/cost-items/04-210"]);
  assert.ok(E1_PATHS.includes(E1_EXTRA.path), "evaluateFigures applies e-1 to the 04-210 rows");
  console.log("FAILS as expected: crawl504 missing the dark executive@320 04-210 load; passes: all 8 04-210 loads, want counts them");
}
