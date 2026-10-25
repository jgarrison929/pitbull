#!/usr/bin/env node
/**
 * Fails when a feature change set also touches verify-v5 or v5/src/proxy.ts.
 *
 * Bypass (not the last commit subject):
 *   - PR title contains exact `[owned-path-ok]` (case-sensitive), or
 *   - PR has label `owned-path-ok`
 * Lookalikes like `[OWNED-PATH-OK]` must not bypass.
 *
 * Fail closed in CI when the base ref/SHA cannot be resolved / diffed.
 *
 * Base resolution (first wins):
 *   OWNED_PATHS_BASE_SHA — PR base commit (preferred in Actions)
 *   OWNED_PATHS_BASE — ref like origin/main
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const inCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

function sh(cmd, { allowFail = false } = {}) {
  try {
    return execSync(cmd, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

function fail(msg, detail) {
  console.error("check-owned-paths FAIL:", msg);
  if (detail) console.error(detail);
  process.exit(1);
}

/** Bypass via PR title or label — never last-commit subject. */
function bypassGranted() {
  const title = process.env.OWNED_PATHS_PR_TITLE || "";
  // Exact case-sensitive marker — do not add the /i flag.
  if (/\[owned-path-ok\]/.test(title)) {
    console.log("check-owned-paths: skipped ([owned-path-ok] in PR title)");
    return true;
  }
  const labelsRaw = process.env.OWNED_PATHS_PR_LABELS || "";
  const labels = labelsRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (labels.includes("owned-path-ok")) {
    console.log("check-owned-paths: skipped (label owned-path-ok)");
    return true;
  }
  return false;
}

if (bypassGranted()) process.exit(0);

const baseSha = (process.env.OWNED_PATHS_BASE_SHA || "").trim();
const baseRef =
  process.env.OWNED_PATHS_BASE ||
  (process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "origin/main");

let files;
try {
  if (baseSha) {
    // Ensure the base commit is present (shallow PR checkouts often lack it).
    const has = sh(`git cat-file -e ${baseSha}^{commit}`, { allowFail: true });
    if (has === null) {
      sh(`git fetch --no-tags --depth=1 origin ${baseSha}`);
    }
    // Two-dot tree diff: PR file list without needing a deep merge-base.
    files = sh(`git diff --name-only ${baseSha} HEAD`);
  } else {
    const mb = sh(`git merge-base HEAD ${baseRef}`);
    if (!mb) throw new Error(`empty merge-base with ${baseRef}`);
    files = sh(`git diff --name-only ${mb}...HEAD`);
  }
} catch (e) {
  const detail = e instanceof Error ? e.message : String(e);
  if (inCi) {
    fail(
      `cannot diff against ${baseSha || baseRef} (fail closed in CI)`,
      detail,
    );
  }
  console.warn(
    "check-owned-paths: could not diff against",
    baseSha || baseRef,
    "— skipping outside CI:",
    detail,
  );
  process.exit(0);
}

const paths = (files || "").split("\n").filter(Boolean);
const forbiddenPrefixes = [".cursor/skills/verify-v5", "v5/src/proxy.ts"];

const forbiddenHits = paths.filter((p) =>
  forbiddenPrefixes.some((f) => p === f || p.startsWith(f + "/")),
);

if (forbiddenHits.length === 0) {
  console.log("check-owned-paths: ok (no owned paths touched)");
  process.exit(0);
}

const product = paths.some(
  (p) =>
    (p.startsWith("v5/src/") && p !== "v5/src/proxy.ts") ||
    p.startsWith("v5/tests/") ||
    p.startsWith("v5/drizzle/") ||
    p.startsWith("docs/v5/"),
);

if (!product) {
  console.log("check-owned-paths: ok (owned-path-only change set)");
  process.exit(0);
}

fail(
  "feature PR also touches owned paths",
  [
    ...forbiddenHits.map((h) => `  ${h}`),
    "Split verify-v5 / proxy.ts into their own PR, or set PR title [owned-path-ok] / label owned-path-ok.",
  ].join("\n"),
);
