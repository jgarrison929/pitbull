#!/usr/bin/env node
// Scripted check for default --commit resolution.
// Fails before the fix: old verify.mjs used `git rev-parse origin/main`, which
// differs from the last v5/ touch whenever main tip is non-v5 (e.g. skill-only).
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDefaultCommit } from "./default-commit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

function git(args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

const tip = git(["rev-parse", "origin/main"]);
const lastV5 = git(["log", "-1", "--format=%H", "origin/main", "--", "v5/"]);
assert.ok(lastV5, "expected at least one commit on origin/main that touches v5/");

// Pure: prefer last v5/ touch over tip when they differ.
{
  const calls = [];
  const resolved = resolveDefaultCommit(repo, {
    git: (args) => {
      calls.push(args.join(" "));
      if (args[0] === "log") return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      if (args[0] === "rev-parse") return tip;
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
  });
  assert.equal(resolved, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.ok(
    calls.some((c) => c.includes("v5/")),
    "resolver must query last commit touching v5/",
  );
  assert.ok(
    !calls.some((c) => c === "rev-parse origin/main") ||
      calls.findIndex((c) => c.includes("v5/")) < calls.findIndex((c) => c === "rev-parse origin/main"),
    "v5/ log must run before any origin/main tip fallback",
  );
}

// Pure: empty v5/ history falls back to origin/main tip.
{
  const resolved = resolveDefaultCommit(repo, {
    git: (args) => {
      if (args[0] === "log") return "";
      if (args[0] === "rev-parse") return tip;
      throw new Error(`unexpected git ${args.join(" ")}`);
    },
  });
  assert.equal(resolved, tip);
}

// Against this clone: default must be last v5/ touch (not tip when tip is non-v5).
{
  const resolved = resolveDefaultCommit(repo);
  assert.equal(
    resolved,
    lastV5,
    `default commit must be last origin/main touch of v5/ (${lastV5.slice(0, 12)}), not tip (${tip.slice(0, 12)})`,
  );
  if (tip !== lastV5) {
    assert.notEqual(
      resolved,
      tip,
      "regression: bare origin/main tip is wrong when tip does not touch v5/ (pre-fix default)",
    );
  }
}

console.log(
  `ok: default commit ${resolveDefaultCommit(repo).slice(0, 12)} (last v5/; tip ${tip.slice(0, 12)}${tip === lastV5 ? ", same" : ", differs"})`,
);

// verify.mjs must load far enough for --self-check (catches missing execFileSync / broken imports
// without Playwright). Fails before the import restore when execFileSync was deleted.
{
  const verify = path.join(here, "verify.mjs");
  const out = execFileSync(process.execPath, ["--check", verify], { encoding: "utf8" });
  assert.equal(out, "");
  const smoke = execFileSync(process.execPath, [verify, "--self-check"], {
    encoding: "utf8",
    cwd: repo,
  });
  assert.match(smoke, /^self-check ok expected=[0-9a-f]{12}\n$/);
  console.log(`ok: verify.mjs --self-check (${smoke.trim()})`);
}
