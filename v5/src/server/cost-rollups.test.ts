import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, costItems, jobs } from "@/db/schema";
import { costLine, rollup } from "@/lib/ev";
import { seedStressJob, STRESS_LEAF_COUNT } from "@/seed/stress";
import { jobRollupSql, pathRollupSql, searchCostItems } from "./cost-rollups";

const db = getDb();
const created: string[] = [];

describe("stress seed shape", () => {
  it("builds exactly 10k leaves under a hierarchy", () => {
    const rows = seedStressJob(
      "00000000-0000-4000-8000-000000000099",
      new Date("2026-10-19T00:00:00Z"),
    );
    const leaves = rows.costItems.filter((c) => c.isLeaf);
    const summaries = rows.costItems.filter((c) => !c.isLeaf);
    expect(leaves).toHaveLength(STRESS_LEAF_COUNT);
    expect(summaries).toHaveLength(110);
    expect(rows.job.number).toBe("99-010");
    const r = rollup(
      leaves.map((c) =>
        costLine({
          code: c.code!,
          description: c.description!,
          unit: c.unit!,
          budgetQtyMilli: c.budgetQtyMilli!,
          installedQtyMilli: c.installedQtyMilli!,
          claimedInstalledQtyMilli: c.claimedInstalledQtyMilli ?? 0,
          budgetCents: c.budgetCents!,
          plannedCents: c.plannedCents!,
          actualCents: c.actualCents!,
          budgetMhPerUnitMilli: c.budgetMhPerUnitMilli!,
          claimedPercentMilli: c.claimedPercentMilli ?? 0,
          evMethod: "units",
          earnDerivation: c.earnDerivation ?? "",
        }),
      ),
    );
    expect(r.budgetCents).toBe(leaves.reduce((s, c) => s + c.budgetCents!, 0));
  });
});

describe.skipIf(!db)("SQL roll-up matches leaf sum on stress job", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("rollup and search stay under budgets on 10k leaves", async () => {
    const companyId = crypto.randomUUID();
    created.push(companyId);
    const today = new Date("2026-10-19T00:00:00Z");
    const stress = seedStressJob(companyId, today);
    await db!.insert(companies).values({
      id: companyId,
      name: "Stress",
      isSandbox: true,
      seededAt: today,
    });
    await db!.insert(jobs).values(stress.job);
    const items = stress.costItems;
    for (let i = 0; i < items.length; i += 500) {
      await db!.insert(costItems).values(items.slice(i, i + 500));
    }

    const t0 = performance.now();
    const sqlRoll = await jobRollupSql(companyId, stress.job.id!, today);
    const rollMs = performance.now() - t0;
    expect(rollMs).toBeLessThan(500);

    const leaves = items.filter((c) => c.isLeaf);
    expect(sqlRoll.budgetCents).toBe(
      leaves.reduce((s, c) => s + c.budgetCents!, 0),
    );
    const jsEarned = leaves.reduce(
      (s, c) =>
        s +
        Math.round(
          (c.budgetCents! * (c.claimedInstalledQtyMilli ?? 0)) /
            (c.budgetQtyMilli || 1),
        ),
      0,
    );
    expect(sqlRoll.earnedCents).toBe(jsEarned);

    const t1 = performance.now();
    const found = await searchCostItems(
      companyId,
      stress.job.id!,
      "01-01-001",
      20,
    );
    const searchMs = performance.now() - t1;
    expect(searchMs).toBeLessThan(300);
    expect(found.some((r) => r.code === "01-01-001")).toBe(true);

    const path = await pathRollupSql(companyId, stress.job.id!, "/01/", today);
    expect(path.budgetCents).toBe(
      leaves
        .filter((c) => c.path!.startsWith("/01/"))
        .reduce((s, c) => s + c.budgetCents!, 0),
    );
  }, 120_000);
});
