// Rejects repeated agent mistakes. The same command runs locally and in CI.
// Fixtures under fixtures/agent-guards/ are real past mistakes; --prove expects them to fail.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const fixtureDir = path.join(here, "fixtures/agent-guards");

/** The only Co-authored-by address a commit in this repo may carry. */
export const ALLOWED_COAUTHOR = "21370704+jgarrison929@users.noreply.github.com";

const CODE_EXT = new Set([".ts", ".tsx", ".mjs", ".js", ".cjs"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "out",
  "build",
  "dist",
  "coverage",
  "fixtures",
  "test-results",
  "playwright-report",
]);

const COMMIT_PROOFS = [
  ["601fbe393e5206c411d6445dcb470220d816b2d1", "PR #4 squash"],
  ["fbc4a1fbb0804ef5dcf91036749a4a6f0264d2bd", "PR #3 squash"],
  ["390fa3a937c6491615d4d1760c397e7909445510", "PR #17"],
  ["1e1bc24cf588e6043ffe660c8b53b9c73335c671", "id-less noreply"],
];

const FILE_PROOFS = [
  ["107671f03f194768f549f79d9dbba17b40e37ff8", ".cursor/skills/verify-v5/checks.test.mjs", "journal", "PR #44 journal pin"],
  ["3650d64beabd841053087bd74b90dacf083ca44c", "v5/tests/e2e/visual.spec.ts", "harness", "PR #48 silent wait"],
  ["615e0bf97c8f43086ea95bcca22cd072a0796ba4", "v5/tests/e2e/visual.spec.ts", "harness", "silent wait 615e0bf"],
];

const MERGE_PROOFS = [
  ["69182163b92bdc4ecefa2371e2fe23a5933c5f48", "643cbaf0d80d73e5868bb17388f356adbc26223f", "PR #25 vs #24"],
  ["69182163b92bdc4ecefa2371e2fe23a5933c5f48", "ae0062a412df3311406ab0ee835780001b4b5f15", "PR #27 vs #24"],
];

const THROWN_WAITS = `
async function waitForScrollHeightStable(page) {
  for (let i = 0; i < 30; i++) {
    if (stable >= 3) return h;
  }
  throw new Error("scrollHeight not stable after 30 frames");
}
async function fitViewportToPage(page) {
  for (let i = 0; i < 5; i++) {
    if (h <= current) break;
  }
  throw new Error("viewport still overflowing after 5 grows");
}
`;

export function commitMessageFailures(message) {
  const text = String(message ?? "");
  const failures = [];
  if (/gmail\.com/i.test(text)) {
    failures.push(
      `commit message contains gmail.com. The only allowed Co-authored-by address is ${ALLOWED_COAUTHOR}.`,
    );
  }
  const seen = new Set();
  for (const match of text.matchAll(/^[ \t]*Co-authored-by:.*<([^>]+)>/gim)) {
    const email = match[1].trim();
    if (email === ALLOWED_COAUTHOR || seen.has(email)) continue;
    seen.add(email);
    failures.push(
      `Co-authored-by <${email}> is not allowed. Use ${ALLOWED_COAUTHOR}.`,
    );
  }
  return failures;
}

function mentionsJournal(source, file) {
  return /journal|loadMigrationJournal|_journal\.json/i.test(`${file}\n${source}`);
}

/** A journal test may assert idx, when, and prevId. It may not pin the count or "this tag is last". */
export function journalPinFailures(source, file = "") {
  if (!mentionsJournal(source, file)) return [];
  const failures = [];
  const text = String(source);
  const lengthPin = /entries\.length\s*,\s*\d+\b|entries\.length\s*===?\s*\d+\b|entries\.length\s*!==?\s*\d+\b|entries\.length\)\s*\.to(?:Be|Equal|StrictEqual)\(\s*\d+\b/g;
  for (const match of text.matchAll(lengthPin)) {
    failures.push(
      `${label(file)}journal length is pinned (${match[0].replace(/\s+/g, " ")}). Assert this migration's idx, when, and prevId. A later migration must still pass.`,
    );
  }
  if (/entries\.length\s*-\s*1/.test(text)) {
    failures.push(
      `${label(file)}journal last-entry pin (entries.length - 1). A later migration must still pass.`,
    );
  }
  const atLast = /\.at\(\s*-1\s*\)/g;
  for (const match of text.matchAll(atLast)) {
    const from = Math.max(0, match.index - 100);
    const to = Math.min(text.length, match.index + match[0].length + 100);
    const tag = text.slice(from, to).match(/00\d{2}_[A-Za-z0-9_]+/);
    if (!tag) continue;
    failures.push(
      `${label(file)}last journal tag is pinned with .at(-1) beside ${tag[0]}. Do not require this tag to stay last.`,
    );
  }
  return failures;
}

function label(file) {
  return file ? `${file}: ` : "";
}

function skipString(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  return source.length;
}

function matchingBrace(source, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const c = source[i];
    if (c === "'" || c === '"') {
      i = skipString(source, i);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(source, i);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      i = nl < 0 ? source.length : nl + 1;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function skipTemplate(source, start) {
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === "`") return i + 1;
    if (source[i] === "$" && source[i + 1] === "{") {
      const end = matchingBrace(source, i + 1);
      if (end < 0) return source.length;
      i = end + 1;
      continue;
    }
    i += 1;
  }
  return source.length;
}

function matchingParen(source, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < source.length) {
    const c = source[i];
    if (c === "'" || c === '"') {
      i = skipString(source, i);
      continue;
    }
    if (c === "`") {
      i = skipTemplate(source, i);
      continue;
    }
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function asyncFunctions(source) {
  const found = [];
  const re = /async\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  let match;
  while ((match = re.exec(source))) {
    const paren = match.index + match[0].length - 1;
    const parenEnd = matchingParen(source, paren);
    if (parenEnd < 0) break;
    const open = source.indexOf("{", parenEnd);
    if (open < 0) break;
    const close = matchingBrace(source, open);
    if (close < 0) break;
    found.push({ name: match[1], body: source.slice(open + 1, close) });
    re.lastIndex = close + 1;
  }
  return found;
}

function numericLoops(body) {
  const loops = [];
  const re = /for\s*\(\s*(?:let|var|const)\s+[A-Za-z0-9_]+\s*=\s*\d+\s*;\s*[A-Za-z0-9_]+\s*<\s*\d+/g;
  let match;
  while ((match = re.exec(body))) {
    const paren = body.indexOf("(", match.index);
    const parenEnd = matchingParen(body, paren);
    if (parenEnd < 0) break;
    const open = body.indexOf("{", parenEnd);
    if (open < 0) break;
    const close = matchingBrace(body, open);
    if (close < 0) break;
    loops.push({ tail: body.slice(close + 1) });
    re.lastIndex = close + 1;
  }
  return loops;
}

function returnsLast(tail) {
  return /(^|\n)[ \t]*return\s+last\b/.test(tail);
}

function throwsInTail(tail) {
  return /\bthrow\b/.test(tail);
}

/**
 * A numeric for-loop that then `return last` gave up without failing the test.
 * waitForScrollHeightStable and fitViewportToPage must throw after the loop.
 */
export function harnessTimeoutFailures(source, file = "") {
  const failures = [];
  for (const fn of asyncFunctions(source)) {
    const loops = numericLoops(fn.body);
    for (const loop of loops) {
      if (!returnsLast(loop.tail)) continue;
      failures.push(
        `${label(file)}${fn.name}: bounded wait returns last after the loop. Throw on timeout instead of returning the last sample.`,
      );
    }
    if (fn.name !== "waitForScrollHeightStable" && fn.name !== "fitViewportToPage") continue;
    if (loops.length === 0) continue;
    const tail = loops[loops.length - 1].tail;
    if (throwsInTail(tail)) continue;
    const hint = fn.name === "waitForScrollHeightStable"
      ? 'Throw new Error("scrollHeight not stable after N frames") when the wait times out.'
      : 'Throw new Error("viewport still overflowing after N grows") when the viewport is still overflowing.';
    failures.push(`${label(file)}${fn.name}: bounded wait ends without throw. ${hint}`);
  }
  return failures;
}

/** Stage lines from `git merge-tree --write-tree` whose path is a visual baseline. */
export function snapshotConflictPaths(stdout) {
  const paths = new Set();
  for (const line of String(stdout ?? "").split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const meta = line.slice(0, tab);
    const file = line.slice(tab + 1).trim();
    if (!/\s[123]$/.test(meta)) continue;
    if (file.includes("visual.spec.ts-snapshots/")) paths.add(file);
  }
  return [...paths];
}

export function snapshotConflictFailures(stdout) {
  const paths = snapshotConflictPaths(stdout);
  if (paths.length === 0) return [];
  const shown = paths.slice(0, 8).join(", ");
  const more = paths.length > 8 ? ` (+${paths.length - 8} more)` : "";
  return [
    `visual baseline conflict (${paths.length} file${paths.length === 1 ? "" : "s"}): ${shown}${more}. Rebase onto the base and re-adopt baselines from CI with v5/scripts/adopt-visual-actuals.sh. Do not hand-merge the PNGs.`,
  ];
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (CODE_EXT.has(path.extname(name))) out.push(full);
  }
}

export function scanTree(root = repoRoot) {
  const files = [];
  walk(path.join(root, "v5"), files);
  walk(path.join(root, ".cursor"), files);
  const failures = [];
  for (const full of files) {
    const rel = path.relative(root, full);
    if (rel === "v5/scripts/agent-guards.mjs" || rel === "v5/scripts/agent-guards.test.ts") continue;
    let source;
    try {
      source = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    failures.push(...journalPinFailures(source, rel));
    failures.push(...harnessTimeoutFailures(source, rel));
  }
  return failures;
}

function readFixture(name) {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}

export function proveFixtures() {
  const problems = [];
  const notes = [];
  const reject = (name, failures) => {
    if (failures.length === 0) problems.push(`prove: ${name} was not rejected`);
    else notes.push(`rejected ${name}: ${failures[0]}`);
    return failures;
  };
  for (const name of ["gmail-601fbe3.txt", "gmail-fbc4a1f.txt", "gmail-390fa3a.txt"]) {
    const failures = reject(name, commitMessageFailures(readFixture(name)));
    if (failures.length > 0 && !failures.some((f) => /gmail\.com/i.test(f))) {
      problems.push(`prove: ${name} was not rejected for gmail.com`);
    }
  }
  const noreply = reject("noreply-1e1bc24.txt", commitMessageFailures(readFixture("noreply-1e1bc24.txt")));
  if (noreply.length > 0 && !noreply.some((f) => /not allowed/.test(f))) {
    problems.push("prove: noreply-1e1bc24 was not rejected as a co-author");
  }
  const allowed = commitMessageFailures(
    `Pick a role.\n\nCo-authored-by: jgarrison929 <${ALLOWED_COAUTHOR}>\n`,
  );
  if (allowed.length > 0) problems.push(`prove: allowed noreply was rejected: ${allowed.join(" ")}`);
  const signedOff = commitMessageFailures(
    "Bump a dependency.\n\nSigned-off-by: dependabot[bot] <support@github.com>\n",
  );
  if (signedOff.length > 0) problems.push(`prove: Signed-off-by without a co-author was rejected: ${signedOff.join(" ")}`);

  for (const name of ["journal-107671f.txt", "journal-0020-last.txt"]) {
    reject(name, journalPinFailures(readFixture(name), name));
  }
  const loop = journalPinFailures(
    "export function journalWhenStrictlyIncreases(entries) {\n  for (let i = 1; i < entries.length; i++) {}\n}\n",
    "applied-migrations.ts",
  );
  if (loop.length > 0) problems.push(`prove: a journal length loop was rejected: ${loop.join(" ")}`);

  for (const name of ["harness-3650d64.txt", "harness-615e0bf.txt"]) {
    const failures = reject(name, harnessTimeoutFailures(readFixture(name), name));
    if (failures.length > 0) {
      if (!failures.some((f) => f.includes("waitForScrollHeightStable"))) {
        problems.push(`prove: ${name} did not reject waitForScrollHeightStable`);
      }
      if (!failures.some((f) => f.includes("fitViewportToPage"))) {
        problems.push(`prove: ${name} did not reject fitViewportToPage`);
      }
    }
  }
  const thrown = harnessTimeoutFailures(THROWN_WAITS, "fixed.ts");
  if (thrown.length > 0) problems.push(`prove: waits that throw were rejected: ${thrown.join(" ")}`);

  for (const name of ["snapshot-643cbaf0.txt", "snapshot-ae0062a4.txt"]) {
    const failures = reject(name, snapshotConflictFailures(readFixture(name)));
    if (failures.length > 0 && !/adopt-visual-actuals\.sh/.test(failures[0])) {
      problems.push(`prove: ${name} did not name adopt-visual-actuals.sh`);
    }
  }
  const cleanTree = snapshotConflictFailures("4244851a43bf7d4ebf455fbe568acf75c77824c0\n");
  if (cleanTree.length > 0) problems.push("prove: a clean merge-tree was rejected");
  return { problems, notes };
}

function gitOk(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0;
}

function gitText(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} exited ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
}

export function proveHistorical() {
  const problems = [];
  const notes = [];
  for (const [sha, title] of COMMIT_PROOFS) {
    if (!gitOk(["cat-file", "-e", `${sha}^{commit}`])) {
      notes.push(`historical commit ${sha.slice(0, 12)} (${title}) is not in this clone; fixture proof stands`);
      continue;
    }
    const message = gitText(["log", "-1", "--format=%B", sha]);
    const failures = commitMessageFailures(message);
    if (failures.length === 0) problems.push(`prove: ${sha.slice(0, 12)} (${title}) was not rejected`);
    else notes.push(`rejected ${sha.slice(0, 12)} (${title}): ${failures[0]}`);
  }
  for (const [sha, file, kind, title] of FILE_PROOFS) {
    if (!gitOk(["cat-file", "-e", `${sha}:${file}`])) {
      notes.push(`historical file ${sha.slice(0, 12)}:${file} is not in this clone; fixture proof stands`);
      continue;
    }
    const source = gitText(["show", `${sha}:${file}`]);
    const failures = kind === "journal" ? journalPinFailures(source, file) : harnessTimeoutFailures(source, file);
    if (failures.length === 0) problems.push(`prove: ${sha.slice(0, 12)} (${title}) was not rejected`);
    else notes.push(`rejected ${sha.slice(0, 12)} (${title}): ${failures[0]}`);
  }
  for (const [base, head, title] of MERGE_PROOFS) {
    if (!gitOk(["cat-file", "-e", `${base}^{commit}`]) || !gitOk(["cat-file", "-e", `${head}^{commit}`])) {
      notes.push(`historical merge ${title} is not in this clone; fixture proof stands`);
      continue;
    }
    const result = spawnSync("git", ["merge-tree", "--write-tree", base, head], { cwd: repoRoot, encoding: "utf8" });
    const failures = snapshotConflictFailures(result.stdout ?? "");
    if (result.status === 0 || failures.length === 0) {
      problems.push(`prove: merge-tree ${title} was not rejected (exit ${result.status})`);
    } else notes.push(`rejected merge-tree ${title}: ${failures[0]}`);
  }
  return { problems, notes };
}

export function rangeFailures(range) {
  const list = range === "HEAD"
    ? [gitText(["rev-parse", "HEAD"]).trim()]
    : gitText(["rev-list", "--reverse", range]).split("\n").filter(Boolean);
  const failures = [];
  for (const sha of list) {
    const message = gitText(["log", "-1", "--format=%B", sha]);
    for (const failure of commitMessageFailures(message)) failures.push(`${sha.slice(0, 12)}: ${failure}`);
  }
  return failures;
}

export function mergeTreeFailures(base, head) {
  const result = spawnSync("git", ["merge-tree", "--write-tree", base, head], { cwd: repoRoot, encoding: "utf8" });
  if (result.status === 0) return [];
  const snapshot = snapshotConflictFailures(result.stdout ?? "");
  if (snapshot.length > 0) return snapshot;
  const detail = (result.stderr || result.stdout || "").trim().split("\n").slice(0, 8).join(" ");
  return [`merge-tree ${base} ${head} failed. ${detail}`];
}

function parseArgs(argv) {
  const out = { prove: false, range: "", base: "", head: "HEAD" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--prove") out.prove = true;
    else if (arg === "--range") out.range = argv[++i] ?? "";
    else if (arg === "--base") out.base = argv[++i] ?? "";
    else if (arg === "--head") out.head = argv[++i] ?? "HEAD";
    else throw new Error(`unknown argument ${arg}`);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];
  if (args.prove) {
    const fixtures = proveFixtures();
    const historical = proveHistorical();
    for (const note of [...fixtures.notes, ...historical.notes]) console.log(note);
    failures.push(...fixtures.problems, ...historical.problems);
  }
  failures.push(...scanTree());
  if (args.range) failures.push(...rangeFailures(args.range));
  if (args.base) failures.push(...mergeTreeFailures(args.base, args.head));
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log("agent-guards: ok");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
