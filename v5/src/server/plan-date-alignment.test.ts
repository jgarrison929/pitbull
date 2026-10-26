/**
 * Integration: at a pinned post-UTC-midnight clock, reset / submit / updateLine
 * all target the same Cedar Bridge Crew 2 plan (job-zone tomorrow).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, dailyPlanLines, dailyPlans } from "@/db/schema";
import { route } from "@/lib/assistant/route";
import { manHoursOf } from "@/lib/plan-line";
import {
  addCalendarDays,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { seedId } from "@/seed";
import { run } from "@/server/assistant/actions";
import { createSandbox, resetSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();

/** verify-v5 failure window: just after UTC midnight = evening PT. */
const PINNED = "2026-10-26T00:30:00.000Z";

describe.skipIf(!db)("plan date alignment across seed / submit / updateLine", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let foreman!: CurrentUser;

  beforeAll(async () => {
    process.env.V5_SEED_NOW = PINNED;
    const seedAt = new Date(PINNED);
    companyId = await createSandbox(seedAt);
    created.push(companyId);
    foreman = {
      userId: seedId(companyId, "user:foreman"),
      companyId,
      name: "Luis Ortega",
      title: "Foreman",
      role: "foreman",
      companyName: "Demo",
      seededAt: seedAt,
      expiresAt: null,
    };
  }, 120_000);

  afterAll(async () => {
    if (prevSeed === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeed;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("reset, submit tomorrow, and pour updateLine share Cedar's job-zone plan", async () => {
    const seedAt = new Date(PINNED);
    const tz = timeZoneForJob();
    const today = planDateToday(seedAt, tz);
    const tomorrow = addCalendarDays(today, 1);
    expect(today).toBe("2026-10-25");
    expect(tomorrow).toBe("2026-10-26");

    await resetSandbox(companyId, seedAt);

    const cedarId = seedId(companyId, "plan:cedar:tomorrow");
    const [cedar] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, cedarId))
      .limit(1);
    expect(cedar?.planDate).toBe(tomorrow);
    expect(cedar?.status).toBe("draft");

    const submitRoute = route("Submit tomorrow's plan", [
      {
        number: "25-031",
        name: "Cedar Creek Bridge Replacement",
        shortName: "Cedar Creek Bridge",
      },
    ]);
    expect(submitRoute).not.toBeNull();
    expect(submitRoute!.action).toBe("dailyPlan.submit");
    const submit = await run(
      foreman,
      "Submit tomorrow's plan",
      submitRoute!.action,
      submitRoute!.args,
    );
    expect(submit.result.refused).toBeFalsy();
    expect(submit.result.summary).toMatch(/Issued Bridge Crew 2/i);

    const [afterSubmit] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, cedarId))
      .limit(1);
    expect(afterSubmit?.status).toBe("issued");
    expect(afterSubmit?.planDate).toBe(tomorrow);

    // Reset restores draft on the same plan date.
    await resetSandbox(companyId, seedAt);
    const [afterReset] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, cedarId))
      .limit(1);
    expect(afterReset?.status).toBe("draft");
    expect(afterReset?.planDate).toBe(tomorrow);

    // 5.1.0-d: linked line activity text is the schedule name ("Pier columns").
    const pourRoute = route("Change pier columns to 80 man-hours", [
      {
        number: "25-031",
        name: "Cedar Creek Bridge Replacement",
        shortName: "Cedar Creek Bridge",
      },
    ]);
    expect(pourRoute).not.toBeNull();
    expect(pourRoute!.action).toBe("dailyPlan.updateLine");
    const pour = await run(
      foreman,
      "Change pier columns to 80 man-hours",
      pourRoute!.action,
      pourRoute!.args,
    );
    expect(pour.result.summary).not.toMatch(/Which line do you mean/i);
    expect(pour.result.summary).toMatch(/man-hours 60 → 80|60 → 80/i);

    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const [line] = await db!
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.id, pourLineId))
      .limit(1);
    // 60 → 80 MH at 10 h rebalances workers 6 → 8 (hours unchanged).
    expect(line?.planId).toBe(cedarId);
    expect(line?.workers).toBe(8);
    expect(line?.hoursTenths).toBe(100);
    expect(manHoursOf(line!)).toBe(80);
  }, 120_000);
});
