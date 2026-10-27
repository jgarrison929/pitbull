/**
 * Before/After gate (Joshua's rule, 2026-10-27).
 *
 * Every PR body needs a `## Before / After` section holding one of:
 *   (a) labeled image pairs: every `Before` image has an `After` image with the same label, and the label states the
 *       page, the viewport (W×H) and the theme (light or dark), e.g.
 *         ![Before: /app · 390×844 · light](https://…/before.png)
 *         ![After: /app · 390×844 · light](https://…/after.png)
 *   (b) non-UI evidence: a fenced code block or a link;
 *   (c) `No visual change` and a reason line.
 *
 * FAIL when: the section is missing or empty; a pair is unmatched; a label is malformed or the labels within a pair
 * differ; an image can't be fetched or its size can't be read; the two images in a pair differ in size; or the PR
 * touches UI files (v5/src/app/**, any components/**, *.css, the visual baselines) and claims `No visual change` while
 * the visual run at maxDiffPixels 0 shows a diff (verdict: contradicted). A UI-touching `No visual change` claim with
 * no visual run to check it against also fails: the claim can't be confirmed.
 *
 * Usage: node before-after.mjs --pr <number> | --pr-json <gh pr view json> [--repo owner/name] [--visual-report <playwright json>]
 *                              [--visual-diff-pixels <n>]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SECTION_HEADING = /^##\s+Before\s*\/\s*After\s*$/im;
/** A claim is a line that starts with the phrase (after list/quote/emphasis marks), not a mention mid-sentence. */
export const NO_VISUAL_CHANGE_LINE = /^[\s>*_\-`]*No visual change\b/i;
const NO_VISUAL_CHANGE = /[>*_\-`\s]*No visual change\b[`*_]*/i;
export const THEMES = ["light", "dark"];
const VIEWPORT = /\b(\d{2,5})\s*[×x]\s*(\d{2,5})\b/;
const IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|<img\b[^>]*>/gi;
const SIDE = /^\s*(before|after)\s*[:\-–—]\s*(.+?)\s*$/i;

/** Paths whose change can move pixels. */
export function isUiPath(p) {
  return (
    /^v5\/src\/app\//.test(p) ||
    /(^|\/)components\//.test(p) ||
    /\.css$/i.test(p) ||
    /^v5\/tests\/e2e\/visual\.spec\.ts-snapshots\//.test(p) ||
    /-snapshots\/.+\.png$/i.test(p)
  );
}
export const touchesUi = (files) => (files ?? []).some((f) => isUiPath(typeof f === "string" ? f : f.path));

/**
 * Cursor cloud-agent PR bodies end with `<!-- CURSOR_AGENT_PR_BODY_END -->` and a footer `<div>` of two cursor.com
 * badges ("Open in Web", "Open in Cursor"). The section ends at that marker, and only those exact badges are removed
 * (an `<a href="https://cursor.com/…">` wrapping a `<picture>` whose `<img alt="Open in Web|Open in Cursor">` comes from
 * `https://cursor.com/assets/images/open-in-(web|cursor)-(dark|light).png`). No other image is exempt.
 */
export const CURSOR_BODY_END = "<!-- CURSOR_AGENT_PR_BODY_END -->";
const BADGE_SRC = String.raw`https://cursor\.com/assets/images/open-in-(?:web|cursor)-(?:dark|light)\.png`;
export const CURSOR_FOOTER_BADGE = new RegExp(
  String.raw`<a href="https://cursor\.com/[^"]*">\s*<picture>(?:\s*<source [^>]*srcset="${BADGE_SRC}"[^>]*>)*\s*<img alt="Open in (?:Web|Cursor)"[^>]*src="${BADGE_SRC}"[^>]*>\s*</picture>\s*</a>`,
  "g",
);
const EMPTY_DIV = /<div>(?:\s|&nbsp;)*<\/div>/g;

/** The text under `## Before / After`, up to the next h1/h2 or the Cursor body-end marker. null when the heading is absent. */
export function extractSection(body) {
  const text = String(body ?? "").replace(/\r\n/g, "\n");
  const m = SECTION_HEADING.exec(text);
  if (!m) return null;
  let rest = text.slice(m.index + m[0].length);
  const end = rest.indexOf(CURSOR_BODY_END);
  if (end !== -1) rest = rest.slice(0, end);
  const next = rest.search(/^#{1,2}\s/m);
  if (next !== -1) rest = rest.slice(0, next);
  return rest.replace(CURSOR_FOOTER_BADGE, "").replace(EMPTY_DIV, "").trim();
}

/** Normalized label key: page, viewport and theme, so `390x844` and `390×844` match. */
function labelParts(label) {
  const vp = VIEWPORT.exec(label);
  const theme = THEMES.find((t) => new RegExp(`\\b${t}\\b`, "i").test(label));
  const page = (label.match(/(^|\s)(\/[^\s·|,]*)/) ?? [])[2];
  return { page: page ?? null, viewport: vp ? `${vp[1]}×${vp[2]}` : null, theme: theme ?? null };
}

function images(section) {
  const out = [];
  for (const m of section.matchAll(IMAGE)) {
    if (m[0].startsWith("<")) {
      const alt = (m[0].match(/\balt\s*=\s*"([^"]*)"/i) ?? [])[1] ?? "";
      const src = (m[0].match(/\bsrc\s*=\s*"([^"]*)"/i) ?? [])[1] ?? "";
      out.push({ alt, url: src });
    } else out.push({ alt: m[1], url: m[2] });
  }
  return out;
}

/**
 * Parse the section. kind: "missing" | "empty" | "pairs" | "evidence" | "no-visual-change" | "unrecognized".
 * pairs: [{ label, before, after }]; problems: format failures found while pairing.
 */
export function parseBeforeAfter(body) {
  const section = extractSection(body);
  if (section === null) return { kind: "missing", problems: [] };
  const meaningful = section.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!meaningful) return { kind: "empty", problems: [] };
  const imgs = images(meaningful);
  if (imgs.length) {
    const problems = [];
    const pairs = [];
    const open = [];
    for (const img of imgs) {
      const side = SIDE.exec(img.alt);
      if (!side) {
        problems.push(`image "${img.alt || img.url}" is not labeled "Before: …" or "After: …"`);
        continue;
      }
      const which = side[1].toLowerCase();
      const label = side[2];
      const parts = labelParts(label);
      const missing = ["page", "viewport", "theme"].filter((k) => !parts[k]);
      if (missing.length) problems.push(`${which} "${label}": label does not state the ${missing.join(", ")}`);
      const entry = { label, parts, url: img.url };
      if (which === "before") {
        open.push(entry);
        continue;
      }
      const key = (x) => `${x.page}|${x.viewport}|${x.theme}`;
      const same = open.findIndex((o) => key(o.parts) === key(parts));
      const before = open.splice(same === -1 ? 0 : same, 1)[0];
      if (!before) {
        problems.push(`after "${label}" has no before`);
        continue;
      }
      const diff = ["page", "viewport", "theme"].filter((k) => before.parts[k] !== parts[k]);
      if (diff.length) problems.push(`pair "${before.label}" / "${label}": labels differ in ${diff.join(", ")}`);
      pairs.push({ label: before.label, before, after: entry });
    }
    for (const b of open) problems.push(`before "${b.label}" has no after`);
    return { kind: "pairs", pairs, problems };
  }
  const lines = meaningful.split("\n").map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => NO_VISUAL_CHANGE_LINE.test(l));
  if (i !== -1) {
    const sameLine = lines[i].replace(NO_VISUAL_CHANGE, "").replace(/^[\s*_.:\-–—]+|[\s*_.]+$/g, "");
    const reason = sameLine || lines.slice(i + 1).find((l) => /\w/.test(l)) || lines.slice(0, i).find((l) => /\w/.test(l)) || "";
    return { kind: "no-visual-change", reason, problems: reason ? [] : ["\"No visual change\" has no reason line"] };
  }
  if (/```[\s\S]*?```/.test(meaningful) || /https?:\/\/\S+/.test(meaningful)) return { kind: "evidence", problems: [] };
  return { kind: "unrecognized", problems: [] };
}

/** Width/height from PNG, GIF, JPEG or WebP bytes; null when unreadable. */
export function imageSize(buf) {
  const b = Buffer.from(buf);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString("ascii", 12, 16) === "IHDR")
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString("ascii", 0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const fmt = b.toString("ascii", 12, 16);
    if (fmt === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (fmt === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (fmt === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1];
      const len = b.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: b.readUInt16BE(o + 5), width: b.readUInt16BE(o + 7) };
      o += 2 + len;
    }
  }
  return null;
}

/** Fetch one image: { ok, width, height } or { ok: false, error }. */
export async function fetchImage(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  try {
    const res = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const size = imageSize(new Uint8Array(await res.arrayBuffer()));
    if (!size || !size.width || !size.height) return { ok: false, error: "not a PNG, JPEG, GIF or WebP image" };
    return { ok: true, ...size };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 120) };
  }
}

/** Diff pixels / failed snapshots from a Playwright JSON report of visual.spec.ts. */
export function visualDiffFromReport(report) {
  const failed = [];
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? [])
        if (/visual\.spec\.ts$/.test(spec.file ?? f ?? "") && t.status && !["expected", "skipped"].includes(t.status))
          failed.push(spec.title);
    for (const s of suite.suites ?? []) walk(s, f);
  };
  for (const s of report?.suites ?? []) walk(s);
  return { ran: true, failed, diff: failed.length > 0 };
}

/**
 * Verdict. images: url → fetchImage result. visual: { ran, diff, failed?, diffPixels? } or null.
 * Returns { pass, verdict, failures, kind }.
 */
export function evaluateBeforeAfter({ body, files = [], images: imgs = {}, visual = null }) {
  const parsed = parseBeforeAfter(body);
  const f = [];
  let verdict = null;
  if (parsed.kind === "missing") f.push("Before/After: no `## Before / After` section in the PR body");
  else if (parsed.kind === "empty") f.push("Before/After: the `## Before / After` section is empty");
  else if (parsed.kind === "unrecognized")
    f.push("Before/After: section has no labeled image pairs, no code block or link, and no `No visual change` line");
  for (const p of parsed.problems) f.push(`Before/After: ${p}`);
  if (parsed.kind === "pairs") {
    for (const { label, before, after } of parsed.pairs) {
      const sizes = [];
      for (const [side, e] of [["before", before], ["after", after]]) {
        const r = imgs[e.url];
        if (!r) f.push(`Before/After: ${side} "${e.label}" was not fetched (${e.url})`);
        else if (!r.ok) f.push(`Before/After: ${side} "${e.label}" can't be fetched: ${r.error} (${e.url})`);
        else sizes.push(r);
      }
      if (sizes.length === 2 && (sizes[0].width !== sizes[1].width || sizes[0].height !== sizes[1].height))
        f.push(`Before/After: pair "${label}" sizes differ: before ${sizes[0].width}×${sizes[0].height}, after ${sizes[1].width}×${sizes[1].height}`);
    }
  }
  if (parsed.kind === "no-visual-change" && touchesUi(files)) {
    const ui = files.map((x) => (typeof x === "string" ? x : x.path)).filter(isUiPath);
    if (visual?.ran && (visual.diff || (visual.diffPixels ?? 0) > 0)) {
      verdict = "contradicted";
      const what = visual.failed?.length ? `${visual.failed.length} snapshot(s) differ: ${visual.failed.slice(0, 5).join(", ")}` : `${visual.diffPixels} px differ`;
      f.push(`Before/After: CONTRADICTED: claims "No visual change" but touches UI (${ui.slice(0, 5).join(", ")}) and the visual run at maxDiffPixels 0 shows a diff (${what})`);
    } else if (!visual?.ran) {
      f.push(`Before/After: claims "No visual change" and touches UI (${ui.slice(0, 5).join(", ")}) but no visual run (maxDiffPixels 0) was given to confirm it`);
    }
  }
  return { pass: f.length === 0, verdict: verdict ?? (f.length ? "fail" : "pass"), failures: f, kind: parsed.kind };
}

/** Read the PR, fetch every pair image, evaluate. */
export async function runBeforeAfterGate({ pr, repo = "jgarrison929/pitbull", visual = null, fetchImpl = fetch, gh = execFileSync }) {
  const raw = gh("gh", ["pr", "view", String(pr), "--repo", repo, "--json", "body,files"], { encoding: "utf8" });
  const { body, files } = JSON.parse(raw);
  const parsed = parseBeforeAfter(body);
  const imgs = {};
  if (parsed.kind === "pairs")
    for (const p of parsed.pairs) for (const e of [p.before, p.after]) imgs[e.url] ??= await fetchImage(e.url, { fetchImpl });
  return { ...evaluateBeforeAfter({ body, files: (files ?? []).map((x) => x.path), images: imgs, visual }), pairs: parsed.pairs ?? [], images: imgs };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const arg = (k) => {
    const i = process.argv.indexOf(k);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const pr = arg("--pr");
  const jsonFile = arg("--pr-json"); // a saved `gh pr view <n> --json body,files`, for offline runs and the CLI test
  if (!pr && !jsonFile) {
    console.error("usage: node before-after.mjs --pr <number> | --pr-json <file> [--repo owner/name] [--visual-report <json>] [--visual-diff-pixels <n>]");
    process.exit(2);
  }
  let visual = null;
  if (arg("--visual-report")) visual = visualDiffFromReport(JSON.parse(readFileSync(arg("--visual-report"), "utf8")));
  else if (arg("--visual-diff-pixels") !== undefined) {
    const n = Number(arg("--visual-diff-pixels"));
    visual = { ran: true, diffPixels: n, diff: n > 0 };
  }
  const gh = jsonFile ? () => readFileSync(jsonFile, "utf8") : execFileSync;
  const r = await runBeforeAfterGate({ pr: pr ?? "file", repo: arg("--repo") ?? "jgarrison929/pitbull", visual, gh });
  for (const p of r.pairs) {
    const b = r.images[p.before.url];
    const a = r.images[p.after.url];
    console.log(`pair "${p.label}": before ${b?.ok ? `${b.width}×${b.height}` : "unfetched"}, after ${a?.ok ? `${a.width}×${a.height}` : "unfetched"}`);
  }
  for (const x of r.failures) console.log(`FAIL ${x}`);
  console.log(`Before/After gate: ${r.verdict.toUpperCase()} (${r.kind})`);
  process.exitCode = r.pass ? 0 : 1; // FAIL and CONTRADICTED exit 1
  process.exit(process.exitCode);
}
