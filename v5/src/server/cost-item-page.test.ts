import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costItems, dailyPlans } from "@/db/schema";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { seedId } from "@/seed";
import { jobChanges, jobChangesCount } from "./assistant/actions";
import { getCostItemPage } from "./cost-item-page";
import { lockedActualMhMilliByCostItem } from "./cost-rollups";
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
    "locked MH on 24-077 matches the cost-item page for 07-300 and 03-210",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);
      const job = await getJob(companyId, "24-077");
      expect(job).not.toBeNull();
      const byItem = await lockedActualMhMilliByCostItem(
        companyId,
        job!.job.id,
      );
      for (const code of ["07-300", "03-210"]) {
        const page = await getCostItemPage(companyId, "24-077", code);
        expect(page, code).not.toBeNull();
        expect(byItem.get(page!.item.id) ?? 0, code).toBe(page!.actualMhMilli);
        expect(page!.actualMhMilli, code).toBeGreaterThan(0);
      }
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
