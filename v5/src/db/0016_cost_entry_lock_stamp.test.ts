import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import { companies, costEntries, dailyPlans } from "@/db/schema";
import { seedId } from "@/seed";
import { getCostItemPage } from "@/server/cost-item-page";
import {
  approveDailyReport,
  submitDailyReport,
} from "@/server/progress";
import { createSandbox } from "@/server/sandbox";

const migrationPath = join(
  process.cwd(),
  "drizzle/0016_cost_entry_lock_stamp.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

/** Backfill statement only (after ADD COLUMN). */
export function lockStampBackfillSql(file = migrationSql): string {
  const parts = file.split("--> statement-breakpoint");
  expect(parts.length).toBeGreaterThanOrEqual(2);
  return parts.slice(1).join("\n").trim();
}

function throughLockCents(page: NonNullable<Awaited<ReturnType<typeof getCostItemPage>>>) {
  return page.entries
    .filter((e) => !e.sinceLock)
    .reduce((s, e) => s + e.amountCents, 0);
}

/** Legacy broken backfill — stamps only when live actual still equals locked. */
const EQUALITY_BACKFILL_SQL = `
UPDATE "cost_entries" AS ce
SET "locked_in_at" = locks.locked_at
FROM "cost_items" AS ci
JOIN (
  SELECT DISTINCT ON (job_id) job_id, locked_at
  FROM "progress_claims"
  WHERE status = 'locked' AND locked_at IS NOT NULL
  ORDER BY job_id, locked_at DESC
) AS locks ON locks.job_id = ci.job_id
WHERE ce.cost_item_id = ci.id
  AND ce.company_id = ci.company_id
  AND ce.locked_in_at IS NULL
  AND ci.actual_cents = ci.locked_actual_cents
`;

describe("migration 0016_cost_entry_lock_stamp", () => {
  it("adds locked_in_at and backfills by covering locked_actual (not equality)", () => {
    expect(migrationSql).toMatch(/ADD COLUMN "locked_in_at"/);
    expect(migrationSql).toMatch(/cum_from_oldest/);
    expect(migrationSql).toMatch(/locked_actual_cents/);
    // Must-fail if someone reintroduces the equality filter that leaves
    // every row unstamped once anything posts after the lock.
    expect(migrationSql).not.toMatch(
      /actual_cents\s*=\s*ci\.locked_actual_cents|actual_cents\s*=\s*locked_actual_cents/,
    );
  });
});

describe.skipIf(!getDb())("0016 upgrade backfill matches fresh seed", () => {
  const created: string[] = [];

  afterAll(async () => {
    const db = getDb();
    if (!db) return;
    for (const id of created) {
      await db.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it(
    "seed-shaped 0015 null stamps + 0016 backfill equals fresh 0016 seed (with post-lock approve)",
    async () => {
      const db = requireDb();

      // Fresh seed on current schema (through 0016): Period 1 already locked and stamped.
      const freshId = await createSandbox();
      created.push(freshId);

      // Post-lock approve — the case that broke equality backfill.
      const planId = seedId(freshId, "plan:cedar:tomorrow");
      const pourLineId = seedId(freshId, "plan-line:cedar:0");
      const superId = seedId(freshId, "user:superintendent");
      await db
        .update(dailyPlans)
        .set({ status: "issued" })
        .where(eq(dailyPlans.id, planId));
      await submitDailyReport(freshId, planId, {
        [pourLineId]: { manHours: 22, qtyMilli: 12_000 },
      });
      const approved = await approveDailyReport(freshId, planId, superId);
      expect(approved.ok).toBe(true);

      const freshPour = await getCostItemPage(freshId, "25-031", "04-210");
      const freshTrench = await getCostItemPage(freshId, "24-077", "03-210");
      expect(freshPour).not.toBeNull();
      expect(freshTrench).not.toBeNull();
      expect(freshPour!.actualMhMilli).toBeGreaterThan(0);
      expect(freshTrench!.actualMhMilli).toBeGreaterThan(0);
      expect(freshPour!.sinceLockCents).toBeGreaterThan(0);
      expect(throughLockCents(freshPour!)).toBe(freshPour!.postedTotalCents);
      expect(throughLockCents(freshTrench!)).toBe(freshTrench!.postedTotalCents);

      // Upgrade shape: 0015 DB just gained the column (all null) before backfill.
      await db.execute(
        sql`UPDATE cost_entries SET locked_in_at = NULL WHERE company_id = ${freshId}::uuid`,
      );
      const wiped = await getCostItemPage(freshId, "25-031", "04-210");
      expect(wiped!.actualMhMilli).toBe(0);
      expect(throughLockCents(wiped!)).toBe(0);

      // Must-fail witness: equality backfill leaves through-lock empty after a post-lock approve.
      await db.execute(sql.raw(EQUALITY_BACKFILL_SQL));
      const bad = await getCostItemPage(freshId, "25-031", "04-210");
      expect(bad!.actualMhMilli).toBe(0);
      expect(throughLockCents(bad!)).toBe(0);

      await db.execute(
        sql`UPDATE cost_entries SET locked_in_at = NULL WHERE company_id = ${freshId}::uuid`,
      );
      await db.execute(sql.raw(lockStampBackfillSql()));

      const upgradedPour = await getCostItemPage(freshId, "25-031", "04-210");
      const upgradedTrench = await getCostItemPage(freshId, "24-077", "03-210");
      expect(upgradedPour!.actualMhMilli).toBe(freshPour!.actualMhMilli);
      expect(upgradedPour!.pendingMhMilli).toBe(freshPour!.pendingMhMilli);
      expect(upgradedPour!.postedTotalCents).toBe(freshPour!.postedTotalCents);
      expect(upgradedPour!.sinceLockCents).toBe(freshPour!.sinceLockCents);
      expect(throughLockCents(upgradedPour!)).toBe(throughLockCents(freshPour!));
      expect(upgradedTrench!.actualMhMilli).toBe(freshTrench!.actualMhMilli);
      expect(throughLockCents(upgradedTrench!)).toBe(
        throughLockCents(freshTrench!),
      );

      // Every stamped row still has a lock timestamp; pending rows stay null.
      const [stampCounts] = await db.execute<{
        stamped: number;
        pending: number;
      }>(sql`
        select
          count(*) filter (where locked_in_at is not null)::int as stamped,
          count(*) filter (where locked_in_at is null)::int as pending
        from cost_entries
        where company_id = ${freshId}::uuid`);
      expect(stampCounts.stamped).toBeGreaterThan(0);
      expect(stampCounts.pending).toBeGreaterThan(0);
    },
    120_000,
  );
});
