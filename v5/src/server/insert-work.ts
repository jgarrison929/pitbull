/**
 * Bulk write path for sandbox seed rows.
 *
 * Field history + baked action history add ~90 plans / ~600 lines / COs /
 * action_runs. Over a high-latency DB, awaiting each INSERT multiplies RTT.
 * We enqueue statements in FK order then flush with Promise.all so postgres.js
 * pipelines them on one connection (one network round-trip for the batch).
 */
import type { Db } from "@/db";
import {
  actionRuns,
  changeOrderEvents,
  changeOrderLines,
  changeOrders,
  costEntries,
  costItemMilestones,
  costItems,
  crews,
  dailyPlanEvents,
  dailyPlanLines,
  dailyPlans,
  jobs,
  milestoneLogs,
  pmPercentLogs,
  progressClaimLines,
  progressClaims,
} from "@/db/schema";
import type { SeedRows } from "@/seed";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Max rows per INSERT — stays under PG bind limits (stress 10k WBS). */
export const INSERT_WORK_CHUNK = 500;

/**
 * How many SQL statements insertWork *should* send for these rows when using
 * chunked bulk inserts. Tests that need the live count must read the return
 * value of insertWork / resetSandbox — this formula alone is not a must-fail.
 */
export function insertWorkStatementCount(rows: SeedRows): number {
  let n = 0;
  n += 1; // jobs
  n += Math.ceil(rows.costItems.length / INSERT_WORK_CHUNK);
  if (rows.costItemMilestones.length) n += 1;
  if (rows.costEntries.length)
    n += Math.ceil(rows.costEntries.length / INSERT_WORK_CHUNK);
  if (rows.pmPercentLogs.length) n += 1;
  if (rows.milestoneLogs.length) n += 1;
  if (rows.progressClaims.length) n += 1;
  if (rows.progressClaimLines.length) n += 1;
  if (rows.crews.length) n += 1;
  n += 1; // dailyPlans (seed always has at least the open drafts)
  if (rows.dailyPlanEvents.length)
    n += Math.ceil(rows.dailyPlanEvents.length / INSERT_WORK_CHUNK);
  if (rows.dailyPlanLines.length)
    n += Math.ceil(rows.dailyPlanLines.length / INSERT_WORK_CHUNK);
  if (rows.changeOrders.length) n += 1;
  if (rows.changeOrderLines.length) n += 1;
  if (rows.changeOrderEvents.length) n += 1;
  if (rows.actionRuns.length) n += 1;
  return n;
}

/**
 * Upper bound for insertWork statements on the default (non-stress) seed.
 * Field history is bulk-chunked; COs + action_runs are single statements each.
 * Going row-by-row for ~90 plans would be 90+.
 */
export const INSERT_WORK_MAX_STATEMENTS = 24;

/**
 * Statements in a full reset transaction: parallel-safe deletes + insertWork +
 * company seededAt touch. Cap covers the whole reset (not insert alone).
 */
export const RESET_DELETE_STATEMENTS = 3; // action_runs, jobs, crews
export const RESET_COMPANY_TOUCH_STATEMENTS = 1;
export function resetTransactionStatementCount(rows: SeedRows): number {
  return (
    RESET_DELETE_STATEMENTS +
    insertWorkStatementCount(rows) +
    RESET_COMPANY_TOUCH_STATEMENTS
  );
}

/** Whole-reset statement budget — must stay well under 600ms at ~5ms RTT. */
export const RESET_MAX_STATEMENTS = 30;

function chunk<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/**
 * Enqueue insertWork statements onto `pending` in FK order (does not await).
 * Callers that also enqueue deletes/updates share one postgres.js pipeline.
 * Returns how many statements were pushed (the actual send count).
 */
export function enqueueInsertWork(
  tx: Tx,
  rows: SeedRows,
  pending: Promise<unknown>[],
): number {
  const before = pending.length;
  const enqueue = (p: Promise<unknown>) => {
    pending.push(p);
  };

  enqueue(tx.insert(jobs).values(rows.jobs));
  for (const part of chunk(rows.costItems, INSERT_WORK_CHUNK)) {
    enqueue(tx.insert(costItems).values(part));
  }
  if (rows.costItemMilestones.length)
    enqueue(tx.insert(costItemMilestones).values(rows.costItemMilestones));
  for (const part of chunk(rows.costEntries, INSERT_WORK_CHUNK)) {
    enqueue(tx.insert(costEntries).values(part));
  }
  if (rows.pmPercentLogs.length)
    enqueue(tx.insert(pmPercentLogs).values(rows.pmPercentLogs));
  if (rows.milestoneLogs.length)
    enqueue(tx.insert(milestoneLogs).values(rows.milestoneLogs));
  if (rows.progressClaims.length)
    enqueue(tx.insert(progressClaims).values(rows.progressClaims));
  if (rows.progressClaimLines.length)
    enqueue(tx.insert(progressClaimLines).values(rows.progressClaimLines));
  if (rows.crews.length) enqueue(tx.insert(crews).values(rows.crews));
  enqueue(tx.insert(dailyPlans).values(rows.dailyPlans));
  for (const part of chunk(rows.dailyPlanEvents, INSERT_WORK_CHUNK)) {
    enqueue(tx.insert(dailyPlanEvents).values(part));
  }
  for (const part of chunk(rows.dailyPlanLines, INSERT_WORK_CHUNK)) {
    enqueue(tx.insert(dailyPlanLines).values(part));
  }
  if (rows.changeOrders.length)
    enqueue(tx.insert(changeOrders).values(rows.changeOrders));
  if (rows.changeOrderLines.length)
    enqueue(tx.insert(changeOrderLines).values(rows.changeOrderLines));
  if (rows.changeOrderEvents.length)
    enqueue(tx.insert(changeOrderEvents).values(rows.changeOrderEvents));
  if (rows.actionRuns.length)
    enqueue(tx.insert(actionRuns).values(rows.actionRuns));

  return pending.length - before;
}

/**
 * Insert all work tables. Statements are pipelined (FK order preserved).
 * Returns the number of SQL statements actually enqueued (not a seed formula).
 */
export async function insertWork(tx: Tx, rows: SeedRows): Promise<number> {
  const pending: Promise<unknown>[] = [];
  const n = enqueueInsertWork(tx, rows, pending);
  await Promise.all(pending);
  return n;
}
