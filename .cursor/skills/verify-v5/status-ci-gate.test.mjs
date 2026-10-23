#!/usr/bin/env node
// Scripted check: verify-v5 must require /status ciGate === "pass".
// Fails before the fix: old check accepted any of pass|fail|pending|unknown.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ciGateIsPass } from "./status-ci-gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

assert.equal(ciGateIsPass("pass"), true);
for (const bad of ["fail", "pending", "unknown", "", undefined, null, "Pass", "PASS"]) {
  assert.equal(ciGateIsPass(bad), false, `must reject ${JSON.stringify(bad)}`);
}

// Document pre-fix behavior: field-exists accepted "fail".
const oldFieldExists = (v) => ["pass", "fail", "pending", "unknown"].includes(v ?? "");
assert.equal(oldFieldExists("fail"), true, "pre-fix accepted fail");
assert.equal(ciGateIsPass("fail"), false, "post-fix must reject fail");

// verify.mjs must use ciGateIsPass (not the old includes list).
const verifySrc = readFileSync(path.join(here, "verify.mjs"), "utf8");
assert.match(verifySrc, /ciGateIsPass\s*\(\s*status\.ciGate\s*\)/);
assert.doesNotMatch(
  verifySrc,
  /\["pass",\s*"fail",\s*"pending",\s*"unknown"\]\.includes\(\s*status\.ciGate/,
  "regression: old field-exists includes check must not remain",
);

console.log("ok: /status ci-gate must be pass (rejects fail/pending/unknown)");
