// Stress WBS: 10 divisions × 10 groups × 100 leaves = 10,000 leaf cost codes (+ 110 summaries).
// Used by the perf harness; not part of the default demo sandbox (keeps sign-in fast).
import type { costItems, jobs } from "@/db/schema";
import { plannedValueCents } from "@/lib/ev";
import { seedId } from "./index";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

export const STRESS_JOB_NUMBER = "99-010";
export const STRESS_LEAF_COUNT = 10_000;

export type StressRows = {
  job: Insert<typeof jobs>;
  costItems: Insert<typeof costItems>[];
};

/**
 * Builds one hierarchical job with exactly STRESS_LEAF_COUNT leaves under
 * 10 × 10 summary nodes. Money fields are tiny deterministic stubs so roll-ups
 * stay cheap to reason about in perf tests.
 */
export function seedStressJob(companyId: string, today: Date): StressRows {
  const id = (key: string) => seedId(companyId, key);
  const jobId = id("job:stress");
  const start = isoDate(addDays(today, -100));
  const finish = isoDate(addDays(today, 100));
  const items: Insert<typeof costItems>[] = [];

  for (let d = 0; d < 10; d++) {
    const divCode = `${String(d + 1).padStart(2, "0")}`;
    const divId = id(`stress:div:${divCode}`);
    const divPath = `/${divCode}/`;
    items.push({
      id: divId,
      companyId,
      jobId,
      parentId: null,
      path: divPath,
      depth: 0,
      isLeaf: false,
      code: divCode,
      description: `Division ${divCode}`,
      unit: "LS",
      evMethod: "units",
      budgetQtyMilli: 0,
      installedQtyMilli: 0,

      claimedInstalledQtyMilli: 0,
      budgetCents: 0,
      plannedStartOn: start,
      plannedFinishOn: finish,
      plannedCents: 0,
      actualCents: 0,
      claimedPercentMilli: 0,
      earnDerivation: "summary",
      budgetMhPerUnitMilli: 0,
    });
    for (let g = 0; g < 10; g++) {
      const groupCode = `${divCode}-${String(g + 1).padStart(2, "0")}`;
      const groupId = id(`stress:grp:${groupCode}`);
      const groupPath = `${divPath}${groupCode}/`;
      items.push({
        id: groupId,
        companyId,
        jobId,
        parentId: divId,
        path: groupPath,
        depth: 1,
        isLeaf: false,
        code: groupCode,
        description: `Group ${groupCode}`,
        unit: "LS",
        evMethod: "units",
        budgetQtyMilli: 0,
        installedQtyMilli: 0,

        claimedInstalledQtyMilli: 0,
        budgetCents: 0,
        plannedStartOn: start,
        plannedFinishOn: finish,
        plannedCents: 0,
        actualCents: 0,
        claimedPercentMilli: 0,
        earnDerivation: "summary",
        budgetMhPerUnitMilli: 0,
      });
      for (let L = 0; L < 100; L++) {
        const leafCode = `${groupCode}-${String(L + 1).padStart(3, "0")}`;
        const leafId = id(`stress:leaf:${leafCode}`);
        const budgetCents = 100_00 + ((d * 1000 + g * 100 + L) % 500) * 100;
        const claimedPercentMilli = (L * 7 + g * 3 + d) % 1000;
        items.push({
          id: leafId,
          companyId,
          jobId,
          parentId: groupId,
          path: `${groupPath}${leafCode}/`,
          depth: 2,
          isLeaf: true,
          code: leafCode,
          description: `Leaf ${leafCode} activity`,
          unit: "CY",
          evMethod: "units",
          budgetQtyMilli: 1_000_000,
          installedQtyMilli: claimedPercentMilli * 1000,

          claimedInstalledQtyMilli: claimedPercentMilli * 1000,
          budgetCents,
          plannedStartOn: start,
          plannedFinishOn: finish,
          plannedCents: plannedValueCents(budgetCents, start, finish, today),
          actualCents: Math.round(
            (budgetCents * claimedPercentMilli) / 1000 / 0.95,
          ),
          claimedPercentMilli,
          earnDerivation: `units complete (stress)`,
          budgetMhPerUnitMilli: 1000,
        });
      }
    }
  }

  return {
    job: {
      id: jobId,
      companyId,
      number: STRESS_JOB_NUMBER,
      name: "Stress WBS — 10k cost codes",
      shortName: "Stress 10k",
      owner: "Internal perf",
      pmName: "Perf Harness",
      finishOn: isoDate(addDays(today, 200)),
      contractCents: 50_000_000_00,
    },
    costItems: items,
  };
}
