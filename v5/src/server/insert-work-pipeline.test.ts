/**
 * Must-fail: observe what insertWork / a reset-shaped flush *actually* send.
 *
 * A seed-bag formula cannot catch S1 (sequential await), S2 (per-plan inserts),
 * or S3 (per-row chunks) — those change the live send path, not the formula.
 * This harness uses a drizzle-like lazy thenable (work starts on .then) with
 * injected RTT so Promise.all pipelines and `for (const p of pending) await p`
 * (or per-row awaits) diverge on wall time, max in-flight, and statement shape.
 */
import { describe, expect, it } from "vitest";
import { seed } from "@/seed";
import {
  INSERT_WORK_CHUNK,
  INSERT_WORK_MAX_STATEMENTS,
  enqueueInsertWork,
  insertWork,
} from "./insert-work";

const company = "00000000-0000-4000-8000-000000000066";
const today = new Date("2026-10-20T17:00:00.000Z");
const rows = seed(company, today);

/** Injected per-statement RTT — large enough that sequential N×RTT is obvious. */
const RTT_MS = 25;

type Recorded = {
  op: "insert" | "delete" | "update";
  table: string;
  rowCount: number;
  /** How many statements were already in flight when this one started. */
  startedWhileInFlight: number;
};

type LatencyTx = {
  records: Recorded[];
  maxInFlight: number;
  insert: (table: { name?: string } | string) => {
    values: (values: unknown) => PromiseLike<unknown>;
  };
  delete: (table: { name?: string } | string) => {
    where: (..._args: unknown[]) => PromiseLike<unknown>;
  };
  update: (table: { name?: string } | string) => {
    set: (..._args: unknown[]) => {
      where: (..._args: unknown[]) => PromiseLike<unknown>;
    };
  };
};

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

function tableName(table: object | string): string {
  if (typeof table === "string") return table;
  const named = table as Record<symbol, unknown>;
  const n = named[DRIZZLE_NAME];
  return typeof n === "string" ? n : "unknown";
}

/**
 * Lazy thenable tx: scheduling happens on `.then`, matching drizzle + postgres.js.
 * Pipelined Promise.all starts every statement before any RTT completes.
 * Sequential await starts the next only after the previous RTT finishes.
 */
function makeLatencyTx(rttMs: number): LatencyTx {
  let inFlight = 0;
  let maxInFlight = 0;
  const records: Recorded[] = [];

  function lazy(
    op: Recorded["op"],
    table: { name?: string } | string,
    rowCount: number,
  ): PromiseLike<unknown> {
    let started: Promise<unknown> | null = null;
    const start = () => {
      if (started) return started;
      const startedWhileInFlight = inFlight;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      records.push({
        op,
        table: tableName(table),
        rowCount,
        startedWhileInFlight,
      });
      started = new Promise((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve(undefined);
        }, rttMs);
      });
      return started;
    };
    return {
      then(onFulfilled, onRejected) {
        return start().then(onFulfilled, onRejected);
      },
    };
  }

  return {
    records,
    get maxInFlight() {
      return maxInFlight;
    },
    insert(table) {
      return {
        values(values: unknown) {
          const rowCount = Array.isArray(values) ? values.length : 1;
          return lazy("insert", table, rowCount);
        },
      };
    },
    delete(table) {
      return {
        where() {
          return lazy("delete", table, 0);
        },
      };
    },
    update(table) {
      return {
        set() {
          return {
            where() {
              return lazy("update", table, 0);
            },
          };
        },
      };
    },
  };
}

describe("insertWork live send path (must-fail)", () => {
  it("pipelines bulk statements: actual count ≤ budget, max in-flight ≫ 1", async () => {
    const tx = makeLatencyTx(RTT_MS);
    const t0 = performance.now();
    const n = await insertWork(tx as never, rows);
    const wallMs = performance.now() - t0;

    expect(n).toBe(tx.records.length);
    expect(n).toBeLessThanOrEqual(INSERT_WORK_MAX_STATEMENTS);
    expect(n).toBeGreaterThan(5);

    // Promise.all starts every statement before the first RTT completes.
    expect(tx.maxInFlight).toBe(n);
    expect(tx.records.every((r) => r.startedWhileInFlight >= 0)).toBe(true);
    // At least half the statements overlapped with another in flight.
    const overlapped = tx.records.filter((r) => r.startedWhileInFlight > 0);
    expect(overlapped.length).toBeGreaterThan(n / 2);

    // Pipelined wall ≈ 1 RTT; sequential would be n × RTT (≥ 150 ms here).
    expect(wallMs).toBeLessThan(RTT_MS * 3);
    expect(n * RTT_MS).toBeGreaterThan(150);
    expect(wallMs).toBeLessThan(n * RTT_MS * 0.5);
  });

  it("sends one bulk INSERT for plans and action_runs — not one per row", async () => {
    const tx = makeLatencyTx(1);
    await insertWork(tx as never, rows);

    const planInserts = tx.records.filter(
      (r) => r.op === "insert" && r.table === "daily_plans",
    );
    const eventInserts = tx.records.filter(
      (r) => r.op === "insert" && r.table === "daily_plan_events",
    );
    const runInserts = tx.records.filter(
      (r) => r.op === "insert" && r.table === "action_runs",
    );
    const entryInserts = tx.records.filter(
      (r) => r.op === "insert" && r.table === "cost_entries",
    );
    const lineInserts = tx.records.filter(
      (r) => r.op === "insert" && r.table === "daily_plan_lines",
    );

    // S2 revert: one INSERT per plan / per action run.
    expect(rows.dailyPlans.length).toBeGreaterThanOrEqual(90);
    expect(planInserts).toHaveLength(1);
    expect(planInserts[0]!.rowCount).toBe(rows.dailyPlans.length);
    expect(rows.dailyPlanEvents.length).toBeGreaterThan(rows.dailyPlans.length);
    expect(eventInserts).toHaveLength(
      Math.ceil(rows.dailyPlanEvents.length / INSERT_WORK_CHUNK),
    );
    expect(
      eventInserts.reduce((s, r) => s + r.rowCount, 0),
    ).toBe(rows.dailyPlanEvents.length);
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0]!.rowCount).toBe(rows.actionRuns.length);

    // S3 revert: one INSERT per cost-entry / plan-line row.
    expect(rows.costEntries.length).toBeGreaterThan(INSERT_WORK_CHUNK);
    expect(rows.dailyPlanLines.length).toBeGreaterThan(INSERT_WORK_CHUNK);
    expect(entryInserts.length).toBe(
      Math.ceil(rows.costEntries.length / INSERT_WORK_CHUNK),
    );
    expect(lineInserts.length).toBe(
      Math.ceil(rows.dailyPlanLines.length / INSERT_WORK_CHUNK),
    );
    expect(entryInserts.every((r) => r.rowCount > 1)).toBe(true);
    expect(lineInserts.every((r) => r.rowCount > 1)).toBe(true);
    expect(Math.max(...entryInserts.map((r) => r.rowCount))).toBeLessThanOrEqual(
      INSERT_WORK_CHUNK,
    );
  });

  it("must-fail: sequential await of the same pending list is N RTTs", async () => {
    // Demonstrates why Promise.all is required: same enqueue, wrong flush.
    const tx = makeLatencyTx(RTT_MS);
    const pending: Promise<unknown>[] = [];
    const n = enqueueInsertWork(tx as never, rows, pending);
    const t0 = performance.now();
    for (const p of pending) await p;
    const wallMs = performance.now() - t0;

    expect(n).toBeGreaterThan(5);
    // Sequential .then → max in-flight stays 1; wall ≈ n × RTT.
    expect(tx.maxInFlight).toBe(1);
    expect(wallMs).toBeGreaterThan(n * RTT_MS * 0.8);
    // The production insertWork path (previous tests) stays under 3×RTT.
    expect(wallMs).toBeGreaterThan(RTT_MS * 3);
  });
});
