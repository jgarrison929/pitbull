#!/usr/bin/env node
/**
 * Compare two burst JSON reports: head must not be slower than main at any
 * width (p95 TTFB and max load). Exit 1 on regression.
 *
 *   node scripts/job-page-ttfb-compare.mjs main.json head.json
 */
import { readFileSync } from "node:fs";

const [mainPath, headPath] = process.argv.slice(2);
if (!mainPath || !headPath) {
  console.error("usage: job-page-ttfb-compare.mjs <main.json> <head.json>");
  process.exit(2);
}

const main = JSON.parse(readFileSync(mainPath, "utf8"));
const head = JSON.parse(readFileSync(headPath, "utf8"));

const widths = Object.keys(main.byWidth ?? {}).map(Number).sort((a, b) => a - b);
if (!widths.length || !head.byWidth) {
  console.error("missing byWidth on one or both reports");
  process.exit(2);
}

const rows = [];
let ok = true;
for (const w of widths) {
  const m = main.byWidth[w];
  const h = head.byWidth[w];
  const ttfbSlow = h.ttfb.p95 > m.ttfb.p95;
  const loadSlow = h.load.max > m.load.max;
  if (ttfbSlow || loadSlow) ok = false;
  rows.push({
    width: w,
    mainTtfbP95: m.ttfb.p95,
    headTtfbP95: h.ttfb.p95,
    ttfbDelta: h.ttfb.p95 - m.ttfb.p95,
    mainLoadMax: m.load.max,
    headLoadMax: h.load.max,
    loadDelta: h.load.max - m.load.max,
    pass: !ttfbSlow && !loadSlow,
  });
}

const report = {
  mainLabel: main.label,
  headLabel: head.label,
  mainOverall: { ttfb: main.ttfb, load: main.load, pass: main.pass },
  headOverall: { ttfb: head.ttfb, load: head.load, pass: head.pass },
  byWidth: rows,
  headNotSlowerAtAnyWidth: ok,
  overallBudgets:
    head.ttfb.p95 < 200 &&
    head.load.max < 1000 &&
    head.extraTimingLeaks === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.headNotSlowerAtAnyWidth || !report.overallBudgets) process.exitCode = 1;
