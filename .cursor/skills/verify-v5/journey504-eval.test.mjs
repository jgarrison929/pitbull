// Unit must-fails for the 5.0.4 first-task journey rules (journey504.mjs). No browser, no network.
import assert from "node:assert/strict";
import { evaluateJourney504, JOURNEYS504 } from "./journey504.mjs";

const lines = [];
let n = 0;
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); n++; };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as required: ${name} → ${f.find((x) => re.test(x))}`); n++; };
const taps = (k) => [{ kind: "tap", label: "role card" }, { kind: "tap", label: "next step" }, ...(k ? [{ kind: "tap", label: "action" }] : [])];
const row = (key, o = {}) => ({ key, name: JOURNEYS504[key].name, role: JOURNEYS504[key].role, width: 390, height: 844, limit: JOURNEYS504[key].limit, entries: taps(!!JOURNEYS504[key].target), bad: [], posts: 1, firstActionTaps: 1, scrollNeed: JOURNEYS504[key].target ? 0 : undefined, landed: "/app/jobs/25-031#plan-41", deadEnd: { nextStep: false, done: false, forward: true, path: "/app/jobs/25-031" }, doneState: { itemLeft: [] }, ...o });

ok("super-submit control", evaluateJourney504(row("super-submit")));
bad("first action 2 taps from /app (measured)", evaluateJourney504(row("super-submit", { firstActionTaps: 2 })), /first real action is 2 taps from \/app/);
bad("first action not measured", evaluateJourney504(row("super-submit", { firstActionTaps: undefined })), /first real action is undefined taps/);
ok("confirm click is not a tap", evaluateJourney504(row("pm-estimate", { entries: [...taps(true), { kind: "confirm", action: "pm-estimate", sawOpen: true, role: "alertdialog", label: "confirm" }], doneState: {} })));
bad("4 taps (extra tap)", evaluateJourney504(row("super-submit", { entries: [...taps(true), { kind: "tap", label: "user menu" }] })), /4 counted taps > 3/);
bad("double confirm counts", evaluateJourney504(row("pm-estimate", { entries: [...taps(true), { kind: "confirm", action: "pm-estimate", sawOpen: true, role: "alertdialog", label: "c1" }, { kind: "confirm", action: "pm-estimate", sawOpen: true, role: "alertdialog", label: "c2" }], doneState: {} })), /4 counted taps > 3/);
bad("scroll to action 120 px (rc: CO section at the bottom)", evaluateJourney504(row("pm-co", { scrollNeed: 120, doneState: { before: { cb: 0, eac: 0 }, after: { cb: 6000000, eac: 6000000 } } })), /scroll to action 120 px \(want 0 px\)/);
bad("a 404 on the way", evaluateJourney504(row("super-submit", { bad: ["404 GET /app/jobs/25-031/plans/x"] })), /1 response\(s\) with 4xx\/5xx/);
bad("dead end", evaluateJourney504(row("super-submit", { deadEnd: { nextStep: false, done: false, forward: false, path: "/app/jobs/25-031" } })), /dead end on \/app\/jobs\/25-031/);
ok("done element is not a dead end", evaluateJourney504(row("super-submit", { deadEnd: { nextStep: false, done: true, forward: false, path: "/app" } })));
bad("next step missing (rc without the item)", evaluateJourney504({ ...row("pm-forecast"), error: "no next-step on /app matches /^Review the forecast on /", stepLabels: ["Approve CO-001 on 25-031: $60,000.00"] }), /no next-step on \/app matches/);
bad("item still listed after submit", evaluateJourney504(row("foreman-submit", { doneState: { itemLeft: [], superLeft: ["Submit tomorrow's plan: Bridge Crew 2 on 25-031"] } })), /superintendent still sees/);
ok("pm-forecast control (2 taps)", evaluateJourney504(row("pm-forecast", { doneState: { costItemPage: true, cb: true } })));
bad("pm-forecast 3 taps", evaluateJourney504(row("pm-forecast", { entries: taps(true), doneState: { costItemPage: true, cb: true } })), /3 counted taps > 2/);
bad("pm-forecast no cost-item-cb", evaluateJourney504(row("pm-forecast", { doneState: { costItemPage: true, cb: false } })), /cost-item-cb not visible/);
ok("exec-open control", evaluateJourney504(row("exec-open", { doneState: { jobPage: true, kpi: true, status: true } })));
bad("exec-open job-status missing (rc)", evaluateJourney504(row("exec-open", { doneState: { jobPage: true, kpi: true, status: false } })), /job-status in viewport false/);
bad("pm-co ΔCB off by one cent", evaluateJourney504(row("pm-co", { doneState: { before: { cb: 0, eac: 0 }, after: { cb: 5999999, eac: 6000000 } } })), /ΔCB 5999999¢/);
bad("super-approve posts twice", evaluateJourney504(row("super-approve", { posts: 2, doneState: { before: { ac: 1 }, after: { ac: 2 } } })), /posted 2 time/);
bad("super-approve AC flat", evaluateJourney504(row("super-approve", { doneState: { before: { ac: 5 }, after: { ac: 5 } } })), /job-actual 5 → 5/);
console.log(lines.join("\n"));
console.log(`journey504-eval: ${n} cases OK`);
{
  const src = (await import("node:fs")).readFileSync(new URL("./journey504.mjs", import.meta.url), "utf8");
  if (/firstActionTaps\s*=\s*1\b/.test(src)) throw new Error("firstActionTaps must be measured, not hard-coded");
}
