#!/usr/bin/env node
// Live must-fails for the journey tap rule (journeys.mjs): a ConfirmDialog confirm click that
// confirmIfDialog saw open is not a tap, at most once per action.
//   --journey co | estimate | report   (pm CO-001 on 25-031, pm Approve estimate on 26-010, superintendent 24-118 report)
//   --mode control         the real journey: PASS (exit 0) within 3 counted taps; the log shows any excluded confirm
//   --mode extra-tap       one extra real tap (user menu): must FAIL (exit 1), 4 counted taps
//   --mode double-confirm  double-click the dialog's confirm: the second confirm is counted, must FAIL (exit 1);
//                          with no dialog (before #65 / #71) there is nothing to double-confirm: harness exit 2
// Exit 0 = PASS, 1 = FAIL (the rule's own verdict), 2 = harness error.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { JOURNEYS, runJourney } from "./journeys.mjs";
import { isLocalUrl } from "./target-guard.mjs";

for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (error) => {
    console.error(`journey must-fail: harness error: ${String(error?.message ?? error).split("\n")[0]}`);
    process.exit(2);
  });
}
const MODES = ["control", "extra-tap", "double-confirm"];
const { values: args } = parseArgs({ options: { url: { type: "string" }, journey: { type: "string" }, mode: { type: "string" }, out: { type: "string" } } });
if (!args.url || !JOURNEYS[args.journey] || !MODES.includes(args.mode)) {
  console.error(`usage: --url URL --journey ${Object.keys(JOURNEYS).join("|")} --mode ${MODES.join("|")} [--out file]`);
  process.exit(2);
}
// Local only (target-guard.mjs): this tool never runs against staging or production.
if (!isLocalUrl(args.url)) {
  console.error(`refused: ${args.url} is not localhost; this tool runs only against a local app`);
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(here, "../../../v5/package.json"))("@playwright/test");
const browser = await chromium.launch();
let r;
try {
  r = await runJourney(browser, args.url.replace(/\/$/, ""), args.journey, { mutant: args.mode === "control" ? null : args.mode });
} finally {
  await browser.close();
}
if (args.mode === "double-confirm" && !r.dialog) {
  console.error(`journey must-fail: harness error: no ConfirmDialog opened on ${r.name}, nothing to double-confirm`);
  process.exit(2);
}
const ok = r.failures.length === 0;
console.log(`journey must-fail ${args.journey} ${args.mode}: ${ok ? "PASS" : "FAIL"} — ${r.name}: ${r.counted} counted taps (limit 3); dialog ${r.dialog}; excluded: ${r.excluded.join(", ") || "none"}; log: ${r.entries.map((e) => e.label).join(" → ")}` + (ok ? "" : ` — ${r.failures.join("; ")}`));
if (args.out) writeFileSync(args.out, JSON.stringify({ journey: args.journey, mode: args.mode, url: args.url, ok, ...r }, null, 2));
process.exit(ok ? 0 : 1);
