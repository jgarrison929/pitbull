import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import {
  companies,
  costEntries,
  costItems,
  dailyPlanLines,
  dailyPlans,
} from "@/db/schema";
import {
  CREW_LABOR_RATE_CENTS,
  CREW_RATE_EXPAND_DEFAULT_CENTS,
} from "@/lib/crew-rates";
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
 * 0013-window rows keep crew_id NULL. Rate lookup must fall back to text crew
 * name (then expand DEFAULT). These go red if the fallbacks are removed.
 */
describe.skipIf(!db)("null crew_id labor rate fallback", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("pending keeps the chip when crew_id is NULL (name → Bridge rate)", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const pourItemId = seedId(companyId, "cost:cedar:04-210");

    await db!
      .update(dailyPlans)
      .set({ status: "issued", crewId: null })
      .where(eq(dailyPlans.id, planId));

    expect(await laborRateForPlan(requireDb(), planId)).toBe(BRIDGE);

    await submitDailyReport(companyId, planId, {
      [pourLineId]: { manHours: 22, qtyMilli: 12_000 },
    });

    const [item] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, pourItemId));
    const pending = await getApprovalPendingByCostItem(companyId, item.jobId);
    // Red if pending still inner-joins crews on crew_id only.
    expect(pending[pourItemId]?.cents).toBe(22 * BRIDGE);
    expect(pending[pourItemId]?.qtyMilli).toBe(12_000);
  });

  it("approve posts without 500 when crew_id is NULL (name → Bridge rate)", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const pourItemId = seedId(companyId, "cost:cedar:04-210");
    const superId = seedId(companyId, "user:superintendent");

    await db!
      .update(dailyPlans)
      .set({ status: "issued", crewId: null })
      .where(eq(dailyPlans.id, planId));

    await submitDailyReport(companyId, planId, {
      [pourLineId]: { manHours: 22, qtyMilli: 12_000 },
    });

    const result = await approveDailyReport(companyId, planId, superId);
    // Red if laborRateForPlan throws on null crew_id.
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

  it("unknown text crew with null crew_id uses expand DEFAULT (never throws)", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");

    await db!.execute(sql`
      UPDATE daily_plans
      SET crew_id = NULL, crew = 'No Such Crew'
      WHERE id = ${planId}::uuid
    `);

    expect(await laborRateForPlan(requireDb(), planId)).toBe(
      CREW_RATE_EXPAND_DEFAULT_CENTS,
    );
  });
});
