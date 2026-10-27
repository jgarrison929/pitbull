import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { actionRuns, companies, dailyPlans } from "@/db/schema";
import { recentRuns, run } from "@/server/assistant/actions";
import { createSandbox, resetSandbox } from "@/server/sandbox";
import {
  SEED_FOREMAN_RUNS,
  SEED_HISTORY_RUNS,
  SEED_PM_RUNS,
  SEED_SUPERINTENDENT_RUNS,
} from "./history";
import { SEED_COMPANY_NAME, seedId, seedUsers } from "./index";

const db = getDb();
const created: string[] = [];

describe.skipIf(!db)("superintendent seed action history", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it(
    "seeds Ray's rail from real run() paths with numbers that trace to demo jobs",
    async () => {
      const companyId = await createSandbox();
      created.push(companyId);

      const all = await db!
        .select()
        .from(actionRuns)
        .where(eq(actionRuns.companyId, companyId));
      expect(all).toHaveLength(SEED_HISTORY_RUNS);

      const superId = seedId(companyId, "user:superintendent");
      const foremanId = seedId(companyId, "user:foreman");
      const pmId = seedId(companyId, "user:pm");
      expect(all.filter((r) => r.userId === superId)).toHaveLength(
        SEED_SUPERINTENDENT_RUNS,
      );
      expect(all.filter((r) => r.userId === foremanId)).toHaveLength(
        SEED_FOREMAN_RUNS,
      );
      expect(all.filter((r) => r.userId === pmId)).toHaveLength(SEED_PM_RUNS);

      const runs = await recentRuns({ companyId, userId: superId });
      expect(runs).toHaveLength(SEED_SUPERINTENDENT_RUNS);
      // No empty-rail state for the superintendent.
      expect(runs.length).toBeGreaterThan(0);

      const byAction = Object.fromEntries(runs.map((r) => [r.action, r]));
      expect(byAction["dailyPlan.submit"]?.summary).toMatch(
        /Issued Culvert Crew A's plan.+I-5 Culverts.+110 man-hours/,
      );
      expect(byAction["dailyPlan.return"]?.summary).toMatch(
        /Returned Culvert Crew A's report.+I-5 Culverts.+Catch basin invert elevations don't match the mark-out/,
      );
      expect(byAction["dailyPlan.show"]?.summary).toMatch(
        /Bridge Crew 2 on Cedar Creek Bridge.+110 man-hours/,
      );
      expect(byAction["job.costVariance"]?.summary).toMatch(
        /Cedar Creek Bridge is .+ over/,
      );
      // CO-001: 18,500 + 23,250 + 6,100 + 12,150 = $60,000.00 from seed prices.
      expect(byAction["changeOrder.show"]?.summary).toMatch(
        /CO-001.+\$60,000\.00/,
      );

      for (const r of runs) {
        expect(r.summary).not.toMatch(/TODO|placeholder|lorem|TBD/i);
        expect(r.summary).not.toMatch(/\bCPI\b/);
        expect(r.summary).not.toMatch(/\bSPI\b/);
        expect(r.summary.length).toBeGreaterThan(20);
      }

      const now = new Date("2026-10-20T17:00:00.000Z");
      const asUser = (key: "superintendent" | "pm") => {
        const u = seedUsers.find((x) => x.key === key)!;
        return {
          userId: seedId(companyId, `user:${key}`),
          companyId,
          name: u.name,
          title: u.title,
          role: u.role,
          companyName: SEED_COMPANY_NAME,
          seededAt: now,
          expiresAt: null,
        };
      };
      const field = await run(
        asUser("superintendent"),
        "Summarize the portfolio",
        "portfolio.summary",
        {},
      );
      expect(field.result.summary).toMatch(/active jobs/);
      expect(field.result.summary).not.toMatch(/\bCPI\b/);
      expect(field.result.summary).not.toMatch(/\bSPI\b/);
      const pm = await run(
        asUser("pm"),
        "Summarize the portfolio",
        "portfolio.summary",
        {},
      );
      expect(pm.result.summary).toMatch(/\bCPI\b/);
      expect(pm.result.summary).toMatch(/\bSPI\b/);
      const variance = await run(
        asUser("superintendent"),
        "Why is Cedar Creek over budget?",
        "job.costVariance",
        { job: "25-031" },
      );
      expect(variance.result.summary).not.toMatch(/\bCPI\b/);
      expect(variance.result.summary).not.toMatch(/\bSPI\b/);

      // I-5 plan ended issued (returned); Cedar tomorrow stays draft.
      const [i5] = await db!
        .select()
        .from(dailyPlans)
        .where(eq(dailyPlans.id, seedId(companyId, "plan:i5:today")));
      expect(i5.status).toBe("issued");
      expect(i5.returnReason).toBe(
        "Catch basin invert elevations don't match the mark-out",
      );
      const [cedar] = await db!
        .select()
        .from(dailyPlans)
        .where(eq(dailyPlans.id, seedId(companyId, "plan:cedar:tomorrow")));
      expect(cedar.status).toBe("draft");

      await resetSandbox(companyId);
      const after = await recentRuns({ companyId, userId: superId });
      expect(after).toHaveLength(SEED_SUPERINTENDENT_RUNS);
      expect(after.some((r) => r.action === "dailyPlan.return")).toBe(true);
    },
    60_000,
  );
});
