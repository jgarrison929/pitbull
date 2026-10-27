// Must-fails for the 5.0.4 axe checks (axe.mjs) on local fixtures: c-4 color-contrast, c-8 full tags,
// i-3 button-name + tree toggle names, i-4 list. Each bad page must FAIL and each good page must PASS,
// through the same axePass + evaluateAxeRows the verify step uses (fake /login sign-in, theme cookie honoured).
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { AXE_THEMES, axePass, C4_OPTIONS, C8_TAGS, evaluateAxeRows, loadAxeSource } from "./axe.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const require = createRequire(path.join(repo, "v5/package.json"));
const { chromium } = require("@playwright/test");
const axe = loadAxeSource(repo);
assert.ok(!axe.error, axe.error);

const ROLES = ["executive", "pm", "superintendent", "foreman"];
const page = (body, dark) => `<!doctype html><html lang="en" class="${dark ? "dark" : ""}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture</title><style>body{font:16px/1.5 sans-serif;color:#111;background:#fff}.dark body{color:#eee;background:#111}</style></head><body><main><h1>Fixture</h1>${body}</main></body></html>`;
const row = (toggle) => `<div data-testid="cost-tree-row">${toggle}<span>02 Earthwork</span></div>`;
const PAGES = {
  "/login": () => ROLES.map((r) => `<button data-testid="role-${r}" onclick="location.href='/app'">${r}</button>`).join(""),
  "/app": () => "<p>Home</p>",
  "/good": () => `<p>Readable text.</p><ul><li><form><label>Percent <input name="percent"></label></form></li></ul>${row('<button aria-expanded="true" aria-label="Collapse 02 Earthwork">-</button>')}`,
  "/low-contrast": () => `<p style="color:#bbb;background:#fff">Pale grey on white.</p>`,
  "/low-contrast-dark-only": (dark) => `<p style="color:${dark ? "#333" : "#111"}">Dark grey on near-black only in dark.</p>`,
  "/nameless-toggle": () => row('<button aria-expanded="true"><svg width="10" height="10" aria-hidden="true"></svg></button>'),
  "/short-toggle": () => row('<button aria-expanded="false" aria-label="Expand">+</button>'),
  "/no-toggles": () => "<p>No tree here.</p>",
  "/form-in-ul": () => `<ul><form><label>Percent <input name="percent"></label></form></ul>`,
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const dark = /(?:^|;\s*)pcs_theme=dark(?:;|$)/.test(req.headers.cookie ?? "");
  const f = PAGES[url.pathname];
  if (!f) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(page(f(dark), dark));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
const sizes = [{ width: 390, height: 844 }];
const run = (pages, options, toggles = false) => axePass(browser, base, { roles: ["pm"], sizes, themes: AXE_THEMES, pages, options, toggles, source: axe.source });
try {
  const mustPass = (name, rows, opts) => { const f = evaluateAxeRows(rows, opts); assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name} (${rows.length} loads)`); };
  const mustFail = (name, rows, re, opts) => { const f = evaluateAxeRows(rows, opts); assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as expected: ${name} → ${f.find((x) => re.test(x))}`); };
  // c-4
  mustPass("c-4 control /good light+dark", await run(["/good"], C4_OPTIONS));
  mustFail("c-4 pale grey on white", await run(["/low-contrast"], C4_OPTIONS), /light \/low-contrast: axe color-contrast/);
  const darkOnly = await run(["/low-contrast-dark-only"], C4_OPTIONS);
  mustFail("c-4 dark-only contrast (light passes, dark must fail)", darkOnly, /dark \/low-contrast-dark-only: axe color-contrast/);
  assert.ok(!evaluateAxeRows(darkOnly).some((x) => / light \//.test(x)), "the light pass of the dark-only page is clean, so only the dark pass catches it");
  // c-8
  const c8 = { runOnly: { type: "tag", values: C8_TAGS } };
  mustPass("c-8 control /good", await run(["/good"], c8));
  mustFail("c-8 nameless button", await run(["/nameless-toggle"], c8), /axe button-name/);
  mustFail("c-8 form directly in ul", await run(["/form-in-ul"], c8), /axe list/);
  // i-3
  const i3 = { runOnly: { type: "rule", values: ["button-name"] } };
  mustPass("i-3 control 'Collapse 02 Earthwork'", await run(["/good"], i3, true), { toggles: true });
  mustFail("i-3 icon-only toggle (rc desktop toggle)", await run(["/nameless-toggle"], i3, true), /axe button-name/, { toggles: true });
  mustFail("i-3 toggle named only 'Expand' (rc phone toggle)", await run(["/short-toggle"], i3, true), /tree toggle name "Expand" does not match/, { toggles: true });
  mustFail("i-3 no toggle to name", await run(["/no-toggles"], i3, true), /no visible cost-tree toggle/, { toggles: true });
  // i-4
  const i4 = { runOnly: { type: "rule", values: ["list"] } };
  mustPass("i-4 control form inside li", await run(["/good"], i4));
  mustFail("i-4 form directly in ul (rc ev-method-controls)", await run(["/form-in-ul"], i4), /axe list/);
} finally {
  await browser.close();
  server.close();
}
for (const l of lines) console.log(l);
console.log(`ok: axe-mustfail.test.mjs (axe-core ${axe.version}, ${lines.length} cases)`);
