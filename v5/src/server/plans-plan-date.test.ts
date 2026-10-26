/**
 * createDailyPlan / resolvePlanForWrite must use job-zone "today", not UTC.
 * At 00:30Z on a weekday evening PT the two calendars disagree — M4 RED when
 * plans.ts reverts to toISOString().slice(0,10).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, dailyPlans } from "@/db/schema";
import {
  addCalendarDays,
  planDateInWindow,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { seedId } from "@/seed";
import { createDailyPlan, resolvePlanForWrite } from "@/server/plans";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();

/** Weekday evening after UTC midnight (Mon evening PT → Tue 00:30Z). */
const PINNED = "2026-10-27T00:30:00.000Z";

describe.skipIf(!db)("createDailyPlan uses job-zone today", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let superintendent!: CurrentUser;
  let cedarJobId = "";
  let bridgeCrewId = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = PINNED;
    const seedAt = new Date(PINNED);
    companyId = await createSandbox(seedAt);
    created.push(companyId);
    cedarJobId = seedId(companyId, "job:cedar");
    bridgeCrewId = seedId(companyId, "crew:bridge-2");
    superintendent = {
      userId: seedId(companyId, "user:superintendent"),
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
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

  it("window and create target planDateToday, not UTC day, at 00:30Z", async () => {
    const seedAt = new Date(PINNED);
    const tz = timeZoneForJob();
    const laToday = planDateToday(seedAt, tz);
    const utcToday = seedAt.toISOString().slice(0, 10);
    expect(laToday).toBe("2026-10-26");
    expect(utcToday).toBe("2026-10-27");
    expect(laToday).not.toBe(utcToday);

    // LA+15 is outside the job-zone ±14 window but still inside a UTC-today
    // window (UTC is one day ahead). UTC revert accepts this date → M4 RED.
    const farDate = addCalendarDays(laToday, 15);
    expect(planDateInWindow(farDate, laToday)).toBe(false);
    expect(planDateInWindow(farDate, utcToday)).toBe(true);
    const far = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: bridgeCrewId,
      planDate: farDate,
    });
    expect("refused" in far).toBe(true);
    if ("refused" in far) {
      expect(far.refused).toContain(laToday);
      expect(far.refused).not.toContain(`today (${utcToday})`);
    }

    // Cedar already has Bridge Crew 2 on LA-tomorrow; create for LA-today.
    const made = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: bridgeCrewId,
      planDate: laToday,
    });
    expect("refused" in made).toBe(false);
    if ("refused" in made) return;
    expect(made.planId).toBeTruthy();

    const [row] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, made.planId))
      .limit(1);
    expect(row?.planDate).toBe(laToday);

    const resolved = await resolvePlanForWrite(superintendent, {
      job: "25-031",
      crewId: bridgeCrewId,
      // omit date → defaults to job-zone today
    });
    expect(resolved?.plan.id).toBe(made.planId);
    expect(resolved?.plan.planDate).toBe(laToday);
  }, 60_000);
});
