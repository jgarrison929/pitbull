import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  actionRuns,
  companies,
  costEntries,
  costItemMilestones,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  milestoneLogs,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
  users,
} from "@/db/schema";
import { seed, type SeedRows } from "@/seed";
import { seedActionHistory } from "@/seed/history";
import { seedStressJob, STRESS_JOB_NUMBER } from "@/seed/stress";

export const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000;
/** Live sandboxes one browser may hold. Past the cap, signing in reuses the newest one. */
export const MAX_SANDBOXES_PER_VISITOR = 3;

/**
 * Calendar used for seed rows (plan dates, claim periods, …). Optional
 * `V5_SEED_NOW` freezes that calendar for visual baselines. Sandbox TTL and
 * "still live?" checks always use wall clock — a frozen seed day must not
 * expire sandboxes the moment real time moves past it.
 */
export function seedNow(fallback = new Date()): Date {
  const raw = process.env.V5_SEED_NOW?.trim();
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`V5_SEED_NOW is not a valid date: ${raw}`);
  }
  return parsed;
}

function wallNow() {
  return new Date();
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function insertWork(tx: Tx, rows: SeedRows) {
  await tx.insert(jobs).values(rows.jobs);
  // Chunk large WBS inserts (10k stress leaves) so one statement stays under PG limits.
  const CHUNK = 500;
  for (let i = 0; i < rows.costItems.length; i += CHUNK) {
    await tx.insert(costItems).values(rows.costItems.slice(i, i + CHUNK));
  }
  if (rows.costItemMilestones.length)
    await tx.insert(costItemMilestones).values(rows.costItemMilestones);
  if (rows.costEntries.length)
    await tx.insert(costEntries).values(rows.costEntries);
  if (rows.pmPercentLogs.length)
    await tx.insert(pmPercentLogs).values(rows.pmPercentLogs);
  if (rows.milestoneLogs.length)
    await tx.insert(milestoneLogs).values(rows.milestoneLogs);
  if (rows.progressClaims.length)
    await tx.insert(progressClaims).values(rows.progressClaims);
  if (rows.progressClaimLines.length)
    await tx.insert(progressClaimLines).values(rows.progressClaimLines);
  await tx.insert(dailyPlans).values(rows.dailyPlans);
  await tx.insert(dailyPlanLines).values(rows.dailyPlanLines);
}

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
  const companyId = await db.transaction(async (tx) => {
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
    // seed() is pure in-memory; insertSandbox writes only through tx.
    return insertSandbox(tx, seedAt, visitorHash, wall);
  });
  // Typed-action history must run after the insert tx commits (run() uses its own connection).
  await ensureSeedHistory(companyId, seedAt);
  return companyId;
}

/** Runs seedActionHistory once per sandbox (skip when reusing a capped visitor sandbox). */
async function ensureSeedHistory(companyId: string, now: Date) {
  const db = requireDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(actionRuns)
    .where(eq(actionRuns.companyId, companyId));
  if ((row?.n ?? 0) > 0) return;
  await seedActionHistory(companyId, now);
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
    // TTL is wall-clock so a frozen V5_SEED_NOW cannot pre-expire the sandbox.
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
  const companyId = await db.transaction(async (tx) =>
    insertSandbox(tx, seedAt, visitorHash, wallAt),
  );
  await seedActionHistory(companyId, seedAt);
  return companyId;
}

/** Puts a sandbox back to the seed. Users and sessions survive, so the visitor stays signed in. */
export async function resetSandbox(companyId: string, seedAt = seedNow()) {
  const db = requireDb();
  const rows = seed(companyId, seedAt);
  await db.transaction(async (tx) => {
    await tx.delete(actionRuns).where(eq(actionRuns.companyId, companyId));
    await tx.delete(jobs).where(eq(jobs.companyId, companyId));
    await insertWork(tx, rows);
    await tx
      .update(companies)
      .set({ seededAt: seedAt })
      .where(eq(companies.id, companyId));
  });
  await seedActionHistory(companyId, seedAt);
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
    await tx.insert(jobs).values(stress.job);
    const CHUNK = 500;
    for (let i = 0; i < stress.costItems.length; i += CHUNK) {
      await tx
        .insert(costItems)
        .values(stress.costItems.slice(i, i + CHUNK));
    }
    await tx.insert(dailyPlans).values(stress.dailyPlans);
    await tx.insert(dailyPlanLines).values(stress.dailyPlanLines);
  });
  return { created: true };
}
