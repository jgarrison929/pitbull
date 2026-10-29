// Turn v5/test-results/areas/plan-edit/ into the PR sections for one area run.
// The reporter writes run.json from Playwright's results. This script writes
// scenarios.md (the table) and can print ## Scenarios plus ## Before / After.
import fs from "node:fs";
import path from "node:path";

const ORDER = ["PB-97-S1", "PB-97-S2", "PB-97-S3", "PB-97-S4", "PB-97-S5"];

/**
 * Pairs the script requires. S3 and S4 both use the pm role on the same page,
 * so a before/after zip by capture order would cross those shots. The key is
 * scenario + role, and this list is the order pairs are emitted in.
 */
export const REQUIRED_PAIRS = [
  { scenario: "PB-97-S1", role: "foreman" },
  { scenario: "PB-97-S2", role: "superintendent" },
  { scenario: "PB-97-S3", role: "pm" },
  { scenario: "PB-97-S3", role: "executive" },
  { scenario: "PB-97-S4", role: "pm" },
  { scenario: "PB-97-S5", role: "foreman" },
];

/** @param {string} scenario @param {string} role */
export function pairKey(scenario, role) {
  return `${scenario}\0${role}`;
}

/**
 * @typedef {object} EvidenceShot
 * @property {string} [scenario]
 * @property {string} [role]
 * @property {"before" | "after"} [which]
 * @property {string} [file]
 * @property {string} [page]
 * @property {string} [viewport]
 * @property {string} [theme]
 * @property {string} [before]
 * @property {string} [after]
 * @property {boolean} [beforeTaken]
 * @property {boolean} [afterTaken]
 * @property {string | null} [replayUrl]
 * @property {string} [test]
 * @property {string} [result]
 */

/**
 * A scenario row, a finished pair, or one shot. `before`/`after` are set once a pair is assembled.
 * @typedef {object} ScenarioRow
 * @property {string} scenario
 * @property {string} [test]
 * @property {string} [result]
 * @property {string} [page]
 * @property {string} [role]
 * @property {string} [viewport]
 * @property {string} [theme]
 * @property {string} [before]
 * @property {string} [after]
 * @property {boolean} [beforeTaken]
 * @property {boolean} [afterTaken]
 * @property {string | null} [replayUrl]
 * @property {"before" | "after"} [which]
 * @property {string} [file]
 * @property {EvidenceShot[]} [shots]
 * @property {EvidenceShot[]} [pairs]
 */

/** @param {string} value */
export function escapeCell(value) {
  // Escape backslash before pipe. Replacing only "|" leaves a preceding
  // backslash able to eat the escape (CodeQL js/incomplete-sanitization).
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

/**
 * @param {string | null | undefined} replayUrl
 * @param {string[]} names
 */
export function proofCell(names, replayUrl) {
  const shots = names.filter(Boolean).map((name) => `\`${name}\``).join(", ");
  const recording = replayUrl ? ` [recording](${replayUrl})` : "";
  return `${shots}${recording}`.trim() || "—";
}

/**
 * One table row per scenario. Proof lists every role's shots for that scenario.
 * @param {ScenarioRow[]} rows
 */
export function scenariosTable(rows) {
  const lines = [
    "| Scenario | Test | Result | Proof |",
    "|---|---|---|---|",
  ];
  for (const row of scenarioSummaries(rows)) {
    lines.push(
      `| ${escapeCell(row.scenario)} | ${escapeCell(row.test)} | ${escapeCell(row.result)} | ${escapeCell(proofCell(row.names, row.replayUrl ? String(row.replayUrl) : null))} |`,
    );
  }
  return lines.join("\n");
}

/**
 * @param {ScenarioRow[]} rows
 * @param {(file: string) => string} hrefFor
 */
export function beforeAfterSection(rows, hrefFor) {
  const blocks = ["## Before / After", ""];
  for (const row of orderedPairs(assemblePairs(rows))) {
    const label = `${row.page} · ${row.role} · ${row.viewport} · ${row.theme}`;
    blocks.push(imageTag("Before", label, hrefFor(String(row.before))));
    blocks.push("");
    blocks.push(imageTag("After", label, hrefFor(String(row.after))));
    blocks.push("");
  }
  return blocks.join("\n").trim();
}

/** @param {string} side @param {string} label @param {string} href */
export function imageTag(side, label, href) {
  const alt = `${side}: ${label}`;
  if (href.startsWith("/")) {
    return `<img alt="${alt}" src="${href}" />`;
  }
  return `![${alt}](${href})`;
}

/**
 * @param {ScenarioRow[]} rows
 * @param {(file: string) => string} hrefFor
 */
export function prSections(rows, hrefFor) {
  return `## Scenarios\n\n${scenariosTable(rows)}\n\n${beforeAfterSection(rows, hrefFor)}\n`;
}

/** @param {string} id */
export function scenarioOrder(id) {
  const index = ORDER.indexOf(id);
  return index === -1 ? ORDER.length : index;
}

/**
 * Flatten scenario rows, pair rows, and individual shots into one list.
 * A row with `shots` is expanded per capture. Capture order is not pairing.
 * @param {ScenarioRow[]} rows
 */
export function expandEntries(rows) {
  const out = [];
  for (const row of rows ?? []) {
    if (Array.isArray(row.shots) && row.shots.length > 0) {
      for (const shot of row.shots) {
        out.push({
          scenario: shot.scenario ?? row.scenario,
          role: shot.role ?? row.role,
          test: row.test,
          result: row.result,
          page: shot.page ?? row.page,
          viewport: shot.viewport ?? row.viewport,
          theme: shot.theme ?? row.theme,
          replayUrl: row.replayUrl ?? null,
          which: shot.which,
          file: shot.file,
        });
      }
      continue;
    }
    if (Array.isArray(row.pairs) && row.pairs.length > 0) {
      for (const pair of row.pairs) {
        out.push({
          scenario: pair.scenario ?? row.scenario,
          role: pair.role ?? row.role,
          test: pair.test ?? row.test,
          result: pair.result ?? row.result,
          page: pair.page ?? row.page,
          viewport: pair.viewport ?? row.viewport,
          theme: pair.theme ?? row.theme,
          replayUrl: pair.replayUrl ?? row.replayUrl ?? null,
          before: pair.before,
          after: pair.after,
          beforeTaken: pair.beforeTaken,
          afterTaken: pair.afterTaken,
        });
      }
      continue;
    }
    out.push(row);
  }
  return out;
}

/**
 * @param {ScenarioRow[]} rows
 * @returns {Map<string, ScenarioRow>}
 */
export function assemblePairs(rows) {
  /** @type {Map<string, ScenarioRow>} */
  const map = new Map();
  for (const entry of expandEntries(rows)) {
    if (!entry.scenario || !entry.role) {
      throw new Error(
        `area-evidence: shot is missing scenario or role (${entry.scenario ?? "?"} ${entry.role ?? "?"})`,
      );
    }
    const key = pairKey(String(entry.scenario), String(entry.role));
    let pair = map.get(key);
    if (!pair) {
      pair = {
        scenario: String(entry.scenario),
        role: String(entry.role),
        test: entry.test ?? "",
        result: entry.result ?? "",
        page: entry.page ?? "",
        viewport: entry.viewport ?? "",
        theme: entry.theme ?? "",
        before: "",
        after: "",
        beforeTaken: false,
        afterTaken: false,
        replayUrl: entry.replayUrl ?? null,
      };
      map.set(key, pair);
    }
    if (entry.test) pair.test = entry.test;
    if (entry.result) pair.result = entry.result;
    if (entry.page) pair.page = entry.page;
    if (entry.viewport) pair.viewport = entry.viewport;
    if (entry.theme) pair.theme = entry.theme;
    if (entry.replayUrl) pair.replayUrl = entry.replayUrl;
    if (entry.which === "before" || entry.which === "after") {
      const file = entry.file ?? entry[entry.which];
      if (!file) {
        throw new Error(`area-evidence: ${entry.scenario} ${entry.role} ${entry.which} shot has no file`);
      }
      pair[entry.which] = String(file);
      pair[entry.which === "before" ? "beforeTaken" : "afterTaken"] = true;
    } else {
      if (entry.before) {
        pair.before = String(entry.before);
        pair.beforeTaken = entry.beforeTaken !== false;
      }
      if (entry.after) {
        pair.after = String(entry.after);
        pair.afterTaken = entry.afterTaken !== false;
      }
    }
  }
  return map;
}

/** Required pairs first, then any extra keys. Not the order shots were captured. */
export function orderedPairs(map) {
  const ordered = [];
  const seen = new Set();
  for (const req of REQUIRED_PAIRS) {
    const key = pairKey(req.scenario, req.role);
    seen.add(key);
    const pair = map.get(key);
    if (pair) ordered.push(pair);
  }
  const rest = [...map.entries()]
    .filter(([key]) => !seen.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [, pair] of rest) ordered.push(pair);
  return ordered;
}

/** @param {ScenarioRow[]} rows */
export function scenarioSummaries(rows) {
  /** @type {Map<string, { scenario: string, test: string, result: string, replayUrl: string | null, names: string[] }>} */
  const byId = new Map();
  const order = [];
  for (const pair of orderedPairs(assemblePairs(rows))) {
    let summary = byId.get(pair.scenario);
    if (!summary) {
      summary = {
        scenario: String(pair.scenario),
        test: String(pair.test ?? ""),
        result: String(pair.result ?? ""),
        replayUrl: pair.replayUrl ? String(pair.replayUrl) : null,
        names: [],
      };
      byId.set(pair.scenario, summary);
      order.push(summary);
    }
    if (pair.test) summary.test = String(pair.test);
    if (pair.result) summary.result = String(pair.result);
    if (pair.replayUrl) summary.replayUrl = String(pair.replayUrl);
    if (pair.beforeTaken && pair.before) summary.names.push(String(pair.before));
    if (pair.afterTaken && pair.after) summary.names.push(String(pair.after));
  }
  return order;
}

/**
 * @param {string} dir
 * @param {ScenarioRow | undefined} pair
 * @param {string} scenario
 * @param {string} role
 */
function problemsForPair(dir, pair, scenario, role) {
  if (!pair?.before || !pair.after || !pair.beforeTaken || !pair.afterTaken) {
    return [`${scenario} ${role} lacks a pair`];
  }
  const beforePath = path.join(dir, String(pair.before));
  const afterPath = path.join(dir, String(pair.after));
  if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
    return [`${scenario} ${role} lacks a pair`];
  }
  const before = fs.readFileSync(beforePath);
  const after = fs.readFileSync(afterPath);
  if (before.equals(after)) {
    return [`${scenario} ${role} before and after are byte-identical`];
  }
  return [];
}

/**
 * Fail when a required scenario+role has no pair, or a pair's files match byte for byte.
 * @param {string} dir
 * @param {ScenarioRow[]} rows
 * @param {{ scenario: string, role: string }[]} [required]
 * @returns {string[]}
 */
export function pairProblems(dir, rows, required = REQUIRED_PAIRS) {
  const map = assemblePairs(rows);
  const problems = [];
  const seen = new Set();
  for (const req of required) {
    const key = pairKey(req.scenario, req.role);
    seen.add(key);
    problems.push(...problemsForPair(dir, map.get(key), req.scenario, req.role));
  }
  for (const [key, pair] of map) {
    if (seen.has(key)) continue;
    problems.push(...problemsForPair(dir, pair, String(pair.scenario), String(pair.role)));
  }
  return problems;
}

/** @param {string} dir */
export function loadScenarios(dir) {
  const runPath = path.join(dir, "run.json");
  if (!fs.existsSync(runPath)) {
    throw new Error(`No run.json in ${dir}. Run the area-plan-edit Playwright project first.`);
  }
  const parsed = JSON.parse(fs.readFileSync(runPath, "utf8"));
  const rows = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
  return rows.slice().sort((a, b) => scenarioOrder(a.scenario) - scenarioOrder(b.scenario));
}

/**
 * @param {string} dir
 * @param {ScenarioRow[]} rows
 */
export function writeScenariosMarkdown(dir, rows) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scenarios.md"), `${scenariosTable(rows)}\n`);
}

/**
 * @param {string} fromDir
 * @param {string} toDir
 * @param {ScenarioRow[]} rows
 */
export function copyShots(fromDir, toDir, rows) {
  fs.mkdirSync(toDir, { recursive: true });
  const names = new Set();
  for (const pair of assemblePairs(rows).values()) {
    if (pair.before) names.add(String(pair.before));
    if (pair.after) names.add(String(pair.after));
  }
  const copied = [];
  for (const name of names) {
    const source = path.join(fromDir, name);
    if (!fs.existsSync(source)) continue;
    const dest = path.join(toDir, name);
    fs.copyFileSync(source, dest);
    copied.push(dest);
  }
  return copied;
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function main() {
  const dir = path.resolve(arg("--dir") ?? "test-results/areas/plan-edit");
  const rows = loadScenarios(dir);
  const problems = pairProblems(dir, rows);
  if (problems.length) {
    console.error(problems.map((problem) => `area-evidence: ${problem}`).join("\n"));
    process.exit(1);
  }
  if (process.argv.includes("--write-scenarios")) writeScenariosMarkdown(dir, rows);
  const copyTo = arg("--copy-to");
  if (copyTo) copyShots(dir, path.resolve(copyTo), rows);
  const linkRoot = arg("--link-root");
  const hrefFor = (file) => (linkRoot ? `${linkRoot.replace(/\/$/, "")}/${file}` : file);
  const body = prSections(rows, hrefFor);
  const out = arg("--out");
  if (out) fs.writeFileSync(path.resolve(out), body);
  if (!process.argv.includes("--quiet")) process.stdout.write(body);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURL(import.meta.url));
if (invoked) main();

function fileURL(href) {
  return new URL(href).pathname;
}
