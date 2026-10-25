/**
 * After insertWork / resetSandbox changes, seeded work rows must stay
 * byte-for-byte identical to the pure seed() bag (same plans, lines, statuses,
 * labor rows and sums).
 */
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  companies,
  costEntries,
  crews,
  dailyPlanLines,
  dailyPlans,
  jobs,
} from "@/db/schema";
import { seed } from "@/seed";
import { createSandbox, resetSandbox } from "./sandbox";
import { seedNow } from "./seed-clock";

const db = getDb();

/** Stable JSON for hashing — Date → ISO, keys sorted. */
function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

describe.skipIf(!db)("reset seed identity (byte-for-byte)", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "DB work rows after reset match seed() for plans, lines, and labor",
    async () => {
      const seedAt = seedNow();
      const companyId = await createSandbox(seedAt);
      created.push(companyId);
      await resetSandbox(companyId, seedAt);

      const expected = seed(companyId, seedAt);
      // seed() includes baked history (I-5 issued, COs, locks). Field-history
      // approved plans + their labor rows must stay identical to seed().
      const expApproved = [...expected.dailyPlans]
        .filter((p) => p.status === "approved")
        .sort((a, b) => a.id.localeCompare(b.id));
      const approvedIds = new Set(expApproved.map((p) => p.id));
      const expLines = [...expected.dailyPlanLines]
        .filter((l) => approvedIds.has(l.planId))
        .sort((a, b) => a.id.localeCompare(b.id));
      const expLabor = expected.costEntries
        .filter((e) => e.kind === "labor" && e.sourcePlanLineId)
        .filter((e) =>
          expLines.some((l) => l.id === e.sourcePlanLineId),
        )
        .sort((a, b) => a.id!.localeCompare(b.id!));

      const dbPlans = await db!
        .select()
        .from(dailyPlans)
        .where(
          and(
            eq(dailyPlans.companyId, companyId),
            eq(dailyPlans.status, "approved"),
          ),
        )
        .orderBy(asc(dailyPlans.id));
      const dbLines = await db!
        .select()
        .from(dailyPlanLines)
        .where(eq(dailyPlanLines.companyId, companyId))
        .orderBy(asc(dailyPlanLines.id));
      const dbLinesApproved = dbLines.filter((l) => approvedIds.has(l.planId));
      const dbLabor = await db!
        .select()
        .from(costEntries)
        .where(
          and(
            eq(costEntries.companyId, companyId),
            eq(costEntries.kind, "labor"),
          ),
        )
        .orderBy(asc(costEntries.id));
      const dbLaborHist = dbLabor.filter((e) =>
        expLines.some((l) => l.id === e.sourcePlanLineId),
      );
      const dbCrews = await db!
        .select()
        .from(crews)
        .where(eq(crews.companyId, companyId))
        .orderBy(asc(crews.id));
      const dbJobs = await db!
        .select({
          id: jobs.id,
          number: jobs.number,
          estimateStatus: jobs.estimateStatus,
        })
        .from(jobs)
        .where(eq(jobs.companyId, companyId))
        .orderBy(asc(jobs.number));

      expect(fingerprint(dbPlans)).toBe(fingerprint(expApproved));
      expect(fingerprint(dbLinesApproved)).toBe(fingerprint(expLines));
      expect(fingerprint(dbLaborHist)).toBe(fingerprint(expLabor));

      expect(dbPlans).toHaveLength(expApproved.length);
      expect(dbLinesApproved).toHaveLength(expLines.length);
      expect(dbLaborHist).toHaveLength(expLabor.length);

      const laborSum = dbLaborHist.reduce((s, e) => s + e.amountCents, 0);
      const expLaborSum = expLabor.reduce((s, e) => s + e.amountCents, 0);
      expect(laborSum).toBe(expLaborSum);

      expect(dbCrews.map((c) => c.id).sort()).toEqual(
        expected.crews.map((c) => c.id).sort(),
      );
      expect(dbJobs.map((j) => j.number).sort()).toEqual(
        expected.jobs.map((j) => j.number).sort(),
      );
    },
    60_000,
  );
});
