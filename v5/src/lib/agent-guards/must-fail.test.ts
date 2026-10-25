import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calendarUsesIndexedArithmetic,
  cpmCapsLfAtJobFinish,
  sharesStatementBudgetFormula,
  weakPvMustFail,
} from "./must-fail";
import { CPM_PATH, WORKING_CALENDAR_PATH } from "./paths";

const root = join(import.meta.dirname, "../../..");

describe("must-fail quality — past Verify FAIL shapes", () => {
  it("must-fail: detects formula-shared statement budget (#715 S1–S3 stayed green)", () => {
    const pastMistake = `
      const n = insertWorkStatementCount(rows);
      expect(phases.statements).toBe(n);
      expect(n).toBeLessThanOrEqual(INSERT_WORK_MAX_STATEMENTS);
    `;
    expect(sharesStatementBudgetFormula(pastMistake)).toBe(true);
  });

  it("accepts a live-path must-fail that records maxInFlight", () => {
    const good = `
      const tx = makeLatencyTx(25);
      await insertWork(tx as never, rows);
      expect(tx.maxInFlight).toBe(16);
      expect(tx.records.length).toBeLessThanOrEqual(INSERT_WORK_MAX_STATEMENTS);
    `;
    expect(sharesStatementBudgetFormula(good)).toBe(false);
  });

  it("must-fail: detects weak PV hard-coding both inputs (#719)", () => {
    const pastMistake = `
      it("must-fail PV", () => {
        const finishExclusive = "2026-11-12";
        expect(plannedValueCents(item, finishExclusive, asOf)).toBe(0);
      });
    `;
    expect(weakPvMustFail(pastMistake)).toBe(true);
  });

  it("accepts PV must-fail that maps through plannedFinishExclusiveOn", () => {
    const good = `
      const exclusive = plannedFinishExclusiveOn(earlyFinishInclusive);
      expect(exclusive).toBe("2026-11-13");
      expect(plannedValueCents(item, exclusive, asOf)).toBe(434_000);
    `;
    expect(weakPvMustFail(good)).toBe(false);
  });

  it("must-fail: detects uncapped SS-only LF (past cpm.ts shape)", () => {
    const pastMistake = `
      const outs = successors.get(id) ?? [];
      let lf = outs.length === 0 ? jobFinish : minFromSuccessors(outs);
      lateFinish.set(id, lf);
    `;
    expect(cpmCapsLfAtJobFinish(pastMistake)).toBe(false);
  });

  it("accepts LF seeded at jobFinish before successor constraints", () => {
    const good = `
      let jobFinish = ...;
      let lf = jobFinish;
      for (const s of outs) lf = minIso(lf, constraint(s));
    `;
    expect(cpmCapsLfAtJobFinish(good)).toBe(true);
  });

  it("must-fail: detects per-day Date walks in calendar math", () => {
    const pastMistake = `
      function addWorkingDays(on, n) {
        let cur = on;
        for (let i = 0; i < Math.abs(n); i++) {
          cur = addCalendarDays(cur, Math.sign(n));
          while (!isWorkingDay(cur)) cur = addCalendarDays(cur, Math.sign(n));
        }
        return cur;
      }
    `;
    expect(calendarUsesIndexedArithmetic(pastMistake)).toBe(false);
  });

  it("accepts indexed working-day arithmetic", () => {
    const good = `
      const days = []; // precomputed day numbers
      function toDayNumber(on) { ... }
      function addWorkingDays(on, n) {
        return fromDayNumber(days[lowerBound(days, toDayNumber(on)) + n]);
      }
    `;
    expect(calendarUsesIndexedArithmetic(good)).toBe(true);
  });
});

describe("live modules when present", () => {
  it("working-calendar.ts uses indexed arithmetic when shipped", () => {
    const p = join(root, WORKING_CALENDAR_PATH);
    if (!existsSync(p)) return;
    expect(calendarUsesIndexedArithmetic(readFileSync(p, "utf8"))).toBe(true);
  });

  it("cpm.ts caps LF at job finish when shipped", () => {
    const p = join(root, CPM_PATH);
    if (!existsSync(p)) return;
    expect(cpmCapsLfAtJobFinish(readFileSync(p, "utf8"))).toBe(true);
  });

  it("cpm.test.ts PV must-fail is not weak when shipped", () => {
    const p = join(root, "src/lib/cpm.test.ts");
    if (!existsSync(p)) return;
    const src = readFileSync(p, "utf8");
    expect(src).toMatch(/plannedFinishExclusiveOn\s*\(/);
    expect(src).toMatch(/SS-only|job finish|past job finish/i);
  });

  it("insert-work pipeline observes live send path when shipped", () => {
    const p = join(root, "src/server/insert-work-pipeline.test.ts");
    if (!existsSync(p)) return;
    const src = readFileSync(p, "utf8");
    expect(sharesStatementBudgetFormula(src)).toBe(false);
    expect(src).toMatch(/maxInFlight|records\.length/);
  });
});
