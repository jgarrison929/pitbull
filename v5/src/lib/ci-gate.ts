/** Looks up the GitHub Actions `ci-gate` check for a commit. Public repos need no token. */

export type CiGateResult = "pass" | "fail" | "pending" | "unknown";

export type CiGateObservation = {
  result: CiGateResult;
  /** True when serving last-good after a GitHub error (stale-while-error). */
  stale: boolean;
  /** ms since last successful GitHub observation; null if never observed. */
  ageMs: number | null;
};

const DEFAULT_REPO = "jgarrison929/pitbull";

/** Server-side TTL so /health and /status do not hit GitHub on every request. */
export const CI_GATE_CACHE_TTL_MS = 5 * 60 * 1000;

/** After a GitHub transport/API error (or unknown), retry sooner. */
export const CI_GATE_ERROR_TTL_MS = 20_000;

type CheckRunsResponse = {
  check_runs?: Array<{
    name: string;
    status: string;
    conclusion: string | null;
  }>;
};

type CacheEntry = {
  result: CiGateResult;
  expiresAt: number;
  stale: boolean;
  /** Last successful (non-error) observation — used for stale-while-error. */
  lastGood?: CiGateResult;
  /** Wall time when lastGood was observed from GitHub. */
  lastGoodAt?: number;
};

type LookupOutcome =
  | { kind: "ok"; result: CiGateResult }
  | { kind: "error" };

const cache = new Map<string, CacheEntry>();
/** One in-flight lookup per commit so TTL expiry does not stampede GitHub. */
const inflight = new Map<string, Promise<CiGateObservation>>();

/** Test helper: drop cached lookups and in-flight work between cases. */
export function clearCiGateCache(): void {
  cache.clear();
  inflight.clear();
}

function observationFromEntry(
  entry: CacheEntry,
  now: number,
): CiGateObservation {
  return {
    result: entry.result,
    stale: entry.stale,
    ageMs:
      entry.lastGoodAt === undefined ? null : Math.max(0, now - entry.lastGoodAt),
  };
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
): Promise<CiGateObservation> {
  const override = env.CI_GATE_RESULT?.trim().toLowerCase();
  if (
    override === "pass" ||
    override === "fail" ||
    override === "pending" ||
    override === "unknown"
  ) {
    return { result: override, stale: false, ageMs: 0 };
  }
  return fetchCiGate(commit, env, fetchFn, now);
}

export async function fetchCiGate(
  commit: string,
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<CiGateObservation> {
  if (!commit || commit === "unknown") {
    return { result: "unknown", stale: false, ageMs: null };
  }

  const t = now();
  const hit = cache.get(commit);
  if (hit && hit.expiresAt > t) return observationFromEntry(hit, t);

  const existing = inflight.get(commit);
  if (existing) return existing;

  const promise = refreshCiGate(commit, env, fetchFn, now);
  inflight.set(commit, promise);
  try {
    return await promise;
  } finally {
    if (inflight.get(commit) === promise) inflight.delete(commit);
  }
}

async function refreshCiGate(
  commit: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
  now: () => number,
): Promise<CiGateObservation> {
  const t = now();
  const prev = cache.get(commit);
  const outcome = await lookupCiGate(commit, env, fetchFn);

  if (outcome.kind === "error") {
    const kept = prev?.lastGood;
    // Prefer last good over flipping to unknown under traffic / rate limits.
    if (kept && kept !== "unknown") {
      const entry: CacheEntry = {
        result: kept,
        expiresAt: t + CI_GATE_ERROR_TTL_MS,
        stale: true,
        lastGood: kept,
        lastGoodAt: prev?.lastGoodAt,
      };
      cache.set(commit, entry);
      return observationFromEntry(entry, t);
    }
    // Never cache unknown for the full success TTL.
    const entry: CacheEntry = {
      result: "unknown",
      expiresAt: t + CI_GATE_ERROR_TTL_MS,
      stale: false,
      lastGood: prev?.lastGood,
      lastGoodAt: prev?.lastGoodAt,
    };
    cache.set(commit, entry);
    return observationFromEntry(entry, t);
  }

  const result = outcome.result;
  // Successful HTTP but unknown/pending/fail/pass — unknown still uses short TTL
  // so we do not lock "unknown" for 5 minutes after a transient empty check list.
  const ttl =
    result === "unknown" ? CI_GATE_ERROR_TTL_MS : CI_GATE_CACHE_TTL_MS;
  const lastGood = result === "unknown" ? prev?.lastGood : result;
  const lastGoodAt =
    result === "unknown" ? prev?.lastGoodAt : t;
  const entry: CacheEntry = {
    result,
    expiresAt: t + ttl,
    stale: false,
    lastGood,
    lastGoodAt,
  };
  cache.set(commit, entry);
  return observationFromEntry(entry, t);
}

async function lookupCiGate(
  commit: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
): Promise<LookupOutcome> {
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
    if (!res.ok) return { kind: "error" };
    const body = (await res.json()) as CheckRunsResponse;
    const run =
      body.check_runs?.find((r) => r.name === "ci-gate") ??
      body.check_runs?.[0];
    if (!run) return { kind: "ok", result: "unknown" };
    if (run.status !== "completed") return { kind: "ok", result: "pending" };
    if (run.conclusion === "success") return { kind: "ok", result: "pass" };
    if (
      run.conclusion === "failure" ||
      run.conclusion === "cancelled" ||
      run.conclusion === "timed_out" ||
      run.conclusion === "startup_failure" ||
      run.conclusion === "action_required"
    ) {
      return { kind: "ok", result: "fail" };
    }
    return { kind: "ok", result: "unknown" };
  } catch {
    return { kind: "error" };
  }
}
