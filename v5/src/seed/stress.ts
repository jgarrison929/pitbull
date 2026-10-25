// Stress WBS: 10 divisions × 10 groups × 100 leaves = 10,000 leaf cost codes (+ 110 summaries).
// Used by the perf harness, optional V5_SEED_STRESS=1 local seed, and ensureStressJob (e2e).
import type { costItems, dailyPlanEvents } from "@/db/schema";
import { plugLabor, valueSetColumns } from "@/lib/budget";
import { plannedValueCents } from "@/lib/ev";
import { seedId, type WorkSeedPatch } from "./index";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

export const STRESS_JOB_NUMBER = "99-010";
export const STRESS_LEAF_COUNT = 10_000;
/** Outside the first-40 typeahead slice (01-01-001…); used by e2e. */
export const STRESS_OUTSIDE_SLICE_CODE = "05-05-050";

/** Same WorkSeedPatch shape appendWorkSeed / insertWork consume — no one-off keys. */
export type StressRows = WorkSeedPatch &
  Required<
    Pick<
      WorkSeedPatch,
      | "jobs"
      | "costItems"
      | "crews"
      | "dailyPlans"
      | "dailyPlanEvents"
      | "dailyPlanLines"
    >
  >;

/**
 * Builds one hierarchical job with exactly STRESS_LEAF_COUNT leaves under
 * 10 × 10 summary nodes. Money fields are tiny deterministic stubs so roll-ups
 * stay cheap to reason about in perf tests.
 *
 * Includes a draft foreman plan with a line on STRESS_OUTSIDE_SLICE_CODE so e2e
 * can open the typeahead past the first-40 initial options.
 */
export function seedStressJob(companyId: string, today: Date): StressRows {
  const id = (key: string) => seedId(companyId, key);
  const jobId = id("job:stress");
  const start = isoDate(addDays(today, -100));
  const finish = isoDate(addDays(today, 100));
  const items: Insert<typeof costItems>[] = [];
  let outsideLeafId: string | null = null;
  const empty = valueSetColumns(plugLabor(0), "approved");

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
      forecastMethod: "current_budget" as const,
      budgetQtyMilli: 0,
      installedQtyMilli: 0,
      claimedInstalledQtyMilli: 0,
      ...empty,
      plannedStartOn: start,
      plannedFinishOn: finish,
      plannedCents: 0,
      actualCents: 0,
      lockedActualCents: 0,
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
        forecastMethod: "current_budget" as const,
        budgetQtyMilli: 0,
        installedQtyMilli: 0,
        claimedInstalledQtyMilli: 0,
        ...empty,
        plannedStartOn: start,
        plannedFinishOn: finish,
        plannedCents: 0,
        actualCents: 0,
        lockedActualCents: 0,
        claimedPercentMilli: 0,
        earnDerivation: "summary",
        budgetMhPerUnitMilli: 0,
      });
      for (let L = 0; L < 100; L++) {
        const leafCode = `${groupCode}-${String(L + 1).padStart(3, "0")}`;
        const leafId = id(`stress:leaf:${leafCode}`);
        const budgetCents = 100_00 + ((d * 1000 + g * 100 + L) % 500) * 100;
        const claimedPercentMilli = (L * 7 + g * 3 + d) % 1000;
        // Distinct unit on one leaf so e2e can assert unit-from-pick past slice 40.
        const unit = leafCode === "08-04-077" ? "LF" : "CY";
        if (leafCode === STRESS_OUTSIDE_SLICE_CODE) outsideLeafId = leafId;
        const actualCents = Math.round(
          (budgetCents * claimedPercentMilli) / 1000 / 0.95,
        );
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
          unit,
          evMethod: "units",
          forecastMethod: "current_budget" as const,
          budgetQtyMilli: 1_000_000,
          installedQtyMilli: claimedPercentMilli * 1000,
          claimedInstalledQtyMilli: claimedPercentMilli * 1000,
          ...valueSetColumns(plugLabor(budgetCents), "approved"),
          plannedStartOn: start,
          plannedFinishOn: finish,
          plannedCents: plannedValueCents(budgetCents, start, finish, today),
          actualCents,
          lockedActualCents: actualCents,
          claimedPercentMilli,
          earnDerivation: `units complete (stress)`,
          budgetMhPerUnitMilli: 1000,
        });
      }
    }
  }

  if (!outsideLeafId) {
    throw new Error(`stress seed missing ${STRESS_OUTSIDE_SLICE_CODE}`);
  }

  const planId = id("plan:stress:draft");
  const planDate = isoDate(addDays(today, 1));
  const foremanId = id("user:foreman");
  const stressCrewId = id("crew:stress");

  return {
    jobs: [
      {
        id: jobId,
        companyId,
        number: STRESS_JOB_NUMBER,
        name: "Stress WBS — 10k cost codes",
        shortName: "Stress 10k",
        owner: "Internal perf",
        pmName: "Perf Harness",
        finishOn: isoDate(addDays(today, 200)),
        contractCents: 50_000_000_00,
        estimateStatus: "approved",
      },
    ],
    costItems: items,
    crews: [
      {
        id: stressCrewId,
        companyId,
        name: "Stress Crew",
        foremanId,
        // Expand-window default; stress is not a demo story crew.
        laborRateCents: 8500,
      },
    ],
    dailyPlans: [
      {
        id: planId,
        companyId,
        jobId,
        crew: "Stress Crew",
        crewId: stressCrewId,
        foremanId,
        planDate,
        status: "draft",
        weather: "Clear",
        equipment: [],
        createdById: foremanId,
      },
    ],
    dailyPlanEvents: [
      {
        id: id("plan-event:stress:created"),
        companyId,
        planId,
        kind: "created",
        actorRole: "foreman",
        actorId: foremanId,
        detail: "",
        at: today,
      } satisfies Insert<typeof dailyPlanEvents>,
    ],
    dailyPlanLines: [
      {
        id: id("plan-line:stress:outside"),
        companyId,
        planId,
        costItemId: outsideLeafId,
        activity: "Stress pour outside first-40 slice",
        location: "Area 5",
        qtyMilli: 10_000,
        workers: 4,
        hoursTenths: 80,
        sort: 0,
        notes: "",
      },
    ],
  };
}
