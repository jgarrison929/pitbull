// Failure evidence: when a reset sample, a crawl page or a drill-down fails, write what the browser saw
// into the run's evidence folder (<run>/failures/): a full-page screenshot, the page HTML, and a JSON file
// with the URL and query, the reason, console errors, page errors and failed requests (method, URL,
// status). Secrets never reach these files: known secret values (VERIFY_TOKEN, GH/GitHub tokens, the
// DATABASE_URL and its password, cookie values) are replaced with [redacted] in every text written,
// Authorization / Cookie style headers are dropped to [redacted], token-looking query values are
// replaced, and cookies themselves are never written.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { databaseUrlSecrets } from "./db-url.mjs";

export const REDACTED = "[redacted]";
/** Hard cap per evidence folder so a run where everything fails can't flood the disk. */
export const MAX_FAILURE_CAPTURES = 60;
/** Query parameter names whose values are always redacted. */
export const SECRET_QUERY_KEY = /(token|secret|passw(or)?d|pwd|auth|api[-_]?key|key|sig(nature)?|session|cookie|jwt|credential|bearer)/i;
/** A value that looks like a token: long, no spaces, letters and digits mixed (a 40-hex git SHA is not). */
export const TOKENISH_VALUE = /^(?![0-9a-f]{40}$)(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9._~+/=-]{20,}$/;
const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-verify-token|x-api-key)$|token|secret|auth/i;
const SECRET_ENV_KEY = /^(VERIFY_TOKEN|GH_TOKEN|GITHUB_TOKEN|DATABASE_URL)$|TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY/i;

/** Secret values from an environment (the runner's process.env by default) for redactText. */
export function secretValues(environment = process.env) {
  const out = [];
  for (const [k, v] of Object.entries(environment ?? {})) {
    if (typeof v !== "string" || v.length < 4 || !SECRET_ENV_KEY.test(k)) continue;
    out.push(v);
    if (/^postgres(ql)?:\/\//i.test(v)) out.push(...databaseUrlSecrets(v));
  }
  return [...new Set(out)];
}

const htmlEscape = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// The HTML serializer (page.content(), outerHTML) escapes only some characters, so a quote next to & < >
// survives in a mixed form. Text nodes: & nbsp < > (quotes raw). Attribute values: & nbsp " per the spec,
// and < > as well in newer Chromium (both spellings are listed; checked against real Chromium in
// crawl-mustfail.test.mjs).
const nbsp = (x) => x.replace(/\u00a0/g, "&nbsp;");
const htmlTextEscape = (x) => nbsp(x.replace(/&/g, "&amp;")).replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlAttrEscape = (x) => nbsp(x.replace(/&/g, "&amp;")).replace(/"/g, "&quot;");
const htmlAttrEscapeLtGt = (x) => htmlAttrEscape(x).replace(/</g, "&lt;").replace(/>/g, "&gt;");
const jsonEscape = (x) => JSON.stringify(x).slice(1, -1);

/**
 * Every spelling a secret can take once it has been serialized: raw, URL-encoded, JSON-escaped (once and
 * twice, for a JSON string inside JSON), HTML-escaped (fully, as a serialized text node, and as a
 * serialized attribute value), and combinations. A `"` or `\` in a secret would
 * otherwise come out escaped and slip past a raw-text match.
 */
export function secretForms(secrets = []) {
  const out = new Set();
  for (const x of secrets) {
    if (typeof x !== "string" || x.length < 2) continue;
    for (const base of [x, encodeURIComponent(x)]) {
      const j = jsonEscape(base);
      for (const f of [base, j, jsonEscape(j), base.replace(/"/g, "&#34;")]) out.add(f);
      for (const h of [htmlEscape, htmlTextEscape, htmlAttrEscape, htmlAttrEscapeLtGt]) for (const v of [base, j]) out.add(h(v));
    }
  }
  return [...out].filter((f) => f.length >= 2).sort((a, b) => b.length - a.length);
}

/**
 * Replace every secret value, in every serialized form (secretForms), with [redacted]; also any
 * postgres:// URL with userinfo, and Bearer / Basic credentials, whatever their value.
 * `jsonText: true` is for text that is already JSON: the userinfo pattern then never crosses a `"`, so
 * redaction can't break the JSON (the secret forms above still catch escaped values).
 */
export function redactText(text, secrets = [], { jsonText = false } = {}) {
  let s = String(text ?? "");
  for (const x of secretForms(secrets)) s = s.split(x).join(REDACTED);
  // Raw text: the userinfo may hold any character, so match up to the last @ of the whitespace-free run.
  s = jsonText ? s.replace(/postgres(ql)?:\/\/[^\s"'<>]*@[^\s"'<>]*/gi, `postgres://${REDACTED}`) : s.replace(/postgres(ql)?:\/\/\S*@[^\s"'<>]*/gi, `postgres://${REDACTED}`);
  s = s.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g, `$1 ${REDACTED}`);
  // Query strings anywhere in the text (HTML, logs): secret-named or token-looking values.
  s = s.replace(/([?&](?:amp;)?)([A-Za-z0-9_.-]+)=([^&#"'\s<>]*)/g, (m, sep, k, v) => {
    let d = v;
    try {
      d = decodeURIComponent(v);
    } catch {
      // keep raw
    }
    return SECRET_QUERY_KEY.test(k) || TOKENISH_VALUE.test(d) ? `${sep}${k}=REDACTED` : m;
  });
  return s;
}

/**
 * Deep copy of a JSON-able value with every string (keys too) redacted while still raw, before any
 * escaping. Errors become their message; cycles become "[circular]".
 */
export function redactValue(value, secrets = [], seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value, secrets);
  if (value instanceof Error) return redactText(value.message, secrets);
  if (value === null || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") return redactValue(value.toJSON(), secrets, seen);
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, secrets, seen));
  if (value instanceof Map) return redactValue(Object.fromEntries(value), secrets, seen);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [redactText(k, secrets), redactValue(v, secrets, seen)]));
}

/**
 * The only way skill evidence JSON is serialized: redact the structured value first (raw strings),
 * stringify, then redact the JSON text again for any escaped secret form (defense in depth).
 */
export function safeJson(value, secrets = [], space = 2) {
  return redactText(JSON.stringify(redactValue(value, secrets), null, space), secrets, { jsonText: true });
}

/**
 * The page's HTML (doctype + <html>, as page.content() gives it) with every secret replaced by [redacted]
 * in each text node, comment and attribute value before serializing, so no serializer escaping can hide
 * one. Runs in a CDP isolated world on a detached clone of the document: the live page is not changed
 * and page scripts can't see the secret list. Returns null when that is unavailable (not Chromium, a
 * page double, a navigation in progress); callers fall back to page.content() + redactText.
 */
export async function redactedDocumentHtml(page, secrets = []) {
  const values = [...new Set(secrets.flatMap((x) => (typeof x === "string" && x.length >= 2 ? [x, encodeURIComponent(x), jsonEscape(x)] : [])))].sort((a, b) => b.length - a.length);
  let cdp = null;
  try {
    cdp = await page.context().newCDPSession(page);
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const { executionContextId } = await cdp.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "verify-v5-redact" });
    const fn = (list, mark) => {
      const scrub = (t) => list.reduce((s, x) => (s.includes(x) ? s.split(x).join(mark) : s), t);
      const walk = (n) => {
        if (n.nodeType === 3 || n.nodeType === 8) n.data = scrub(n.data);
        if (n.nodeType === 1) for (const a of [...n.attributes]) a.value = scrub(a.value);
        // <template> keeps its children in .content (a fragment); <meta content> is a string.
        for (const c of [...n.childNodes, ...(n.content?.nodeType === 11 ? n.content.childNodes : [])]) walk(c);
      };
      const root = document.documentElement.cloneNode(true);
      walk(root);
      const dt = document.doctype ? new XMLSerializer().serializeToString(document.doctype) : "";
      return dt + root.outerHTML;
    };
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression: `(${fn})(${JSON.stringify(values)}, ${JSON.stringify(REDACTED)})`,
      contextId: executionContextId,
      returnByValue: true,
    });
    return exceptionDetails || typeof result?.value !== "string" ? null : result.value;
  } catch {
    return null;
  } finally {
    await cdp?.detach().catch(() => {});
  }
}

/** URL with userinfo removed and secret-named or token-looking query values replaced (reset=1 stays). */
export function redactUrl(raw, secrets = []) {
  let u;
  try {
    u = new URL(String(raw));
  } catch {
    return redactText(raw, secrets);
  }
  u.username = "";
  u.password = "";
  const q = [...u.searchParams.entries()].map(([k, v]) => [k, SECRET_QUERY_KEY.test(k) || TOKENISH_VALUE.test(v) ? "REDACTED" : v]);
  const search = q.length ? `?${q.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}` : "";
  return redactText(`${u.origin}${u.pathname}${search}`, secrets);
}

/** Headers with Authorization, Cookie, Set-Cookie and any token/secret/auth-named header redacted. */
export function redactHeaders(headers = {}, secrets = []) {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k, SECRET_HEADER.test(k) ? REDACTED : redactText(v, secrets)]));
}

/** page.on that tolerates page-like test doubles which don't support every event. */
function listen(page, event, fn) {
  try {
    page.on(event, fn);
    return () => {
      try {
        page.off(event, fn);
      } catch {
        // test double
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Collects console errors, uncaught page errors and failed requests (status >= 400 or a network failure)
 * from now on. mark() returns a position; since(mark) returns what arrived after it.
 */
export function startFailureRecorder(page) {
  const events = [];
  const offs = [
    listen(page, "console", (m) => {
      if (m?.type?.() === "error") events.push({ kind: "console", text: String(m.text()).slice(0, 2000) });
    }),
    listen(page, "pageerror", (e) => events.push({ kind: "pageerror", text: String(e?.stack ?? e?.message ?? e).slice(0, 2000) })),
    listen(page, "response", (r) => {
      if (typeof r?.status !== "function" || r.status() < 400) return;
      const req = r.request();
      events.push({ kind: "request", method: req.method(), url: r.url(), status: r.status(), headers: req.headers?.() ?? {} });
    }),
    listen(page, "requestfailed", (req) => {
      if (typeof req?.method !== "function") return;
      events.push({ kind: "request", method: req.method(), url: req.url(), status: null, failure: req.failure?.()?.errorText ?? "failed", headers: req.headers?.() ?? {} });
    }),
  ];
  return {
    mark: () => events.length,
    since: (m = 0) => events.slice(m),
    stop: () => offs.forEach((f) => f()),
  };
}

const counters = new Map();
const slug = (s) => String(s ?? "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 80) || "page";

/**
 * Write <dir>/NNN-<kind>-<label>.{png,html,json} for the page's current state. Never throws: a part
 * that can't be captured is listed under captureErrors. Returns { json, png, html } (file names) or
 * { skipped } past MAX_FAILURE_CAPTURES.
 */
export async function captureFailure(page, { dir, kind, label, reason, recorder, mark = 0, secrets = secretValues(), extra = {} }) {
  const n = (counters.get(dir) ?? 0) + 1;
  counters.set(dir, n);
  if (n > MAX_FAILURE_CAPTURES) return { skipped: `over ${MAX_FAILURE_CAPTURES} captures in ${dir}` };
  mkdirSync(dir, { recursive: true });
  const name = `${String(n).padStart(3, "0")}-${slug(kind)}-${slug(label)}`;
  const captureErrors = [];
  let all = [...secrets];
  try {
    const cookies = await page.context().cookies();
    all = [...all, ...cookies.map((c) => c.value).filter((v) => typeof v === "string" && v.length >= 6)];
  } catch (e) {
    captureErrors.push(`cookies (for redaction only): ${String(e?.message ?? e).split("\n")[0]}`);
  }
  const clean = (s) => redactText(s, all);
  const files = { json: `${name}.json`, png: `${name}.png`, html: `${name}.html` };
  try {
    await page.screenshot({ path: path.join(dir, files.png), fullPage: true, timeout: 10_000 });
  } catch (e) {
    files.png = null;
    captureErrors.push(`screenshot: ${clean(String(e?.message ?? e).split("\n")[0])}`);
  }
  try {
    // DOM-level first (secrets replaced in a copy of the DOM before it is serialized), then the escaped
    // forms over the serialized text as a backstop. A page double without CDP falls back to page.content().
    writeFileSync(path.join(dir, files.html), clean((await redactedDocumentHtml(page, all)) ?? (await page.content())));
  } catch (e) {
    files.html = null;
    captureErrors.push(`html: ${clean(String(e?.message ?? e).split("\n")[0])}`);
  }
  let url = null;
  try {
    url = redactUrl(page.url(), all);
  } catch (e) {
    captureErrors.push(`url: ${clean(String(e?.message ?? e).split("\n")[0])}`);
  }
  const ev = recorder ? recorder.since(mark) : [];
  const record = {
    kind,
    label,
    reason: clean(reason),
    url,
    capturedAt: new Date().toISOString(),
    consoleErrors: ev.filter((e) => e.kind === "console").map((e) => clean(e.text)),
    pageErrors: ev.filter((e) => e.kind === "pageerror").map((e) => clean(e.text)),
    failedRequests: ev
      .filter((e) => e.kind === "request")
      .map((e) => ({ method: e.method, url: redactUrl(e.url, all), status: e.status, ...(e.failure ? { failure: clean(e.failure) } : {}), requestHeaders: redactHeaders(e.headers, all) })),
    ...extra,
    files: { png: files.png, html: files.html },
    captureErrors,
  };
  // reason, extra and every field are redacted as raw values before stringifying (safeJson).
  writeFileSync(path.join(dir, files.json), safeJson(record, all) + "\n");
  return files;
}

/** Evidence settings ride on the page (verify.mjs sets them) so step signatures stay unchanged. */
const registry = new WeakMap();
export function setFailureEvidence(page, settings) {
  registry.set(page, { secrets: secretValues(), ...settings });
}
export function failureEvidenceFor(page) {
  return (page && typeof page === "object" && registry.get(page)) || null;
}
