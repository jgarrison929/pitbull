// Unit must-fails for the 5.0.4 page-pass evaluators in spec504.mjs (no browser): each control row PASSes and each
// mutant or below-threshold row FAILs. The browser halves run in spec504-mustfail.test.mjs.
import assert from "node:assert/strict";
import {
  evaluateAssistantCollapsed, evaluateAtRisk, evaluateCostRowsFit, evaluateFirstUse, evaluateFullWidth,
  evaluateHomeOrder, evaluateKpiFold, evaluateNamedTargets, evaluatePhoneTables, evaluatePlanCards, evaluateTabular, pickPlanLink, evaluateFirstTarget, evaluateStepCount, evaluateDoneState, evaluateRequiredFields, evaluateDemoPath,
} from "./spec504.mjs";
import { evaluateFigures, FIGURE_GUARD, stripFigureExceptions } from "./checks.mjs";

const lines = [];
const row = (over) => ({ role: "pm", width: 390, height: 844, theme: "light", path: "/app", ...over });
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as required: ${name}`); };
const with_ = (o, p) => ({ ...o, ...p });

// a-3
const home = { firstSection: "next-steps", firstStepBottom: 200, assistantTop: 260, strip: null, stepsTop: 80 };
ok("a-3 control (no strip)", evaluateHomeOrder(row({ role: "foreman", data: home })));
ok("a-3 control (strip above, no indexes)", evaluateHomeOrder(row({ role: "foreman", data: with_(home, { strip: { bottom: 80, indexes: 0 } }) })));
bad("a-3 KPI strip first", evaluateHomeOrder(row({ data: with_(home, { firstSection: "kpi-strip" }) })), /first section in main is kpi-strip/);
bad("a-3 assistant above first step", evaluateHomeOrder(row({ data: with_(home, { assistantTop: 199 }) })), /assistant top 199 is above/);
bad("a-3 strip below steps", evaluateHomeOrder(row({ data: with_(home, { strip: { bottom: 81, indexes: 0 } }) })), /job-strip bottom 81 is not above/);
bad("a-3 strip with CPI", evaluateHomeOrder(row({ data: with_(home, { strip: { bottom: 60, indexes: 1 } }) })), /holds 1 -cpi\/-spi/);

// a-8
const t = { w: 44, h: 44 };
const asst = { input: { w: 300, h: 44 }, mic: t, send: t, messages: 3, show: { w: 120, h: 44 } };
ok("a-8 control", evaluateAssistantCollapsed(row({ data: asst })));
bad("a-8 mic 43", evaluateAssistantCollapsed(row({ data: with_(asst, { mic: { w: 43, h: 44 } }) })), /mic button 43×44 < 44×44/);
bad("a-8 send missing", evaluateAssistantCollapsed(row({ data: with_(asst, { send: null }) })), /send button not visible/);
bad("a-8 4 messages", evaluateAssistantCollapsed(row({ data: with_(asst, { messages: 4 }) })), /4 assistant-message elements/);
bad("a-8 show 43 tall", evaluateAssistantCollapsed(row({ data: with_(asst, { show: { w: 120, h: 43 } }) })), /43 px tall < 44/);
bad("a-8 show missing (rc)", evaluateAssistantCollapsed(row({ data: with_(asst, { show: null }) })), /assistant-show-conversation not visible/);

// b-4
const good4 = "Job 25-031 Cost performance (CPI) 0.97 Schedule performance (SPI) 1.01 Earned value (EV) $1.2M Actual cost (AC) $1.1M Planned value (PV) $1.3M Estimate at completion (EAC) $2.0M later CPI EV";
ok("b-4 control", evaluateFirstUse(row({ data: { text: good4 } })));
bad("b-4 bare CPI first", evaluateFirstUse(row({ data: { text: `CPI 0.97 ${good4}` } })), /first "CPI" is in/);
bad("b-4 EV inside EVM is not a use; bare EV first", evaluateFirstUse(row({ data: { text: good4.replace("Earned value (EV)", "EV") } })), /first "EV"/);
bad("b-4 missing PV", evaluateFirstUse(row({ data: { text: good4.replace("Planned value (PV)", "Planned") } })), /"PV" never appears/);
ok("b-4 EAC does not count as AC", evaluateFirstUse(row({ data: { text: good4.replace("Actual cost (AC)", "Actual cost (AC)") } })));

// b-5 (#78 seed: 24-077 and 25-031 at risk)
const cvRef = { "24-077": { atRisk: true, cv: -25500000 }, "24-118": { atRisk: false, cv: 100000 }, "25-031": { atRisk: true, cv: -4200000 } };
const line = (text, cents, title = "$x") => ({ text, dollars: [...text.matchAll(/[−-]?\$[\d,.]+[KMB]?/g)].map((m) => m[0]), figures: [{ text: "$x", cents: String(cents), title }] });
const risk = { present: true, lines: [line("I-5 Culvert (24-077) is $255K over cost", -25500000), line("Cedar Creek (25-031) is $42K over cost", -4200000)] };
ok("b-5 control", evaluateAtRisk(row({ role: "executive", cvRef, data: risk })));
ok("b-5 foreman absent", evaluateAtRisk(row({ role: "foreman", data: { present: false } })));
bad("b-5 foreman sees it", evaluateAtRisk(row({ role: "foreman", data: risk })), /present for the foreman/);
bad("b-5 rc (no data-cents on the figure)", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [{ text: "I-5 Culvert (24-077) is $255K over cost", dollars: ["$255K"], figures: [] }, risk.lines[1]] } })), /1 dollar figures but 0/);
bad("b-5 cents off by 1", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [line("I-5 Culvert (24-077) is $255K over cost", -25500001), risk.lines[1]] } })), /data-cents -25500001 ≠ 24-077 cost variance -25500000/);
bad("b-5 no title", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [line("I-5 Culvert (24-077) is $255K over cost", -25500000, null), risk.lines[1]] } })), /has no title/);
bad("b-5 missing phrase", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [line("I-5 Culvert (24-077) is $255K off", -25500000), risk.lines[1]] } })), /neither "over cost"/);
bad("b-5 only 24-077 (25-031 missing)", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [risk.lines[0]] } })), /seed at-risk jobs are \[24-077, 25-031\]/);
bad("b-5 extra line", evaluateAtRisk(row({ role: "executive", cvRef, data: { present: true, lines: [...risk.lines, line("Harbor (24-118) is $1K over cost", 100000)] } })), /seed at-risk jobs are \[24-077, 25-031\]/);
bad("b-5 reference unreadable", evaluateAtRisk(row({ role: "executive", cvRef: { "24-077": null }, data: risk })), /reference unreadable/);
// d-6
const fw = { buttons: [{ label: "submit-plan", w: 342, h: 44, cardContent: 342.5 }] };
ok("d-6 control", evaluateFullWidth(row({ path: "/app/jobs/25-031", data: fw })));
bad("d-6 narrow", evaluateFullWidth(row({ path: "/app/jobs/25-031", data: { buttons: [{ label: "submit-plan", w: 120, h: 44, cardContent: 342 }] } })), /width 120\.0 ≠ card content box 342\.0/);
bad("d-6 short", evaluateFullWidth(row({ path: "/app/jobs/25-031", data: { buttons: [{ label: "submit-plan", w: 342, h: 40, cardContent: 342 }] } })), /40 px tall < 44/);
bad("d-6 report missing on 24-077", evaluateFullWidth(row({ path: "/app/jobs/24-077", data: { buttons: [] } })), /Report day's work not visible/);
ok("d-6 superintendent on 24-077 is not in #80 d-6", evaluateFullWidth(row({ role: "superintendent", path: "/app/jobs/24-077", data: { buttons: [] } })));
bad("d-6 superintendent on 25-031 still checked", evaluateFullWidth(row({ role: "superintendent", path: "/app/jobs/25-031", data: { buttons: [] } })), /submit-plan not visible/);

// e-2
const pt = { tables: 0, past: 0, clientWidth: 390, entryCards: true, entries: [{ amountPrimary: true, labor: true, mh: true, rate: true }, { amountPrimary: true, labor: false, mh: false, rate: false }] };
ok("e-2 control", evaluatePhoneTables(row({ path: "/app/jobs/24-077/cost-items/07-300", data: pt })));
bad("e-2 table", evaluatePhoneTables(row({ path: "/app/jobs/24-077", data: with_(pt, { tables: 1 }) })), /1 visible table/);
bad("e-2 overflow", evaluatePhoneTables(row({ path: "/app/jobs/24-077", data: with_(pt, { past: 2 }) })), /2 element\(s\) in main past clientWidth 390/);
bad("e-2 rate behind a tap", evaluatePhoneTables(row({ path: "/app/jobs/24-077/cost-items/07-300", data: with_(pt, { entries: [{ amountPrimary: true, labor: true, mh: true, rate: false }] }) })), /rate hidden without a tap/);
bad("e-2 amount secondary", evaluatePhoneTables(row({ path: "/app/jobs/24-077/cost-items/07-300", data: with_(pt, { entries: [{ amountPrimary: false, labor: false }] }) })), /not its primary figure/);

// e-4
const span = (o) => ({ code: "07-300", text: "$690,000.00", sw: 90, cw: 90, right: 300, contentRight: 300, ...o });
ok("e-4 control", evaluateCostRowsFit(row({ data: { spans: [span(), { code: "07-300", gap: 8, pair: ["$1", "$2"] }] } })));
bad("e-4 spill", evaluateCostRowsFit(row({ data: { spans: [span({ sw: 91 })] } })), /scrollWidth 91 > clientWidth 90/);
bad("e-4 past parent", evaluateCostRowsFit(row({ data: { spans: [span({ right: 301 })] } })), /past its parent's content box/);
bad("e-4 gap 7", evaluateCostRowsFit(row({ data: { spans: [{ code: "07-300", gap: 7, pair: ["$1", "$2"] }] } })), /7\.0 px apart \(< 8\)/);

// e-5
ok("e-5 control", evaluateKpiFold(row({ width: 320, height: 568, data: { eacTop: 400, cpiTop: 567, hyphenMoney: 0 } })));
bad("e-5 CPI at 568", evaluateKpiFold(row({ width: 320, height: 568, data: { eacTop: 400, cpiTop: 568, hyphenMoney: 0 } })), /job-cpi top 568 is not above 568/);
bad("e-5 hyphen money", evaluateKpiFold(row({ width: 320, height: 568, data: { eacTop: 400, cpiTop: 500, hyphenMoney: 1 } })), /1 "-\$"/);

// f-1
// f-1 (Planner ruling 2026-10-27, #86): plan-detail-line-reported reads exactly "Not reported yet" before the first
// report and "Reported <qty> <unit> · <MH> MH" after it; "Reported — · — MH" or any other placeholder fails.
const planned = [{ label: "", text: "Planned 120 LF · 12.0 MH" }];
const rep = (text, visible = true) => ({ figures: planned, reported: { visible, text } });
const allFour = rep("Not reported yet");
const rcLine = { figures: [{ label: "", text: "Planned 120 LF" }], reported: { visible: true, text: "Reported 100 LF · 10.0 MH" } };
const PC = (l, o = {}) => evaluatePlanCards(row({ data: { tables: 0, past: 0, scrollers: 0, lines: [l] }, ...o }));
ok("f-1 control (before the first report: \"Not reported yet\")", PC(allFour));
ok("f-1 control (after it: Reported 175 CY · 42.0 MH)", PC(rep("Reported 175 CY · 42.0 MH")));
ok("f-1 control (draft 25-031 plan: \"Not reported yet\")", PC(allFour, { path: "/app/jobs/25-031/plans/41" }));
ok("f-1 control (planned figures under their own labels)", PC({ figures: [{ label: "Planned MH", text: "12.0" }, { label: "", text: "Planned 120 LF" }], reported: { visible: true, text: "Reported 1,200 LF · 112.5 MH" } }));
bad("f-1 rc layout (planned MH behind Line detail)", PC(rcLine), /lacks visible planned MH/);
bad("f-1 rc/5.0.4 placeholder \"Reported — · — MH\"", PC(rep("Reported — · — MH")), /reported figure "Reported — · — MH" \(want "Not reported yet" before the first report/);
bad("f-1 placeholder \"Reported —\"", PC(rep("Reported —")), /reported figure "Reported —"/);
bad("f-1 placeholder \"Reported 0 LF · — MH\"", PC(rep("Reported 0 LF · — MH")), /reported figure "Reported 0 LF · — MH"/);
bad("f-1 reported quantity without its MH", PC(rep("Reported 175 CY")), /reported figure "Reported 175 CY"/);
bad("f-1 placeholder on the draft plan before the first report", PC(rep("Reported — · — MH"), { path: "/app/jobs/25-031/plans/41" }), /on a draft plan \(want exactly "Not reported yet"\)/);
bad("f-1 figures on a draft plan (status draft)", PC(rep("Reported 1 LF · 1.0 MH"), { data: { tables: 0, past: 0, scrollers: 0, planStatus: "Draft", lines: [rep("Reported 1 LF · 1.0 MH")] } }), /on a draft plan/);
bad("f-1 wording variant \"Not yet reported\"", PC(rep("Not yet reported")), /reported figure "Not yet reported"/);
bad("f-1 empty reported element", PC(rep("")), /reported figure ""/);
bad("f-1 reported element hidden", PC(rep("Not reported yet", false)), /is not visible/);
bad("f-1 no reported element", PC({ figures: planned }), /no \[data-testid="plan-detail-line-reported"\]/);
bad("f-1 sideways scroll", evaluatePlanCards(row({ data: { tables: 0, past: 0, scrollers: 1, lines: [allFour] } })), /scroll sideways/);
bad("f-1 table", evaluatePlanCards(row({ data: { tables: 1, past: 0, scrollers: 0, lines: [allFour] } })), /visible table/);
assert.equal(pickPlanLink("/app/jobs/25-031", [{ status: "issued", href: "/a" }, { status: "draft", href: "/b" }]), "/b");
assert.equal(pickPlanLink("/app/jobs/25-031", [{ status: "draft", href: "/a" }, { status: "draft", href: "/b" }]), null);
assert.equal(pickPlanLink("/app/jobs/24-077", [{ status: "issued", href: "/x" }]), "/x");
lines.push("passes: f-1 plan-link picks (25-031 single draft; ambiguous → none)");

// c-1 / e-1
const card = (o) => ({ testid: "job-eac", top: 100, aboveFold: true, costRow: false, rollup: false, primary: 1, secondary: 2, stray: [], ...o });
const frow = (cards, o) => ({ role: "superintendent", width: 390, path: "/app/jobs/24-077", cards, ...o });
ok("c-1 control", evaluateFigures(frow([card(), card({ aboveFold: false, primary: 0, secondary: 5 })])));
bad("c-1 two primaries above fold", evaluateFigures(frow([card({ primary: 2 })])), /2 primary figures/);
bad("c-1 three secondaries", evaluateFigures(frow([card({ secondary: 3 })])), /3 secondary figures/);
bad("c-1 stray number", evaluateFigures(frow([card({ stray: ["0.93"] })])), /number outside data-figure: "0\.93"/);
ok("c-1 not at 1280", evaluateFigures(frow([card({ primary: 2 })], { width: 1280 })));
ok("e-1 control (below-fold cost row for super is c-1 only)", evaluateFigures(frow([card({ aboveFold: false, costRow: true, primary: 0 })])));
bad("e-1 PM below-fold cost row", evaluateFigures(frow([card({ testid: "cost-tree-row", code: "07", aboveFold: false, costRow: true, primary: 0 })], { role: "pm" })), /cost-tree-row 07 has 0 primary/);
bad("e-1 roll-up exact money", evaluateFigures(frow([card({ testid: "cost-tree-row", code: "07", costRow: true, rollup: true, money: [{ text: "$2,000,000.00", cents: "200000000", title: "$2,000,000.00" }] })], { role: "executive" })), /is not usdShort/);
bad("e-1 roll-up no title", evaluateFigures(frow([card({ testid: "cost-tree-row", code: "07", costRow: true, rollup: true, money: [{ text: "$2.0M", cents: "200000000", title: null }] })], { role: "executive" })), /lacks title or data-cents/);
ok("e-1 roll-up control", evaluateFigures(frow([card({ testid: "cost-tree-row", code: "07", costRow: true, rollup: true, money: [{ text: "$2.0M", cents: "200000000", title: "$2,000,000.00" }, { text: "$255K", cents: "25500000", title: "$255,000.00" }] })], { role: "executive" })));
// guard and date patterns
// #78's own examples: each exception deleted leaves no guard hit; everything else still hits.
const hit = (t) => FIGURE_GUARD.test(stripFigureExceptions(t));
for (const t of ["Tue, Oct 27", "Tuesday, Oct 27", "Oct 27, 2026, 4:08 AM", "Dec 2026", "2026-10-27", "2026-10-27 11:08 UTC", "24-077", "04-210", "02 Earthwork", "CO-001", "Approve CO-001 on 25-031"]) assert.ok(!hit(t), `exception "${t}" still hits`);
for (const t of ["12 CY", "Bridge Crew 2", "I-5 Culvert", "0.93", "$255K", "Period 2", "02 earthwork", "co-001", "27 LF"]) assert.ok(hit(t), `"${t}" must still hit the guard`);
lines.push("passes: c-1 #78 exceptions (dates ×3, job/leaf code, roll-up code + name, CO number) deleted in order; crew numbers, I-5, quantities still hit");

// c-3 named
ok("c-3 named control", evaluateNamedTargets(row({ data: { "submit-plan": [{ w: 342, h: 44, fontPx: 16, text: "Submit plan" }] } }), {}));
bad("c-3 named Edit 32 px", evaluateNamedTargets(row({ data: { "plan line Edit": [{ w: 60, h: 32, fontPx: 16, text: "Edit" }] } }), {}), /plan line Edit "Edit" 60×32 < 44×44/);
bad("c-3 T1 input 14 px text", evaluateNamedTargets(row({ data: { "actualMh input": [{ w: 100, h: 44, fontPx: 14, text: "actualMh[1]" }] } }), { minFontPx: 16 }), /text 14px < 16px/);

// c-7 (#78): figures tabular only; numeric cells tabular + end-aligned (text-align or Range within 2 px)
const cell = (o) => ({ kind: "figure", tag: "span", figure: "primary", text: "$1.2M", tabular: true, fvn: null, ...o });
const num = (o) => ({ kind: "numeric", tag: "td", figure: null, text: "$1,200.00", tabular: true, fvn: null, end: { ok: true, align: "right" }, ...o });
ok("c-7 control", evaluateTabular(row({ data: { cells: [cell(), num(), num({ end: { ok: true, align: "start", gap: 1.5 } })] } })));
ok("c-7 MetricCard figure left-aligned is fine", evaluateTabular(row({ data: { cells: [cell({ end: undefined })] } })));
bad("c-7 proportional figure", evaluateTabular(row({ data: { cells: [cell({ tabular: false, fvn: "normal" })] } })), /font-variant-numeric "normal" \(no tabular-nums\)/);
bad("c-7 proportional numeric cell", evaluateTabular(row({ data: { cells: [num({ tabular: false, fvn: "normal" })] } })), /numeric td .*no tabular-nums/);
bad("c-7 numeric cell left, 2.5 px off", evaluateTabular(row({ data: { cells: [num({ end: { ok: false, align: "start", gap: 2.5 } })] } })), /text-align "start" and its text ends 2\.5 px/);
bad("c-7 nothing found", evaluateTabular(row({ data: { cells: [] } })), /no figure or numeric cell/);
// a-2 (#78 test ids)
const clicked = { label: "Submit tomorrow's plan: Bridge Crew 2 on 25-031", href: "/app/jobs/25-031#plan-41" };
const sup = (o = {}) => ({ vh: 844, anchor: { planId: "41", anchorFound: true }, targets: { "submit-plan in plan-card 41": { top: 600, bottom: 644 } }, ...o });
ok("a-2 control", evaluateFirstTarget(row({ role: "superintendent", clicked, landed: "/app/jobs/25-031#plan-41", data: sup() })));
bad("a-2 below the fold", evaluateFirstTarget(row({ role: "superintendent", clicked, landed: "/app/jobs/25-031", data: sup({ targets: { "submit-plan in plan-card 41": { top: 830, bottom: 874 } } }) })), /bottom 874 not inside viewport 0\.\.844/);
bad("a-2 link without #plan-<id> (rc)", evaluateFirstTarget(row({ role: "superintendent", clicked: { ...clicked, href: "/app/jobs/25-031" }, landed: "/app/jobs/25-031", data: sup({ anchor: { planId: null, anchorFound: false }, targets: { "submit-plan in plan-card (no #plan-<id> in link)": null } }) })), /has no #plan-<id>/);
bad("a-2 anchor id missing", evaluateFirstTarget(row({ role: "superintendent", clicked, landed: "/app/jobs/25-031", data: sup({ anchor: { planId: "41", anchorFound: false } }) })), /anchor id "plan-41" not on the page/);
bad("a-2 submit-plan wrong text", evaluateFirstTarget(row({ role: "superintendent", clicked, landed: "/app/jobs/25-031", data: sup({ targets: { "submit-plan in plan-card 41": { top: 600, bottom: 644 }, "submit-plan text": { wrongText: "Submit", want: "Submit plan" } } }) })), /reads "Submit" \(want "Submit plan"\)/);
bad("a-2 PM co-approve missing (rc)", evaluateFirstTarget(row({ role: "pm", clicked, landed: "/app/jobs/25-031", data: { vh: 844, anchor: { anchorFound: false }, targets: { "co-approve in CO-001 co-card": null } } })), /co-approve in CO-001 co-card not found/);
bad("a-2 PM anchor co-CO-001 missing", evaluateFirstTarget(row({ role: "pm", clicked, landed: "/app/jobs/25-031", data: { vh: 844, anchor: { anchorFound: false }, targets: { "co-approve in CO-001 co-card": { top: 10, bottom: 54 } } } })), /anchor id "co-CO-001"/);
ok("a-2 executive control", evaluateFirstTarget(row({ role: "executive", clicked, landed: "/app/jobs/24-077", data: { vh: 800, anchor: { planId: null, anchorFound: null }, targets: { "[data-card] holding job-eac": { top: 100, bottom: 200 }, "[data-card] holding job-cpi": { top: 210, bottom: 300 }, "job-status": { top: 40, bottom: 60 } } } })));
bad("job-status missing (rc)", evaluateFirstTarget(row({ role: "executive", clicked, landed: "/app/jobs/24-077", data: { vh: 800, anchor: { planId: null, anchorFound: null }, targets: { "[data-card] holding job-eac": { top: 100, bottom: 200 }, "[data-card] holding job-cpi": { top: 210, bottom: 300 }, "job-status": null } } })), /job-status not found/);
bad("job-status below the fold", evaluateFirstTarget(row({ role: "executive", clicked, landed: "/app/jobs/24-077", data: { vh: 800, anchor: { planId: null, anchorFound: null }, targets: { "[data-card] holding job-eac": { top: 100, bottom: 200 }, "[data-card] holding job-cpi": { top: 210, bottom: 300 }, "job-status": { top: 790, bottom: 812 } } } })), /job-status top 790 bottom 812/);
bad("a-2 no click", evaluateFirstTarget(row({ data: {} })), /not clicked/);
// a-6 (#78: 2 / 2 / 4 / 4, no overflow line)
ok("a-6 pm 4", evaluateStepCount(row({ role: "pm", data: { count: 4 } })));
bad("a-6 pm 3", evaluateStepCount(row({ role: "pm", data: { count: 3 } })), /3 next steps after reset \(want 4\)/);
bad("a-6 foreman 3", evaluateStepCount(row({ role: "foreman", data: { count: 3 } })), /want 2/);
ok("a-6 executive 4", evaluateStepCount(row({ role: "executive", data: { count: 4 } })));
bad("a-6 executive 2 (rc: one at-risk + CO-001)", evaluateStepCount(row({ role: "executive", data: { count: 2 } })), /want 4/);
bad("a-6 executive 5", evaluateStepCount(row({ role: "executive", data: { count: 5 } })), /want 4/);
bad("a-6 overflow line", evaluateStepCount(row({ role: "superintendent", data: { count: 2, overflow: true } })), /overflow line/);
// a-4
const done = { steps: ["a", "b"], drafts: 1, foreman: { steps: 0, done: "All done for today. 24-077 is reported." }, superLabels: ["Approve today's report on 24-118"] };
ok("a-4 control", evaluateDoneState(done));
bad("a-4 item left", evaluateDoneState(with_(done, { foreman: { steps: 1, done: null } })), /foreman has 1 next-step/);
bad("a-4 short done text", evaluateDoneState(with_(done, { foreman: { steps: 0, done: "Done 24-077" } })), /11 characters \(want > 20\)/);
bad("a-4 done text without job", evaluateDoneState(with_(done, { foreman: { steps: 0, done: "You are all caught up for today, nice." } })), /lacks "24-077"/);
bad("a-4 super still sees submit", evaluateDoneState(with_(done, { superLabels: ["Submit tomorrow's plan for Bridge Crew 2 (25-031)"] })), /superintendent still sees/);
bad("a-4 journey threw", evaluateDoneState({ steps: [], error: "Timeout" }), /a-4: Timeout/);
// d-1
const form = (o = {}) => ({ form: "ReportWorkForm", text: "Report day's work", wantText: "Report day's work", inForm: true, required: [{ name: "report-mh-07-300", hidden: null }, { name: "report-qty-07-300", hidden: null }], listed: [{ want: "report-mh-", n: 1, notRequired: [] }, { want: "report-qty-", n: 1, notRequired: [] }], ...o });
ok("d-1 control", evaluateRequiredFields(row({ data: { forms: [form(), form({ form: "ApproveReportForm", text: "Approve report", wantText: "Approve report", required: [], listed: [] })] } })));
bad("d-1 qty behind details", evaluateRequiredFields(row({ data: { forms: [form({ required: [{ name: "report-qty-07-300", hidden: "inside a closed details" }] })] } })), /required field report-qty-07-300 is inside a closed details while its submit is visible/);
bad("d-1 field display:none", evaluateRequiredFields(row({ data: { forms: [form({ required: [{ name: "return-reason", hidden: "display:none" }] })] } })), /is display:none/);
bad("d-1 listed field missing", evaluateRequiredFields(row({ data: { forms: [form({ listed: [{ want: "report-mh-", n: 0, notRequired: [] }] })] } })), /no report-mh-<code> field/);
bad("d-1 listed field not required", evaluateRequiredFields(row({ data: { forms: [form({ listed: [{ want: "return-reason", n: 1, notRequired: ["return-reason"] }] })] } })), /return-reason has no required attribute/);
bad("d-1 submit text", evaluateRequiredFields(row({ data: { forms: [form({ text: "Report" })] } })), /reads "Report" \(want "Report day's work"\)/);

// g-1 / g-2
const link = (o) => ({ role: "pm", href: "/app/jobs/26-010#estimate", path: "/app/jobs/26-010", status: 200, bad: [], allowed: true, ...o });
const dis = { before: 1, afterReload: 0, afterSignIn: 0, afterReset: 1 };
ok("g control", evaluateDemoPath({ links: [link()], dismiss: dis }));
bad("g-1 rc (no panel)", evaluateDemoPath({ links: [{ role: "pm", missing: true }], dismiss: { before: 0 } }), /demo-path missing or has no links/);
bad("g-1 path outside allowed set", evaluateDemoPath({ links: [link({ href: "/app/schedule", path: "/app/schedule", allowed: false })], dismiss: dis }), /not in the allowed set/);
bad("g-1 404 sub-request", evaluateDemoPath({ links: [link({ bad: ["404 /x.js"] })], dismiss: dis }), /404 \/x\.js/);
bad("g-2 reappears after sign-in", evaluateDemoPath({ links: [link()], dismiss: { ...dis, afterSignIn: 1 } }), /after sign out\/in/);
bad("g-2 not back after reset", evaluateDemoPath({ links: [link()], dismiss: { ...dis, afterReset: 0 } }), /after Reset demo \(want 1\)/);

console.log(lines.join("\n"));
console.log(`spec504-eval: ${lines.length} cases OK`);
