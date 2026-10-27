#!/usr/bin/env node
// Must-fails for field504.mjs (5.0.4-d checks 3, 4, 5 and 5.0.4-g check 3). No network. Run: node field504-eval.test.mjs
import assert from "node:assert/strict";
import { demoStepDone, evaluateDemoState, evaluateField504, evaluateIssueReportApprove, evaluateOfflineReplay } from "./field504.mjs";

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

const off = (o = {}) => ({ steps: ["offline submit", "online count", "replay"], planId: "41", replays: [200, 200], reportedBefore: 0, reportedOnline: 1, reportedAfter: 1, after: { visible: true, status: "reported" }, ...o });
ok("d-4 control (app's own retry adds 1 on reconnect; 2 replays add 0)", evaluateOfflineReplay(off()));
bad("d-4 no offline handling: online count 0, our replay created the submission", evaluateOfflineReplay(off({ reportedOnline: 0, reportedAfter: 1 })), /0 reported submission\(s\) after reconnecting, before any replay \(want exactly 1/);
bad("d-4 app retry double-posts on reconnect", evaluateOfflineReplay(off({ reportedOnline: 2, reportedAfter: 2 })), /2 reported submission\(s\) after reconnecting/);
bad("d-4 replay double-posts", evaluateOfflineReplay(off({ reportedAfter: 2 })), /1 reported submission\(s\) added by the 2 replays \(want 0/);
bad("d-4 nothing reached the server", evaluateOfflineReplay(off({ reportedOnline: 0, reportedAfter: 0 })), /0 reported submission\(s\) after reconnecting/);
bad("d-4 online count not recorded", evaluateOfflineReplay(off({ steps: ["offline submit", "replay"], reportedOnline: undefined })), /online count .* not recorded/);
bad("d-4 nothing to replay", evaluateOfflineReplay(off({ steps: ["offline submit", "online count"], reportedOnline: 0, error: "no report request was made while offline or after reconnecting, so there is nothing to replay" })), /nothing to replay/);
bad("d-4 plan not reported", evaluateOfflineReplay(off({ after: { visible: true, status: "issued" } })), /want reported/);

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
