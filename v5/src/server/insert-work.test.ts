import { describe, expect, it } from "vitest";
import { seed } from "@/seed";
import { SEED_HISTORY_RUNS } from "@/seed/history";
import {
  INSERT_WORK_CHUNK,
  INSERT_WORK_MAX_STATEMENTS,
  insertWorkStatementCount,
  RESET_MAX_STATEMENTS,
  resetTransactionStatementCount,
} from "./insert-work";

const company = "00000000-0000-4000-8000-000000000099";
const today = new Date("2026-10-20T17:00:00.000Z");
const rows = seed(company, today);

/**
 * Seed-bag formula checks (soft). The live send-path must-fail that catches
 * S1/S2/S3 reverts lives in insert-work-pipeline.test.ts and reset-perf.test.ts.
 */
describe("insertWork statement budget (formula)", () => {
  it("default seed formula stays under the bulk-insert round-trip cap", () => {
    const n = insertWorkStatementCount(rows);
    expect(n).toBeLessThanOrEqual(INSERT_WORK_MAX_STATEMENTS);
    expect(n).toBeGreaterThan(5);
    expect(rows.actionRuns).toHaveLength(SEED_HISTORY_RUNS);
    expect(rows.changeOrders.length).toBe(6);
  });

  it("whole reset formula stays under the remote RTT budget", () => {
    const n = resetTransactionStatementCount(rows);
    expect(n).toBeLessThanOrEqual(RESET_MAX_STATEMENTS);
    // 5ms × 30 = 150ms ≪ 600ms target even if every statement waited.
    expect(n * 5).toBeLessThan(600);
  });

  it("row-by-row history plans would exceed the formula cap", () => {
    const perPlan = rows.dailyPlans.length;
    expect(perPlan).toBeGreaterThan(INSERT_WORK_MAX_STATEMENTS);
    expect(perPlan).toBeGreaterThanOrEqual(90);
  });

  it("chunks cost entries and plan lines in the formula", () => {
    expect(rows.costEntries.length).toBeGreaterThan(INSERT_WORK_CHUNK);
    expect(rows.dailyPlanLines.length).toBeGreaterThan(INSERT_WORK_CHUNK);
    const entryChunks = Math.ceil(rows.costEntries.length / INSERT_WORK_CHUNK);
    const lineChunks = Math.ceil(
      rows.dailyPlanLines.length / INSERT_WORK_CHUNK,
    );
    expect(entryChunks + lineChunks).toBeLessThanOrEqual(6);
    const n = insertWorkStatementCount(rows);
    expect(n).toBeLessThan(rows.costEntries.length);
    expect(n).toBeLessThan(rows.dailyPlanLines.length);
  });
});
