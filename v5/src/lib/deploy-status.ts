import "server-only";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { appSettings } from "@/db/schema";
import {
  listAppliedMigrationNames,
  type AppliedMigrations,
} from "@/lib/applied-migrations";
import { getBuildInfo, type BuildInfo } from "@/lib/build-info";
import {
  ciGateForRequest,
  peekCiGate,
  type CiGateResult,
} from "@/lib/ci-gate";
import {
  readLastVerifyAt,
  readLastVerifyCommit,
} from "@/lib/last-verify";

/** One row: `${commit} ${result}`. Shared by every instance so /status does not wait on GitHub. */
const CI_GATE_CACHE_KEY = "ci_gate_latest";

function isStoredResult(value: string): value is CiGateResult {
  return (
    value === "pass" ||
    value === "fail" ||
    value === "pending" ||
    value === "unknown"
  );
}

async function readStoredCiGate(
  db: Db,
  commit: string,
): Promise<CiGateResult | null> {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, CI_GATE_CACHE_KEY))
      .limit(1);
    if (!row) return null;
    const space = row.value.indexOf(" ");
    if (space < 0) return null;
    const sha = row.value.slice(0, space);
    const result = row.value.slice(space + 1);
    if (sha !== commit || !isStoredResult(result) || result === "unknown") {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

async function writeStoredCiGate(db: Db, commit: string, result: CiGateResult) {
  if (result === "unknown") return;
  try {
    const now = new Date();
    await db
      .insert(appSettings)
      .values({
        key: CI_GATE_CACHE_KEY,
        value: `${commit} ${result}`,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: `${commit} ${result}`, updatedAt: now },
      });
  } catch {
    // A cache write must not fail /status.
  }
}

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

/**
 * ci-gate for a page render. Memory and the app_settings row answer
 * immediately. GitHub runs only when neither has a result for this commit,
 * and a later request does not wait on it again.
 */
async function loadCiGate(
  commit: string,
  env: Record<string, string | undefined>,
  fetchFn: typeof fetch,
  database: Db | null,
) {
  const peeked = peekCiGate(commit);
  if (peeked.fresh || peeked.lastGood) {
    return ciGateForRequest(commit, env, fetchFn);
  }
  const stored = database ? await readStoredCiGate(database, commit) : null;
  if (stored) {
    // Refresh GitHub off the request. Do not write the DB from that task:
    // a floating query keeps the pool open and stalls the next reset.
    void ciGateForRequest(commit, env, fetchFn).catch(() => {});
    return { result: stored, stale: false, ageMs: 0 };
  }
  const gate = await ciGateForRequest(commit, env, fetchFn);
  if (database && gate.result !== "unknown") {
    await writeStoredCiGate(database, commit, gate.result);
  }
  return gate;
}

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
  const database = db === undefined ? getDb() : db;
  const [gate, lastVerifyAt, lastVerifyCommit, migrations] = await Promise.all([
    loadCiGate(fullSha, env, fetchFn, database),
    readLastVerifyAt(env),
    readLastVerifyCommit(env),
    listAppliedMigrationNames(database),
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
