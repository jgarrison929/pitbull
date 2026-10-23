import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { actionRuns, companies, dailyPlans } from "@/db/schema";
import { SEED_JOB_NUMBERS } from "@/seed/history";
import { seed, seedId } from "@/seed";
import {
  countRows,
  createSandbox,
  MAX_SANDBOXES_PER_VISITOR,
  resetSandbox,
  sandboxForVisitor,
  sweepExpiredSandboxes,
} from "./sandbox";

// Runs against the migrated DATABASE_URL (CI runs db:prepare first). Skipped when no database is configured.
const db = getDb();
const created: string[] = [];

/** Foreman note + Harbor import + PM CO creates/prices/void + locks×3 + executive reject/approve. */
const SEED_HISTORY_RUNS = 18;
/** Pure seed cost items plus the one leaf approved CO-003 inserts on 24-118. */
const SEED_APPROVED_CO_LEAVES = 1;

describe.skipIf(!db)("sandbox lifecycle", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it(
    "clones the full seed into a new sandbox",
    async () => {
      const id = await createSandbox();
      created.push(id);
      const expected = seed(id, new Date());
      const rows = await countRows(id);
      expect(rows).toMatchObject({
        jobs: expected.jobs.length,
        cost_items: expected.costItems.length + SEED_APPROVED_CO_LEAVES,
        plans: expected.dailyPlans.length,
      });
      expect(rows.runs).toBe(SEED_HISTORY_RUNS);
      // Harbor stays a draft estimate (import history); approved jobs get Period 1 locks.
      expect(SEED_JOB_NUMBERS).toHaveLength(4);
      expect(SEED_JOB_NUMBERS).toContain("26-010");
    },
    30_000,
  );

  it(
    "reset undoes a visitor's changes and keeps the same ids",
    async () => {
      const id = await createSandbox();
      created.push(id);
      const planId = seedId(id, "plan:cedar:tomorrow");
      await db!
        .update(dailyPlans)
        .set({ status: "issued" })
        .where(eq(dailyPlans.id, planId));
      await db!.insert(actionRuns).values({
        companyId: id,
        userId: seedId(id, "user:pm"),
        prompt: "x",
        action: "portfolio.summary",
        args: {},
        summary: "x",
      });
      await resetSandbox(id);
      const [plan] = await db!
        .select()
        .from(dailyPlans)
        .where(eq(dailyPlans.id, planId));
      expect(plan.status).toBe("draft");
      // Reset clears visitor runs then re-seeds history via real typed actions.
      expect((await countRows(id)).runs).toBe(SEED_HISTORY_RUNS);
    },
    30_000,
  );

  it("sweeps only expired sandboxes", async () => {
    const live = await createSandbox();
    const old = await createSandbox(new Date(Date.now() - 48 * 3600 * 1000));
    created.push(live, old);
    await sweepExpiredSandboxes();
    const ids = (await db!.select({ id: companies.id }).from(companies)).map(
      (r) => r.id,
    );
    expect(ids).toContain(live);
    expect(ids).not.toContain(old);
  }, 30_000);

  it(
    "caps live sandboxes per visitor, then reuses the newest",
    async () => {
      const visitor = `test-${Date.now()}`;
      const ids: string[] = [];
      for (let i = 0; i < MAX_SANDBOXES_PER_VISITOR; i++) {
        // Distinct seed times so "newest" is well defined.
        ids.push(
          await sandboxForVisitor(visitor, new Date(Date.now() + i * 1000)),
        );
      }
      created.push(...ids);
      expect(new Set(ids).size).toBe(MAX_SANDBOXES_PER_VISITOR);
      const next = await sandboxForVisitor(visitor, new Date(Date.now() + 5000));
      expect(next).toBe(ids.at(-1));
    },
    60_000,
  );

  it(
    "parallel sign-ins never create more than the cap",
    async () => {
      const visitor = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date();
      // Concurrent callers; without the advisory lock this over-creates.
      // Seed history serializes under the lock (CO actions), so budget wall time.
      const ids = await Promise.all(
        Array.from({ length: 6 }, () => sandboxForVisitor(visitor, now)),
      );
      const unique = [...new Set(ids)];
      created.push(...unique);
      expect(unique.length).toBe(MAX_SANDBOXES_PER_VISITOR);
      const live = await db!
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.visitorHash, visitor));
      expect(live.length).toBe(MAX_SANDBOXES_PER_VISITOR);
    },
    180_000,
  );
});
