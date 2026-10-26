/**
 * Assistant scopedPlan / dailyPlan.create must use job-zone today (M3b/M3c).
 * Pin weekday evening 00:30Z — UTC todayIso hides I-5's LA-today plan.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, dailyPlans } from "@/db/schema";
import { planDateToday, timeZoneForJob } from "@/lib/plan-date";
import { seedId } from "@/seed";
import { run } from "@/server/assistant/actions";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";

const db = getDb();
const PINNED = "2026-10-27T00:30:00.000Z";

describe.skipIf(!db)("assistant plan dates use job zone at weekday 00:30Z", () => {
  const created: string[] = [];
  const prevSeed = process.env.V5_SEED_NOW;
  let companyId = "";
  let foreman!: CurrentUser;
  let superintendent!: CurrentUser;

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

  it("M3b: implicit-today show finds I-5 plan (scopedPlan todayIso)", async () => {
    const laToday = planDateToday(new Date(PINNED), timeZoneForJob());
    expect(laToday).toBe("2026-10-26");
    // No date arg → scopedPlan filters planDate >= todayIso.
    const shown = await run(
      foreman,
      "Show the plan for 24-077",
      "dailyPlan.show",
      { job: "24-077" },
    );
    expect(shown.result.summary).not.toMatch(/no crew plan/i);
    expect(shown.result.summary).toMatch(/Culvert Crew A/);
    expect(shown.result.summary).toMatch(/Mon, Oct 26/);
  }, 60_000);

  it("M3c: dailyPlan.create date=today writes LA-today", async () => {
    const laToday = planDateToday(new Date(PINNED), timeZoneForJob());
    const utcToday = new Date(PINNED).toISOString().slice(0, 10);
    // Cedar has Bridge Crew 2 on tomorrow only — Interchange is free for today.
    const createdRun = await run(
      superintendent,
      "Plan today on 25-031 for Interchange Crew 1",
      "dailyPlan.create",
      {
        job: "25-031",
        date: "today",
        crew: "Interchange Crew 1",
      },
    );
    expect(createdRun.result.refused).toBeFalsy();
    expect(createdRun.result.summary).toMatch(new RegExp(laToday));

    const rows = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.companyId, companyId));
    const made = rows.find(
      (p) =>
        p.jobId === seedId(companyId, "job:cedar") &&
        p.crewId === seedId(companyId, "crew:interchange-1") &&
        p.planDate === laToday,
    );
    expect(made).toBeTruthy();
    expect(made!.planDate).not.toBe(utcToday);
  }, 60_000);
});
