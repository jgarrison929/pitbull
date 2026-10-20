import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNotNull, lt, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  actionRuns,
  companies,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { seed, type SeedRows } from "@/seed";

export const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000;
/** Live sandboxes one browser may hold. Past the cap, signing in reuses the newest one. */
export const MAX_SANDBOXES_PER_VISITOR = 3;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function insertWork(tx: Tx, rows: SeedRows) {
  await tx.insert(jobs).values(rows.jobs);
  await tx.insert(costItems).values(rows.costItems);
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

/**
 * The sandbox a signed-out visitor gets: a new one while they are under the cap,
 * otherwise their most recently seeded live one.
 *
 * Count and insert run in one transaction under pg_advisory_xact_lock(hashtext(visitor)),
 * so parallel sign-ins from the same browser cannot over-create past the cap.
 */
export async function sandboxForVisitor(visitorHash: string, now = new Date()) {
  const db = requireDb();
  return db.transaction(async (tx) => {
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
          gt(companies.expiresAt, now),
        ),
      )
      .orderBy(desc(companies.seededAt));
    if (live.length >= MAX_SANDBOXES_PER_VISITOR) return live[0].id;
    return insertSandbox(tx, now, visitorHash);
  });
}

async function insertSandbox(
  tx: Tx,
  now: Date,
  visitorHash: string | null,
) {
  const companyId = randomUUID();
  const rows = seed(companyId, now);
  await tx.insert(companies).values({
    ...rows.company,
    visitorHash,
    expiresAt: new Date(now.getTime() + SANDBOX_TTL_MS),
  });
  await tx.insert(users).values(rows.users);
  await insertWork(tx, rows);
  return companyId;
}

/** Creates a new visitor sandbox cloned from the seed. */
export async function createSandbox(
  now = new Date(),
  visitorHash: string | null = null,
) {
  const db = requireDb();
  return db.transaction(async (tx) => insertSandbox(tx, now, visitorHash));
}

/** Puts a sandbox back to the seed. Users and sessions survive, so the visitor stays signed in. */
export async function resetSandbox(companyId: string, now = new Date()) {
  const db = requireDb();
  const rows = seed(companyId, now);
  await db.transaction(async (tx) => {
    await tx.delete(actionRuns).where(eq(actionRuns.companyId, companyId));
    await tx.delete(jobs).where(eq(jobs.companyId, companyId));
    await insertWork(tx, rows);
    await tx
      .update(companies)
      .set({ seededAt: now })
      .where(eq(companies.id, companyId));
  });
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
