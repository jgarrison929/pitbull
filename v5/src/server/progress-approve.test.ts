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
import { seedId } from "@/seed";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { createSandbox } from "./sandbox";
import {
  approveDailyReport,
  getApprovalPendingByCostItem,
  planDateAsTimestamp,
  returnDailyReport,
  submitDailyReport,
} from "./progress";

const BRIDGE_RATE = CREW_LABOR_RATE_CENTS["Bridge Crew 2"];
const CULVERT_RATE = CREW_LABOR_RATE_CENTS["Culvert Crew A"];

const foremanActor = (companyId: string) => ({
  userId: seedId(companyId, "user:foreman"),
  role: "foreman" as const,
});
const superActor = (companyId: string) => ({
  userId: seedId(companyId, "user:superintendent"),
  role: "superintendent" as const,
});

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

    // 22.0 MH × Bridge Crew 2 seeded rate; 12 CY
    const submit = await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 22, qtyMilli: 12_000 } },
      foremanActor(companyId),
    );
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

    const pending = await getApprovalPendingByCostItem(
      companyId,
      itemBefore.jobId,
    );
    expect(pending[pourItemId]?.cents).toBe(22 * BRIDGE_RATE);

    const first = await approveDailyReport(companyId, planId, superActor(companyId));
    expect(first.ok).toBe(true);
    if (!first.ok || first.already) throw new Error("expected first approve");
    expect(first.postedMh).toBe(22);
    expect(first.postedCents).toBe(22 * BRIDGE_RATE);
    expect(first.rateCents).toBe(BRIDGE_RATE);
    expect(first.postedQtyByUnit).toEqual({ CY: 12_000 });

    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    expect(itemAfter.actualCents).toBe(actualBefore + 22 * BRIDGE_RATE);
    expect(itemAfter.installedQtyMilli).toBe(installedBefore + 12_000);

    const entries = await db!
      .select()
      .from(costEntries)
      .where(eq(costEntries.sourcePlanLineId, pourLineId));
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const labor = entries.find((e) => e.kind === "labor")!;
    expect(labor.rateCents).toBe(BRIDGE_RATE);
    expect(labor.amountCents).toBe(22 * BRIDGE_RATE);
    const [plan] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    expect(labor.at.toISOString()).toBe(
      planDateAsTimestamp(plan.planDate).toISOString(),
    );

    const second = await approveDailyReport(companyId, planId, superActor(companyId));
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

    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 22, qtyMilli: 12_000 } },
      foremanActor(companyId),
    );

    const empty = await returnDailyReport(companyId, planId, "   ", superActor(companyId));
    expect(empty.ok).toBe(false);

    const ok = await returnDailyReport(companyId, planId, "Recount pour 3", superActor(companyId));
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

    // Keep the seed tomorrow date — Part B history occupies past working days.
    const [seeded] = await db!
      .select({ planDate: dailyPlans.planDate })
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    const planDate = seeded!.planDate;
    await db!
      .update(dailyPlans)
      .set({ status: "issued" })
      .where(eq(dailyPlans.id, planId));

    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 10, qtyMilli: 5_000 } },
      foremanActor(companyId),
    );
    // Approve on a different calendar day than the plan date.
    const approveAt = new Date(`${planDate}T18:00:00.000Z`);
    approveAt.setUTCDate(approveAt.getUTCDate() + 2);
    const result = await approveDailyReport(
      companyId,
      planId,
      superActor(companyId),
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
    expect(labor.at.toISOString().slice(0, 10)).not.toBe(
      approveAt.toISOString().slice(0, 10),
    );
    expect(labor.rateCents).toBe(BRIDGE_RATE);
  });

  it("Culvert Crew A posts at $78.00/MH", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:i5:today");
    const lineId = seedId(companyId, "plan-line:i5:1"); // 07-120
    const itemId = seedId(companyId, "cost:i5:07-120");
    const superId = seedId(companyId, "user:superintendent");

    // seedActionHistory already reported+returned this plan — clear pending
    // actuals so this case posts only the 50 MH we submit on 07-120.
    await db!
      .update(dailyPlanLines)
      .set({ reportedHoursTenths: null, reportedQtyMilli: null })
      .where(eq(dailyPlanLines.planId, planId));
    await db!
      .update(dailyPlans)
      .set({ status: "issued", returnReason: null, returnedAt: null })
      .where(eq(dailyPlans.id, planId));

    const [itemBefore] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, itemId));

    await submitDailyReport(
      companyId,
      planId,
      { [lineId]: { manHours: 50, qtyMilli: 48_000 } },
      foremanActor(companyId),
    );

    const pending = await getApprovalPendingByCostItem(
      companyId,
      itemBefore.jobId,
    );
    expect(pending[itemId]?.cents).toBe(50 * CULVERT_RATE);

    const first = await approveDailyReport(companyId, planId, superActor(companyId));
    expect(first.ok).toBe(true);
    if (!first.ok || first.already) throw new Error("expected first approve");
    expect(first.postedCents).toBe(50 * CULVERT_RATE);
    expect(first.rateCents).toBe(CULVERT_RATE);

    const labor = (
      await db!
        .select()
        .from(costEntries)
        .where(eq(costEntries.sourcePlanLineId, lineId))
    ).find((e) => e.kind === "labor")!;
    expect(labor.rateCents).toBe(CULVERT_RATE);
    expect(labor.amountCents).toBe(50 * CULVERT_RATE);

    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, itemId));
    expect(itemAfter.actualCents).toBe(
      itemBefore.actualCents + 50 * CULVERT_RATE,
    );
  });
});
