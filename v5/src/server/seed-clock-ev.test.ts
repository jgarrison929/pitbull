import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { companies, costItems, jobs, progressClaims } from "@/db/schema";
import { currentBudgetCents } from "@/lib/budget";
import { plannedValueCents } from "@/lib/ev";
import { getPortfolio } from "@/server/data";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import { seedId } from "@/seed";

const db = getDb();
const created: string[] = [];

/** Owner-accepted SPI after PV cutoff moves to the seed calendar (V5_SEED_NOW). */
const ACCEPTED_SPI = {
  portfolio: 1.09,
  "24-077": 0.91,
  "24-118": 1.14,
  "25-031": 1.1,
} as const;

/**
 * Visual baselines drift after UTC midnight when Period 1 locks stamp
 * lockedAt from the wall clock. With V5_SEED_NOW fixed, seeded EV must not.
 */
describe.skipIf(!db)("seed clock earned value", () => {
  const prev = process.env.V5_SEED_NOW;

  afterEach(() => {
    if (prev === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prev;
  });

  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it(
    "must-fail: SPI/PV identical at wall 10-24 23:50Z and 10-27 under fixed V5_SEED_NOW",
    async () => {
      process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
      const frozen = seedNow();
      expect(frozen.toISOString()).toBe("2026-10-20T17:00:00.000Z");

      const companyId = await createSandbox();
      created.push(companyId);

      const locked = await db!
        .select({
          lockedAt: progressClaims.lockedAt,
          jobNumber: jobs.number,
        })
        .from(progressClaims)
        .innerJoin(jobs, eq(jobs.id, progressClaims.jobId))
        .where(
          and(
            eq(progressClaims.companyId, companyId),
            eq(progressClaims.status, "locked"),
          ),
        );
      expect(locked.length).toBe(3);
      for (const row of locked) {
        expect(row.lockedAt?.toISOString()).toBe(frozen.toISOString());
      }

      // Verify-proven wall instants (same suite green/red on main).
      const wallA = new Date("2026-10-24T23:50:00.000Z");
      const wallB = new Date("2026-10-27T09:30:00.000Z");
      const a = await getPortfolio(companyId, wallA);
      const b = await getPortfolio(companyId, wallB);

      // Default read path (seedNow) matches both wall-asOf snapshots for locked EV.
      const viaSeed = await getPortfolio(companyId);
      expect(viaSeed.totals.spi).toBe(a.totals.spi);
      expect(viaSeed.totals.plannedCents).toBe(a.totals.plannedCents);

      expect(a.totals.spi).toBe(b.totals.spi);
      expect(a.totals.plannedCents).toBe(b.totals.plannedCents);
      expect(a.totals.spi).toBeCloseTo(ACCEPTED_SPI.portfolio, 2);

      for (const num of ["24-077", "24-118", "25-031"] as const) {
        const ja = a.jobs.find((j) => j.job.number === num)!;
        const jb = b.jobs.find((j) => j.job.number === num)!;
        expect(ja.spi).toBe(jb.spi);
        expect(ja.plannedCents).toBe(jb.plannedCents);
        expect(ja.scheduleVarianceCents).toBe(jb.scheduleVarianceCents);
        expect(ja.spi).toBeCloseTo(ACCEPTED_SPI[num], 2);
      }

      // CO-003 leaf on 24-118: plannedStartOn is seed day, not wall.
      const coLeaf = await db!
        .select({
          plannedStartOn: costItems.plannedStartOn,
        })
        .from(costItems)
        .where(eq(costItems.id, seedId(companyId, "cost:24-118:91-300")))
        .limit(1);
      // seed id scheme may differ — fall back to code lookup
      const [leaf] =
        coLeaf.length > 0
          ? coLeaf
          : await db!
              .select({ plannedStartOn: costItems.plannedStartOn })
              .from(costItems)
              .innerJoin(jobs, eq(jobs.id, costItems.jobId))
              .where(
                and(
                  eq(jobs.companyId, companyId),
                  eq(jobs.number, "24-118"),
                  eq(costItems.code, "91-300"),
                ),
              )
              .limit(1);
      expect(leaf?.plannedStartOn).toBe("2026-10-20");

      // Prove main's wall-cutoff behavior would diverge across these two days:
      // sum leaf PV as-of wallA vs wallB (what lockedAt=wall would have done).
      const cedar = a.jobs.find((j) => j.job.number === "25-031")!;
      const leaves = await db!
        .select()
        .from(costItems)
        .where(
          and(eq(costItems.jobId, cedar.job.id), eq(costItems.isLeaf, true)),
        );
      const pvWall = (asOf: Date) =>
        leaves.reduce(
          (s, l) =>
            s +
            plannedValueCents(
              currentBudgetCents(l),
              l.plannedStartOn,
              l.plannedFinishOn,
              asOf,
            ),
          0,
        );
      expect(pvWall(wallA)).not.toBe(pvWall(wallB));
      // Seeded planned matches seed-day cutoff, not either wall day.
      expect(cedar.plannedCents).toBe(pvWall(frozen));
      expect(cedar.plannedCents).not.toBe(pvWall(wallA));
    },
    60_000,
  );

  it(
    "createSandbox(seedAt) locks Period 1 at seedAt even when V5_SEED_NOW is unset",
    async () => {
      delete process.env.V5_SEED_NOW;
      const seedAt = new Date("2026-06-15T12:00:00.000Z");
      const companyId = await createSandbox(seedAt);
      created.push(companyId);

      const locked = await db!
        .select({ lockedAt: progressClaims.lockedAt })
        .from(progressClaims)
        .where(
          and(
            eq(progressClaims.companyId, companyId),
            eq(progressClaims.status, "locked"),
          ),
        );
      expect(locked.length).toBe(3);
      for (const row of locked) {
        expect(row.lockedAt?.toISOString()).toBe(seedAt.toISOString());
      }
    },
    60_000,
  );
});
