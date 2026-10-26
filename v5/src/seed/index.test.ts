import { describe, expect, it } from "vitest";
import {
  buildWbsMoney,
  currentBudgetCents,
  SHB_CSV,
  SHB_FIXTURE,
} from "@/lib/budget";
import {
  existingCostItems,
  parseEstimateCsv,
  reconcileByCode,
} from "@/lib/estimate-reconcile";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { costLine, plannedValueCents } from "@/lib/ev";
import { SEED_ACTIVE_JOB_COUNT, seed, seedId } from "./index";

const company = "00000000-0000-4000-8000-000000000001";
// Midday Pacific-aligned instant so UTC day === job-zone plan day in tests.
const today = new Date("2026-10-19T17:00:00Z");
const rows = seed(company, today);

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

function jobIndex(number: string) {
  const job = rows.jobs.find((j) => j.number === number)!;
  const items = rows.costItems.filter((c) => c.jobId === job.id && c.isLeaf);
  const lines = items.map(asLine);
  const sum = (f: (c: (typeof lines)[number]) => number) =>
    lines.reduce((s, c) => s + f(c), 0);
  return {
    earned: sum((c) => c.earnedCents),
    actual: sum((c) => c.actualCents),
    planned: sum((c) => c.plannedCents),
    items,
    lines,
  };
}

describe("seed", () => {
  it("is deterministic for the same company and day", () => {
    expect(seed(company, today)).toEqual(rows);
    expect(seedId(company, "x")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("gives each sandbox its own ids", () => {
    const other = seed("00000000-0000-4000-8000-000000000002", today);
    expect(other.jobs[0].id).not.toBe(rows.jobs[0].id);
  });

  it("builds actuals from cost entries and planned from schedule dates", () => {
    const byItem = new Map<string, number>();
    for (const e of rows.costEntries) {
      expect(e.at).toBeTruthy();
      byItem.set(e.costItemId, (byItem.get(e.costItemId) ?? 0) + e.amountCents);
    }
    for (const c of rows.costItems) {
      expect(byItem.get(c.id) ?? 0).toBe(c.actualCents);
      const budgetCents = currentBudgetCents({
        cbLaborCents: c.cbLaborCents ?? 0,
        cbMaterialCents: c.cbMaterialCents ?? 0,
        cbEquipmentCents: c.cbEquipmentCents ?? 0,
        cbSubCents: c.cbSubCents ?? 0,
      });
      expect(c.plannedCents).toBe(
        plannedValueCents(
          budgetCents,
          c.plannedStartOn!,
          c.plannedFinishOn!,
          today,
        ),
      );
    }
  });

  it("refuses the budget×pct−labor plug and pct-derived PV=EV", () => {
    // Every active line must have dated invoices (never a single "Material / subcontract
    // to date" sized as budget×pct−labor). AC==EV and PV==EV to the cent are the
    // fingerprints of those plugs. Allow a tiny tolerance for fully complete lines
    // whose schedules have finished (PV=budget=EV is honest there) — never the 19+
    // exact matches the old SR-99/I-5 default produced.
    const MAX_AC_EQ_EV = 0;
    const MAX_PV_EQ_EV = 3; // e.g. LS at 100% with finished calendars only

    let acEq = 0;
    let pvEq = 0;
    const offenders: string[] = [];

    for (const c of rows.costItems) {
      if (!c.isLeaf) continue;
      if (c.claimedPercentMilli === 0 && c.actualCents === 0) continue; // not started
      const line = asLine(c);
      const job = rows.jobs.find((j) => j.id === c.jobId)!;
      if (line.actualCents === line.earnedCents) {
        acEq += 1;
        offenders.push(`${job.number} ${c.code} AC==EV $${line.earnedCents / 100}`);
      }
      if (line.plannedCents === line.earnedCents && line.earnedCents > 0) {
        pvEq += 1;
        offenders.push(`${job.number} ${c.code} PV==EV $${line.earnedCents / 100}`);
      }
    }

    expect(
      acEq,
      `AC==EV on ${acEq} lines (max ${MAX_AC_EQ_EV}): ${offenders.filter((o) => o.includes("AC==")).join("; ")}`,
    ).toBeLessThanOrEqual(MAX_AC_EQ_EV);
    expect(
      pvEq,
      `PV==EV on ${pvEq} lines (max ${MAX_PV_EQ_EV}): ${offenders.filter((o) => o.includes("PV==")).join("; ")}`,
    ).toBeLessThanOrEqual(MAX_PV_EQ_EV);

    // No default plug note anywhere.
    expect(
      rows.costEntries.some((e) =>
        /Material \/ subcontract to date/i.test(e.note ?? ""),
      ),
    ).toBe(false);
  });

  it("tells the story without targeting exact CPI/SPI", () => {
    const sr99 = jobIndex("24-118");
    const cedar = jobIndex("25-031");
    const i5 = jobIndex("24-077");
    // Cedar: actuals clearly above earned (over cost).
    expect(cedar.actual).toBeGreaterThan(cedar.earned);
    // I-5: planned value ahead of earned (behind schedule).
    expect(i5.planned).toBeGreaterThan(i5.earned);
    // SR-99: roughly healthy — actuals not wildly off earned.
    const sr99Gap = Math.abs(sr99.actual - sr99.earned) / sr99.earned;
    expect(sr99Gap).toBeLessThan(0.15);
    for (const j of [sr99, cedar, i5]) expect(j.earned).toBeGreaterThan(0);
  });

  it("has tomorrow's Cedar draft and today's I-5 draft on real cost items", () => {
    // 30 working days × 3 jobs of approved history + 2 open drafts.
    expect(rows.dailyPlans.length).toBe(30 * 3 + 2);
    // Cedar tomorrow stays draft; I-5 today is issued (returned) after history bake.
    expect(
      rows.dailyPlans.filter((p) => p.status === "draft"),
    ).toHaveLength(1);
    expect(
      rows.dailyPlans.find((p) => p.id === seedId(company, "plan:i5:today"))
        ?.status,
    ).toBe("issued");
    expect(rows.crews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seedId(company, "crew:bridge-2"),
          name: "Bridge Crew 2",
          foremanId: seedId(company, "user:foreman"),
          laborRateCents: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
        }),
        expect.objectContaining({
          id: seedId(company, "crew:culvert-a"),
          name: "Culvert Crew A",
          foremanId: seedId(company, "user:foreman"),
          laborRateCents: CREW_LABOR_RATE_CENTS["Culvert Crew A"],
        }),
        expect.objectContaining({
          id: seedId(company, "crew:interchange-1"),
          name: "Interchange Crew 1",
          foremanId: seedId(company, "user:foreman"),
          laborRateCents: CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
        }),
      ]),
    );
    const cedar = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:cedar:tomorrow"),
    )!;
    const i5 = rows.dailyPlans.find(
      (p) => p.id === seedId(company, "plan:i5:today"),
    )!;
    expect(cedar).toMatchObject({
      planDate: "2026-10-20",
      status: "draft",
      crewId: seedId(company, "crew:bridge-2"),
    });
    expect(i5).toMatchObject({
      planDate: "2026-10-19",
      status: "issued",
      crewId: seedId(company, "crew:culvert-a"),
    });
    const ids = new Set(rows.costItems.map((c) => c.id));
    expect(rows.dailyPlanLines.every((l) => ids.has(l.costItemId))).toBe(true);
    expect(rows.users.map((u) => u.role)).toEqual([
      "executive",
      "pm",
      "superintendent",
      "foreman",
    ]);
  });

  it("stores money and quantities as integers", () => {
    for (const c of rows.costItems) {
      for (const v of [
        c.cbLaborCents,
        c.ceLaborCents,
        c.obLaborCents,
        c.plannedCents,
        c.actualCents,
        c.budgetQtyMilli,
        c.installedQtyMilli,
        c.claimedInstalledQtyMilli,
        c.claimedPercentMilli,
      ]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("seeds one draft estimate job with the SHB fixture totals", () => {
    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    expect(harbor.estimateStatus).toBe("draft");
    // Login copy and portfolio "active jobs" must agree — draft is not active.
    expect(SEED_ACTIVE_JOB_COUNT).toBe(
      rows.jobs.filter((j) => j.estimateStatus === "approved").length,
    );
    const leaves = rows.costItems.filter(
      (c) => c.jobId === harbor.id && c.isLeaf,
    );
    expect(leaves).toHaveLength(4);
    const ce = leaves.reduce(
      (s, c) =>
        s +
        (c.ceLaborCents ?? 0) +
        (c.ceMaterialCents ?? 0) +
        (c.ceEquipmentCents ?? 0) +
        (c.ceSubCents ?? 0),
      0,
    );
    const ob = leaves.reduce(
      (s, c) =>
        s +
        (c.obLaborCents ?? 0) +
        (c.obMaterialCents ?? 0) +
        (c.obEquipmentCents ?? 0) +
        (c.obSubCents ?? 0),
      0,
    );
    expect(ce).toBe(SHB_FIXTURE.jobTotalCents);
    expect(ob).toBe(0);
    expect(
      currentBudgetCents({
        cbLaborCents: leaves[0]!.cbLaborCents ?? 0,
        cbMaterialCents: leaves[0]!.cbMaterialCents ?? 0,
        cbEquipmentCents: leaves[0]!.cbEquipmentCents ?? 0,
        cbSubCents: leaves[0]!.cbSubCents ?? 0,
      }),
    ).toBe(0);
    // Existing jobs stay approved with OB=CB=CE.
    for (const n of ["24-118", "25-031", "24-077"]) {
      expect(rows.jobs.find((j) => j.number === n)!.estimateStatus).toBe(
        "approved",
      );
    }
  });

  it("seeds Harbor as a CSV estimate, so importing SHB onto it changes nothing", () => {
    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    expect(harbor.estimateSource).toBe("csv");
    for (const j of rows.jobs)
      if (j !== harbor) expect(j.estimateSource ?? "seed").toBe("seed");

    const items = rows.costItems
      .filter((c) => c.jobId === harbor.id)
      .map((c) => ({
        id: c.id!,
        parentId: c.parentId ?? null,
        code: c.code,
        path: c.path,
        depth: c.depth ?? 0,
        isLeaf: c.isLeaf ?? true,
        description: c.description,
        unit: c.unit,
        budgetQtyMilli: c.budgetQtyMilli ?? 0,
        budgetMhPerUnitMilli: c.budgetMhPerUnitMilli ?? 0,
        obLaborCents: c.obLaborCents ?? 0,
        obMaterialCents: c.obMaterialCents ?? 0,
        obEquipmentCents: c.obEquipmentCents ?? 0,
        obSubCents: c.obSubCents ?? 0,
        cbLaborCents: c.cbLaborCents ?? 0,
        cbMaterialCents: c.cbMaterialCents ?? 0,
        cbEquipmentCents: c.cbEquipmentCents ?? 0,
        cbSubCents: c.cbSubCents ?? 0,
        ceLaborCents: c.ceLaborCents ?? 0,
        ceMaterialCents: c.ceMaterialCents ?? 0,
        ceEquipmentCents: c.ceEquipmentCents ?? 0,
        ceSubCents: c.ceSubCents ?? 0,
      }));
    for (const s of items.filter((c) => !c.isLeaf)) {
      expect(s).toMatchObject({ unit: "", budgetQtyMilli: 0, ceLaborCents: 0 });
    }
    const money = buildWbsMoney(items).job;
    expect(money).toMatchObject({
      obCents: 0,
      cbCents: 0,
      ceCents: SHB_FIXTURE.jobTotalCents,
      ce: SHB_FIXTURE.categories,
      mhMilli: SHB_FIXTURE.jobMhMilli,
    });

    const parsed = parseEstimateCsv(SHB_CSV);
    if (!parsed.ok) throw new Error("SHB_CSV must parse");
    const diff = reconcileByCode(existingCostItems(items), parsed.forest);
    if (!diff.ok) throw new Error("SHB_CSV must reconcile");
    expect(diff.plan.steps).toEqual([]);
    expect(diff.plan.unchangedIds).toHaveLength(items.length);
  });

  it("locks Period 1 on approved jobs (Harbor stays draft)", () => {
    expect(rows.costEntries.length).toBeGreaterThan(0);
    // 3 locked Period 1 + 3 Period 2 drafts + Harbor Period 1 draft.
    expect(rows.progressClaims).toHaveLength(7);
    const harbor = rows.jobs.find((j) => j.number === "26-010")!;
    const harborClaims = rows.progressClaims.filter((c) => c.jobId === harbor.id);
    expect(harborClaims).toHaveLength(1);
    expect(harborClaims[0]!.status).toBe("draft");
    expect(harborClaims[0]!.periodLabel).toBe("Period 1");
    const locked = rows.progressClaims.filter((c) => c.status === "locked");
    expect(locked).toHaveLength(3);
    expect(locked.every((c) => c.periodLabel === "Period 1")).toBe(true);
    expect(
      rows.progressClaims.filter((c) => c.periodLabel === "Period 2"),
    ).toHaveLength(3);
    expect(rows.costItemMilestones.length).toBeGreaterThan(0);
    expect(rows.pmPercentLogs.length).toBeGreaterThan(0);
    expect(rows.actionRuns.length).toBeGreaterThan(0);
    expect(rows.changeOrders).toHaveLength(6);
    for (const c of rows.costItems) {
      if (!c.isLeaf) continue;
      const job = rows.jobs.find((j) => j.id === c.jobId)!;
      if (job.estimateStatus === "draft") continue;
      expect((c.earnDerivation ?? "").length).toBeGreaterThan(0);
      expect(c.earnDerivation).toMatch(/\(locked Period 1\)/);
      expect(["units", "milestones", "pm_percent"]).toContain(c.evMethod);
      expect(c.claimedInstalledQtyMilli).toBe(c.installedQtyMilli);
    }
  });
});
