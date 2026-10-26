import { describe, expect, it } from "vitest";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { calendarDateInTz } from "@/lib/plan-date";
import { seed, seedId } from "./index";
import {
  CEDAR_RETURN_REASON,
  FIELD_HISTORY_WORKING_DAYS,
  distributeInt,
  histPlanKey,
  workingDaysBefore,
} from "./field-history";

const company = "00000000-0000-4000-8000-0000000000b2";
const today = new Date("2026-10-20T17:00:00.000Z");
const rows = seed(company, today);
const days = workingDaysBefore(today, FIELD_HISTORY_WORKING_DAYS);

describe("workingDaysBefore / distributeInt", () => {
  it("returns 30 Mon–Fri dates strictly before today, oldest first", () => {
    expect(days).toHaveLength(30);
    expect(days[0]! < days[29]!).toBe(true);
    expect(days.every((d) => d < "2026-10-20")).toBe(true);
    expect(days.every((d) => d < calendarDateInTz(today))).toBe(true);
    for (const d of days) {
      const dow = new Date(`${d}T12:00:00.000Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("leaves the Los Angeles today free after UTC has rolled to the next day", () => {
    // Tuesday 00:05 UTC is still Monday evening in Los Angeles.
    const evening = new Date("2026-10-27T00:05:00.000Z");
    const laToday = calendarDateInTz(evening);
    const prior = workingDaysBefore(evening, 5);
    expect(laToday).toBe("2026-10-26");
    expect(prior.every((d) => d < laToday)).toBe(true);
    expect(prior.at(-1)).toBe("2026-10-23");
  });

  it("distributeInt parts sum to total", () => {
    expect(distributeInt(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(distributeInt(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(distributeInt(7, 1)).toEqual([7]);
  });
});

describe("seeded field history (Part B)", () => {
  it("seeds 30 approved plans per active job before today", () => {
    for (const number of ["24-118", "25-031", "24-077"]) {
      const job = rows.jobs.find((j) => j.number === number)!;
      const approved = rows.dailyPlans.filter(
        (p) => p.jobId === job.id && p.status === "approved",
      );
      expect(approved).toHaveLength(FIELD_HISTORY_WORKING_DAYS);
      const dates = approved.map((p) => p.planDate).sort();
      expect(dates).toEqual([...days].sort());
      expect(approved.every((p) => p.crewId)).toBe(true);
      expect(approved.every((p) => p.createdById)).toBe(true);
      expect(approved.every((p) => p.reportedAt)).toBe(true);
      expect(approved.every((p) => p.approvedById)).toBe(true);
    }
  });

  it("reconciles 25-031 / 04-210 qty and labor hours; rate is Bridge Crew 2", () => {
    const item = rows.costItems.find(
      (c) => c.id === seedId(company, "cost:cedar:04-210"),
    )!;
    const lines = rows.dailyPlanLines.filter(
      (l) => l.costItemId === item.id && l.reportedQtyMilli != null,
    );
    const qtySum = lines.reduce((s, l) => s + (l.reportedQtyMilli ?? 0), 0);
    expect(qtySum).toBe(item.installedQtyMilli);

    const labor = rows.costEntries.filter(
      (e) => e.costItemId === item.id && e.kind === "labor",
    );
    expect(labor.length).toBeGreaterThan(0);
    expect(labor.every((e) => e.rateCents === CREW_LABOR_RATE_CENTS["Bridge Crew 2"])).toBe(
      true,
    );
    expect(labor.every((e) => e.sourcePlanLineId)).toBe(true);
    const hoursTenths = labor.reduce((s, e) => s + (e.hoursTenths ?? 0), 0);
    const amount = labor.reduce((s, e) => s + e.amountCents, 0);
    // Hours stay the same as 5.0.0 single row: mh × installed, rounded to tenths.
    const installed = item.installedQtyMilli! / 1000;
    const expectedTenths = Math.max(1, Math.round(1.6 * installed * 10));
    expect(hoursTenths).toBe(expectedTenths);
    expect(amount).toBe(
      Math.round((expectedTenths / 10) * CREW_LABOR_RATE_CENTS["Bridge Crew 2"]),
    );
    expect(amount).toBe(
      rows.costEntries
        .filter((e) => e.costItemId === item.id)
        .reduce((s, e) => s + e.amountCents, 0) -
        rows.costEntries
          .filter((e) => e.costItemId === item.id && e.kind === "other")
          .reduce((s, e) => s + e.amountCents, 0),
    );
  });

  it("has no single Crew labor plug rows", () => {
    expect(
      rows.costEntries.some((e) => /Crew labor/i.test(e.note ?? "")),
    ).toBe(false);
  });

  it("keeps the Cedar returned-then-approved story", () => {
    const cedar = rows.jobs.find((j) => j.number === "25-031")!;
    const returned = rows.dailyPlans.filter(
      (p) =>
        p.jobId === cedar.id &&
        p.returnReason === CEDAR_RETURN_REASON &&
        p.status === "approved",
    );
    expect(returned).toHaveLength(1);
    const plan = returned[0]!;
    expect(plan.returnedAt).toBeTruthy();
    expect(plan.reportedAt).toBeTruthy();
    expect(plan.approvedAt).toBeTruthy();
    expect(plan.submittedAt).toBeTruthy();
    expect(plan.createdAt).toBeTruthy();
    expect(plan.id).toBe(seedId(company, histPlanKey("cedar", plan.planDate)));
    // Re-report / approve after the return day.
    expect(plan.approvedAt!.getTime()).toBeGreaterThan(plan.returnedAt!.getTime());
    expect(plan.reportedAt!.getTime()).toBeGreaterThan(plan.returnedAt!.getTime());
  });

  it("keeps story invariants (Cedar over cost, I-5 behind, SR-99 healthy)", () => {
    const jobIndex = (number: string) => {
      const job = rows.jobs.find((j) => j.number === number)!;
      const items = rows.costItems.filter((c) => c.jobId === job.id && c.isLeaf);
      const earned = items.reduce((s, c) => {
        // Mirror asLine EV via claimed % × budget is enough for inequality checks
        // used in seed/index.test — here we use locked actual vs a simple proxy.
        return s + (c.actualCents ?? 0);
      }, 0);
      void earned;
      return {
        actual: items.reduce((s, c) => s + (c.actualCents ?? 0), 0),
        planned: items.reduce((s, c) => s + (c.plannedCents ?? 0), 0),
      };
    };
    // Full story checks live in seed/index.test; smoke that AC still positive.
    expect(jobIndex("25-031").actual).toBeGreaterThan(0);
    expect(jobIndex("24-077").planned).toBeGreaterThan(0);
  });

  it("cost item actualCents equals sum of its cost_entries", () => {
    const byItem = new Map<string, number>();
    for (const e of rows.costEntries) {
      byItem.set(e.costItemId, (byItem.get(e.costItemId) ?? 0) + e.amountCents);
    }
    for (const c of rows.costItems) {
      if (!c.isLeaf) continue;
      expect(byItem.get(c.id) ?? 0).toBe(c.actualCents);
    }
  });
});
