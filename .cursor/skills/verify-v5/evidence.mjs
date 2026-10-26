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

/**
 * The ONE place secrets are matched: returns `text` with every span that is a secret in any serialized form
 * replaced by `mark`. Instead of listing spellings, it decodes the text and looks for the secret in each
 * decoded view, mapping hits back to the original characters. One decoding level undoes, wherever they
 * occur and in any mix (so partial escaping like the HTML serializer's is covered):
 *   HTML character references: named (&amp; &lt; &gt; &quot; &apos; &nbsp; ...), &#NN; and &#xHH;
 *   JS / JSON escapes: \" \\ \/ \n ..., \uXXXX (all chars or Next.js's < > & U+2028 U+2029 subset), \u{...}, \xHH
 *   percent-encoding: path, query, encodeURIComponent and URLSearchParams forms (UTF-8 bytes)
 *   + as a space (URLSearchParams / form encoding); also looked through with + kept, in case + is literal
 * Hex in every escape is matched in any case. Views are decoded up to 4 levels (DEPTH), so composed
 * forms (JSON twice, HTML twice, \u inside JSON, %25-double-encoding, ...) are found too. The secret is
 * decoded the same way at each level, so a secret that itself looks escaped is still found.
 * Self-contained (no outside references): redactedDocumentHtml ships its source into the page.
 */
export function scrubSecrets(text, secrets, mark, opts) {
  const src = String(text ?? "");
  const list = (Array.isArray(secrets) ? secrets : []).filter((x) => typeof x === "string" && x.length >= 2);
  if (!src || !list.length) return src;
  const DEPTH = 4;
  const NAMED = Object.assign(Object.create(null), { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", sol: "/", bsol: "\\", num: "#", percnt: "%", plus: "+", equals: "=", semi: ";", colon: ":", comma: ",", period: ".", excl: "!", quest: "?", commat: "@", dollar: "$", lpar: "(", rpar: ")", lsqb: "[", rsqb: "]", lbrack: "[", rbrack: "]", lcub: "{", rcub: "}", lbrace: "{", rbrace: "}", ast: "*", grave: "`", hat: "^", vert: "|", verbar: "|", lowbar: "_", tilde: "~", Tab: "\t", NewLine: "\n" });
  const SIMPLE = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", 0: "\0" };
  const ENT = /&(?:#[xX]([0-9A-Fa-f]{1,6});?|#([0-9]{1,7});?|([A-Za-z][A-Za-z0-9]{1,7});)/y;
  const ESC = /\\(?:u\{([0-9A-Fa-f]{1,6})\}|u([0-9A-Fa-f]{4})|x([0-9A-Fa-f]{2})|(["'\\/`bfnrtv0]))/y;
  const PCT = /(?:%[0-9A-Fa-f]{2})+/y;
  const fromCp = (n) => (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : null);
  // One decoding level. a[i]..b[i] is the span of the ORIGINAL text that unit i of the view came from.
  const decode = (v, plus) => {
    const { s, a, b } = v;
    const parts = [];
    const na = new Int32Array(s.length);
    const nb = new Int32Array(s.length);
    let k = 0;
    let changed = false;
    const emit = (str, i, j) => {
      parts.push(str);
      for (let t = 0; t < str.length; t++) (na[k] = a[i]), (nb[k] = b[j]), k++;
    };
    for (let i = 0; i < s.length; ) {
      const c = s[i];
      let m = null;
      let val = null;
      if (c === "&") {
        ENT.lastIndex = i;
        m = ENT.exec(s);
        if (m) val = m[1] ? fromCp(parseInt(m[1], 16)) : m[2] ? fromCp(parseInt(m[2], 10)) : NAMED[m[3]] ?? NAMED[m[3].toLowerCase()] ?? null;
        // Named references are also recognized without a trailing ';'. Longest name in NAMED wins, so
        // "&quotb" is quot, not a failed longer token. A miss falls through and advances one character.
        if (!m || val === null) {
          let name = "";
          let best = null;
          let bestLen = 0;
          for (let j = i + 1; j < s.length && j - (i + 1) < 32 && /[A-Za-z0-9]/.test(s[j]); j++) {
            name += s[j];
            const lower = name.toLowerCase();
            const hit = name in NAMED ? NAMED[name] : lower in NAMED ? NAMED[lower] : undefined;
            if (hit !== undefined) (best = hit), (bestLen = name.length);
          }
          if (best !== null && bestLen > 0) {
            let end = i + 1 + bestLen;
            if (s[end] === ";") end += 1;
            m = [s.slice(i, end)];
            val = best;
          }
        }
      } else if (c === "\\") {
        ESC.lastIndex = i;
        m = ESC.exec(s);
        if (m) val = m[1] ? fromCp(parseInt(m[1], 16)) : m[2] || m[3] ? String.fromCharCode(parseInt(m[2] || m[3], 16)) : SIMPLE[m[4]] ?? m[4];
      } else if (c === "%") {
        PCT.lastIndex = i;
        m = PCT.exec(s);
        if (m) {
          // Decode the byte run one UTF-8 character at a time; an invalid sequence stays as it is.
          const bytes = m[0].match(/%../g).map((x) => parseInt(x.slice(1), 16));
          for (let j = 0; j < bytes.length; ) {
            const lead = bytes[j];
            const len = lead < 0x80 ? 1 : lead >= 0xc2 && lead < 0xe0 ? 2 : lead >= 0xe0 && lead < 0xf0 ? 3 : lead >= 0xf0 && lead < 0xf5 ? 4 : 0;
            let ch = null;
            if (len && j + len <= bytes.length) {
              try {
                ch = decodeURIComponent(m[0].slice(j * 3, (j + len) * 3));
              } catch {
                ch = null;
              }
            }
            if (ch !== null) {
              emit(ch, i + j * 3, i + (j + len) * 3 - 1);
              changed = true;
              j += len;
            } else {
              for (let t = 0; t < 3; t++) emit(s[i + j * 3 + t], i + j * 3 + t, i + j * 3 + t);
              j += 1;
            }
          }
          i += m[0].length;
          continue;
        }
      } else if (c === "+" && plus) {
        emit(" ", i, i);
        changed = true;
        i += 1;
        continue;
      }
      if (m && val !== null) {
        emit(val, i, i + m[0].length - 1);
        changed = true;
        i += m[0].length;
      } else {
        emit(c, i, i);
        i += 1;
      }
    }
    return changed ? { s: parts.join(""), a: na.subarray(0, k), b: nb.subarray(0, k) } : null;
  };
  const identity = (s) => {
    const a = new Int32Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = i;
    return { s, a, b: a };
  };
  // All views of a string: itself, then up to DEPTH levels decoded with + as space, and without.
  const views = (s) => {
    const out = [identity(s)];
    const lazy = !/[&\\%+]/.test(s);
    if (lazy) return out;
    for (const plus of s.includes("+") ? [true, false] : [true]) {
      let v = out[0];
      for (let d = 0; d < DEPTH; d++) {
        v = decode(v, plus);
        if (!v) break;
        out.push(v);
      }
    }
    return out;
  };
  const needles = [...new Set(list.flatMap((x) => views(x).map((v) => v.s)))].filter((x) => x.length >= 2);
  const spans = [];
  for (const v of views(src)) {
    for (const nd of needles) {
      for (let at = v.s.indexOf(nd); at >= 0; at = v.s.indexOf(nd, at + 1)) spans.push([v.a[at], v.b[at + nd.length - 1]]);
    }
  }
  if (!spans.length) return opts?.spans ? [] : src;
  spans.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const merged = [];
  let out = "";
  let pos = 0;
  for (let i = 0; i < spans.length; ) {
    let [from, to] = spans[i];
    for (i++; i < spans.length && spans[i][0] <= to; i++) to = Math.max(to, spans[i][1]);
    merged.push([from, to]);
    out += src.slice(pos, from) + mark;
    pos = to + 1;
  }
  // opts.spans is for the raw-text cap (callers in this file). The page calls scrubSecrets with 3 args.
  return opts?.spans ? merged : out + src.slice(pos);
}

/**
 * Replace every secret value, in every serialized form (scrubSecrets), with [redacted]; also any
 * postgres:// URL with userinfo, and Bearer / Basic credentials, whatever their value.
 * `jsonText: true` is for text that is already JSON: the userinfo pattern then never crosses a `"`, so
 * redaction can't break the JSON (scrubSecrets still catches escaped values).
 */
export function redactText(text, secrets = [], { jsonText = false } = {}) {
  let s = scrubSecrets(text, secrets, REDACTED);
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
 * escaping. Errors become their message. A true cycle (an object reached again through itself) becomes
 * "[circular]". A value that is merely shared — the same array on `slowest` and again on `rows` — is
 * copied at each place, because JSON has no references. The seen set is path-scoped: it is removed
 * when that visit finishes, so a later sibling is not mistaken for a cycle.
 */
export function redactValue(value, secrets = [], seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value, secrets);
  if (value instanceof Error) return redactText(value.message, secrets);
  if (value === null || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") return redactValue(value.toJSON(), secrets, seen);
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((v) => redactValue(v, secrets, seen));
    if (value instanceof Map) return redactValue(Object.fromEntries(value), secrets, seen);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [redactText(k, secrets), redactValue(v, secrets, seen)]));
  } finally {
    seen.delete(value);
  }
}

/**
 * Redact secrets inside JSON string literals only (keys and values). Structural characters stay, so a
 * secret that happens to look like `": "` cannot break the document. Each literal is decoded, scrubbed,
 * and re-encoded. The caller parses the result.
 */
export function redactJsonText(json, secrets = []) {
  const src = String(json ?? "");
  let out = "";
  for (let i = 0; i < src.length; ) {
    if (src[i] !== '"') {
      out += src[i++];
      continue;
    }
    let j = i + 1;
    let raw = "";
    while (j < src.length) {
      if (src[j] === "\\") {
        raw += src[j] + (src[j + 1] ?? "");
        j += 2;
        continue;
      }
      if (src[j] === '"') break;
      raw += src[j++];
    }
    const decoded = JSON.parse(`"${raw}"`);
    out += JSON.stringify(redactText(decoded, secrets));
    i = j + 1;
  }
  return out;
}

/**
 * The only way skill evidence JSON is serialized: redact the structured value first (raw strings),
 * stringify, then scrub secrets only inside JSON string literals. The result is parsed before it is
 * returned, so a scrub that broke the JSON throws instead of being written.
 */
export function safeJson(value, secrets = [], space = 2) {
  const scrubbed = redactJsonText(JSON.stringify(redactValue(value, secrets), null, space), secrets);
  JSON.parse(scrubbed);
  return scrubbed;
}

/**
 * The page's HTML (doctype + <html>, as page.content() gives it) with every secret replaced by [redacted]
 * in each text node (script text too), comment and attribute value before serializing, by the same
 * scrubSecrets (its source is sent into the page), so no serializer escaping can hide one. Runs in a CDP isolated world on a detached clone of the document: the live page is not changed
 * and page scripts can't see the secret list. Returns null when that is unavailable (not Chromium, a
 * page double, a navigation in progress); callers fall back to page.content() + redactText.
 */
export async function redactedDocumentHtml(page, secrets = []) {
  const values = [...new Set(secrets.filter((x) => typeof x === "string" && x.length >= 2))];
  let cdp = null;
  try {
    cdp = await page.context().newCDPSession(page);
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const { executionContextId } = await cdp.send("Page.createIsolatedWorld", { frameId: frameTree.frame.id, worldName: "verify-v5-redact" });
    const fn = (list, mark, scrubSecrets) => {
      const scrub = (t) => scrubSecrets(t, list, mark);
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
      expression: `(${fn})(${JSON.stringify(values)}, ${JSON.stringify(REDACTED)}, ${scrubSecrets})`,
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

// Console / page error text is kept long while raw and cut to TEXT_CAP only after redaction, so a cut can't
// leave a secret's prefix behind (a cut first would keep "…ab&c" of "ab&cd1234", which no match finds).
// RAW_TEXT_CAP is applied first, while the text is still raw. A secret that starts before that cut and
// ends after it would otherwise leave a prefix the later scrub cannot see. capRawText looks past the cut
// (far enough for an encoded form) and replaces any span that crosses it.
export const RAW_TEXT_CAP = 100_000;
export const TEXT_CAP = 2000;

/** Keep at most `cap` characters. A secret that straddles the cut is replaced in the kept head. */
export function capRawText(text, secrets = [], cap = RAW_TEXT_CAP) {
  const src = String(text ?? "");
  if (src.length <= cap) return src;
  const list = (Array.isArray(secrets) ? secrets : []).filter((x) => typeof x === "string" && x.length >= 2);
  const longest = list.reduce((m, s) => Math.max(m, s.length), 0);
  const extra = Math.max(64, longest * 12);
  const window = src.slice(0, Math.min(src.length, cap + extra));
  const spans = scrubSecrets(window, list, REDACTED, { spans: true });
  const crossing = spans.filter((sp) => sp[0] < cap && sp[1] >= cap);
  if (!crossing.length) return src.slice(0, cap);
  let out = "";
  let pos = 0;
  for (const [from, to] of crossing) {
    if (from < pos) continue;
    out += src.slice(pos, from) + REDACTED;
    pos = Math.min(to + 1, cap);
  }
  if (pos < cap) out += src.slice(pos, cap);
  return out;
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
export function startFailureRecorder(page, secrets = []) {
  const events = [];
  const offs = [
    listen(page, "console", (m) => {
      if (m?.type?.() === "error") events.push({ kind: "console", text: capRawText(String(m.text()), secrets) });
    }),
    listen(page, "pageerror", (e) => events.push({ kind: "pageerror", text: capRawText(String(e?.stack ?? e?.message ?? e), secrets) })),
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
    consoleErrors: ev.filter((e) => e.kind === "console").map((e) => clean(e.text).slice(0, TEXT_CAP)),
    pageErrors: ev.filter((e) => e.kind === "pageerror").map((e) => clean(e.text).slice(0, TEXT_CAP)),
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
