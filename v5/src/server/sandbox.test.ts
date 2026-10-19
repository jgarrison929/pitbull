import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { actionRuns, companies, dailyPlans } from "@/db/schema";
import { seed, seedId } from "@/seed";
import {
  countRows,
  createSandbox,
  resetSandbox,
  sweepExpiredSandboxes,
} from "./sandbox";

// Runs against the migrated DATABASE_URL (CI runs db:prepare first). Skipped when no database is configured.
const db = getDb();
const created: string[] = [];

describe.skipIf(!db)("sandbox lifecycle", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("clones the full seed into a new sandbox", async () => {
    const id = await createSandbox();
    created.push(id);
    const expected = seed(id, new Date());
    expect(await countRows(id)).toEqual({
      jobs: expected.jobs.length,
      cost_items: expected.costItems.length,
      plans: expected.dailyPlans.length,
      runs: 0,
    });
  });

  it("reset undoes a visitor's changes and keeps the same ids", async () => {
    const id = await createSandbox();
    created.push(id);
    const planId = seedId(id, "plan:cedar:tomorrow");
    await db!
      .update(dailyPlans)
      .set({ status: "submitted" })
      .where(eq(dailyPlans.id, planId));
    await db!
      .insert(actionRuns)
      .values({
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
    expect((await countRows(id)).runs).toBe(0);
  });

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
  });
});
