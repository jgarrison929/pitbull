/**
 * Before/After gate (Joshua's rule, 2026-10-27).
 *
 * Every PR body needs a `## Before / After` section holding one of:
 *   (a) labeled image pairs: every `Before` image has an `After` image with the same label, and the label states the
 *       page, the role (superintendent, foreman, pm, executive or visitor), the viewport (W×H) and the theme (light or
 *       dark), e.g.
 *         ![Before: /app · pm · 390×844 · light](https://…/before.png)
 *         ![After: /app · pm · 390×844 · light](https://…/after.png)
 *   (b) non-UI evidence: a fenced code block or a link that isn't a placeholder, with the section naming both Before and
 *       After;
 *   (c) `No visual change` and a reason, taken from the same line or the lines after it (never the line above).
 *
 * Placeholders FAIL: an empty code block, a block holding only TODO/TBD/…, a link to example.com/.org/.net, and a
 * `No visual change` reason like TBD, TODO, n/a or "…".
 *
 * A PR that touches UI files needs (a), or (c) confirmed by a clean 0 px visual run. Code blocks, plain links and
 * unlabeled `[shot](….png)` links are not visual evidence and FAIL on a UI diff.
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
export const ROLES = ["superintendent", "foreman", "pm", "executive", "visitor"];
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

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * The text under `## Before / After`, up to the next h1/h2 or the Cursor body-end marker. null when the heading is absent.
 * Lines inside fenced code blocks are never headings, so a `# run` comment in a bash fence doesn't end the section (and a
 * fenced `## Before / After` doesn't start one).
 */
export function extractSection(body) {
  const lines = String(body ?? "").replace(/\r\n/g, "\n").split("\n");
  let fence = null;
  let start = -1;
  const out = [];
  for (const line of lines) {
    const f = FENCE.exec(line);
    const inFence = fence !== null;
    if (f) {
      if (!inFence) fence = f[1][0];
      else if (f[1][0] === fence && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(line)) fence = null;
    }
    if (start === -1) {
      if (!inFence && !f && SECTION_HEADING.test(line)) start = 0;
      continue;
    }
    if (!inFence && !f) {
      if (line.includes(CURSOR_BODY_END)) { out.push(line.slice(0, line.indexOf(CURSOR_BODY_END))); break; }
      if (/^#{1,2}\s/.test(line)) break;
    }
    out.push(line);
  }
  if (start === -1) return null;
  return out.join("\n").replace(CURSOR_FOOTER_BADGE, "").replace(EMPTY_DIV, "").trim();
}

/** Fenced code blocks in a section: [{ content }], unclosed fences run to the end. */
function codeBlocks(section) {
  const blocks = [];
  let cur = null;
  let fence = null;
  for (const line of section.split("\n")) {
    const f = FENCE.exec(line);
    if (cur === null) {
      if (f) { cur = []; fence = f[1][0]; }
    } else if (f && f[1][0] === fence && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(line)) {
      blocks.push({ content: cur.join("\n") });
      cur = null;
    } else cur.push(line);
  }
  if (cur !== null) blocks.push({ content: cur.join("\n"), unclosed: true });
  return blocks;
}
/** Text outside fenced code blocks. */
function proseOf(section) {
  const keep = [];
  let fence = null;
  for (const line of section.split("\n")) {
    const f = FENCE.exec(line);
    if (fence === null) {
      if (f) { fence = f[1][0]; continue; }
      keep.push(line);
    } else if (f && f[1][0] === fence && /^\s{0,3}(`{3,}|~{3,})\s*$/.test(line)) fence = null;
  }
  return keep.join("\n");
}
/** TODO, TBD, FIXME, XXX, placeholder, n/a, none, "…", "-", "?", "<reason>", or nothing at all. */
export const PLACEHOLDER = /^[\s>*_`"'()[\]<>:.\-–—?]*(?:(?:todo|tbd|tbc|fixme|xxx|placeholder|n\/?a|none|reason|coming soon|wip)\b[\s*_`"'()[\]<>:.\-–—?!]*)?(?:…|\.\.\.)?[\s*_`"'()[\]<>.\-–—?!]*$/i;
const isPlaceholder = (t) => PLACEHOLDER.test(String(t ?? "").replace(/\s+/g, " ").trim());
const URL_RE = /https?:\/\/[^\s)<>"'\]]+/gi;
const placeholderUrl = (u) => {
  try {
    return /(^|\.)example\.(com|org|net)$/i.test(new URL(u).hostname);
  } catch {
    return true;
  }
};

export const PAIR_KEYS = ["page", "role", "viewport", "theme"];
/** Normalized label key: page, role, viewport and theme, so `390x844` and `390×844` match. The role is read with the page removed. */
function labelParts(label) {
  const vp = VIEWPORT.exec(label);
  const theme = THEMES.find((t) => new RegExp(`\\b${t}\\b`, "i").test(label));
  const page = (label.match(/(^|\s)(\/[^\s·|,]*)/) ?? [])[2];
  const rest = page ? label.replace(page, " ") : label;
  const role = ROLES.find((r) => new RegExp(`(^|[^\\w/-])${r}(?![\\w/-])`, "i").test(rest));
  return { page: page ?? null, role: role ?? null, viewport: vp ? `${vp[1]}×${vp[2]}` : null, theme: theme ?? null };
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
      const missing = PAIR_KEYS.filter((k) => !parts[k]);
      if (missing.length) problems.push(`${which} "${label}": label does not state the ${missing.join(", ")}`);
      const entry = { label, parts, url: img.url };
      if (which === "before") {
        open.push(entry);
        continue;
      }
      const key = (x) => PAIR_KEYS.map((k) => x[k]).join("|");
      const same = open.findIndex((o) => key(o.parts) === key(parts));
      const before = open.splice(same === -1 ? 0 : same, 1)[0];
      if (!before) {
        problems.push(`after "${label}" has no before`);
        continue;
      }
      const diff = PAIR_KEYS.filter((k) => before.parts[k] !== parts[k]);
      if (diff.length) problems.push(`pair "${before.label}" / "${label}": labels differ in ${diff.join(", ")}`);
      pairs.push({ label: before.label, before, after: entry });
    }
    for (const b of open) problems.push(`before "${b.label}" has no after`);
    return { kind: "pairs", pairs, problems };
  }
  const lines = meaningful.split("\n").map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => NO_VISUAL_CHANGE_LINE.test(l));
  if (i !== -1) {
    // The reason is on the claim's line or the lines after it; a line above the claim never counts.
    const sameLine = lines[i].replace(NO_VISUAL_CHANGE, "").replace(/^[\s*_.:\-–—]+|[\s*_.]+$/g, "");
    const reason = sameLine || lines.slice(i + 1).find((l) => /\w/.test(l) && !FENCE.test(l)) || "";
    const problems = !reason
      ? ["\"No visual change\" has no reason on its line or the lines after it"]
      : isPlaceholder(reason) || isPlaceholder(reason.replace(/^\W*reason\s*[:\-–—]\s*/i, ""))
        ? [`"No visual change" reason "${reason.slice(0, 60)}" is a placeholder`]
        : [];
    return { kind: "no-visual-change", reason, problems };
  }
  const blocks = codeBlocks(meaningful);
  const urls = [...proseOf(meaningful).matchAll(URL_RE)].map((m) => m[0]);
  if (blocks.length || urls.length) {
    const problems = [];
    blocks.forEach((b, n) => {
      if (isPlaceholder(b.content)) problems.push(`code block ${n + 1} is a placeholder (${b.content.trim() ? `"${b.content.trim().slice(0, 40)}"` : "empty"})`);
    });
    for (const u of urls) if (placeholderUrl(u)) problems.push(`link ${u} is a placeholder`);
    const prose = proseOf(meaningful);
    const named = ["Before", "After"].filter((w) => !new RegExp(`\\b${w}\\b`, "i").test(prose));
    if (named.length) problems.push(`evidence does not name ${named.join(" or ")} (outside code blocks)`);
    return { kind: "evidence", problems };
  }
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
  const ui = files.map((x) => (typeof x === "string" ? x : x.path)).filter(isUiPath);
  if (ui.length && parsed.kind === "evidence")
    f.push(`Before/After: touches UI (${ui.slice(0, 5).join(", ")}) but gives only code blocks or links; a UI diff needs labeled image pairs, or "No visual change" confirmed by a clean 0 px visual run`);
  if (ui.length && parsed.kind === "pairs" && parsed.pairs.length === 0)
    f.push(`Before/After: touches UI (${ui.slice(0, 5).join(", ")}) but has no labeled Before/After image pair`);
  if (parsed.kind === "no-visual-change" && ui.length) {
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
