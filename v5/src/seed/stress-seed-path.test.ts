import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, crews, dailyPlans } from "@/db/schema";
import { seed, WORK_SEED_KEYS } from "@/seed";
import { STRESS_JOB_NUMBER, STRESS_LEAF_COUNT, seedStressJob } from "@/seed/stress";
import { createSandbox } from "@/server/sandbox";

describe("appendWorkSeed / V5_SEED_STRESS path", () => {
  it("stress rows cover every work-seed key insertWork needs for stress", () => {
    const stress = seedStressJob(
      "00000000-0000-4000-8000-000000000099",
      new Date("2026-10-19T00:00:00Z"),
    );
    for (const key of WORK_SEED_KEYS) {
      // Stress only fills the tables it needs; required ones must be present.
      if (
        key === "jobs" ||
        key === "costItems" ||
        key === "crews" ||
        key === "dailyPlans" ||
        key === "dailyPlanEvents" ||
        key === "dailyPlanLines"
      ) {
        expect(stress[key]?.length ?? 0, key).toBeGreaterThan(0);
      }
    }
    expect(stress.crews![0]!.name).toBe("Stress Crew");
    expect(stress.dailyPlans![0]!.crewId).toBe(stress.crews![0]!.id);
  });

  it("seed(V5_SEED_STRESS=1) includes stress crews before plans", () => {
    const prev = process.env.V5_SEED_STRESS;
    process.env.V5_SEED_STRESS = "1";
    try {
      const rows = seed(
        "00000000-0000-4000-8000-000000000098",
        new Date("2026-10-19T00:00:00Z"),
      );
      expect(rows.crews.map((c) => c.name)).toEqual(
        expect.arrayContaining([
          "Bridge Crew 2",
          "Culvert Crew A",
          "Interchange Crew 1",
          "Stress Crew",
        ]),
      );
      expect(rows.jobs.some((j) => j.number === STRESS_JOB_NUMBER)).toBe(true);
      const stressLeaves = rows.costItems.filter(
        (c) =>
          c.isLeaf &&
          rows.jobs.find((j) => j.id === c.jobId)?.number === STRESS_JOB_NUMBER,
      );
      expect(stressLeaves).toHaveLength(STRESS_LEAF_COUNT);
      const stressCrew = rows.crews.find((c) => c.name === "Stress Crew")!;
      expect(
        rows.dailyPlans.some((p) => p.crewId === stressCrew.id),
      ).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.V5_SEED_STRESS;
      else process.env.V5_SEED_STRESS = prev;
    }
  });
});

describe("V5_SEED_STRESS=1 createSandbox (FK)", () => {
  const db = getDb();
  const created: string[] = [];

  afterAll(async () => {
    if (!db || !created.length) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  });

  it.skipIf(!db)(
    "inserts stress crews and plans without FK errors",
    async () => {
      const prev = process.env.V5_SEED_STRESS;
      process.env.V5_SEED_STRESS = "1";
      let companyId: string;
      try {
        companyId = await createSandbox(new Date("2026-10-19T00:00:00Z"));
      } finally {
        if (prev === undefined) delete process.env.V5_SEED_STRESS;
        else process.env.V5_SEED_STRESS = prev;
      }
      created.push(companyId);

      const crewRows = await db!
        .select()
        .from(crews)
        .where(eq(crews.companyId, companyId));
      expect(crewRows.map((c) => c.name).sort()).toEqual([
        "Bridge Crew 2",
        "Culvert Crew A",
        "Interchange Crew 1",
        "Stress Crew",
      ]);

      const plans = await db!
        .select()
        .from(dailyPlans)
        .where(eq(dailyPlans.companyId, companyId));
      // 30 working days × 3 jobs + Cedar tomorrow + I-5 today + SR-99 reported + stress draft.
      expect(plans).toHaveLength(30 * 3 + 3 + 1);
      expect(plans.every((p) => p.crewId)).toBe(true);
      const stressCrew = crewRows.find((c) => c.name === "Stress Crew")!;
      expect(plans.some((p) => p.crewId === stressCrew.id)).toBe(true);
    },
    120_000,
  );
});
