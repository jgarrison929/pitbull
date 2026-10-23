// Resolves the commit verify-v5 expects when --commit is omitted.
// Railway skips deploys that touch nothing under v5/, so bare origin/main tip
// is wrong whenever the tip is docs/skill/CI-only. Prefer the last commit that
// touches v5/; fall back to origin/main only if that history is empty.
import { execFileSync } from "node:child_process";

/**
 * @param {string} repo Absolute path to the git repo root
 * @param {{ git?: (args: string[]) => string }} [opts]
 * @returns {string} Full commit SHA (caller may slice)
 */
export function resolveDefaultCommit(repo, opts = {}) {
  const git =
    opts.git ??
    ((args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim());

  const v5Touch = git(["log", "-1", "--format=%H", "origin/main", "--", "v5/"]);
  if (v5Touch) return v5Touch;
  return git(["rev-parse", "origin/main"]);
}
