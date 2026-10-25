import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  actionRuns,
  companies,
  costItems,
  crews,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { seed } from "@/seed";
import { seedStressJob, STRESS_JOB_NUMBER } from "@/seed/stress";
import {
  enqueueInsertWork,
  flushPending,
  insertWork,
} from "./insert-work";
import { seedNow } from "./seed-clock";

export { seedNow } from "./seed-clock";
export {
  flushPending,
  insertWork,
  insertWorkStatementCount,
  INSERT_WORK_MAX_STATEMENTS,
  resetTransactionStatementCount,
  RESET_MAX_STATEMENTS,
} from "./insert-work";

export const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000;
/** Live sandboxes one browser may hold. Past the cap, signing in reuses the newest one. */
export const MAX_SANDBOXES_PER_VISITOR = 3;

function wallNow() {
  return new Date();
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Deletes sandboxes past their expiry. Cascades remove every row they own. */
export async function sweepExpiredSandboxes(now = new Date()) {
  const db = requireDb();
  const gone = await db
    .delete(companies)
    .where(
      and(
        eq(companies.isSandbox, true),
        isNotNull(companies.expiresAt),
        lt(companies.expiresAt, now),
      ),
    )
    .returning({ id: companies.id });
  return gone.length;
}

/** How long a visitor may wait for another sign-in's advisory lock before failing. */
export const SANDBOX_LOCK_TIMEOUT = "5s";

/**
 * The sandbox a signed-out visitor gets: a new one while they are under the cap,
 * otherwise their most recently seeded live one.
 *
 * Count and insert run in one transaction under pg_advisory_xact_lock(hashtext(visitor)),
 * so parallel sign-ins from the same browser cannot over-create past the cap.
 *
 * Everything under the lock uses only `tx` (this connection). Do not call
 * requireDb()/getDb() inside — a second pool checkout while holding the advisory
 * lock can deadlock the pool when other sessions wait on the same lock.
 */
export async function sandboxForVisitor(
  visitorHash: string,
  seedAt = seedNow(),
) {
  const wall = wallNow();
  const db = requireDb();
  return db.transaction(async (tx) => {
    // Fail fast if another sign-in holds the lock too long (transaction-local).
    await tx.execute(
      sql`select set_config('lock_timeout', ${SANDBOX_LOCK_TIMEOUT}, true)`,
    );
    // Transaction-scoped lock keyed by visitor hash; released on commit/rollback.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${visitorHash}))`,
    );
    const live = await tx
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          eq(companies.visitorHash, visitorHash),
          gt(companies.expiresAt, wall),
        ),
      )
      .orderBy(desc(companies.seededAt));
    if (live.length >= MAX_SANDBOXES_PER_VISITOR) return live[0].id;
    // seed() is pure in-memory (includes baked action history); insertSandbox
    // writes only through tx — no post-commit seedActionHistory round-trips.
    return insertSandbox(tx, seedAt, visitorHash, wall);
  });
}

async function insertSandbox(
  tx: Tx,
  seedAt: Date,
  visitorHash: string | null,
  wall = wallNow(),
) {
  const companyId = randomUUID();
  const rows = seed(companyId, seedAt);
  await tx.insert(companies).values({
    ...rows.company,
    visitorHash,
    // Seed calendar may be frozen (V5_SEED_NOW); company metadata stays on the
    // wall clock so Reset demo still bumps seeded-at and TTL cannot pre-expire.
    seededAt: wall,
    expiresAt: new Date(wall.getTime() + SANDBOX_TTL_MS),
  });
  await tx.insert(users).values(rows.users);
  await insertWork(tx, rows);
  return companyId;
}

/**
 * Creates a new visitor sandbox cloned from the seed.
 * `wallAt` drives TTL (defaults to real now). Pass the same past instant for
 * both `seedAt` and `wallAt` in tests that need an already-expired sandbox.
 */
export async function createSandbox(
  seedAt = seedNow(),
  visitorHash: string | null = null,
  wallAt = wallNow(),
) {
  const db = requireDb();
  return db.transaction(async (tx) =>
    insertSandbox(tx, seedAt, visitorHash, wallAt),
  );
}

export type ResetSandboxPhases = {
  /** Pure in-memory seed(companyId, seedAt). */
  buildMs: number;
  /**
   * One transaction: delete action_runs + jobs (cascade) + crews, bulk
   * insertWork (including baked history), company seededAt touch.
   */
  txnMs: number;
  /** SQL statements in the reset transaction (deletes + inserts + touch). */
  statements: number;
  /** Statements insertWork alone will send (subset of statements). */
  insertStatements: number;
  /** Wall time for the whole resetSandbox call. */
  totalMs: number;
};

/**
 * Puts a sandbox back to the seed. Users and sessions survive, so the visitor stays signed in.
 * Returns phase timings when the caller needs evidence (tests / staging probes).
 *
 * All work rows — including change orders and action_runs — are bulk-inserted
 * from the finalized seed bag. No live seedActionHistory round-trips.
 */
export async function resetSandbox(
  companyId: string,
  seedAt = seedNow(),
): Promise<ResetSandboxPhases> {
  const db = requireDb();
  const t0 = performance.now();
  const tBuild0 = performance.now();
  const rows = seed(companyId, seedAt);
  const buildMs = performance.now() - tBuild0;
  const wall = wallNow();
  let insertStatements = 0;
  let statements = 0;
  const tTxn0 = performance.now();
  await db.transaction(async (tx) => {
    // One pipeline: deletes → bulk inserts → company touch. Call order is
    // execution order on the single connection (FK-safe).
    // `statements` is the live pending length — not a seed-bag formula — so a
    // per-plan / per-row revert raises the reported count and fails the budget.
    const pending: Promise<unknown>[] = [];
    pending.push(
      tx.delete(actionRuns).where(eq(actionRuns.companyId, companyId)),
    );
    pending.push(tx.delete(jobs).where(eq(jobs.companyId, companyId)));
    pending.push(tx.delete(crews).where(eq(crews.companyId, companyId)));
    insertStatements = enqueueInsertWork(tx, rows, pending);
    pending.push(
      tx
        .update(companies)
        .set({ seededAt: wall })
        .where(eq(companies.id, companyId)),
    );
    statements = pending.length;
    // Batched flushPending — serial await of the pending list is N RTTs and is
    // caught by insert-work-pipeline (reset-shaped) must-fail.
    await flushPending(pending);
  });
  const txnMs = performance.now() - tTxn0;
  return {
    buildMs,
    txnMs,
    statements,
    insertStatements,
    totalMs: performance.now() - t0,
  };
}

export async function countRows(companyId: string) {
  const db = requireDb();
  const [r] = await db.execute<{
    jobs: number;
    cost_items: number;
    plans: number;
    runs: number;
  }>(sql`
    select
      (select count(*)::int from ${jobs} where company_id = ${companyId}) as jobs,
      (select count(*)::int from ${costItems} where company_id = ${companyId}) as cost_items,
      (select count(*)::int from ${dailyPlans} where company_id = ${companyId}) as plans,
      (select count(*)::int from ${actionRuns} where company_id = ${companyId}) as runs`);
  return r;
}

/**
 * Idempotent 10k WBS insert for stress e2e / perf. Default seed and Reset demo
 * stay fast — callers opt in (stress-typeahead fixture), never via V5_SEED_STRESS
 * on the shared Playwright webServer.
 */
export async function ensureStressJob(companyId: string, now = new Date()) {
  const db = requireDb();
  const existing = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(eq(jobs.companyId, companyId), eq(jobs.number, STRESS_JOB_NUMBER)),
    )
    .limit(1);
  if (existing.length) return { created: false };

  const stress = seedStressJob(companyId, now);
  await db.transaction(async (tx) => {
    await tx.insert(jobs).values(stress.jobs!);
    const CHUNK = 500;
    for (let i = 0; i < stress.costItems!.length; i += CHUNK) {
      await tx
        .insert(costItems)
        .values(stress.costItems!.slice(i, i + CHUNK));
    }
    if (stress.crews?.length) await tx.insert(crews).values(stress.crews);
    await tx.insert(dailyPlans).values(stress.dailyPlans!);
    await tx.insert(dailyPlanLines).values(stress.dailyPlanLines!);
  });
  return { created: true };
}
