import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, dailyPlanLines } from "@/db/schema";
import { seedId } from "@/seed";
import { run } from "@/server/assistant/actions";
import {
  addPlanLine,
  costItemLinkedToActivity,
  listJobActivitiesForPicker,
} from "@/server/plans";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

describe.skipIf(!getDb())("5.1.0-d plan-line activity_id", () => {
  const db = getDb()!;
  const created: string[] = [];
  const prevSeedNow = process.env.V5_SEED_NOW;
  let companyId = "";
  let superintendent: CurrentUser;
  let cost210 = "";
  let cost410 = "";
  let cedarJobId = "";
  let planId = "";
  let pourLineId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    companyId = await createSandbox(new Date("2026-10-20T17:00:00.000Z"));
    created.push(companyId);
    cedarJobId = seedId(companyId, "job:cedar");
    cost210 = seedId(companyId, "cost:cedar:04-210");
    cost410 = seedId(companyId, "cost:cedar:07-410");
    planId = seedId(companyId, "plan:cedar:tomorrow");
    pourLineId = seedId(companyId, "plan-line:cedar:0");
    superintendent = {
      userId: seedId(companyId, "user:superintendent"),
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
  }, 120_000);

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("addLine by activity C copies Pier columns and cost 04-210", async () => {
    // Date coverage is a picker rule; the write accepts the code + link check.
    const added = await addPlanLine(superintendent, planId, {
      activityCode: "C",
      qty: "12",
      workers: "3",
      hours: "8",
      location: "Pier 3",
    });
    if ("refused" in added) throw new Error(added.refused);

    const [line] = await db
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.id, added.lineId));
    expect(line!.activity).toBe("Pier columns");
    expect(line!.costItemId).toBe(cost210);
    expect(line!.activityId).toBe(seedId(companyId, "activity:cedar:C"));
  });

  it("refuses a cost item not linked to the line's activity", async () => {
    const linkedOk = await costItemLinkedToActivity(
      companyId,
      seedId(companyId, "activity:cedar:C"),
      cost210,
    );
    expect(linkedOk).toBe(true);
    const linkedBad = await costItemLinkedToActivity(
      companyId,
      seedId(companyId, "activity:cedar:C"),
      cost410,
    );
    expect(linkedBad).toBe(false);

    const result = await run(
      superintendent,
      "Edit line (test)",
      "dailyPlan.updateLine",
      {
        lineId: pourLineId,
        change: { costItemId: cost410 },
      },
    );
    expect(result.result.refused).toBe(true);
    expect(result.result.summary).toMatch(/not linked/i);

    const [line] = await db
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.id, pourLineId));
    expect(line!.costItemId).toBe(cost210);
  });

  it("picker lists activities covering the plan date", async () => {
    const all = await listJobActivitiesForPicker(companyId, cedarJobId);
    expect(all.map((a) => a.code).sort()).toEqual(["A", "B", "C", "D", "E"]);
    // E covers Cedar tomorrow (2026-10-21 under frozen seed).
    const onTomorrow = all.filter(
      (a) => a.earlyStartOn <= "2026-10-21" && a.earlyFinishOn >= "2026-10-21",
    );
    expect(onTomorrow.map((a) => a.code)).toContain("E");
  });
});
