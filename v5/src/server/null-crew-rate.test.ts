import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costEntries, costItems, dailyPlans } from "@/db/schema";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { seedId } from "@/seed";
import { laborRateForPlan } from "@/server/plans";
import {
  approveDailyReport,
  getApprovalPendingByCostItem,
  submitDailyReport,
} from "@/server/progress";
import { createSandbox } from "@/server/sandbox";

const db = getDb();
const created: string[] = [];
const BRIDGE = CREW_LABOR_RATE_CENTS["Bridge Crew 2"];

/**
 * After 0019, crew_id is required. Rate lookup joins crews on crew_id only.
 */
describe.skipIf(!db)("crew_id labor rate (post-0019)", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("pending uses Bridge rate from crew_id join", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const pourItemId = seedId(companyId, "cost:cedar:04-210");

    await db!
      .update(dailyPlans)
      .set({ status: "issued" })
      .where(eq(dailyPlans.id, planId));

    expect(await laborRateForPlan(requireDb(), planId)).toBe(BRIDGE);

    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 22, qtyMilli: 12_000 } },
      { userId: seedId(companyId, "user:foreman"), role: "foreman" },
    );

    const [item] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    const pending = await getApprovalPendingByCostItem(companyId, item.jobId);
    expect(pending[pourItemId]?.cents).toBe(22 * BRIDGE);
    expect(pending[pourItemId]?.qtyMilli).toBe(12_000);
  });

  it("approve posts Bridge rate from crew_id", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const superId = seedId(companyId, "user:superintendent");

    await db!
      .update(dailyPlans)
      .set({ status: "issued" })
      .where(eq(dailyPlans.id, planId));

    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 22, qtyMilli: 12_000 } },
      { userId: seedId(companyId, "user:foreman"), role: "foreman" },
    );

    const result = await approveDailyReport(companyId, planId, {
      userId: superId,
      role: "superintendent",
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.already) throw new Error("expected first approve");
    expect(result.rateCents).toBe(BRIDGE);
    expect(result.postedCents).toBe(22 * BRIDGE);

    const labor = (
      await db!
        .select()
        .from(costEntries)
        .where(eq(costEntries.sourcePlanLineId, pourLineId))
    ).find((e) => e.kind === "labor")!;
    expect(labor.rateCents).toBe(BRIDGE);
    expect(labor.amountCents).toBe(22 * BRIDGE);
  });
});
