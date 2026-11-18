import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  activities,
  baselineActivities,
  companies,
  jobs,
  scheduleBaselines,
} from "@/db/schema";
import { actionRailLabel } from "@/lib/assistant/labels";
import { route } from "@/lib/assistant/route";
import { seedId } from "@/seed";
import { createSandbox } from "@/server/sandbox";
import {
  finishExclusiveOn,
  listBaselines,
  rebaseline,
  refuseBaselineEdit,
  setBaseline,
} from "@/server/schedule";
import type { CurrentUser } from "@/server/session";

const db = getDb();
const created: string[] = [];

function actor(
  companyId: string,
  role: CurrentUser["role"],
): { userId: string; role: CurrentUser["role"] } {
  return { userId: seedId(companyId, `user:${role}`), role };
}

describe("finishExclusiveOn (5.1.2 acceptance check 2)", () => {
  it("maps inclusive baseline finish to finishExclusive = finish + 1 day", () => {
    expect(finishExclusiveOn("2026-11-12")).toBe("2026-11-13");
  });

  it("must-fail: passing finish unchanged is wrong for plannedValueCents", () => {
    const finishOn = "2026-11-12";
    expect(finishExclusiveOn(finishOn)).not.toBe(finishOn);
  });
});

describe("baseline immutability helper", () => {
  it("refuseBaselineEdit always refuses", () => {
    const r = refuseBaselineEdit();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.kind).toBe("immutable");
  });
});

describe("honesty: baseline refusal rail labels + route", () => {
  it("check 6: superintendent setBaseline chip is exact", () => {
    expect(
      actionRailLabel("schedule.setBaseline", "25-031", { refused: true }),
    ).toBe("Couldn't set baseline on 25-031");
  });

  it("routes set / re-baseline prompts", () => {
    const jobs = [
      {
        number: "25-031",
        name: "Cedar Creek Bridge",
        shortName: "Cedar Creek",
      },
    ];
    expect(
      route("Set Award baseline on 25-031 because Award", jobs),
    ).toEqual({
      action: "schedule.setBaseline",
      args: {
        job: "25-031",
        name: "Award baseline",
        reason: "Award",
      },
    });
    expect(
      route("Re-baseline Cedar Creek because CO-001 scope", jobs),
    ).toMatchObject({
      action: "schedule.rebaseline",
      args: {
        job: "25-031",
        reason: "CO-001 scope",
      },
    });
  });
});

describe.skipIf(!db)("5.1.2-a set / re-baseline actions", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  }, 120_000);

  it("seed places Award baseline on approved jobs; none on draft 26-010", async () => {
    const companyId = await createSandbox();
    created.push(companyId);

    for (const number of ["25-031", "24-118", "24-077"]) {
      const { baselines } = await listBaselines(companyId, number);
      expect(baselines).toHaveLength(1);
      expect(baselines[0]!.name).toBe("Award baseline");
      expect(baselines[0]!.reason).toBe("Award");
      expect(baselines[0]!.activityCount).toBeGreaterThan(0);
    }
    expect((await listBaselines(companyId, "26-010")).baselines).toHaveLength(
      0,
    );

    const [cedarCount] = await db!
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(baselineActivities)
      .innerJoin(
        scheduleBaselines,
        eq(scheduleBaselines.id, baselineActivities.baselineId),
      )
      .where(
        and(
          eq(scheduleBaselines.companyId, companyId),
          eq(scheduleBaselines.jobId, seedId(companyId, "job:cedar")),
        ),
      );
    expect(cedarCount!.n).toBe(5);
  });

  it("setBaseline refused when baseline exists; rebaseline appends with reason", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = actor(companyId, "pm");

    const again = await setBaseline(companyId, pm, "25-031", {
      name: "Award baseline",
      reason: "Award",
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.refusal.kind).toBe("baseline_exists");

    const re = await rebaseline(companyId, pm, "25-031", {
      name: "CO-001 baseline",
      reason: "CO-001 scope",
    });
    expect(re.ok).toBe(true);
    if (re.ok) {
      expect(re.first).toBe(false);
      expect(re.baseline.name).toBe("CO-001 baseline");
      expect(re.baseline.reason).toBe("CO-001 scope");
    }

    const { baselines } = await listBaselines(companyId, "25-031");
    expect(baselines.map((b) => b.name)).toEqual([
      "Award baseline",
      "CO-001 baseline",
    ]);
  });

  it("setBaseline succeeds after wiping baselines; copies activity dates", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = actor(companyId, "pm");
    const jobId = seedId(companyId, "job:i5");

    await db!
      .delete(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.companyId, companyId),
          eq(scheduleBaselines.jobId, jobId),
        ),
      );
    expect((await listBaselines(companyId, "24-077")).baselines).toHaveLength(
      0,
    );

    const acts = await db!
      .select({
        id: activities.id,
        earlyStartOn: activities.earlyStartOn,
        earlyFinishOn: activities.earlyFinishOn,
        durationDays: activities.durationDays,
      })
      .from(activities)
      .where(and(eq(activities.companyId, companyId), eq(activities.jobId, jobId)));
    expect(acts.length).toBeGreaterThan(0);

    const set = await setBaseline(companyId, pm, "24-077", {
      name: "Award baseline",
      reason: "Award",
    });
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.first).toBe(true);
    expect(set.baseline.activityCount).toBe(acts.length);

    const copies = await db!
      .select()
      .from(baselineActivities)
      .where(eq(baselineActivities.baselineId, set.baseline.id));
    expect(copies).toHaveLength(acts.length);
    for (const a of acts) {
      const copy = copies.find((c) => c.activityId === a.id)!;
      expect(copy.startOn).toBe(a.earlyStartOn);
      expect(copy.finishOn).toBe(a.earlyFinishOn);
      expect(copy.durationDays).toBe(a.durationDays);
    }
  });

  it("draft 26-010 and empty reason are refused", async () => {
    const companyId = await createSandbox();
    created.push(companyId);
    const pm = actor(companyId, "pm");

    const harbor = await setBaseline(companyId, pm, "26-010", {
      name: "Award baseline",
      reason: "Award",
    });
    expect(harbor.ok).toBe(false);
    if (!harbor.ok) expect(harbor.refusal.kind).toBe("estimate_not_approved");

    const empty = await rebaseline(companyId, pm, "25-031", {
      name: "Next",
      reason: "   ",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.refusal.kind).toBe("empty_reason");

    // Harbor has no schedule rows at all.
    const [n] = await db!
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(activities)
      .innerJoin(jobs, eq(jobs.id, activities.jobId))
      .where(and(eq(jobs.companyId, companyId), eq(jobs.number, "26-010")));
    expect(n!.n).toBe(0);
  });
});
