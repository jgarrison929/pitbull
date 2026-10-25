/**
 * Part B replay: one historical plan per job + the Cedar returned plan,
 * through create → addLine → submit → report → approve. Fail if amount,
 * rate, date, or cost item differ from the seeded rows.
 */
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  companies,
  costEntries,
  costItems,
  dailyPlanLines,
  dailyPlans,
} from "@/db/schema";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { run } from "@/server/assistant/actions";
import { addPlanLine, createDailyPlan } from "@/server/plans";
import { approveDailyReport, submitDailyReport } from "@/server/progress";
import { createSandbox } from "@/server/sandbox";
import { seedNow } from "@/server/seed-clock";
import type { CurrentUser } from "@/server/session";
import { SEED_COMPANY_NAME, seedId, seedUsers } from "./index";
import {
  CEDAR_RETURN_REASON,
  FIELD_HISTORY_WORKING_DAYS,
  histPlanKey,
  workingDaysBefore,
} from "./field-history";

const db = getDb();
const created: string[] = [];

function asUser(
  companyId: string,
  key: (typeof seedUsers)[number]["key"],
  now: Date,
): CurrentUser {
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
}

const JOBS = [
  {
    key: "sr99",
    number: "24-118",
    crewKey: "crew:interchange-1",
    rate: CREW_LABOR_RATE_CENTS["Interchange Crew 1"],
  },
  {
    key: "cedar",
    number: "25-031",
    crewKey: "crew:bridge-2",
    rate: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
  },
  {
    key: "i5",
    number: "24-077",
    crewKey: "crew:culvert-a",
    rate: CREW_LABOR_RATE_CENTS["Culvert Crew A"],
  },
] as const;

async function replayPlan(args: {
  companyId: string;
  planId: string;
  jobKey: string;
  jobNumber: string;
  crewKey: string;
  rate: number;
  day: string;
  foreman: CurrentUser;
  superintendent: CurrentUser;
  now: Date;
}) {
  const {
    companyId,
    planId,
    jobKey,
    jobNumber,
    crewKey,
    rate,
    day,
    foreman,
    superintendent,
    now,
  } = args;

  const seedLines = await db!
    .select()
    .from(dailyPlanLines)
    .where(eq(dailyPlanLines.planId, planId));
  expect(seedLines.length, `${jobKey} ${day} lines`).toBeGreaterThan(0);

  const lineIds = seedLines.map((l) => l.id);
  const seedLabor = await db!
    .select()
    .from(costEntries)
    .where(
      and(
        eq(costEntries.companyId, companyId),
        eq(costEntries.kind, "labor"),
        inArray(costEntries.sourcePlanLineId, lineIds),
      ),
    );
  // Need at least one labor row to compare amount/rate.
  expect(seedLabor.length, `${jobKey} ${day} labor`).toBeGreaterThan(0);

  const expected = seedLabor.map((e) => ({
    costItemId: e.costItemId,
    amountCents: e.amountCents,
    rateCents: e.rateCents,
    atDay: e.at.toISOString().slice(0, 10),
    hoursTenths: e.hoursTenths ?? 0,
    code: seedLines.find((l) => l.id === e.sourcePlanLineId)!.activity,
    line: seedLines.find((l) => l.id === e.sourcePlanLineId)!,
  }));
  for (const e of expected) {
    expect(e.rateCents).toBe(rate);
    expect(e.atDay).toBe(day);
  }

  // Roll back seed so createDailyPlan can reuse (job, crew, date).
  const rollbackByItem = new Map<
    string,
    { amount: number; qtyMilli: number }
  >();
  for (const e of seedLabor) {
    const line = seedLines.find((l) => l.id === e.sourcePlanLineId)!;
    const cur = rollbackByItem.get(e.costItemId) ?? {
      amount: 0,
      qtyMilli: 0,
    };
    cur.amount += e.amountCents;
    cur.qtyMilli += line.reportedQtyMilli ?? 0;
    rollbackByItem.set(e.costItemId, cur);
  }
  for (const [costItemId, delta] of rollbackByItem) {
    const [item] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, costItemId));
    await db!
      .update(costItems)
      .set({
        actualCents: item!.actualCents - delta.amount,
        installedQtyMilli: item!.installedQtyMilli - delta.qtyMilli,
      })
      .where(eq(costItems.id, costItemId));
  }
  await db!
    .delete(costEntries)
    .where(
      and(
        eq(costEntries.companyId, companyId),
        inArray(costEntries.sourcePlanLineId, lineIds),
      ),
    );
  await db!.delete(dailyPlanLines).where(eq(dailyPlanLines.planId, planId));
  await db!.delete(dailyPlans).where(eq(dailyPlans.id, planId));

  const createdPlan = await createDailyPlan(foreman, {
    jobId: jobNumber,
    crewId: seedId(companyId, crewKey),
    planDate: day,
  });
  if ("refused" in createdPlan) throw new Error(createdPlan.refused);
  const newPlanId = createdPlan.planId;

  const reportActuals: Record<
    string,
    { manHours: number; qtyMilli: number }
  > = {};
  for (const e of expected) {
    const manHours = e.hoursTenths / 10;
    const added = await addPlanLine(foreman, newPlanId, {
      costItemId: e.costItemId,
      activity: e.line.activity,
      location: e.line.location,
      qty: (e.line.reportedQtyMilli ?? 0) / 1000,
      workers: e.line.workers,
      hours: e.line.hoursTenths / 10,
      manHours: manHours > 0 ? manHours : undefined,
    });
    if ("refused" in added) throw new Error(JSON.stringify(added));
    reportActuals[added.lineId] = {
      manHours,
      qtyMilli: e.line.reportedQtyMilli ?? 0,
    };
  }

  const issued = await run(superintendent, "Submit", "dailyPlan.submit", {
    planId: newPlanId,
  });
  expect(issued.result.summary).toMatch(/Issued/i);

  const reported = await submitDailyReport(
    companyId,
    newPlanId,
    reportActuals,
    now,
  );
  expect(reported.ok).toBe(true);

  const approved = await approveDailyReport(
    companyId,
    newPlanId,
    superintendent.userId,
    now,
  );
  expect(approved.ok).toBe(true);
  if (!approved.ok || approved.already) throw new Error("approve failed");

  const replayed = await db!
    .select()
    .from(costEntries)
    .where(
      and(
        eq(costEntries.companyId, companyId),
        eq(costEntries.kind, "labor"),
        inArray(
          costEntries.sourcePlanLineId,
          Object.keys(reportActuals),
        ),
      ),
    );
  expect(replayed).toHaveLength(expected.length);

  const byItem = (rows: typeof expected) =>
    [...rows].sort((a, b) => a.costItemId.localeCompare(b.costItemId));
  const got = byItem(
    replayed.map((e) => ({
      costItemId: e.costItemId,
      amountCents: e.amountCents,
      rateCents: e.rateCents!,
      atDay: e.at.toISOString().slice(0, 10),
      hoursTenths: e.hoursTenths ?? 0,
      code: "",
      line: expected[0]!.line,
    })),
  );
  const want = byItem(expected);
  for (let i = 0; i < want.length; i++) {
    expect(got[i]!.amountCents, `${jobKey} amount`).toBe(want[i]!.amountCents);
    expect(got[i]!.rateCents, `${jobKey} rate`).toBe(want[i]!.rateCents);
    expect(got[i]!.atDay, `${jobKey} date`).toBe(want[i]!.atDay);
    expect(got[i]!.costItemId, `${jobKey} item`).toBe(want[i]!.costItemId);
  }
}

describe.skipIf(!db)("Part B field-history replay", () => {
  afterAll(async () => {
    for (const id of created)
      await db!.delete(companies).where(eq(companies.id, id));
  });

  it("replays one plan per job + Cedar returned plan; amount/rate/date/item match seed", async () => {
    process.env.V5_SEED_NOW ??= "2026-10-20T17:00:00.000Z";
    const now = seedNow();
    const companyId = await createSandbox(now);
    created.push(companyId);
    const days = workingDaysBefore(now, FIELD_HISTORY_WORKING_DAYS);
    const replayDay = days[days.length - 1]!;

    const foreman = asUser(companyId, "foreman", now);
    const superintendent = asUser(companyId, "superintendent", now);

    const [cedarReturned] = await db!
      .select()
      .from(dailyPlans)
      .where(
        and(
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.returnReason, CEDAR_RETURN_REASON),
        ),
      )
      .limit(1);
    expect(cedarReturned).toBeTruthy();

    const targets: {
      key: string;
      number: string;
      crewKey: string;
      rate: number;
      day: string;
      planId: string;
    }[] = [];

    for (const j of JOBS) {
      // Prefer a day with labor on this job near the end of the window.
      let day = replayDay;
      let planId = seedId(companyId, histPlanKey(j.key, day));
      const laborOnDay = await db!
        .select({ id: costEntries.id })
        .from(costEntries)
        .innerJoin(
          dailyPlanLines,
          eq(dailyPlanLines.id, costEntries.sourcePlanLineId),
        )
        .where(
          and(
            eq(costEntries.companyId, companyId),
            eq(costEntries.kind, "labor"),
            eq(dailyPlanLines.planId, planId),
          ),
        )
        .limit(1);
      if (!laborOnDay.length) {
        // Walk back until we find a day with labor.
        for (let i = days.length - 2; i >= 0; i--) {
          day = days[i]!;
          planId = seedId(companyId, histPlanKey(j.key, day));
          const found = await db!
            .select({ id: costEntries.id })
            .from(costEntries)
            .innerJoin(
              dailyPlanLines,
              eq(dailyPlanLines.id, costEntries.sourcePlanLineId),
            )
            .where(
              and(
                eq(costEntries.companyId, companyId),
                eq(costEntries.kind, "labor"),
                eq(dailyPlanLines.planId, planId),
              ),
            )
            .limit(1);
          if (found.length) break;
        }
      }
      targets.push({
        key: j.key,
        number: j.number,
        crewKey: j.crewKey,
        rate: j.rate,
        day,
        planId: seedId(companyId, histPlanKey(j.key, day)),
      });
    }

    // Cedar returned plan (may already be in targets — dedupe by plan id).
    if (!targets.some((t) => t.planId === cedarReturned!.id)) {
      targets.push({
        key: "cedar",
        number: "25-031",
        crewKey: "crew:bridge-2",
        rate: CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
        day: cedarReturned!.planDate,
        planId: cedarReturned!.id,
      });
    }

    for (const t of targets) {
      await replayPlan({
        companyId,
        planId: t.planId,
        jobKey: t.key,
        jobNumber: t.number,
        crewKey: t.crewKey,
        rate: t.rate,
        day: t.day,
        foreman,
        superintendent,
        now,
      });
    }
  });
});
