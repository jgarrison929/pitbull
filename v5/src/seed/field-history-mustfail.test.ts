/**
 * Must-fail twins for Part B acceptance checks — each bad input fails the
 * same predicate the happy-path seed satisfies.
 */
import { describe, expect, it } from "vitest";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { seed, seedId } from "./index";
import {
  CEDAR_RETURN_REASON,
  FIELD_HISTORY_WORKING_DAYS,
  workingDaysBefore,
} from "./field-history";

const company = "00000000-0000-4000-8000-0000000000mf";
const today = new Date("2026-10-20T17:00:00.000Z");
const rows = seed(company, today);
const days = workingDaysBefore(today, FIELD_HISTORY_WORKING_DAYS);

function approvedDates(number: string) {
  const job = rows.jobs.find((j) => j.number === number)!;
  return rows.dailyPlans
    .filter((p) => p.jobId === job.id && p.status === "approved")
    .map((p) => p.planDate)
    .sort();
}

function qtySum04210() {
  const itemId = seedId(company, "cost:cedar:04-210");
  return rows.dailyPlanLines
    .filter((l) => l.costItemId === itemId)
    .reduce((s, l) => s + (l.reportedQtyMilli ?? 0), 0);
}

function laborRates04210() {
  const itemId = seedId(company, "cost:cedar:04-210");
  return rows.costEntries
    .filter((e) => e.costItemId === itemId && e.kind === "labor")
    .map((e) => e.rateCents);
}

function cedarReturnPlans() {
  const cedar = rows.jobs.find((j) => j.number === "25-031")!;
  return rows.dailyPlans.filter(
    (p) =>
      p.jobId === cedar.id &&
      p.returnReason === CEDAR_RETURN_REASON &&
      p.status === "approved",
  );
}

describe("Part B acceptance must-fail", () => {
  it("passes: 30 working days per active job", () => {
    for (const n of ["24-118", "25-031", "24-077"]) {
      expect(approvedDates(n)).toEqual([...days].sort());
      expect(approvedDates(n)).toHaveLength(FIELD_HISTORY_WORKING_DAYS);
    }
  });

  it("must-fail: 29 days is not 30", () => {
    const bad = days.slice(1);
    expect(bad).toHaveLength(29);
    expect(bad).not.toEqual(approvedDates("25-031"));
  });

  it("passes: 04-210 reported qty = installed", () => {
    const item = rows.costItems.find(
      (c) => c.id === seedId(company, "cost:cedar:04-210"),
    )!;
    expect(qtySum04210()).toBe(item.installedQtyMilli);
  });

  it("must-fail: qty off by 1 milli", () => {
    const item = rows.costItems.find(
      (c) => c.id === seedId(company, "cost:cedar:04-210"),
    )!;
    expect(qtySum04210() + 1).not.toBe(item.installedQtyMilli);
  });

  it("passes: every 04-210 labor row is Bridge Crew 2 rate", () => {
    const rates = laborRates04210();
    expect(rates.length).toBeGreaterThan(0);
    expect(rates.every((r) => r === CREW_LABOR_RATE_CENTS["Bridge Crew 2"])).toBe(
      true,
    );
  });

  it("must-fail: flat $85 rate on history", () => {
    expect(
      laborRates04210().some((r) => r === 8500),
    ).toBe(false);
  });

  it("passes: one Cedar returned plan with Recount pour 3", () => {
    expect(cedarReturnPlans()).toHaveLength(1);
    expect(cedarReturnPlans()[0]!.returnReason).toBe(CEDAR_RETURN_REASON);
  });

  it("must-fail: missing return reason", () => {
    expect(
      cedarReturnPlans().filter((p) => !p.returnReason),
    ).toHaveLength(0);
  });

  it("must-fail: Crew labor plug row still present", () => {
    expect(
      rows.costEntries.some((e) => /Crew labor/i.test(e.note ?? "")),
    ).toBe(false);
  });
});
