/**
 * Demo reset performance after baking action history into the seed bag.
 *
 * `phases.statements` / `phases.insertStatements` are live counts from the
 * pending pipeline (not a seed-bag formula). Must-fail asserts those counts.
 */
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies } from "@/db/schema";
import { seed } from "@/seed";
import { SEED_HISTORY_RUNS } from "@/seed/history";
import {
  INSERT_WORK_MAX_STATEMENTS,
  insertWorkStatementCount,
  RESET_MAX_STATEMENTS,
  resetTransactionStatementCount,
} from "./insert-work";
import { createSandbox, resetSandbox } from "./sandbox";
import { seedNow } from "./seed-clock";

const db = getDb();
/** Staging/prod-like per-statement RTT used for projections. */
const REMOTE_RTT_MS = 5;
/** Live typed-action history: many statements per run() (selects + writes). */
const LIVE_HISTORY_STMTS_PER_RUN = 15;

describe.skipIf(!db)("demo reset performance", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "resetSandbox reports live statement counts within budget",
    async () => {
      const seedAt = seedNow();
      const companyId = await createSandbox(seedAt);
      created.push(companyId);

      const rows = seed(companyId, seedAt);
      expect(rows.actionRuns).toHaveLength(SEED_HISTORY_RUNS);

      const phases = await resetSandbox(companyId, seedAt);
      // eslint-disable-next-line no-console
      console.log(
        "\n=== resetSandbox phases ===\n" +
          JSON.stringify(
            {
              ...phases,
              buildMs: Math.round(phases.buildMs),
              txnMs: Math.round(phases.txnMs),
              totalMs: Math.round(phases.totalMs),
              statements: phases.statements,
              insertStatements: phases.insertStatements,
              formulaInsert: insertWorkStatementCount(rows),
              formulaReset: resetTransactionStatementCount(rows),
              rowCounts: {
                costEntries: rows.costEntries.length,
                dailyPlans: rows.dailyPlans.length,
                dailyPlanLines: rows.dailyPlanLines.length,
                changeOrders: rows.changeOrders.length,
                actionRuns: rows.actionRuns.length,
              },
              sequentialRemoteProjectionMs:
                phases.statements * REMOTE_RTT_MS,
              liveHistoryProjectionMs:
                SEED_HISTORY_RUNS * LIVE_HISTORY_STMTS_PER_RUN * REMOTE_RTT_MS,
            },
            null,
            2,
          ),
      );

      // Live counts from the pending array — a per-plan / per-row revert
      // raises these and fails the budget (S2/S3).
      expect(phases.insertStatements).toBeLessThanOrEqual(
        INSERT_WORK_MAX_STATEMENTS,
      );
      expect(phases.statements).toBeLessThanOrEqual(RESET_MAX_STATEMENTS);
      expect(phases.statements).toBe(
        phases.insertStatements + 3 + 1, // deletes + company touch
      );
      // Healthy path still matches the bulk formula.
      expect(phases.insertStatements).toBe(insertWorkStatementCount(rows));
      expect(phases.statements).toBe(resetTransactionStatementCount(rows));
      expect(phases.totalMs).toBeGreaterThan(0);
      expect(phases.totalMs).toBeLessThan(600);
      expect(phases.statements * REMOTE_RTT_MS).toBeLessThan(600);
    },
    60_000,
  );

  it(
    "must-fail: live history / per-plan projections exceed the remote budget",
    async () => {
      const rows = seed(
        "00000000-0000-4000-8000-000000000077",
        new Date("2026-10-20T17:00:00.000Z"),
      );
      const liveHistoryMs =
        SEED_HISTORY_RUNS * LIVE_HISTORY_STMTS_PER_RUN * REMOTE_RTT_MS;
      expect(liveHistoryMs).toBeGreaterThan(600);

      // Per-plan insert anti-pattern (S2) exceeds the insert budget alone.
      expect(rows.dailyPlans.length).toBeGreaterThan(INSERT_WORK_MAX_STATEMENTS);
      expect(rows.dailyPlans.length + rows.actionRuns.length).toBeGreaterThan(
        RESET_MAX_STATEMENTS,
      );
    },
  );
});
