// Unit must-fails for speed.mjs's evaluator: each control PASSes, each over-budget run FAILs.
import assert from "node:assert/strict";
import { evaluateSpeedRows, median, SPEED_PASSES } from "./speed.mjs";

const lines = [];
const ok = (n, f) => { assert.deepEqual(f, [], `${n} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${n}`); };
const bad = (n, f, re) => { assert.ok(f.some((x) => re.test(x)), `${n} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as required: ${n}`); };
const run = (idleMs, lcpMs = 900) => ({ status: 200, idleMs, lcpMs });
const row = (runs) => [{ role: "pm", width: 390, height: 844, theme: "dark", path: "/app", runs }];
const s1 = SPEED_PASSES["speed-1"], s3 = SPEED_PASSES["speed-3"];
ok("speed-1 control (1500 idle, 1499 LCP)", evaluateSpeedRows(s1, row([run(1500, 1499), run(900), run(900), run(900), run(900)])));
bad("speed-1 one run 1501", evaluateSpeedRows(s1, row([run(1501), run(900), run(900), run(900), run(900)])), /run 1: idle 1501 ms > 1500/);
bad("speed-1 LCP 1500 (not under)", evaluateSpeedRows(s1, row([run(900, 1500), run(900), run(900), run(900), run(900)])), /LCP 1500 ms ≥ 1500/);
bad("speed-1 LCP missing", evaluateSpeedRows(s1, row([run(900, null), run(900), run(900), run(900), run(900)])), /LCP not observed/);
bad("speed-1 4 runs", evaluateSpeedRows(s1, row([run(900), run(900), run(900), run(900)])), /4\/5 runs/);
ok("speed-3 control (median 1200 with one 1490)", evaluateSpeedRows(s3, row([run(1490), run(1200), run(1200), run(800), run(800)])));
bad("speed-3 median 1201", evaluateSpeedRows(s3, row([run(1201), run(1201), run(1201), run(800), run(800)])), /median idle 1201 ms > 1200/);
assert.equal(median([3, 1, 2]), 2); assert.equal(median([1500, 900, 1300, 1100, 1000]), 1100); // 3rd of 5 sorted
bad("speed-3 one run errored (no median from 4)", evaluateSpeedRows(s3, row([run(800), run(800), { error: "Timeout" }, run(800), run(800)])), /run 3: Timeout/);
lines.push("passes: median = 3rd of 5 sorted; FAILS as expected: errored run");
console.log(lines.join("\n"));
console.log(`speed-eval: ${lines.length} cases OK`);
