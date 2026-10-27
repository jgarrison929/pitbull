// Browser must-fails for 5.0.4-h checks 1-7 and the #65 guard (confirm504.mjs) on a local fixture app that mimics the
// job page's ConfirmDialog (radix AlertDialog shape: role alertdialog, data-testid confirm-dialog, overlay slot,
// aria-labelledby/-describedby). Each mode breaks one rule; the real drives + evaluators must FAIL on it and PASS on
// the good fixture. Local only: 127.0.0.1, no DB, nothing remote.
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { coGuardFlow, confirmFlow, evaluateCoGuard, evaluateConfirmFlow, evaluateKeyboard, evaluateNoButtons, evaluatePhoneDialogs, H_COPY, keyboardFlow, noButtonFlow, phoneFlow } from "./confirm504.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(here, "../../../v5/package.json"))("@playwright/test");
let mode = "good";
let st;
const reset = () => { st = { locks: 0, approved: false, co: "priced" }; };
reset();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const DIALOG_JS = `
function openConfirm(trigger, c) {
  const M = ${"${MODE}"};
  const ov = document.createElement("div"); ov.setAttribute("data-slot", "confirm-dialog-overlay");
  ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50";
  const d = document.createElement("div"); d.setAttribute("role", "alertdialog"); d.dataset.testid = "confirm-dialog";
  d.setAttribute("data-destructive", M === "destructive" ? "true" : "false");
  d.setAttribute("aria-labelledby", "cd-t"); d.setAttribute("aria-describedby", "cd-d");
  d.style.cssText = "position:fixed;left:16px;right:16px;top:20%;max-width:420px;margin:auto;background:#fff;padding:20px;z-index:51;box-sizing:border-box";
  const narrow = M === "narrow-buttons";
  d.innerHTML = '<h2 id="cd-t" style="margin:0;font-size:16px' + (M === "phone-ellipsis" ? ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis' : '') + '"></h2><p id="cd-d" style="font-size:14px"></p>' +
    '<div style="display:flex;flex-direction:column-reverse;gap:8px"><button data-testid="confirm-dialog-cancel" style="height:44px;' + (narrow ? 'width:120px' : 'width:100%') + '"></button>' +
    '<button data-testid="confirm-dialog-confirm" style="height:44px;' + (narrow ? 'width:120px' : 'width:100%') + '"></button></div>';
  d.querySelector("h2").textContent = c.title; d.querySelector("p").textContent = c.description;
  d.querySelector('[data-testid="confirm-dialog-cancel"]').textContent = "Cancel";
  d.querySelector('[data-testid="confirm-dialog-confirm"]').textContent = c.confirm;
  document.body.append(ov, d);
  let done = false;
  const close = () => { ov.remove(); d.remove(); document.removeEventListener("keydown", onKey, true); trigger.focus(); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab" && M !== "no-trap") { e.preventDefault(); const b = [...d.querySelectorAll("button")]; const i = b.indexOf(document.activeElement); b[(i + 1) % b.length].focus(); }
  };
  document.addEventListener("keydown", onKey, true);
  ov.addEventListener("click", () => { if (M === "overlay-closes") close(); });
  d.querySelector('[data-testid="confirm-dialog-cancel"]').onclick = () => { if (M === "cancel-posts") post(c.what); close(); };
  d.querySelector('[data-testid="confirm-dialog-confirm"]').onclick = () => { if (done && M !== "double-post") return; done = true; post(c.what).then(() => location.reload()); if (M !== "double-post") close(); };
  (M === "focus-confirm" ? d.querySelector('[data-testid="confirm-dialog-confirm"]') : d.querySelector('[data-testid="confirm-dialog-cancel"]')).focus();
}
function post(what) { return fetch("/__act?what=" + what, { method: "POST", headers: { "Next-Action": "fixture" } }); }
`;
const role = (req) => /(?:^|;\s*)role=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "pm";
const page = (body) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px sans-serif}</style></head><body><header><details><summary data-testid="user-menu">Menu</summary><button onclick="fetch('/__reset',{method:'POST'}).then(()=>location.href='/app?reset=1')">Reset demo</button></details></header><main>${body}</main><script>${DIALOG_JS.replace("${MODE}", JSON.stringify(mode))}</script></body></html>`;
const L = H_COPY.lock, E = H_COPY.estimate;
const lockCopy = mode === "x" ? null : null;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  const send = (html, headers = {}) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...headers }); res.end(html); };
  if (u.pathname === "/__mode") { mode = u.searchParams.get("m"); reset(); res.writeHead(204); return res.end(); }
  if (u.pathname === "/__reset") { reset(); res.writeHead(204); return res.end(); }
  if (u.pathname === "/__act") { const w = u.searchParams.get("what"); if (w === "lock") st.locks++; if (w === "estimate") st.approved = true; if (w === "co") st.co = "approved"; res.writeHead(204); return res.end(); }
  if (u.pathname === "/login") return send(page(["executive", "pm", "superintendent", "foreman"].map((r) => `<button data-testid="role-${r}" onclick="document.cookie='role=${r};path=/';location.href='/app'">${r}</button>`).join("")));
  if (u.pathname === "/app") return send(page(`<h1>Home</h1>`));
  const r = role(req);
  const canAct = r === "pm" || r === "executive" || mode === "super-sees-lock";
  const lockTitle = mode === "wrong-copy" ? L.title.replace("?", "") : `Lock Period ${2 + st.locks} on 25-031?`;
  const lockDesc = L.description.replace("Period 2", `Period ${2 + st.locks}`);
  if (u.pathname === "/app/jobs/25-031") {
    const lockBtn = canAct ? `<button data-testid="lock-claim" onclick="${mode === "rc" ? "post('lock').then(()=>location.reload())" : `openConfirm(this, ${esc(JSON.stringify({ title: lockTitle, description: lockDesc, confirm: L.confirm, what: "lock" })).replace(/"/g, "&quot;")})`}">Lock Period ${2 + st.locks}</button>` : "";
    const co = `<div data-testid="co-card" data-status="${st.co}"><h3>CO-001 · Added scope</h3><button onclick="openConfirm(this, ${esc(JSON.stringify({ title: "Approve change order CO-001 on 25-031?", description: "Current Budget increases by $60,000.00 and EAC increases by $60,000.00. This cannot be undone.", confirm: "Approve change order", what: "co" })).replace(/"/g, "&quot;")})">Approve</button></div>`;
    return send(page(`<h1>Cedar Creek Bridge</h1><span data-testid="job-earned" data-cents="639558000">$6.4M</span><span data-testid="job-actual" data-cents="${mode === "cancel-moves" && st.locks ? 1 : 821896625}">$8.2M</span>${lockBtn}<p><a href="/app/jobs/25-031/changes">Changes</a></p><div id="co-CO-001">${co}</div>`));
  }
  if (u.pathname === "/app/jobs/26-010") {
    const btn = canAct && !st.approved ? `<button data-testid="approve-estimate" onclick="openConfirm(this, ${esc(JSON.stringify({ title: E.title, description: mode === "wrong-amount" ? E.description.replace("$86,750.00", "$86,750") : E.description, confirm: E.confirm, what: "estimate" })).replace(/"/g, "&quot;")})">Approve estimate</button>` : "";
    return send(page(`<h1>Harbor Abutment</h1><span data-testid="estimate-status" data-status="${st.approved ? "approved" : "draft"}">${st.approved ? "approved" : "draft"}</span>${btn}`));
  }
  if (u.pathname === "/app/jobs/25-031/changes") return send(page(`<ul data-testid="job-changes-full">${Array.from({ length: st.locks }, () => "<li>Locked Period 2 on Cedar Creek Bridge: frozen</li>").join("")}<li>Other row</li></ul>`));
  if (u.pathname === "/app/jobs/26-010/changes") return send(page(`<ul data-testid="job-changes-full">${st.approved ? "<li>Approved the estimate on Harbor Abutment: done</li>" : ""}<li>Other</li></ul>`));
  res.writeHead(404); res.end("no");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
const setMode = (m) => fetch(`${base}/__mode?m=${m}`);
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as expected: ${name} → ${f.find((x) => re.test(x))}`); };
const D = { width: 1280, height: 800 }, P = { width: 390, height: 844 };
try {
  await setMode("good");
  ok("h-1..h-4 good fixture (pm 1280 light)", evaluateConfirmFlow(await confirmFlow(browser, base, "pm", D, "light")));
  ok("h-1..h-4 good fixture (executive 390 dark)", evaluateConfirmFlow(await confirmFlow(browser, base, "executive", P, "dark")));
  ok("h-5 good fixture", evaluateKeyboard(await keyboardFlow(browser, base)));
  ok("h-6 good fixture 320 light", evaluatePhoneDialogs(await phoneFlow(browser, base, { width: 320, height: 568 }, "light")));
  ok("h-7 foreman sees no buttons", evaluateNoButtons(await noButtonFlow(browser, base, "foreman")));
  ok("#65 guard good fixture", evaluateCoGuard(await coGuardFlow(browser, base, "light")));
  const cases = [
    ["rc", "h-1 (rc: Lock posts at once, no dialog)", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /h-1: no visible \[data-testid="confirm-dialog"\]/],
    ["wrong-copy", "h copy exact (title without ?)", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /h-1: title "Lock Period 2 on 25-031" ≠/],
    ["wrong-amount", "h copy exact ($86,750)", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /h-4: description/],
    ["destructive", "h data-destructive", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /data-destructive="true"/],
    ["focus-confirm", "h focus opens on confirm", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /focus on open is confirm-dialog-confirm/],
    ["overlay-closes", "h-2 overlay click closes", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /overlay click at \(8, 8\) closed the dialog/],
    ["cancel-posts", "h-2 Cancel posts", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /Cancel posted 1/],
    ["double-post", "h-3 double-click posts twice", () => confirmFlow(browser, base, "pm", D, "light"), evaluateConfirmFlow, /h-3: double-click confirm posted 2/],
    ["no-trap", "h-5 Tab leaves the dialog", () => keyboardFlow(browser, base), evaluateKeyboard, /Tab moved focus to/],
    ["phone-ellipsis", "h-6 title ellipsis on a phone", () => phoneFlow(browser, base, { width: 320, height: 568 }, "light"), evaluatePhoneDialogs, /title (scrollWidth|text-overflow)/],
    ["super-sees-lock", "h-7 superintendent sees lock-claim", () => noButtonFlow(browser, base, "superintendent"), evaluateNoButtons, /25-031 shows 1 visible lock-claim/],
    ["narrow-buttons", "#65 guard buttons not full width", () => coGuardFlow(browser, base, "light"), evaluateCoGuard, /width 120\.0 ≠ dialog content box/],
  ];
  for (const [m, name, run, ev, re] of cases) { await setMode(m); bad(name, ev(await run()), re); }
} finally {
  await browser.close();
  server.close();
}
console.log(lines.join("\n"));
console.log(`confirm504-mustfail: ${lines.length} cases OK`);
