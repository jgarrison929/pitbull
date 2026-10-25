// Reads main's CI state for verify-v5: the newest origin/main commits touching v5/ and each one's
// ci-gate check-run conclusion, plus main HEAD. Uses `gh api` when gh is installed (signed in or not),
// else the public GitHub REST API (GH_TOKEN/GITHUB_TOKEN sent as a header only when already set).
import { execFileSync } from "node:child_process";

export const REPO_SLUG = process.env.VERIFY_REPO ?? "jgarrison929/pitbull";

export function gitIn(repo) {
  return (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** git rev-parse of a short SHA; null when unknown or ambiguous (git refuses ambiguous prefixes). */
export function resolvePrefix(repo) {
  const git = gitIn(repo);
  return (prefix) => {
    try {
      const out = git(["rev-parse", "--verify", "--quiet", `${prefix}^{commit}`]);
      return /^[0-9a-f]{40}$/.test(out) ? out : null;
    } catch {
      return null;
    }
  };
}

async function ghJson(pathAndQuery) {
  try {
    const out = execFileSync("gh", ["api", pathAndQuery], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return JSON.parse(out);
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`gh api ${pathAndQuery}: ${String(error.stderr ?? error.message).trim().split("\n")[0]}`);
  }
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/${pathAndQuery}`, {
    headers: { Accept: "application/vnd.github+json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${pathAndQuery}: HTTP ${res.status}`);
  return res.json();
}

/** "success" | "failure" | "pending" | "missing" for the ci-gate check-run on sha (latest attempt). */
export async function ciGateConclusion(sha) {
  const body = await ghJson(`repos/${REPO_SLUG}/commits/${sha}/check-runs?check_name=ci-gate&filter=latest`);
  const runs = body.check_runs ?? [];
  if (runs.length === 0) return "missing";
  if (runs.some((r) => r.status !== "completed")) return "pending";
  if (runs.every((r) => r.conclusion === "success")) return "success";
  return "failure";
}

/** Main HEAD and the newest `limit` origin/main commits that touch v5/, newest first, each with its ci-gate. */
export async function readMainCi(repo, { limit = 20 } = {}) {
  const git = gitIn(repo);
  const parse = (line) => {
    const [sha, committedAt] = line.split("\t");
    return { sha, committedAt };
  };
  const head = parse(git(["log", "-1", "--format=%H%x09%cI", "origin/main"]));
  const v5 = git(["log", `-${limit}`, "--format=%H%x09%cI", "origin/main", "--", "v5/"])
    .split("\n")
    .filter(Boolean)
    .map(parse);
  const gates = new Map();
  const gate = async (sha) => {
    if (!gates.has(sha)) gates.set(sha, await ciGateConclusion(sha));
    return gates.get(sha);
  };
  head.gate = await gate(head.sha);
  for (const c of v5) {
    c.gate = await gate(c.sha);
    if (c.gate === "success") break; // older commits are not needed once the last green is known
  }
  return { head, v5Commits: v5.filter((c) => c.gate !== undefined) };
}

/**
 * `git ls-remote --tags` output → [{ name, sha }] with annotated tags peeled to their commit
 * (the `^{}` line wins over the tag object line).
 */
export function parseLsRemoteTags(text) {
  const byName = new Map();
  for (const line of String(text ?? "").split("\n")) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (!sha || !ref?.startsWith("refs/tags/")) continue;
    const peeled = ref.endsWith("^{}");
    const name = ref.slice("refs/tags/".length, peeled ? -3 : undefined);
    if (peeled || !byName.has(name)) byName.set(name, sha);
  }
  return [...byName].map(([name, sha]) => ({ name, sha }));
}

/** true when sha is an ancestor of (or equal to) main on GitHub; false when not; throws on API errors. */
export async function isOnMain(sha) {
  const body = await ghJson(`repos/${REPO_SLUG}/compare/${sha}...main`);
  return body.status === "ahead" || body.status === "identical";
}

/**
 * Production release facts: every tag on origin (ls-remote, so tags need not be fetched), the newest v5
 * tag by semver, its ci-gate and whether it is on main. `newestV5Tag` comes from checks.mjs.
 */
export async function readRelease(repo, newestV5Tag) {
  const tags = parseLsRemoteTags(gitIn(repo)(["ls-remote", "--tags", "origin"]));
  const newest = newestV5Tag(tags);
  if (!newest) return { tags, newest: null, gate: null, onMain: null };
  return { tags, newest, gate: await ciGateConclusion(newest.sha), onMain: await isOnMain(newest.sha) };
}
