/**
 * 5.0.3 Part D — plan history events (role + time).
 * Acceptance checks + must-fail twins that go red if history reverts to names
 * or collapses return→approve into one stamp.
 */
import { and, asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb, requireDb } from "@/db";
import {
  companies,
  dailyPlanEvents,
  dailyPlans,
} from "@/db/schema";
import { CEDAR_RETURN_REASON } from "@/seed/field-history";
import { seedId } from "@/seed";
import { getPlanPage } from "@/server/plan-page";
import {
  approveDailyReport,
  issueDailyPlan,
  returnDailyReport,
  submitDailyReport,
} from "@/server/progress";
import { createSandbox } from "@/server/sandbox";

const db = getDb();
const created: string[] = [];

const DEMO_NAMES = ["Elena Brooks", "Marcus Lee", "Ray Dominguez", "Luis Ortega"];

describe.skipIf(!db)("Part D plan events", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it("seeded Cedar return story: roles + Returned before Approved, no names", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    const cedar = seedId(companyId, "job:cedar");
    const [plan] = await requireDb()
      .select()
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.jobId, cedar),
          eq(dailyPlans.returnReason, CEDAR_RETURN_REASON),
        ),
      )
      .limit(1);
    expect(plan).toBeTruthy();

    const page = await getPlanPage(companyId, "25-031", plan!.id);
    expect(page).toBeTruthy();
    const history = page!.history;
    expect(history.length).toBeGreaterThanOrEqual(4);

    const returned = history.filter((h) => h.kind === "returned");
    const approved = history.filter((h) => h.kind === "approved");
    expect(returned).toHaveLength(1);
    expect(approved.length).toBeGreaterThanOrEqual(1);
    expect(returned[0]!.actorRole).toBe("superintendent");
    expect(returned[0]!.detail).toBe(CEDAR_RETURN_REASON);
    expect(approved[0]!.actorRole).toBe("superintendent");
    expect(new Date(returned[0]!.at).getTime()).toBeLessThan(
      new Date(approved[0]!.at).getTime(),
    );

    // Must-fail: history must not carry person names (old who: string path).
    const blob = JSON.stringify(history);
    for (const name of DEMO_NAMES) {
      expect(blob).not.toContain(name);
    }
    expect(history.every((h) => "actorRole" in h && !("who" in h))).toBe(true);
  });

  it("must-fail: Returned after Approved would violate order", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const cedar = seedId(companyId, "job:cedar");
    const [plan] = await requireDb()
      .select()
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.jobId, cedar),
          eq(dailyPlans.returnReason, CEDAR_RETURN_REASON),
        ),
      )
      .limit(1);
    const page = await getPlanPage(companyId, "25-031", plan!.id);
    const returned = page!.history.find((h) => h.kind === "returned")!;
    const approved = page!.history.find((h) => h.kind === "approved")!;
    expect(new Date(returned.at).getTime()).not.toBeGreaterThan(
      new Date(approved.at).getTime(),
    );
  });

  it("live return then re-report then approve appends events; stamps match latest", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const planId = seedId(companyId, "plan:cedar:tomorrow");
    const pourLineId = seedId(companyId, "plan-line:cedar:0");
    const foreman = {
      userId: seedId(companyId, "user:foreman"),
      role: "foreman" as const,
    };
    const superintendent = {
      userId: seedId(companyId, "user:superintendent"),
      role: "superintendent" as const,
    };

    const before = await requireDb()
      .select()
      .from(dailyPlanEvents)
      .where(eq(dailyPlanEvents.planId, planId));
    const beforeLen = before.length;

    await issueDailyPlan(companyId, planId, superintendent);
    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 12, qtyMilli: 8_000 } },
      foreman,
    );
    const returned = await returnDailyReport(
      companyId,
      planId,
      "Forms not stripped",
      superintendent,
    );
    expect(returned.ok).toBe(true);

    await submitDailyReport(
      companyId,
      planId,
      { [pourLineId]: { manHours: 14, qtyMilli: 9_000 } },
      foreman,
    );
    const approved = await approveDailyReport(
      companyId,
      planId,
      superintendent,
    );
    expect(approved.ok).toBe(true);

    const events = await requireDb()
      .select()
      .from(dailyPlanEvents)
      .where(eq(dailyPlanEvents.planId, planId))
      .orderBy(asc(dailyPlanEvents.at), asc(dailyPlanEvents.id));
    expect(events.length).toBeGreaterThan(beforeLen);

    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("submitted");
    expect(kinds.filter((k) => k === "reported").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(kinds).toContain("returned");
    expect(kinds).toContain("approved");

    const lastReturn = [...events].reverse().find((e) => e.kind === "returned")!;
    const lastApproved = [...events]
      .reverse()
      .find((e) => e.kind === "approved")!;
    expect(lastReturn.actorRole).toBe("superintendent");
    expect(lastReturn.detail).toBe("Forms not stripped");
    expect(lastApproved.actorRole).toBe("superintendent");
    expect(lastReturn.at.getTime()).toBeLessThan(lastApproved.at.getTime());

    const [plan] = await requireDb()
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, planId));
    expect(plan!.status).toBe("approved");
    expect(plan!.returnReason).toBeNull();
    expect(plan!.returnedAt).toBeNull();
    expect(plan!.approvedAt!.getTime()).toBe(lastApproved.at.getTime());
    expect(plan!.reportedAt!.getTime()).toBe(
      [...events].reverse().find((e) => e.kind === "reported")!.at.getTime(),
    );
    expect(plan!.submittedAt!.getTime()).toBe(
      events.find((e) => e.kind === "submitted")!.at.getTime(),
    );

    const page = await getPlanPage(companyId, "25-031", planId);
    const blob = JSON.stringify(page!.history);
    for (const name of DEMO_NAMES) {
      expect(blob).not.toContain(name);
    }
    expect(
      page!.history.some(
        (h) => h.kind === "returned" && h.detail === "Forms not stripped",
      ),
    ).toBe(true);
  });

  it("must-fail: collapsing to stamp columns alone drops the first report", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const cedar = seedId(companyId, "job:cedar");
    const [plan] = await requireDb()
      .select()
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.jobId, cedar),
          eq(dailyPlans.returnReason, CEDAR_RETURN_REASON),
        ),
      )
      .limit(1);

    const events = await requireDb()
      .select()
      .from(dailyPlanEvents)
      .where(eq(dailyPlanEvents.planId, plan!.id))
      .orderBy(asc(dailyPlanEvents.at));

    const reportedBeforeReturn = events.filter(
      (e) =>
        e.kind === "reported" &&
        e.at.getTime() <
          events.find((x) => x.kind === "returned")!.at.getTime(),
    );
    // Seed writes the first report as its own event. Stamp columns cannot.
    expect(reportedBeforeReturn.length).toBeGreaterThanOrEqual(1);
    // Must-fail twin: one reported_at cannot equal two reported events.
    expect(events.filter((e) => e.kind === "reported").length).toBeGreaterThan(
      1,
    );
  });

  it("must-fail: history must not read action_runs for who", async () => {
    // Guard the implementation surface: plan-page buildPlanHistory no longer
    // imports actionRuns.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("./plan-page.ts", import.meta.url),
        "utf8",
      ),
    );
    expect(src).not.toMatch(/actionRuns/);
    expect(src).toMatch(/dailyPlanEvents/);
    expect(src).toMatch(/actorRole/);
    expect(src).not.toMatch(/\bwho\b/);
  });
});

describe("Part D seed events (pure)", () => {
  it("seed bag includes dailyPlanEvents for Cedar return story", async () => {
    const { seed } = await import("@/seed");
    const company = "00000000-0000-4000-8000-0000000000d4";
    const today = new Date("2026-10-20T17:00:00.000Z");
    const rows = seed(company, today);
    expect(rows.dailyPlanEvents.length).toBeGreaterThan(0);

    const cedar = rows.jobs.find((j) => j.number === "25-031")!;
    const plan = rows.dailyPlans.find(
      (p) =>
        p.jobId === cedar.id && p.returnReason === CEDAR_RETURN_REASON,
    )!;
    const events = rows.dailyPlanEvents
      .filter((e) => e.planId === plan.id)
      .sort((a, b) => a.at!.getTime() - b.at!.getTime());
    const kinds = events.map((e) => e.kind);
    expect(kinds).toEqual([
      "created",
      "submitted",
      "reported",
      "returned",
      "reported",
      "approved",
    ]);
    expect(events.find((e) => e.kind === "returned")!.detail).toBe(
      CEDAR_RETURN_REASON,
    );
    expect(events.every((e) => e.actorRole)).toBe(true);
    expect(
      events.some((e) => DEMO_NAMES.includes(String(e.actorId))),
    ).toBe(false);
  });
});
