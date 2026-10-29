// Turn v5/test-results/areas/plan-edit/ into the PR sections for one area run.
// The reporter writes run.json from Playwright's results. This script writes
// scenarios.md (the table) and can print ## Scenarios plus ## Before / After.
import fs from "node:fs";
import path from "node:path";

const ORDER = ["PB-97-S1", "PB-97-S2", "PB-97-S3", "PB-97-S4", "PB-97-S5"];

/**
 * @typedef {object} ScenarioRow
 * @property {string} scenario
 * @property {string} test
 * @property {string} result
 * @property {string} page
 * @property {string} role
 * @property {string} viewport
 * @property {string} theme
 * @property {string} before
 * @property {string} after
 * @property {boolean} [beforeTaken]
 * @property {boolean} [afterTaken]
 * @property {string | null} [replayUrl]
 */

/** @param {string} value */
export function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
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

/** @param {ScenarioRow[]} rows */
export function scenariosTable(rows) {
  const lines = [
    "| Scenario | Test | Result | Proof |",
    "|---|---|---|---|",
  ];
  for (const row of rows) {
    const names = [];
    if (row.beforeTaken !== false && row.before) names.push(String(row.before));
    if (row.afterTaken !== false && row.after) names.push(String(row.after));
    lines.push(
      `| ${escapeCell(row.scenario)} | ${escapeCell(row.test)} | ${escapeCell(row.result)} | ${escapeCell(proofCell(names, row.replayUrl ? String(row.replayUrl) : null))} |`,
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
  for (const row of rows) {
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
  for (const row of rows) {
    if (row.before) names.add(String(row.before));
    if (row.after) names.add(String(row.after));
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
