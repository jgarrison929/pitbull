#!/usr/bin/env node
// Must-fails for field504.mjs (5.0.4-d checks 3, 4, 5 and 5.0.4-g check 3). No network. Run: node field504-eval.test.mjs
import assert from "node:assert/strict";
import { countReportRows, demoStepDone, evaluateDemoState, evaluateField504, evaluateIssueReportApprove, evaluateOfflineRetry } from "./field504.mjs";

let n = 0;
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); n++; console.log(`passes: ${name}`); };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); n++; console.log(`FAILS as required: ${name} → ${f.find((x) => re.test(x))}`); };

const ALL = ["super submit", "foreman sees", "live G/L", "report", "approve + posted qty"];
const flow = (o = {}) => ({ steps: ALL, planId: "41", superAfter: { visible: true, status: "issued" }, foremanSees: { visible: true, status: "issued" }, liveGl: "Gain / loss −2.8 MH Earned 19.2 MH Actual 22.0 MH", afterReport: { visible: true, status: "reported" }, afterApprove: { visible: true, status: "approved" }, installedBefore: "120 CY", installedAfter: "132 CY", ...o });
const d3 = (o) => evaluateIssueReportApprove(flow(o))["d-3"];
const d5 = (o) => evaluateIssueReportApprove(flow(o))["d-5"];
ok("d-3 control", d3());
ok("d-5 control", d5());
ok("d-5 ASCII minus accepted", d5({ liveGl: "-2.8 MH Earned 19.2 MH Actual 22.0 MH" }));
bad("d-3 super submit left it draft", d3({ superAfter: { visible: true, status: "draft" } }), /"draft" \(want issued\)/);
bad("d-3 foreman cannot see the plan", d3({ foremanSees: { visible: false, status: null } }), /foreman at 390×844 does not see plan 41/);
bad("d-3 foreman sees draft", d3({ foremanSees: { visible: true, status: "draft" } }), /foreman sees plan 41 as "draft"/);
bad("d-3 not run", d3({ steps: [] }), /superintendent submit not run/);
bad("d-5 earned wrong", d5({ liveGl: "−3.0 MH Earned 19.0 MH Actual 22.0 MH" }), /lacks "Earned 19\.2 MH"/);
bad("d-5 gain shown as positive", d5({ liveGl: "+2.8 MH Earned 19.2 MH Actual 22.0 MH" }), /lacks "−2\.8 MH"/);
bad("d-5 actual missing", d5({ liveGl: "−2.8 MH Earned 19.2 MH" }), /lacks "Actual 22\.0 MH"/);
bad("d-5 no G/L element", d5({ liveGl: null }), /report-gl-04-210 missing/);
bad("d-5 not reported", d5({ afterReport: { visible: true, status: "issued" } }), /want reported/);
bad("d-5 not approved", d5({ afterApprove: { visible: true, status: "reported" } }), /want approved/);
bad("d-5 posted quantity off", d5({ installedAfter: "120 CY" }), /installed "120 CY" → "120 CY" \(want \+12\)/);
bad("d-5 posted quantity unreadable", d5({ installedAfter: null }), /cost-item-installed unreadable/);
bad("d-5 error after the foreman step", d5({ steps: ["super submit", "foreman sees"], error: "boom" }), /boom \(after super submit, foreman sees\)/);

// d-4 (Planner ruling 2026-10-27, #86): manual Retry or one automatic resend; the queued report survives a reload.
const RETRY_STEPS = ["offline submit", "back online", "reload", "retry", "rows"];
const Q = { unsent: true, retry: true, retryTag: "BUTTON", retryText: "Retry" };
const off = (o = {}) => ({ steps: RETRY_STEPS, job: "24-077", planId: "41", mode: "retry", rowsBefore: 0, rowsAfter: 1, queued: Q, offlineReached: 0, autoPosts: 0, afterReload: { ...Q, status: "issued" }, retryPosts: 1, afterRetry: { unsent: false, retry: false, status: "reported" }, ...o });
const auto = (o = {}) => off({ steps: ["offline submit", "back online", "rows"], mode: "auto", autoPosts: 1, afterReload: undefined, retryPosts: undefined, afterRetry: undefined, ...o });
ok("d-4 control: queued, survives a reload, a double-click on Retry posts once, 1 report row", evaluateOfflineRetry(off()));
ok("d-4 control: an automatic resend that posts once and adds 1 report row", evaluateOfflineRetry(auto()));
bad("d-4 a stale report row already on the page (#86 wants exactly 1 row, not +1)", evaluateOfflineRetry(off({ rowsBefore: 1, rowsAfter: 2 })), /2 report row\(s\) on \/app\/jobs\/24-077\/changes \(want exactly 1; 1 before/);
bad("d-4 lost on reload", evaluateOfflineRetry(off({ afterReload: { unsent: false, retry: false, status: "issued" }, steps: ["offline submit", "back online", "reload", "rows"], retryPosts: undefined, afterRetry: undefined, rowsAfter: 0 })), /after reload: the queued report is lost/);
bad("d-4 no visible unsent state", evaluateOfflineRetry(off({ queued: { unsent: false, retry: false } })), /no visible report-unsent \(no visible unsent state\)/);
bad("d-4 unsent state without Retry", evaluateOfflineRetry(off({ queued: { unsent: true, retry: false } })), /holds no visible report-retry/);
bad("d-4 Retry that is not a 'Retry' button", evaluateOfflineRetry(off({ queued: { unsent: true, retry: true, retryTag: "A", retryText: "Try again" } })), /want a button "Retry"/);
bad("d-4 zero posts after Retry", evaluateOfflineRetry(off({ retryPosts: 0, rowsAfter: 0, afterRetry: { unsent: true, retry: true, status: "issued" } })), /Retry: 0 post\(s\) \(want exactly 1\)/);
bad("d-4 duplicate post (second Retry click posts again, 2 rows)", evaluateOfflineRetry(off({ retryPosts: 2, rowsAfter: 2 })), /2 report row\(s\) on \/app\/jobs\/24-077\/changes \(want exactly 1/);
bad("d-4 duplicate rows even with one counted post", evaluateOfflineRetry(off({ rowsAfter: 2 })), /2 report row\(s\) on /);
bad("d-4 automatic resend posts twice", evaluateOfflineRetry(auto({ autoPosts: 2, rowsAfter: 2 })), /automatic resend: 2 post\(s\)/);
bad("d-4 report-unsent still visible after Retry", evaluateOfflineRetry(off({ afterRetry: { unsent: true, retry: true, status: "reported" } })), /after Retry: report-unsent is still visible/);
bad("d-4 plan not issued after the reload", evaluateOfflineRetry(off({ afterReload: { ...Q, status: "reported" } })), /after reload: plan 41 is "reported" \(want issued\)/);
bad("d-4 zero rows (nothing posted)", evaluateOfflineRetry(off({ rowsAfter: 0 })), /0 report row\(s\) on /);
bad("d-4 a post reached the server while offline", evaluateOfflineRetry(off({ offlineReached: 1 })), /reached the server while offline/);
bad("d-4 plan still issued after Retry", evaluateOfflineRetry(off({ afterRetry: { unsent: false, retry: false, status: "issued" } })), /after Retry plan 41 is "issued" \(want reported\)/);
bad("d-4 rows not counted", evaluateOfflineRetry(off({ steps: ["offline submit", "back online", "reload", "retry"], rowsAfter: undefined })), /report rows not counted/);
bad("d-4 error", evaluateOfflineRetry(off({ steps: ["offline submit"], error: "boom" })), /boom \(after offline submit\)/);
// S11: the row matcher is the app's /changes wording; a page with no report row is still counted 0.
const APP_ROW = "Reported Culvert Crew A's work on I-5 Culverts for Tue, Oct 27: 12 CY, 22.0 MH · Bryce Foreman · 9:41 AM";
assert.equal(countReportRows([APP_ROW, "Issued Culvert Crew A's plan on I-5 Culverts"]), 1); n++; console.log("passes: S11 the app's /changes report row counts 1");
assert.equal(countReportRows(["Issued Culvert Crew A's plan on I-5 Culverts", "Returned Culvert Crew A's report on I-5 Culverts"]), 0); n++; console.log("FAILS as required: S11 no report row → counted 0");
assert.equal(countReportRows(["Reported day's work"]), 0); n++; console.log("FAILS as required: S11 the assistant label alone is not a report row → 0");

const DONE = [{ done: "true", state: null, status: null, testid: null, visible: true }];
const NOT = [];
const demo = (o = {}) => ({ steps: ["approve estimate"], estimateStatus: "approved", demoPath: { steps: [{ text: "1. Import the estimate", marks: DONE }, { text: "2. Approve the budget", marks: [{ done: null, state: null, status: "done", testid: null, visible: true }] }, { text: "3. Plan the day", marks: NOT }] }, ...o });
ok("g-3 control (data-done / data-status marks)", evaluateDemoState(demo()));
ok("g-3 control ([data-testid$='-done'] visible element)", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1", marks: [{ done: null, state: null, status: null, testid: "demo-step-1-done", visible: true }] }, { text: "2", marks: [{ done: null, state: "done", status: null, testid: null, visible: true }] }] } })));
bad("g-3 'Done when 26-010 is approved' copy on a step that isn't done", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1. Import the estimate", marks: DONE }, { text: "2. Done when 26-010 is approved", marks: [{ done: "false", state: "todo", status: null, testid: "demo-step-2", visible: true }] }] } })), /step 2 "2\. Done when 26-010 is approved" is not done/);
bad("g-3 hidden -done element is not a mark", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1", marks: DONE }, { text: "2. Approve", marks: [{ done: null, state: null, status: null, testid: "demo-step-2-done", visible: false }] }] } })), /step 2 .* is not done/);
assert.equal(demoStepDone({ text: "Done", marks: [] }), false); n++; console.log("FAILS as required: g-3 text 'Done' alone → not done");
bad("g-3 rc today (no panel)", evaluateDemoState(demo({ demoPath: { missing: true } })), /g-3: demo-path missing/);
bad("g-3 step 2 not done", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1", marks: DONE }, { text: "2. Approve the budget", marks: NOT }] } })), /step 2 .* is not done/);
bad("g-3 step 1 not done", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1. Import", marks: NOT }, { text: "2", marks: DONE }] } })), /step 1 .* is not done/);
bad("g-3 too few steps", evaluateDemoState(demo({ demoPath: { steps: [{ text: "1", marks: DONE }] } })), /no step 2/);
bad("g-3 estimate not approved", evaluateDemoState(demo({ estimateStatus: "draft" })), /estimate-status "draft"/);

const all = evaluateField504({ flow: flow(), offline: off(), demo: demo() });
assert.equal(Object.keys(all).length, 4);
for (const [k, v] of Object.entries(all)) assert.deepEqual(v, [], k);
console.log(`field504-eval: ${n} cases OK`);
