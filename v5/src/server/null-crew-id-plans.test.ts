import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, jobs, users } from "@/db/schema";
import { calendarDateInTz } from "@/lib/plan-date";
import { seedId } from "@/seed";
import { run } from "@/server/assistant/actions";
import { getPlansForJob } from "@/server/data";
import { seedNow } from "@/server/seed-clock";
import type { CurrentUser } from "@/server/session";

/**
 * After 0013, pre-0013 writers insert plans with crew_id NULL. The new build
 * must still surface those plans (LEFT JOIN + coalesce to text crew).
 */
describe("null crew_id plans remain readable", () => {
  const db = getDb();
  const created: string[] = [];
  const prevSeedNow = process.env.V5_SEED_NOW;

  beforeAll(() => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
  });

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    if (!db || !created.length) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  });

  it.skipIf(!db)(
    "getPlansForJob and dailyPlan.show use text crew when crew_id is null",
    async () => {
      const companyId = crypto.randomUUID();
      created.push(companyId);
      const today = new Date("2026-10-20T17:00:00.000Z");
      // Working-rail filter is planDate >= seedNow() today — put the fixture there.
      const planDate = calendarDateInTz(seedNow());
      const foremanId = seedId(companyId, "user:foreman");
      const jobId = seedId(companyId, "job:null-crew");
      const planId = seedId(companyId, "plan:null-crew");
      const jobNumber = "99-040";

      await db!.insert(companies).values({
        id: companyId,
        name: "Null Crew Co",
        isSandbox: true,
        seededAt: today,
      });
      await db!.insert(users).values({
        id: foremanId,
        companyId,
        name: "Luis Ortega",
        title: "Foreman",
        role: "foreman",
      });
      await db!.insert(jobs).values({
        id: jobId,
        companyId,
        number: jobNumber,
        name: "Null Crew Job",
        shortName: "Null Crew",
        owner: "Test",
        pmName: "PM",
        finishOn: "2027-01-01",
        contractCents: 1,
        estimateStatus: "approved",
      });

      // Pre-0013 shape: text crew only, no crew_id.
      await db!.execute(sql`
        INSERT INTO daily_plans (
          id, company_id, job_id, crew, foreman_id, plan_date, weather, status
        ) VALUES (
          ${planId}::uuid,
          ${companyId}::uuid,
          ${jobId}::uuid,
          'Bridge Crew 2',
          ${foremanId}::uuid,
          ${planDate},
          '',
          'draft'
        )
      `);

      const plans = await getPlansForJob(companyId, jobId);
      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe(planId);
      expect(plans[0].crew).toBe("Bridge Crew 2");
      expect(plans[0].crewId).toBeNull();
      expect(plans[0].planDate).toBe(planDate);

      const user: CurrentUser = {
        userId: foremanId,
        companyId,
        name: "Luis Ortega",
        title: "Foreman",
        role: "foreman",
        companyName: "Null Crew Co",
        seededAt: today,
        expiresAt: null,
      };
      // Job-only show (implicit today) must still read the null-crew row.
      const shown = await run(user, "Show the plan for 99-040", "dailyPlan.show", {
        job: jobNumber,
      });
      expect(shown.result.refused).toBeFalsy();
      expect(shown.result.summary).toMatch(/Bridge Crew 2/);
      expect(shown.result.summary).not.toMatch(/There is no crew plan/);
      expect(shown.summary).toMatch(/Bridge Crew 2/);
    },
  );
});
