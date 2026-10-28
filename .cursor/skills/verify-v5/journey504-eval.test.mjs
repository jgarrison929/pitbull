// Unit must-fails for the 5.0.4 first-task journey rules (journey504.mjs). No browser, no network.
import assert from "node:assert/strict";
import { evaluateJourney504, JOURNEYS504 } from "./journey504.mjs";

const lines = [];
let n = 0;
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); n++; };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as required: ${name} → ${f.find((x) => re.test(x))}`); n++; };
const taps = (k) => [{ kind: "tap", label: "role card" }, { kind: "tap", label: "next step" }, ...(k ? [{ kind: "tap", label: "action" }] : [])];
// S8 (#86): the one-tap hook, data-role="<role>". On /app on the first next-step (the one tapped here, index 0); on the
// action screen on the measured control; none on the read-only end screens.
const hook = (role, o = {}) => ({ path: "/app", count: 1, hooks: [`a[data-testid="next-step"] "x"`], others: [], isTarget: true, targetRole: role, target: `a[data-testid="next-step"] "x"`, ...o });
const row = (key, o = {}) => {
  const J = JOURNEYS504[key];
  return { key, name: J.name, role: J.role, width: 390, height: 844, limit: J.limit, entries: taps(!!J.target), bad: [], posts: 1, firstActionTaps: 1, scrollNeed: J.target ? 0 : undefined, landed: "/app/jobs/25-031#plan-41", deadEnd: { nextStep: false, done: false, forward: true, path: "/app/jobs/25-031" }, doneState: { itemLeft: [] },
    appHook: key === "pm-estimate" ? { ...hook(J.role, { isTarget: false, targetRole: null, target: 'a "Approve the estimate"' }), tappedIndex: 1 } : { ...hook(J.role), tappedIndex: 0 }, ...(J.target ? { targetFound: true, actionHook: hook(J.role, { path: "/app/jobs/25-031" }) } : { endHook: hook(J.role, { count: 0, hooks: [], isTarget: false, targetRole: null, target: null, path: "/app/jobs/24-077" }) }), ...o };
};

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
// super-approve done state (spec #89, main 9497f7e9): job-actual, CPI and EAC unchanged; job-ac-since-lock = before +
// the approved cost (sum of approval-pending-* data-cents), text "+$X posted since Period 1 lock". checks.test.mjs has
// the full must-fail list; these keep the journey evaluator's own file honest.
// Spec #93 (main 9d05bd8d) line 392: the 24-118 readings are taken at 1280×800 whatever the journey size (row() is 390×844).
const e6r = (o = {}) => ({ actual: 3079353280, cpiText: "0.97", eac: 3290000000, since: { count: 0, visible: false, cents: null, rawCents: null, text: null }, pending: { count: 1, cents: [668800], codes: ["03-210"] }, readAt: { width: 1280, height: 800 }, ...o });
const e6line = (c) => ({ count: 1, visible: true, cents: c, rawCents: String(c), text: `+$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} posted since Period 1 lock` });
const superDone = (after = {}) => ({ settled: true, before: e6r(), after: e6r({ pending: { count: 0, cents: [], codes: [] }, since: e6line(668800), ...after }) });
ok("super-approve control (#89: AC flat, since-lock +$6,688.00)", evaluateJourney504(row("super-approve", { doneState: superDone() })));
ok("super-approve 390×844 journey with its 24-118 readings at 1280×800", evaluateJourney504(row("super-approve", { width: 390, height: 844, doneState: superDone() })));
bad("super-approve 390×844 read at the journey size (lead's false-FAIL path)", evaluateJourney504(row("super-approve", { doneState: { settled: true, before: e6r({ readAt: { width: 390, height: 844 }, pending: { count: 0, cents: [], codes: [] } }), after: e6r({ readAt: { width: 390, height: 844 }, pending: { count: 0, cents: [], codes: [] }, since: e6line(668800) }) } })), /before: 24-118 read at 390×844 \(want 1280×800/);
bad("super-approve posts twice", evaluateJourney504(row("super-approve", { posts: 2, doneState: superDone() })), /posted 2 time/);
bad("super-approve AC rises (#89: AC stays at the cutoff)", evaluateJourney504(row("super-approve", { doneState: superDone({ actual: 3079353280 + 668800 }) })), /job-actual 3079353280¢ → 3080022080¢ after the approval \(want unchanged/);
bad("super-approve since-lock unchanged", evaluateJourney504(row("super-approve", { doneState: superDone({ since: e6r().since }) })), /job-ac-since-lock missing \(want 668800¢\)/);
bad("super-approve since-lock wrong amount", evaluateJourney504(row("super-approve", { doneState: superDone({ since: e6line(668700) }) })), /job-ac-since-lock data-cents 668700 \(want 0 \+ 668800 = 668800¢\)/);
// S8 must-fails (lead): zero matches, two visible matches, and a match that is not the measured action all fail.
bad("S8 action screen with zero data-role hooks", evaluateJourney504(row("super-submit", { actionHook: hook("superintendent", { path: "/app/jobs/25-031", count: 0, hooks: [], isTarget: false, targetRole: null }) })), /action screen \/app\/jobs\/25-031 has 0 visible data-role="superintendent" element\(s\)/);
bad("S8 action screen with two visible hooks", evaluateJourney504(row("super-submit", { actionHook: hook("superintendent", { path: "/app/jobs/25-031", count: 2, hooks: ["button a", "button b"] }) })), /has 2 visible data-role="superintendent" element\(s\)/);
bad("S8 the hook is not the measured action", evaluateJourney504(row("super-submit", { actionHook: hook("superintendent", { path: "/app/jobs/25-031", isTarget: false, targetRole: null }) })), /the measured action .* is not the data-role="superintendent" hook \(it has data-role=none\)/);
bad("S8 data-role=\"primary-action\" on the action is not the role hook", evaluateJourney504(row("super-submit", { actionHook: hook("superintendent", { path: "/app/jobs/25-031", count: 0, hooks: [], isTarget: false, targetRole: "primary-action", others: ['button "Submit plan" data-role="primary-action"'] }) })), /it has data-role="primary-action"/);
bad("S8 /app with zero hooks", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { count: 0, hooks: [], isTarget: false, targetRole: null }), tappedIndex: 0 } })), /\/app has 0 visible data-role="superintendent"/);
bad("S8 /app with two hooks", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { count: 2 }), tappedIndex: 0 } })), /\/app has 2 visible data-role="superintendent"/);
bad("S8 /app hook is not the tapped first next-step", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { isTarget: false, targetRole: null }), tappedIndex: 0 } })), /the tapped first next-step .* is not the data-role="superintendent" hook/);
ok("S8 a later next-step (index 1) needs no hook of its own", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { isTarget: false, targetRole: null }), tappedIndex: 1 } })));
bad("S8 /app hook on something other than the first next-step", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { isTarget: false, firstStepIsHook: false, hooks: ['a "Jobs"'] }), tappedIndex: 1 } })), /\/app: the data-role="superintendent" hook a "Jobs" is not the first next-step/);
bad("S8 wrong role value on /app (data-role=\"pm\" for the superintendent)", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { count: 0, hooks: [], isTarget: false, targetRole: "pm", others: ['a[data-testid="next-step"] "Submit" data-role="pm"'] }), tappedIndex: 0 } })), /\/app has 0 visible data-role="superintendent".*other data-role: .*data-role="pm"/);
bad("S8 data-role=\"primary-action\" on /app", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { count: 0, hooks: [], isTarget: false, targetRole: "primary-action", others: ['a[data-testid="next-step"] "Submit" data-role="primary-action"'] }), tappedIndex: 0 } })), /it has data-role="primary-action"/);
bad("S8 another visible data-role element on /app", evaluateJourney504(row("super-submit", { appHook: { ...hook("superintendent", { others: ['button "Menu" data-role="pm"'] }), tappedIndex: 0 } })), /\/app has other visible data-role element\(s\)/);
ok("S8 pm-estimate: its \"Approve the estimate\" tap carries no data-role (#86 exception)", evaluateJourney504(row("pm-estimate", { doneState: {}, appHook: { ...hook("pm", { isTarget: false, targetRole: null, target: 'a "Approve the estimate"' }), tappedIndex: 1 } })));
ok("S8 pm-estimate exception holds even when its link is first", evaluateJourney504(row("pm-estimate", { doneState: {}, appHook: { ...hook("pm", { isTarget: false, targetRole: null }), tappedIndex: 0 } })));
bad("S8 pm-estimate link carrying a hook", evaluateJourney504(row("pm-estimate", { doneState: {}, appHook: { ...hook("pm", { count: 2, targetRole: "pm" }), tappedIndex: 1 } })), /"Approve the estimate" next-step carries data-role="pm"/);
bad("S8 hook not read at all", evaluateJourney504(row("super-submit", { appHook: undefined })), /one-tap hook on \/app not read/);
bad("S8 read-only end screen carries a hook", evaluateJourney504(row("exec-open", { doneState: { jobPage: true, kpi: true, status: true }, endHook: hook("executive", { path: "/app/jobs/24-077" }) })), /read-only end screen \/app\/jobs\/24-077 carries 1 data-role="executive"/);
console.log(lines.join("\n"));
console.log(`journey504-eval: ${n} cases OK`);
{
  const src = (await import("node:fs")).readFileSync(new URL("./journey504.mjs", import.meta.url), "utf8");
  if (/firstActionTaps\s*=\s*1\b/.test(src)) throw new Error("firstActionTaps must be measured, not hard-coded");
}
