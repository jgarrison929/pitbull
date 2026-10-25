import "server-only";
import { getDb, type Db } from "@/db";
import {
  listAppliedMigrationNames,
  type AppliedMigrations,
} from "@/lib/applied-migrations";
import { getBuildInfo, type BuildInfo } from "@/lib/build-info";
import { resolveCiGate, type CiGateResult } from "@/lib/ci-gate";
import {
  readLastVerifyAt,
  readLastVerifyCommit,
} from "@/lib/last-verify";

export type DeployStatus = BuildInfo & {
  /** ci-gate check for this commit: pass / fail / pending / unknown */
  ciGate: CiGateResult;
  /** True when ciGate is last-good after a GitHub error. */
  ciGateStale: boolean;
  /** ms since last successful GitHub observation; null if never observed. */
  ciGateAgeMs: number | null;
  /** ISO timestamp of the last successful verify-v5 run, or null */
  lastVerifyAt: string | null;
  /** Full SHA from that stamp, or null when never recorded */
  lastVerifyCommit: string | null;
  /**
   * Applied drizzle migration tags (e.g. `0000_init`), in order.
   * `null` when DATABASE_URL is unset; `"unavailable"` when the table can't be read;
   * `[]` when readable but none applied.
   */
  migrations: AppliedMigrations;
};

/** Full /status and /health payload: build + ci-gate + last verify + migrations. */
export async function getDeployStatus(
  env: Record<string, string | undefined> = process.env,
  fetchFn: typeof fetch = fetch,
  /** Override DB for tests; omit to use `getDb()`. */
  db?: Db | null,
): Promise<DeployStatus> {
  const build = getBuildInfo(env);
  const fullSha =
    env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? build.commit;
  const [gate, lastVerifyAt, lastVerifyCommit, migrations] = await Promise.all([
    resolveCiGate(fullSha, env, fetchFn),
    readLastVerifyAt(env),
    readLastVerifyCommit(env),
    listAppliedMigrationNames(db === undefined ? getDb() : db),
  ]);
  return {
    ...build,
    ciGate: gate.result,
    ciGateStale: gate.stale,
    ciGateAgeMs: gate.ageMs,
    lastVerifyAt,
    lastVerifyCommit,
    migrations,
  };
}
