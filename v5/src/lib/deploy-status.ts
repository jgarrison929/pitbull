import "server-only";
import { getBuildInfo, type BuildInfo } from "@/lib/build-info";
import { resolveCiGate, type CiGateResult } from "@/lib/ci-gate";
import { readLastVerifyAt } from "@/lib/last-verify";

export type DeployStatus = BuildInfo & {
  /** ci-gate check for this commit: pass / fail / pending / unknown */
  ciGate: CiGateResult;
  /** True when ciGate is last-good after a GitHub error. */
  ciGateStale: boolean;
  /** ms since last successful GitHub observation; null if never observed. */
  ciGateAgeMs: number | null;
  /** ISO timestamp of the last successful verify-v5 run, or null */
  lastVerifyAt: string | null;
};

/** Full /status and /health payload: build + ci-gate + last verify. */
export async function getDeployStatus(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<DeployStatus> {
  const build = getBuildInfo(env);
  const fullSha =
    env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? build.commit;
  const [gate, lastVerifyAt] = await Promise.all([
    resolveCiGate(fullSha, env, fetchFn),
    readLastVerifyAt(env),
  ]);
  return {
    ...build,
    ciGate: gate.result,
    ciGateStale: gate.stale,
    ciGateAgeMs: gate.ageMs,
    lastVerifyAt,
  };
}
