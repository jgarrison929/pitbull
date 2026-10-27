// Unit must-fails for the 5.0.4-h / #65 guard rules in confirm504.mjs (no browser, no network).
import assert from "node:assert/strict";
import { CO_GUARD, evaluateCoGuard, evaluateConfirmFlow, evaluateKeyboard, evaluateNoButtons, evaluatePhoneDialogs, H_COPY } from "./confirm504.mjs";

const lines = [];
let n = 0;
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); n++; };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as required: ${name} → ${f.find((x) => re.test(x))}`); n++; };

const rect = (o = {}) => ({ left: 16, top: 300, right: 374, bottom: 344, w: 358, h: 44, ...o });
const fit = (o = {}) => ({ sw: 300, cw: 300, sh: 40, ch: 40, textOverflow: "clip", ...o });
const dlg = (c, o = {}) => ({ visibleAlertdialogs: 1, isConfirmDialog: true, shown: true, title: c.title, description: c.description, confirmText: c.confirm, cancelText: "Cancel", destructive: "false", focus: "confirm-dialog-cancel", focusInDialog: true, vw: 390, vh: 844, dialogFit: fit({ sw: 358, cw: 358 }), dialogRect: rect({ top: 250, bottom: 600 }), contentBoxW: 358, titleFit: fit(), descFit: fit(), confirmRect: rect(), cancelRect: rect({ top: 352, bottom: 396 }), ...o });
const closed = (o = {}) => ({ shown: false, visibleAlertdialogs: 0, posts: 0, ...o });
const L = H_COPY.lock, E = H_COPY.estimate;
const flow = (o = {}) => ({
  role: "pm", width: 390, height: 844, theme: "light", steps: ["h-1", "h-2", "h-3", "h-4"],
  before: { ev: 100, ac: 90, trigger: "Lock Period 2" },
  h1: { ...dlg(L), posts: 0 },
  h2: { cancel: closed(), esc: closed(), overlay: { ...dlg(L), posts: 0 }, after: { trigger: "Lock Period 2", ev: 100, ac: 90, lockRows: 0 } },
  h3: { posts: 1, trigger: "Lock Period 3", lockRows: 1 },
  h4: { open: dlg(E), cancel: { posts: 0, status: "draft", approveRows: 0 }, confirm: { posts: 1, status: "approved", approveRows: 1 } },
  ...o,
});
ok("h-1..h-4 control", evaluateConfirmFlow(flow()));
ok("h-7 executive control", evaluateConfirmFlow(flow({ role: "executive" })));
bad("h-1 rc: no dialog (posts at once)", evaluateConfirmFlow(flow({ h1: { ...closed(), posts: 1 }, h2: undefined, h3: undefined })), /h-1: no visible \[data-testid="confirm-dialog"\]/);
bad("h-1 posts on open", evaluateConfirmFlow(flow({ h1: { ...dlg(L), posts: 1 } })), /h-1: 1 post\(s\) on opening/);
bad("h copy: title differs by one char", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { title: "Lock Period 2 on 25-031" }), posts: 0 } })), /title "Lock Period 2 on 25-031" ≠ "Lock Period 2 on 25-031\?"/);
bad("h copy: description differs", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { description: L.description.replace("frozen", "locked") }), posts: 0 } })), /h-1: description/);
bad("h copy: confirm label", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { confirmText: "Lock" }), posts: 0 } })), /confirm reads "Lock" \(want "Lock period"\)/);
bad("h copy: cancel label", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { cancelText: "Close" }), posts: 0 } })), /cancel reads "Close"/);
bad("h copy: destructive variant", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { destructive: "true" }), posts: 0 } })), /data-destructive="true"/);
bad("h-1 two alertdialogs", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { visibleAlertdialogs: 2, isConfirmDialog: false }), posts: 0 } })), /2 visible \[role="alertdialog"\]/);
bad("h focus opens on confirm", evaluateConfirmFlow(flow({ h1: { ...dlg(L, { focus: "confirm-dialog-confirm" }), posts: 0 } })), /focus on open is confirm-dialog-confirm/);
bad("h-2 cancel posts", evaluateConfirmFlow(flow({ h2: { ...flow().h2, cancel: closed({ posts: 1 }) } })), /Cancel posted 1/);
bad("h-2 Esc leaves dialog open", evaluateConfirmFlow(flow({ h2: { ...flow().h2, esc: { ...dlg(L), posts: 0 } } })), /still visible after Esc/);
bad("h-2 overlay closes", evaluateConfirmFlow(flow({ h2: { ...flow().h2, overlay: closed() } })), /overlay click at \(8, 8\) closed the dialog/);
bad("h-2 overlay posts", evaluateConfirmFlow(flow({ h2: { ...flow().h2, overlay: { ...dlg(L), posts: 1 } } })), /overlay click posted 1/);
bad("h-2 locked anyway", evaluateConfirmFlow(flow({ h2: { ...flow().h2, after: { trigger: "Lock Period 3", ev: 100, ac: 90, lockRows: 1 } } })), /after reload lock-claim reads "Lock Period 3"/);
bad("h-2 cents moved", evaluateConfirmFlow(flow({ h2: { ...flow().h2, after: { trigger: "Lock Period 2", ev: 101, ac: 90, lockRows: 0 } } })), /job-earned\/job-actual 101\/90 ≠ before 100\/90/);
bad("h-3 double-click posts twice", evaluateConfirmFlow(flow({ h3: { posts: 2, trigger: "Lock Period 3", lockRows: 2 } })), /posted 2 time\(s\) \(want exactly 1\)/);
bad("h-3 lock row missing", evaluateConfirmFlow(flow({ h3: { posts: 1, trigger: "Lock Period 2", lockRows: 0 } })), /0 lock row\(s\) \(want exactly 1\)/);
bad("h-4 approve copy amount", evaluateConfirmFlow(flow({ h4: { ...flow().h4, open: dlg(E, { description: E.description.replace("$86,750.00", "$86,750") }) } })), /h-4: description/);
bad("h-4 cancel approved anyway", evaluateConfirmFlow(flow({ h4: { ...flow().h4, cancel: { posts: 1, status: "approved", approveRows: 1 } } })), /estimate-status "approved" after Cancel/);
bad("h-4 double-click posts twice", evaluateConfirmFlow(flow({ h4: { ...flow().h4, confirm: { posts: 2, status: "approved", approveRows: 1 } } })), /h-4: double-click confirm posted 2/);
bad("h-4 rc no dialog", evaluateConfirmFlow(flow({ h4: { open: closed(), posts: 1 } })), /h-4: no visible/);
bad("h flow threw", evaluateConfirmFlow(flow({ error: "Timeout 10000ms", steps: ["h-1"] })), /Timeout 10000ms \(after h-1\)/);

const kb = (o = {}) => ({ role: "pm", width: 1280, height: 800, theme: "light", reachedTrigger: true, open: dlg(L), tab1: dlg(L, { focus: "confirm-dialog-confirm" }), tab2: dlg(L), esc: closed({ focus: "lock-claim" }), beforeConfirm: dlg(L, { focus: "confirm-dialog-confirm" }), confirm: { posts: 1, trigger: "Lock Period 3" }, ...o });
ok("h-5 control", evaluateKeyboard(kb()));
bad("h-5 Tab leaves dialog", evaluateKeyboard(kb({ tab2: dlg(L, { focus: "user-menu", focusInDialog: false }) })), /second Tab moved focus to user-menu/);
bad("h-5 focus not returned", evaluateKeyboard(kb({ esc: closed({ focus: "body" }) })), /focus after Esc is body/);
bad("h-5 Enter posts twice", evaluateKeyboard(kb({ confirm: { posts: 2, trigger: "Lock Period 3" } })), /posted 2/);
bad("h-5 trigger unreachable", evaluateKeyboard(kb({ reachedTrigger: false })), /never reached lock-claim/);

const ph = (o = {}) => ({ role: "pm", width: 320, height: 568, theme: "dark", dialogs: { lock: dlg(L, { vw: 320, vh: 568, dialogRect: rect({ right: 304, w: 288, bottom: 500 }) }), estimate: dlg(E, { vw: 320, vh: 568, dialogRect: rect({ right: 304, w: 288, bottom: 500 }), confirmRect: rect({ right: 300 }), cancelRect: rect({ right: 300 }) }) }, ...o });
const phOk = ph();
phOk.dialogs.lock.confirmRect = rect({ right: 300 }); phOk.dialogs.lock.cancelRect = rect({ right: 300 });
ok("h-6 control", evaluatePhoneDialogs(phOk));
const clone = () => JSON.parse(JSON.stringify(phOk));
let x = clone(); x.dialogs.lock.descFit.sh = 60; bad("h-6 description clipped vertically", evaluatePhoneDialogs(x), /description scrollHeight 60 > clientHeight 40/);
x = clone(); x.dialogs.estimate.titleFit.textOverflow = "ellipsis"; bad("h-6 title ellipsis", evaluatePhoneDialogs(x), /title text-overflow is ellipsis/);
x = clone(); x.dialogs.lock.cancelRect.h = 36; bad("h-6 cancel 36 px", evaluatePhoneDialogs(x), /confirm-dialog-cancel 358×36 < 44×44/);
x = clone(); x.dialogs.lock.dialogFit.sw = 380; bad("h-6 dialog scrolls sideways", evaluatePhoneDialogs(x), /confirm-dialog scrollWidth 380 > clientWidth 358/);
x = clone(); x.dialogs.lock.confirmRect.bottom = 600; bad("h-6 confirm below viewport", evaluatePhoneDialogs(x), /confirm-dialog-confirm not fully in the viewport/);

ok("h-7 no buttons control", evaluateNoButtons({ role: "foreman", pages: { "25-031": { "lock-claim": 0, "approve-estimate": 0 }, "26-010": { "lock-claim": 0, "approve-estimate": 0 } } }));
bad("h-7 superintendent sees lock", evaluateNoButtons({ role: "superintendent", pages: { "25-031": { "lock-claim": 1, "approve-estimate": 0 } } }), /25-031 shows 1 visible lock-claim/);

const co = (o = {}) => ({ role: "pm", width: 390, height: 844, theme: "light", open: dlg({ title: CO_GUARD.title, description: "x", confirm: "Approve change order" }), esc: closed(), focusOnApprove: true, status: "priced", ...o });
ok("#65 guard control", evaluateCoGuard(co()));
bad("#65 guard title", evaluateCoGuard(co({ open: dlg({ title: "Approve CO-001?", description: "x", confirm: "Approve" }) })), /title "Approve CO-001\?"/);
bad("#65 guard focus", evaluateCoGuard(co({ focusOnApprove: false })), /focus did not return to Approve/);
bad("#65 guard approved on Esc", evaluateCoGuard(co({ status: "approved" })), /CO-001 is "approved" after Esc/);
bad("#65 guard narrow buttons (sm:w-auto)", evaluateCoGuard(co({ open: dlg({ title: CO_GUARD.title, description: "x", confirm: "y" }, { confirmRect: rect({ w: 120 }) }) })), /confirm-dialog-confirm width 120\.0 ≠ dialog content box 358\.0/);
ok("#65 guard width 1.0 px off (±1 px, #80)", evaluateCoGuard(co({ open: dlg({ title: CO_GUARD.title, description: "x", confirm: "y" }, { confirmRect: rect({ w: 359 }), cancelRect: rect({ w: 357.6 }) }) })));
bad("#65 guard width 1.1 px off", evaluateCoGuard(co({ open: dlg({ title: CO_GUARD.title, description: "x", confirm: "y" }, { confirmRect: rect({ w: 359.1 }) }) })), /width 359\.1 ≠ dialog content box 358\.0 \(±1 px\)/);
bad("#65 guard short button", evaluateCoGuard(co({ open: dlg({ title: CO_GUARD.title, description: "x", confirm: "y" }, { cancelRect: rect({ h: 40 }) }) })), /confirm-dialog-cancel 40 px tall/);

console.log(lines.join("\n"));
console.log(`confirm504-eval: ${n} cases OK`);
