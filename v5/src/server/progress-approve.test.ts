import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  companies,
  costEntries,
  costItems,
  dailyPlanLines,
  dailyPlans,
} from "@/db/schema";
import { DEFAULT_LABOR_RATE_CENTS } from "@/lib/ev";
import { seedId } from "@/seed";
import { createSandbox } from "./sandbox";
import {
  approveDailyReport,
  planDateAsTimestamp,
  returnDailyReport,
  submitDailyReport,
} from "./progress";

const db = getDb();
const created: string[] = [];

describe.skipIf(!db)("daily report approve posts once on plan date", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("report does not touch cost; approve posts once; second approve is a no-op", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const pourItemId = seedId(companyId, "cost:cedar:04-210");
    const superId = seedId(companyId, "user:superintendent");

    await db!
      .update(dailyPlans)
      .set({ status: "issued" })
      .where(eq(dailyPlans.id, planId));

    const [itemBefore] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    const actualBefore = itemBefore.actualCents;
    const installedBefore = itemBefore.installedQtyMilli;

    // 22.0 MH × $85 = $1,870.00; 12 CY
    const submit = await submitDailyReport(companyId, planId, {
      [pourLineId]: { manHours: 22, qtyMilli: 12_000 },
    });
    expect(submit.ok).toBe(true);

    const [itemAfterReport] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    expect(itemAfterReport.actualCents).toBe(actualBefore);
    expect(itemAfterReport.installedQtyMilli).toBe(installedBefore);

    const [planReported] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    expect(planReported.status).toBe("reported");

    const first = await approveDailyReport(companyId, planId, superId);
    expect(first.ok).toBe(true);
    if (!first.ok || first.already) throw new Error("expected first approve");
    expect(first.postedMh).toBe(22);
    expect(first.postedCents).toBe(22 * DEFAULT_LABOR_RATE_CENTS);
    expect(first.postedQtyByUnit).toEqual({ CY: 12_000 });

    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    expect(itemAfter.actualCents).toBe(
      actualBefore + 22 * DEFAULT_LABOR_RATE_CENTS,
    );
    expect(itemAfter.installedQtyMilli).toBe(installedBefore + 12_000);

    const entries = await db!
      .select()
      .from(costEntries)
      .where(eq(costEntries.sourcePlanLineId, pourLineId));
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const labor = entries.find((e) => e.kind === "labor")!;
    const [plan] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    expect(labor.at.toISOString()).toBe(
      planDateAsTimestamp(plan.planDate).toISOString(),
    );

    const second = await approveDailyReport(companyId, planId, superId);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected second approve ok");
    expect(second.already).toBe(true);
    expect(second.postedCents).toBe(0);

    const [itemFinal] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    expect(itemFinal.actualCents).toBe(itemAfter.actualCents);
    expect(itemFinal.installedQtyMilli).toBe(itemAfter.installedQtyMilli);

    const entriesAfter = await db!
      .select()
      .from(costEntries)
      .where(eq(costEntries.sourcePlanLineId, pourLineId));
    expect(entriesAfter).toHaveLength(entries.length);
  });

  it("return needs a reason, keeps values, and posts nothing", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const pourItemId = seedId(companyId, "cost:cedar:04-210");

    await db!
      .update(dailyPlans)
      .set({ status: "issued" })
      .where(eq(dailyPlans.id, planId));

    const [itemBefore] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));

    await submitDailyReport(companyId, planId, {
      [pourLineId]: { manHours: 22, qtyMilli: 12_000 },
    });

    const empty = await returnDailyReport(companyId, planId, "   ");
    expect(empty.ok).toBe(false);

    const ok = await returnDailyReport(companyId, planId, "Recount pour 3");
    expect(ok.ok).toBe(true);

    const [plan] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    expect(plan.status).toBe("issued");
    expect(plan.returnReason).toBe("Recount pour 3");

    const [line] = await db!
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.id, pourLineId));
    expect(line.reportedHoursTenths).toBe(220);
    expect(line.reportedQtyMilli).toBe(12_000);

    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    expect(itemAfter.actualCents).toBe(itemBefore.actualCents);
    expect(itemAfter.installedQtyMilli).toBe(itemBefore.installedQtyMilli);
  });

  it("entries carry the plan date, not the approve day", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const superId = seedId(companyId, "user:superintendent");

    const planDate = "2026-10-15";
    await db!
      .update(dailyPlans)
      .set({ status: "issued", planDate })
      .where(eq(dailyPlans.id, planId));

    await submitDailyReport(companyId, planId, {
      [pourLineId]: { manHours: 10, qtyMilli: 5_000 },
    });
    const approveAt = new Date("2026-10-21T18:00:00.000Z");
    const result = await approveDailyReport(
      companyId,
      planId,
      superId,
      approveAt,
    );
    expect(result.ok).toBe(true);

    const labor = (
      await db!
        .select()
        .from(costEntries)
        .where(eq(costEntries.sourcePlanLineId, pourLineId))
    ).find((e) => e.kind === "labor")!;
    expect(labor.at.toISOString()).toBe(
      planDateAsTimestamp(planDate).toISOString(),
    );
    expect(labor.at.toISOString().slice(0, 10)).toBe(planDate);
    expect(labor.at.toISOString().slice(0, 10)).not.toBe("2026-10-21");
  });
});
