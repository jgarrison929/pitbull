/** Looks up the GitHub Actions `ci-gate` check for a commit. Public repos need no token. */

export type CiGateResult = "pass" | "fail" | "pending" | "unknown";

const DEFAULT_REPO = "jgarrison929/pitbull";

/** Server-side TTL so /health and /status do not hit GitHub on every request. */
export const CI_GATE_CACHE_TTL_MS = 5 * 60 * 1000;

type CheckRunsResponse = {
  check_runs?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
  }>;
};

type CacheEntry = { result: CiGateResult; expiresAt: number };

const cache = new Map<string, CacheEntry>();

/** Test helper: drop cached lookups between cases. */
export function clearCiGateCache(): void {
  cache.clear();
}

/**
 * Maps a GitHub check-run for `ci-gate` onto a short result.
 * Env override `CI_GATE_RESULT` wins (local/e2e); otherwise fetches GitHub
 * (cached per commit for {@link CI_GATE_CACHE_TTL_MS}).
 */
export async function resolveCiGate(
  commit: string,
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<CiGateResult> {
  const override = env.CI_GATE_RESULT?.trim().toLowerCase();
  if (
    override === "pass" ||
    override === "fail" ||
    override === "pending" ||
    override === "unknown"
  ) {
    return override;
  }
  return fetchCiGate(commit, env, fetchFn, now);
}

export async function fetchCiGate(
  commit: string,
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<CiGateResult> {
  if (!commit || commit === "unknown") return "unknown";

  const t = now();
  const hit = cache.get(commit);
  if (hit && hit.expiresAt > t) return hit.result;

  const result = await lookupCiGate(commit, env, fetchFn);
  cache.set(commit, { result, expiresAt: t + CI_GATE_CACHE_TTL_MS });
  return result;
}

async function lookupCiGate(
  commit: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
): Promise<CiGateResult> {
  const repo = env.GITHUB_REPOSITORY ?? DEFAULT_REPO;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "pitbull-v5-status",
  };
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const url = `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(commit)}/check-runs?check_name=ci-gate&filter=latest&per_page=5`;
    const res = await fetchFn(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "unknown";
    const body = (await res.json()) as CheckRunsResponse;
    const run =
      body.check_runs?.find((r) => r.name === "ci-gate") ??
      body.check_runs?.[0];
    if (!run) return "unknown";
    if (run.status !== "completed") return "pending";
    if (run.conclusion === "success") return "pass";
    if (
      run.conclusion === "failure" ||
      run.conclusion === "cancelled" ||
      run.conclusion === "timed_out" ||
      run.conclusion === "startup_failure" ||
      run.conclusion === "action_required"
    ) {
      return "fail";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
