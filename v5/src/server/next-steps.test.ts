import { describe, expect, it } from "vitest";
import { currentBudgetCents } from "@/lib/budget";
import { coLabel } from "@/lib/change-order";
import { costLine } from "@/lib/ev";
import { overallStatus } from "@/lib/status";
import { seed, seedId } from "@/seed";

/**
 * 5.0.4-a check 6 — seeded next-step counts after reset, no browser.
 * Mirrors getNextSteps item sources against the pure seed().
 */
const company = "00000000-0000-4000-8000-000000000099";
const today = new Date("2026-10-19T00:00:00Z");
const todayIso = "2026-10-19";
const rows = seed(company, today);
const foremanId = seedId(company, "user:foreman");

function asLine(c: (typeof rows.costItems)[number]) {
  const budgetCents = currentBudgetCents({
    cbLaborCents: c.cbLaborCents ?? 0,
    cbMaterialCents: c.cbMaterialCents ?? 0,
    cbEquipmentCents: c.cbEquipmentCents ?? 0,
    cbSubCents: c.cbSubCents ?? 0,
  });
  return costLine({
    code: c.code!,
    description: c.description!,
    unit: c.unit!,
    budgetQtyMilli: c.budgetQtyMilli!,
    installedQtyMilli: c.installedQtyMilli!,
    claimedInstalledQtyMilli: c.claimedInstalledQtyMilli ?? 0,
    budgetCents,
    plannedCents: c.plannedCents!,
    actualCents: c.lockedActualCents ?? c.actualCents!,
    budgetMhPerUnitMilli: c.budgetMhPerUnitMilli!,
    claimedPercentMilli: c.claimedPercentMilli ?? 0,
    earnDerivation: c.earnDerivation ?? "",
    evMethod: c.evMethod ?? "units",
    forecastMethod: c.forecastMethod ?? "current_budget",
  });
}

function jobRollup(number: string) {
  const job = rows.jobs.find((j) => j.number === number)!;
  const lines = rows.costItems
    .filter((c) => c.jobId === job.id && c.isLeaf)
    .map(asLine);
  const earned = lines.reduce((s, l) => s + l.earnedCents, 0);
  const actual = lines.reduce((s, l) => s + l.actualCents, 0);
  const planned = lines.reduce((s, l) => s + l.plannedCents, 0);
  const budget = lines.reduce((s, l) => s + l.budgetCents, 0);
  return {
    job,
    earned,
    actual,
    planned,
    budget,
    costVarianceCents: earned - actual,
    scheduleVarianceCents: earned - planned,
    cpi: budget === 0 || actual === 0 ? null : earned / actual,
    spi: budget === 0 || planned === 0 ? null : earned / planned,
  };
}

describe("5.0.4-a seeded next-step counts", () => {
  it("superintendent: draft Cedar tomorrow + reported 24-118 today", () => {
    const drafts = rows.dailyPlans.filter(
      (p) => p.status === "draft" && p.planDate >= todayIso,
    );
    const reported = rows.dailyPlans.filter((p) => p.status === "reported");
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.id).toBe(seedId(company, "plan:cedar:tomorrow"));
    expect(reported).toHaveLength(1);
    expect(reported[0]!.id).toBe(seedId(company, "plan:sr99:today"));
    expect(drafts.length + reported.length).toBe(2);
  });

  it("foreman: issued I-5 today + draft Cedar tomorrow (both foreman-owned)", () => {
    const issued = rows.dailyPlans.filter(
      (p) =>
        p.status === "issued" &&
        p.foremanId === foremanId &&
        p.planDate <= todayIso,
    );
    const drafts = rows.dailyPlans.filter(
      (p) =>
        p.status === "draft" &&
        p.foremanId === foremanId &&
        p.planDate >= todayIso,
    );
    expect(issued).toHaveLength(1);
    expect(issued[0]!.id).toBe(seedId(company, "plan:i5:today"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.id).toBe(seedId(company, "plan:cedar:tomorrow"));
    expect(issued.length + drafts.length).toBe(2);
  });

  it("pm: all priced COs + Harbor draft estimate + one lowest-CPI leaf", () => {
    const priced = rows.changeOrders.filter((c) => c.status === "priced");
    // Seed has CO-001 (25-031) and CO-002 (24-077) priced.
    expect(priced.map((c) => coLabel(c.number)).sort()).toEqual([
      "CO-001",
      "CO-002",
    ]);
    const draftJobs = rows.jobs.filter((j) => j.estimateStatus === "draft");
    expect(draftJobs.map((j) => j.number)).toEqual(["26-010"]);
    const leaves = rows.costItems
      .filter((c) => c.isLeaf)
      .map(asLine)
      .filter((l) => l.cpi != null && l.cpi < 1)
      .sort(
        (a, b) =>
          (a.cpi ?? 1) - (b.cpi ?? 1) || a.code.localeCompare(b.code),
      );
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves[0]!.cpi!).toBeLessThan(1);
    // Spec table lists 3; seed rules yield 4 (both priced COs). Cap is 5.
    expect(priced.length + draftJobs.length + 1).toBe(4);
  });

  it("executive: at least one at-risk job + every priced CO", () => {
    const active = ["24-118", "25-031", "24-077"].map(jobRollup);
    const atRisk = active.filter(
      (j) =>
        overallStatus({
          cpi: j.cpi,
          spi: j.spi,
          costVarianceCents: j.costVarianceCents,
          scheduleVarianceCents: j.scheduleVarianceCents,
        }) === "at-risk",
    );
    expect(atRisk.length).toBeGreaterThanOrEqual(1);
    expect(atRisk.some((j) => j.job.number === "24-077")).toBe(true);
    const priced = rows.changeOrders.filter((c) => c.status === "priced");
    expect(priced.length).toBe(2);
    expect(atRisk.length + priced.length).toBeGreaterThanOrEqual(2);
  });

  it("does not move 25-031 locked actuals (no cost from the new reported plan)", () => {
    const cedar = rows.jobs.find((j) => j.number === "25-031")!;
    const locked = rows.costItems
      .filter((c) => c.jobId === cedar.id && c.isLeaf)
      .reduce((s, c) => s + (c.lockedActualCents ?? 0), 0);
    const r = jobRollup("25-031");
    expect(r.actual).toBe(locked);
    expect(r.actual).toBeGreaterThan(0);
  });
});
