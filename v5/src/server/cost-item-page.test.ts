import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costEntries, costItems, dailyPlans } from "@/db/schema";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { seedId } from "@/seed";
import { jobChanges, jobChangesCount } from "./assistant/actions";
import { getCostItemPage } from "./cost-item-page";
import { laborMhMilliByCostItem } from "./cost-rollups";
import { getJob } from "./data";
import { getPlanPage } from "./plan-page";
import {
  approveDailyReport,
  lockProgressClaim,
  submitDailyReport,
} from "./progress";
import { createSandbox } from "./sandbox";

const db = getDb();
const created: string[] = [];

describe.skipIf(!db)("Part C drill-down loaders", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it(
    "posted total equals rollup AC; hides approved-qty markers",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const page = await getCostItemPage(companyId, "25-031", "04-210");
      expect(page).not.toBeNull();
      expect(page!.item.code).toBe("04-210");
      expect(page!.entries.length).toBeGreaterThan(0);
      expect(page!.postedTotalCents).toBe(page!.rollup.actualCents);
      expect(page!.entriesTotalCents).toBe(page!.rollup.actualCents);
      expect(
        page!.entries.some(
          (e) => e.kind === "other" && e.note === "approved-qty",
        ),
      ).toBe(false);
      expect(page!.hasLaborEntries).toBe(true);
      const labor = page!.entries.filter((e) => e.kind === "labor");
      expect(labor.length).toBeGreaterThan(0);
      for (const row of labor) {
        expect(row.rateCents).toBeTruthy();
        expect(row.amountCents).toBe(
          Math.round(row.manHours * (row.rateCents ?? 0)),
        );
      }
    },
    30_000,
  );

  it(
    "empty labor copy target 05-120 has no labor rows",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const page = await getCostItemPage(companyId, "25-031", "05-120");
      expect(page).not.toBeNull();
      expect(page!.hasLaborEntries).toBe(false);
      expect(
        page!.entries.filter((e) => e.kind === "labor"),
      ).toHaveLength(0);
    },
    30_000,
  );

  it(
    "plan page is read-only detail with lines; invalid id is null",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const planId = seedId(companyId, "plan:cedar:tomorrow");
      const page = await getPlanPage(companyId, "25-031", planId);
      expect(page).not.toBeNull();
      expect(page!.plan.crew).toBe("Bridge Crew 2");
      expect(page!.lines.length).toBe(3);
      expect(page!.lines.map((l) => l.code)).toContain("04-210");
      expect(page!.plan.rateCents).toBe(CREW_LABOR_RATE_CENTS["Bridge Crew 2"]);

      await expect(getPlanPage(companyId, "25-031", "not-a-uuid")).resolves.toBeNull();
      await expect(
        getPlanPage(
          companyId,
          "25-031",
          "00000000-0000-4000-8000-000000000099",
        ),
      ).resolves.toBeNull();
    },
    30_000,
  );

  it(
    "cost entries are newest first (fails if oldest-first)",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const page = await getCostItemPage(companyId, "25-031", "04-210");
      expect(page).not.toBeNull();
      expect(page!.entries.length).toBeGreaterThan(1);
      const ats = page!.entries.map((e) => e.at);
      for (let i = 1; i < ats.length; i++) {
        expect(
          ats[i - 1]! >= ats[i]!,
          `expected newest-first; index ${i - 1} ${ats[i - 1]} before ${ats[i]}`,
        ).toBe(true);
      }
      const oldestFirst = [...ats].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(ats).not.toEqual(oldestFirst);
    },
    30_000,
  );

  it(
    "after approve: posted total stays rollup AC; since-lock holds new labor",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const planId = seedId(companyId, "plan:cedar:tomorrow");
      const pourLineId = seedId(companyId, "plan-line:cedar:0");
      const pourItemId = seedId(companyId, "cost:cedar:04-210");
      const superId = seedId(companyId, "user:superintendent");
      const pmId = seedId(companyId, "user:pm");

      const before = await getCostItemPage(companyId, "25-031", "04-210");
      expect(before!.sinceLockCents).toBe(0);
      const acBefore = before!.rollup.actualCents;

      await requireDb()
        .update(dailyPlans)
        .set({ status: "issued" })
        .where(eq(dailyPlans.id, planId));

      await submitDailyReport(
        companyId,
        planId,
        { [pourLineId]: { manHours: 22, qtyMilli: 12_000 } },
        { userId: seedId(companyId, "user:foreman"), role: "foreman" },
      );
      const approve = await approveDailyReport(companyId, planId, { userId: superId, role: "superintendent" });
      expect(approve.ok).toBe(true);

      const after = await getCostItemPage(companyId, "25-031", "04-210");
      expect(after!.postedTotalCents).toBe(after!.rollup.actualCents);
      expect(after!.postedTotalCents).toBe(acBefore);
      expect(after!.sinceLockCents).toBeGreaterThan(0);
      expect(after!.entries.some((e) => e.sinceLock)).toBe(true);
      expect(
        after!.entries.some(
          (e) => e.kind === "other" && e.note === "approved-qty",
        ),
      ).toBe(false);

      const [item] = await requireDb()
        .select()
        .from(costItems)
        .where(eq(costItems.id, pourItemId));
      // Live actual moved; locked/rollup AC did not.
      expect(item.actualCents).toBeGreaterThan(item.lockedActualCents);
      expect(after!.rollup.actualCents).toBe(item.lockedActualCents);
      const pendingLabor = after!.entries.find(
        (e) => e.sinceLock && e.kind === "labor",
      );
      expect(pendingLabor).toBeTruthy();

      const relock = await lockProgressClaim(
        companyId,
        seedId(companyId, "job:cedar"),
        pmId,
      );
      expect(relock.ok).toBe(true);
      const flipped = await getCostItemPage(companyId, "25-031", "04-210");
      expect(flipped!.sinceLockCents).toBe(0);
      expect(flipped!.postedTotalCents).toBe(item.actualCents);
      expect(flipped!.entries.find((e) => e.id === pendingLabor!.id)?.sinceLock).toBe(
        false,
      );
      const through = flipped!.entries.reduce((s, e) => s + e.amountCents, 0);
      expect(through).toBe(flipped!.postedTotalCents);
      expect(flipped!.actualMhMilli).toBeGreaterThan(after!.actualMhMilli);
    },
    60_000,
  );

  it(
    "plan dated on the lock day stays pending until the next lock (24-077 03-210)",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const planId = seedId(companyId, "plan:i5:today");
      const lineId = seedId(companyId, "plan-line:i5:0");
      const superId = seedId(companyId, "user:superintendent");
      const pmId = seedId(companyId, "user:pm");

      const before = await getCostItemPage(companyId, "24-077", "03-210");
      expect(before!.sinceLockCents).toBe(0);
      const acBefore = before!.postedTotalCents;
      const mhBefore = before!.actualMhMilli;
      const throughBefore = before!.entries
        .filter((e) => !e.sinceLock)
        .reduce((s, e) => s + e.amountCents, 0);
      expect(throughBefore).toBe(acBefore);

      await submitDailyReport(
        companyId,
        planId,
        { [lineId]: { manHours: 42, qtyMilli: 175_000 } },
        { userId: seedId(companyId, "user:foreman"), role: "foreman" },
      );
      const approved = await approveDailyReport(companyId, planId, { userId: superId, role: "superintendent" });
      expect(approved.ok).toBe(true);

      const posted = 42 * CREW_LABOR_RATE_CENTS["Culvert Crew A"];
      const after = await getCostItemPage(companyId, "24-077", "03-210");
      expect(after!.postedTotalCents).toBe(acBefore);
      expect(after!.rollup.actualCents).toBe(acBefore);
      expect(after!.sinceLockCents).toBe(posted);
      expect(after!.actualMhMilli).toBe(mhBefore);
      expect(after!.pendingMhMilli).toBe(42_000);
      const pending = after!.entries.filter((e) => e.sinceLock);
      expect(pending.some((e) => e.kind === "labor" && e.amountCents === posted)).toBe(
        true,
      );
      const through = after!.entries
        .filter((e) => !e.sinceLock)
        .reduce((s, e) => s + e.amountCents, 0);
      expect(through).toBe(after!.postedTotalCents);
      expect(
        after!.entries.some((e) => e.kind === "other" && e.note === "approved-qty"),
      ).toBe(false);

      const locked = await lockProgressClaim(
        companyId,
        seedId(companyId, "job:i5"),
        pmId,
      );
      expect(locked.ok).toBe(true);

      const relocked = await getCostItemPage(companyId, "24-077", "03-210");
      expect(relocked!.sinceLockCents).toBe(0);
      expect(relocked!.postedTotalCents).toBe(acBefore + posted);
      expect(relocked!.actualMhMilli).toBe(mhBefore + 42_000);
      expect(relocked!.pendingMhMilli).toBe(0);
      expect(relocked!.entries.every((e) => !e.sinceLock)).toBe(true);
      const throughAfter = relocked!.entries.reduce((s, e) => s + e.amountCents, 0);
      expect(throughAfter).toBe(relocked!.postedTotalCents);
    },
    60_000,
  );

  it(
    "every 24-077 leaf actual MH matches the job map through unlock and relock",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const job = await getJob(companyId, "24-077");
      expect(job).not.toBeNull();
      const jobId = job!.job.id;
      const leaves = job!.items.filter((item) => item.isLeaf);
      expect(leaves.length).toBeGreaterThan(1);
      const zero = { lockedMhMilli: 0, pendingMhMilli: 0 };

      async function assertMatch(label: string) {
        const byItem = await laborMhMilliByCostItem(companyId, jobId);
        for (const leaf of leaves) {
          const page = await getCostItemPage(companyId, "24-077", leaf.code);
          expect(page, `${label} ${leaf.code}`).not.toBeNull();
          const split = byItem.get(leaf.id) ?? zero;
          expect(page!.actualMhMilli, `${label} ${leaf.code}`).toBe(
            split.lockedMhMilli,
          );
          expect(page!.pendingMhMilli, `${label} ${leaf.code}`).toBe(
            split.pendingMhMilli,
          );
        }
        return byItem;
      }

      const before = await assertMatch("locked");
      const beforeTotal = [...before.values()].reduce(
        (sum, split) => sum + split.lockedMhMilli + split.pendingMhMilli,
        0,
      );
      expect(beforeTotal).toBeGreaterThan(0);
      const basins = leaves.find((leaf) => leaf.code === "07-300");
      const trench = leaves.find((leaf) => leaf.code === "03-210");
      expect(basins).toBeTruthy();
      expect(trench).toBeTruthy();
      expect(before.get(basins!.id)!.lockedMhMilli).toBeGreaterThan(0);
      expect(before.get(trench!.id)!.lockedMhMilli).toBeGreaterThan(0);

      // Drop the period's lock stamp. Hours stay on the entries; they are pending.
      await requireDb()
        .update(costEntries)
        .set({ lockedInAt: null })
        .where(
          and(
            eq(costEntries.companyId, companyId),
            inArray(
              costEntries.costItemId,
              leaves.map((leaf) => leaf.id),
            ),
          ),
        );

      const unlocked = await assertMatch("unlocked");
      for (const leaf of leaves) {
        expect(unlocked.get(leaf.id)?.lockedMhMilli ?? 0, leaf.code).toBe(0);
      }

      const relock = await lockProgressClaim(
        companyId,
        jobId,
        seedId(companyId, "user:pm"),
      );
      expect(relock.ok).toBe(true);

      const after = await assertMatch("relocked");
      let relockedTotal = 0;
      for (const split of after.values()) {
        relockedTotal += split.lockedMhMilli;
        expect(split.pendingMhMilli).toBe(0);
      }
      expect(relockedTotal).toBe(beforeTotal);
    },
    60_000,
  );

  it(
    "job changes paginate with offset and count",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const total = await jobChangesCount(companyId, "25-031");
      expect(total).toBeGreaterThan(0);
      const first = await jobChanges(companyId, "25-031", 2, 0);
      const second = await jobChanges(companyId, "25-031", 2, 2);
      expect(first).toHaveLength(2);
      expect(second.length).toBeGreaterThan(0);
      expect(first[0]!.id).not.toBe(second[0]!.id);
      const all = await jobChanges(companyId, "25-031", 100, 0);
      expect(all.length).toBe(total);
    },
    30_000,
  );
});
