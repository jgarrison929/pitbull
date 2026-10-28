#!/usr/bin/env node
// Must-fails for field504.mjs (5.0.4-d checks 3, 4, 5 and 5.0.4-g check 3). No network. Run: node field504-eval.test.mjs
import assert from "node:assert/strict";
import { countReportRows, demoStepDone, evaluateDemoState, evaluateField504, evaluateIssueReportApprove, evaluateOfflineRetry, headlineQty, reportDay, reportRowKeys } from "./field504.mjs";

let n = 0;
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); n++; console.log(`passes: ${name}`); };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); n++; console.log(`FAILS as required: ${name} → ${f.find((x) => re.test(x))}`); };

const ALL = ["super submit", "foreman sees", "live G/L", "report", "return", "resubmit", "approve + posted qty"];
const flow = (o = {}) => ({ steps: ALL, planId: "41", superAfter: { visible: true, status: "issued" }, foremanSees: { visible: true, status: "issued" }, liveGl: "Gain / loss −2.8 MH Earned 19.2 MH Actual 22.0 MH", afterReport: { visible: true, status: "reported" }, qtyReported: qb(), afterReturn: { visible: true, status: "issued" }, qtyReturned: qb(), foremanReturned: { visible: true, status: "issued", banner: "Returned: Recount pour 3", values: { qty: "12", mh: "22" } }, afterResubmit: { visible: true, status: "reported" }, qtyResubmitted: qb(), afterApprove: { visible: true, status: "approved" }, qtyBefore: qb(), qtyAfter: qa(), ...o });
// d-5 readings (spec #93, main 9d05bd8d, lines 363-366): the foreman reports, the superintendent returns it with a
// reason, the foreman resubmits, the superintendent approves. Installed stays at the claimed 248 CY; the line has count 0
// before the report and until the approval, then shows "+12 CY posted since Period 1 lock" for every role, foreman included.
function qb(o = {}) { return { path: "/app/jobs/25-031/cost-items/04-210", installed: "Installed 248 CY 300 CY budgeted", line: { count: 0, visible: false, rawQty: null, text: null }, periods: [1], ...o }; }
function qline(o = {}) { return { count: 1, visible: true, rawQty: "12000", text: "+12 CY posted since Period 1 lock", ...o }; }
function qr(o = {}) { return qb({ line: qline(), ...o }); }
function qa(over = {}) { return Object.fromEntries(["superintendent", "pm", "executive", "foreman"].map((role) => [role, over[role] ?? qr()])); }
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
ok("d-5 control: no Period mention elsewhere (agreement not checkable)", d5({ qtyAfter: qa({ pm: qr({ periods: [] }) }) }));
// Spec #93 line 364: "`<P>` is 25-031's latest locked period, which is Period 1 after **Reset demo**." Period 3 was a pass
// before review round 2 (any Period N); it now FAILS even when the page agrees.
bad("d-5 line names Period 3 and the page agrees (P is Period 1 after Reset demo)", d5({ qtyBefore: qb({ periods: [3] }), qtyAfter: qa(Object.fromEntries(["superintendent", "pm", "executive", "foreman"].map((r) => [r, qr({ periods: [3], line: qline({ text: "+12 CY posted since Period 3 lock" }) })]))) }), /pm after the approval: cost-item-qty-since-lock reads "\+12 CY posted since Period 3 lock" \(want exactly "\+12 CY posted since Period 1 lock"\)/);
// Spec #93 line 364: "Before the foreman reports. … `cost-item-qty-since-lock` has count 0." Any line there FAILS.
bad("d-5 a valid-looking +12 CY line already there before the foreman reports", d5({ qtyBefore: qb({ line: qline() }) }), /before the foreman reports: cost-item-qty-since-lock count 1 \(want 0\)/);
// Spec #93 line 363: report, return with a reason, resubmit, approve. The line stays at count 0 until the approval.
bad("d-5 line appears while the report is returned", d5({ qtyReturned: qr() }), /returned \(before the approval\): cost-item-qty-since-lock count 1 \(want 0/);
bad("d-5 line appears on the first report (before the approval)", d5({ qtyReported: qr() }), /reported \(before the approval\): cost-item-qty-since-lock count 1/);
bad("d-5 line appears after the resubmit (before the approval)", d5({ qtyResubmitted: qr() }), /resubmitted \(before the approval\): cost-item-qty-since-lock count 1/);
bad("d-5 headline moves while returned", d5({ qtyReturned: qb({ installed: "Installed 260 CY 300 CY budgeted" }) }), /returned \(before the approval\): Installed headline 260 CY/);
bad("d-5 returned reading missing", d5({ qtyReturned: undefined }), /returned \(before the approval\): not read/);
bad("d-5 return step missing (report then approve, the old flow)", d5({ steps: ["super submit", "foreman sees", "live G/L", "report", "approve + posted qty"] }), /return with a reason not run/);
bad("d-5 return step missing: also flagged on the approval", d5({ steps: ["super submit", "foreman sees", "live G/L", "report", "approve + posted qty"] }), /approved without the return and resubmit/);
bad("d-5 return ineffective (plan still reported)", d5({ afterReturn: { visible: true, status: "reported" } }), /after the superintendent's return plan 41 is "reported" \(want issued: the return did not take\)/);
bad("d-5 return ineffective for the foreman", d5({ foremanReturned: { visible: true, status: "reported", banner: null, values: { qty: "12", mh: "22" } } }), /foreman after the return sees plan 41 as "reported"/);
bad("d-5 return reason not shown to the foreman", d5({ foremanReturned: { visible: true, status: "issued", banner: null, values: { qty: "12", mh: "22" } } }), /return-reason-banner missing \(want the reason "Recount pour 3"\)/);
bad("d-5 return loses the foreman's values", d5({ foremanReturned: { visible: true, status: "issued", banner: "Returned: Recount pour 3", values: { qty: "", mh: "" } } }), /report values "" CY \/ "" MH \(want 12 CY and 22.0 MH kept\)/);
bad("d-5 resubmit missing", d5({ steps: ["super submit", "foreman sees", "live G/L", "report", "return", "approve + posted qty"] }), /foreman resubmit not run/);
bad("d-5 resubmit ineffective (still issued)", d5({ afterResubmit: { visible: true, status: "issued" } }), /after the foreman's resubmit plan 41 is "issued" \(want reported\)/);
ok("d-5 kept values read as 22.0", d5({ foremanReturned: { visible: true, status: "issued", banner: "Returned: Recount pour 3", values: { qty: "12", mh: "22.0" } } }));
assert.deepEqual(headlineQty("Installed 248 CY 300 CY budgeted"), { qty: 248, unit: "CY" }); n++;
// The old rule (headline rises +12) is dropped: the headline rising is now a FAIL.
bad("d-5 headline rises +12 (the old rule's pass)", d5({ qtyAfter: qa({ pm: qr({ installed: "Installed 260 CY 300 CY budgeted" }) }) }), /pm after the approval: Installed headline 248 CY → 260 CY \(want unchanged at the claimed 248 CY\)/);
bad("d-5 headline changes for the foreman only", d5({ qtyAfter: qa({ foreman: qr({ installed: "Installed 236 CY 300 CY budgeted" }) }) }), /foreman after the approval: Installed headline 248 CY → 236 CY/);
bad("d-5 headline not the claimed 248 CY before", d5({ qtyBefore: qb({ installed: "Installed 240 CY 300 CY budgeted" }) }), /before: Installed headline 240 CY \(want the claimed 248 CY\)/);
bad("d-5 headline unreadable", d5({ qtyAfter: qa({ pm: qr({ installed: null }) }) }), /pm after the approval: cost-item-installed headline unreadable/);
bad("d-5 line missing after +12", d5({ qtyAfter: qa({ pm: qr({ line: { count: 0, visible: false, rawQty: null, text: null } }) }) }), /pm after the approval: cost-item-qty-since-lock missing/);
bad("d-5 data-qty-milli wrong (12 instead of 12000)", d5({ qtyAfter: qa({ executive: qr({ line: qline({ rawQty: "12" }) }) }) }), /executive after the approval: cost-item-qty-since-lock data-qty-milli "12" \(want "12000"\)/);
bad("d-5 data-qty-milli doubled (24000)", d5({ qtyAfter: qa({ superintendent: qr({ line: qline({ rawQty: "24000" }) }) }) }), /data-qty-milli "24000" \(want "12000"\)/);
bad("d-5 data-qty-milli missing", d5({ qtyAfter: qa({ pm: qr({ line: qline({ rawQty: null }) }) }) }), /data-qty-milli null \(want "12000"\)/);
bad("d-5 text wrong ('12 CY since lock')", d5({ qtyAfter: qa({ pm: qr({ line: qline({ text: "12 CY since lock" }) }) }) }), /reads "12 CY since lock" \(want exactly "\+12 CY posted since Period 1 lock"\)/);
bad("d-5 text wrong unit ('+12 LF …')", d5({ qtyAfter: qa({ pm: qr({ line: qline({ text: "+12 LF posted since Period 1 lock" }) }) }) }), /reads "\+12 LF posted since Period 1 lock"/);
bad("d-5 text with extra words", d5({ qtyAfter: qa({ pm: qr({ line: qline({ text: "+12 CY posted since Period 1 lock (pending)" }) }) }) }), /want exactly/);
bad("d-5 line names Period 2 while the page says Period 1", d5({ qtyAfter: qa({ pm: qr({ periods: [1], line: qline({ text: "+12 CY posted since Period 2 lock" }) }) }) }), /reads "\+12 CY posted since Period 2 lock" \(want exactly "\+12 CY posted since Period 1 lock"\)/);
bad("d-5 page names another lock period (Period 2) next to a Period 1 line", d5({ qtyAfter: qa({ pm: qr({ periods: [1, 2] }) }) }), /pm after the approval: the page says Period 2 lock \(want Period 1/);
bad("d-5 line rendered at 0 before anything is posted", d5({ qtyBefore: qb({ line: qline({ rawQty: "0", text: "+0 CY posted since Period 1 lock" }) }) }), /before: cost-item-qty-since-lock is rendered with data-qty-milli "0" \(want no line at 0 or less\)/);
bad("d-5 line rendered at a negative qty", d5({ qtyBefore: qb({ line: qline({ rawQty: "-12000" }) }) }), /rendered with data-qty-milli "-12000"/);
bad("d-5 line hidden for the foreman (not rendered)", d5({ qtyAfter: qa({ foreman: qr({ line: { count: 0, visible: false, rawQty: null, text: null } }) }) }), /foreman after the approval: cost-item-qty-since-lock missing/);
bad("d-5 line hidden for the foreman (rendered, not visible)", d5({ qtyAfter: qa({ foreman: qr({ line: qline({ visible: false }) }) }) }), /foreman after the approval: cost-item-qty-since-lock is not visible/);
bad("d-5 a role not read", d5({ qtyAfter: { superintendent: qr(), pm: qr(), executive: qr() } }), /foreman after the approval: not read/);
bad("d-5 error after the foreman step", d5({ steps: ["super submit", "foreman sees"], error: "boom" }), /boom \(after super submit, foreman sees\)/);

// d-4 (spec #93, main 9d05bd8d, 5.0.4-d check 4): manual Retry or one automatic resend; the queued report survives a reload.
const RETRY_STEPS = ["offline submit", "back online", "reload", "retry", "rows"];
const Q = { unsent: true, retry: true, retryTag: "BUTTON", retryText: "Retry" };
// Rows as /changes renders them: "<user> · <summary> <time>" (change-log-list.tsx). Key = crew + job + day (spec #93 line
// 360: "Dedupe is by plan plus report day." … "another crew's row neither fails nor satisfies it").
const RROW = (crew = "Culvert Crew A", day = "Tue, Oct 27") => `Bryce Foreman · Reported ${crew}'s work on I-5 Culverts for ${day}: 110 man-hours pending (as planned). $9.9K and quantities await superintendent approval — nothing posted to actual cost yet. 9:41 AM`;
const OTHER = "Mia PM · Issued Culvert Crew A's plan on I-5 Culverts 8:02 AM";
const off = (o = {}) => ({ steps: RETRY_STEPS, job: "24-077", planId: "41", planDate: "2026-10-27", mode: "retry", rowsBefore: [OTHER], rowsAfter: [OTHER, RROW()], queued: Q, offlineReached: 0, autoPosts: 0, afterReload: { ...Q, status: "issued" }, retryPosts: 1, afterRetry: { unsent: false, retry: false, status: "reported" }, ...o });
const auto = (o = {}) => off({ steps: ["offline submit", "back online", "rows"], mode: "auto", autoPosts: 1, afterReload: undefined, retryPosts: undefined, afterRetry: undefined, ...o });
ok("d-4 control: queued, survives a reload, a double-click on Retry posts once, 1 report row", evaluateOfflineRetry(off()));
ok("d-4 control: an automatic resend that posts once and adds 1 report row", evaluateOfflineRetry(auto()));
bad("d-4 two rows for the same plan + day (a stale seeded row plus the new one)", evaluateOfflineRetry(off({ rowsBefore: [RROW()], rowsAfter: [RROW(), RROW()] })), /2 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27 on \/app\/jobs\/24-077\/changes \(want exactly 1 for the d-4 plan \+ day\)/);
ok("d-4 two rows for different plans on the same day (a second crew's report stays)", evaluateOfflineRetry(off({ rowsAfter: [RROW("Culvert Crew B"), RROW()] })));
ok("d-4 the same crew on an earlier day is a different plan + day", evaluateOfflineRetry(off({ rowsAfter: [RROW(), RROW("Culvert Crew A", "Mon, Oct 26")] })));
// Spec #93 line 360: another crew's row neither fails nor satisfies the d-4 count (was a must-fail before round 2).
ok("d-4 another crew's row duplicated on the same day neither fails nor satisfies", evaluateOfflineRetry(off({ rowsAfter: [RROW("Culvert Crew B"), RROW("Culvert Crew B"), RROW()] })));
ok("d-4 another crew's row with no readable day neither fails nor satisfies", evaluateOfflineRetry(off({ rowsAfter: [RROW(), "Bryce Foreman · Reported Culvert Crew B's work on I-5 Culverts today: 110 man-hours"] })));
bad("d-4 another crew's rows do not satisfy the d-4 key", evaluateOfflineRetry(off({ rowsAfter: [RROW("Culvert Crew B"), RROW("Culvert Crew B", "Mon, Oct 26")] })), /0 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/);
bad("d-4 only another crew's row (the d-4 plan's row is missing)", evaluateOfflineRetry(off({ rowsAfter: [RROW("Culvert Crew B")] })), /0 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/);
bad("d-4 the d-4 plan's row on the wrong day only", evaluateOfflineRetry(off({ rowsAfter: [RROW("Culvert Crew A", "Mon, Oct 26")] })), /0 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/);
bad("d-4 plan date unreadable", evaluateOfflineRetry(off({ planDate: null })), /data-plan-date null unreadable/);
bad("d-4 a Culvert Crew A row with no readable day", evaluateOfflineRetry(off({ rowsAfter: [RROW(), "Bryce Foreman · Reported Culvert Crew A's work on I-5 Culverts today: 110 man-hours"] })), /Culvert Crew A report row with no readable day/);
bad("d-4 rows unreadable (not a list)", evaluateOfflineRetry(off({ rowsAfter: 1 })), /report rows on \/app\/jobs\/24-077\/changes unreadable/);
assert.equal(reportDay("2026-10-27"), "Tue, Oct 27"); assert.equal(reportDay("Oct 27"), null); n++;
assert.equal(reportRowKeys([RROW(), RROW("Culvert Crew B"), OTHER]).counts.size, 2); n++;
bad("d-4 lost on reload", evaluateOfflineRetry(off({ afterReload: { unsent: false, retry: false, status: "issued" }, steps: ["offline submit", "back online", "reload", "rows"], retryPosts: undefined, afterRetry: undefined, rowsAfter: 0 })), /after reload: the queued report is lost/);
bad("d-4 no visible unsent state", evaluateOfflineRetry(off({ queued: { unsent: false, retry: false } })), /no visible report-unsent \(no visible unsent state\)/);
bad("d-4 unsent state without Retry", evaluateOfflineRetry(off({ queued: { unsent: true, retry: false } })), /holds no visible report-retry/);
bad("d-4 Retry that is not a 'Retry' button", evaluateOfflineRetry(off({ queued: { unsent: true, retry: true, retryTag: "A", retryText: "Try again" } })), /want a button "Retry"/);
bad("d-4 zero posts after Retry", evaluateOfflineRetry(off({ retryPosts: 0, rowsAfter: [OTHER], afterRetry: { unsent: true, retry: true, status: "issued" } })), /Retry: 0 post\(s\) \(want exactly 1\)/);
bad("d-4 retry posts twice and duplicates the plan + day row", evaluateOfflineRetry(off({ retryPosts: 2, rowsAfter: [RROW(), RROW()] })), /2 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27 on \/app\/jobs\/24-077\/changes \(want exactly 1 for the d-4 plan \+ day\)/);
bad("d-4 retry producing a duplicate plan + day row even with one counted post", evaluateOfflineRetry(off({ rowsAfter: [RROW(), RROW()] })), /2 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/);
bad("d-4 automatic resend posts twice", evaluateOfflineRetry(auto({ autoPosts: 2, rowsAfter: [RROW(), RROW()] })), /automatic resend: 2 post\(s\)/);
bad("d-4 report-unsent still visible after Retry", evaluateOfflineRetry(off({ afterRetry: { unsent: true, retry: true, status: "reported" } })), /after Retry: report-unsent is still visible/);
bad("d-4 plan not issued after the reload", evaluateOfflineRetry(off({ afterReload: { ...Q, status: "reported" } })), /after reload: plan 41 is "reported" \(want issued\)/);
bad("d-4 zero rows (nothing posted)", evaluateOfflineRetry(off({ rowsAfter: [OTHER] })), /0 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/);
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
