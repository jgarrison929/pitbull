import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  companies,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
} from "@/db/schema";
import { route } from "@/lib/assistant/route";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { formatMhPerUnit } from "@/lib/plan-line";
import { run } from "@/server/assistant/actions";
import {
  addPlanLine,
  createDailyPlan,
} from "@/server/plans";
import { createSandbox } from "@/server/sandbox";
import type { CurrentUser } from "@/server/session";
import { seedId } from "@/seed";

const BRIDGE_RATE = CREW_LABOR_RATE_CENTS["Bridge Crew 2"];
const JOB_REFS = [
  {
    number: "25-031",
    name: "Cedar Creek Bridge Replacement",
    shortName: "Cedar Creek Bridge",
  },
];

const db = getDb();
const prevSeedNow = process.env.V5_SEED_NOW;

describe.skipIf(!db)("plan action scoping and guards", () => {
  const created: string[] = [];
  let companyId = "";
  let superintendent!: CurrentUser;
  let foreman!: CurrentUser;
  let bridgeCrewId = "";
  let culvertCrewId = "";
  let cedarJobId = "";
  let draftJobId = "";
  let costOnCedar = "";
  let costOnOther = "";

  beforeAll(async () => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
    companyId = await createSandbox();
    created.push(companyId);
    const superId = seedId(companyId, "user:superintendent");
    const foremanId = seedId(companyId, "user:foreman");
    bridgeCrewId = seedId(companyId, "crew:bridge-2");
    culvertCrewId = seedId(companyId, "crew:culvert-a");
    cedarJobId = seedId(companyId, "job:cedar");
    draftJobId = seedId(companyId, "job:harbor");
    costOnCedar = seedId(companyId, "cost:cedar:04-210");
    costOnOther = seedId(companyId, "cost:i5:03-210");
    superintendent = {
      userId: superId,
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
    foreman = {
      userId: foremanId,
      companyId,
      name: "Luis Ortega",
      title: "Foreman",
      role: "foreman",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
  }, 120_000);

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("submit and report hit the planId on the card, not another plan on the job", async () => {
    const today = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in today) throw new Error(today.refused);
    const added = await addPlanLine(superintendent, today.planId, {
      costItemId: costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    if ("refused" in added) throw new Error(added.refused);

    const emptyCulvert = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: culvertCrewId,
      planDate: "2026-10-22",
    });
    if ("refused" in emptyCulvert) throw new Error(emptyCulvert.refused);

    const emptySubmit = await run(
      superintendent,
      "Submit plan (button)",
      "dailyPlan.submit",
      { job: "25-031", planId: emptyCulvert.planId },
    );
    expect(emptySubmit.result.refused).toBe(true);
    expect(emptySubmit.result.summary).toMatch(
      /Add a cost item before submitting/,
    );

    // Seeded Bridge Crew 2 tomorrow draft must stay draft.
    const [seededTomorrow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, seedId(companyId, "plan:cedar:tomorrow")));
    expect(seededTomorrow.status).toBe("draft");

    const issued = await run(
      superintendent,
      "Submit plan (button)",
      "dailyPlan.submit",
      { job: "25-031", planId: today.planId },
    );
    expect(issued.result.refused).toBeFalsy();
    expect(issued.result.summary).toMatch(/Issued Bridge Crew 2/);

    const reported = await run(
      foreman,
      "Report day's work (button)",
      "dailyReport.post",
      {
        job: "25-031",
        planId: today.planId,
        actuals: [
          { lineId: added.lineId, manHours: 22, qty: 12 },
        ],
      },
    );
    expect(reported.result.summary).not.toMatch(/Issue .+ plan first/);
    expect(reported.result.refused).toBeFalsy();
    const [todayRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, today.planId));
    expect(todayRow.status).toBe("reported");
    expect(seededTomorrow.status).toBe("draft");
  });

  it("duplicate check refuses a second plan for the same crew_id and date", async () => {
    const first = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: culvertCrewId,
      planDate: "2026-10-20",
    });
    expect("planId" in first).toBe(true);
    const dup = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: culvertCrewId,
      planDate: "2026-10-20",
    });
    expect("refused" in dup).toBe(true);
    if ("refused" in dup) {
      expect(dup.refused).toMatch(/Culvert Crew A already has a draft plan/);
    }
  });

  it("refuses a plan date outside the ±14-day window", async () => {
    const far = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: bridgeCrewId,
      planDate: "2026-11-10",
    });
    expect("refused" in far).toBe(true);
    if ("refused" in far) {
      expect(far.refused).toMatch(/within 14 days/);
    }
  });

  it("refuses create on a draft-estimate job", async () => {
    const [draft] = await db!
      .select()
      .from(jobs)
      .where(eq(jobs.id, draftJobId));
    expect(draft.estimateStatus).toBe("draft");
    const refused = await createDailyPlan(superintendent, {
      jobId: draftJobId,
      crewId: bridgeCrewId,
      planDate: "2026-10-20",
    });
    expect("refused" in refused).toBe(true);
    if ("refused" in refused) {
      expect(refused.refused).toMatch(/Approve the estimate/);
    }
  });

  it("refuses a line from another job (jobId check — not allowed-list alone)", async () => {
    // Future date: Part B seeds 30 working days before seedNow on Bridge Crew 2.
    const plan = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: bridgeCrewId,
      planDate: "2026-10-23",
    });
    if ("refused" in plan) throw new Error(plan.refused);
    const [other] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, costOnOther));
    expect(other.jobId).not.toBe(cedarJobId);
    expect(other.isLeaf).toBe(true);
    const line = await addPlanLine(superintendent, plan.planId, {
      costItemId: costOnOther,
      qty: "1",
      workers: "1",
      hours: "8",
    });
    expect("refused" in line).toBe(true);
    if ("refused" in line) {
      expect(line.refused).toMatch(/other jobs|leaf cost item on this job/i);
    }
    // Must-fail when item.jobId !== plan.jobId check is removed: a foreign
    // leaf would insert. Assert no new line on this plan.
    const lines = await db!
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.planId, plan.planId));
    expect(lines).toHaveLength(0);
  });

  it("refuses adding a line after the plan is issued", async () => {
    const plan = await createDailyPlan(superintendent, {
      jobId: cedarJobId,
      crewId: culvertCrewId,
      planDate: "2026-10-25",
    });
    if ("refused" in plan) throw new Error(plan.refused);
    await addPlanLine(superintendent, plan.planId, {
      costItemId: costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    await run(superintendent, "Submit", "dailyPlan.submit", {
      job: "25-031",
      planId: plan.planId,
    });
    const after = await addPlanLine(superintendent, plan.planId, {
      costItemId: costOnCedar,
      qty: "1",
      workers: "1",
      hours: "8",
    });
    expect("refused" in after).toBe(true);
    if ("refused" in after) {
      expect(after.refused).toMatch(/issued|locked/i);
    }
  });

});

describe.skipIf(!db)("rail date/crew scoping (fresh sandbox per test)", () => {
  const created: string[] = [];
  const prevSeedNow = process.env.V5_SEED_NOW;

  beforeAll(() => {
    process.env.V5_SEED_NOW = "2026-10-20T17:00:00.000Z";
  });

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  async function freshSandbox() {
    const companyId = await createSandbox();
    created.push(companyId);
    const superintendent: CurrentUser = {
      userId: seedId(companyId, "user:superintendent"),
      companyId,
      name: "Ray Dominguez",
      title: "Superintendent",
      role: "superintendent",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
    const foreman: CurrentUser = {
      userId: seedId(companyId, "user:foreman"),
      companyId,
      name: "Luis Ortega",
      title: "Foreman",
      role: "foreman",
      companyName: "Demo",
      seededAt: new Date("2026-10-20T17:00:00.000Z"),
      expiresAt: null,
    };
    return {
      companyId,
      superintendent,
      foreman,
      cedarJobId: seedId(companyId, "job:cedar"),
      bridgeCrewId: seedId(companyId, "crew:bridge-2"),
      culvertCrewId: seedId(companyId, "crew:culvert-a"),
      costOnCedar: seedId(companyId, "cost:cedar:04-210"),
      cost310: seedId(companyId, "cost:cedar:04-310"),
    };
  }

  it("rail approve/return/submit ask when two plans match — never posts cost", async () => {
    const ctx = await freshSandbox();
    // Today: two reported crews → job-only approve/return must ask (not prefer one).
    const day = "2026-10-20";
    const bridge = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: day,
    });
    if ("refused" in bridge) throw new Error(bridge.refused);
    const culvert = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.culvertCrewId,
      planDate: day,
    });
    if ("refused" in culvert) throw new Error(culvert.refused);
    const bLine = await addPlanLine(ctx.superintendent, bridge.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "1",
      hours: "10",
    });
    if ("refused" in bLine) throw new Error(bLine.refused);
    const cLine = await addPlanLine(ctx.superintendent, culvert.planId, {
      costItemId: ctx.cost310,
      qty: "100",
      workers: "1",
      hours: "10",
    });
    if ("refused" in cLine) throw new Error(cLine.refused);

    for (const planId of [bridge.planId, culvert.planId]) {
      expect(
        (
          await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
            job: "25-031",
            planId,
          })
        ).result.refused,
      ).toBeFalsy();
    }
    for (const [planId, lineId] of [
      [bridge.planId, bLine.lineId],
      [culvert.planId, cLine.lineId],
    ] as const) {
      expect(
        (
          await run(ctx.foreman, "Report", "dailyReport.post", {
            job: "25-031",
            planId,
            actuals: [{ lineId, manHours: 10, qty: 1 }],
          })
        ).result.refused,
      ).toBeFalsy();
    }

    const ambiguousApprove = await run(
      ctx.superintendent,
      "Approve the report on 25-031",
      "dailyPlan.approve",
      { job: "25-031" },
    );
    expect(ambiguousApprove.result.refused).toBe(true);
    expect(ambiguousApprove.result.summary).toMatch(
      /Which report should I approve/i,
    );
    expect(ambiguousApprove.result.summary).toMatch(/Bridge Crew 2/);
    expect(ambiguousApprove.result.summary).toMatch(/Culvert Crew A/);
    expect(ambiguousApprove.result.summary).not.toMatch(/actual cost/);
    expect(ambiguousApprove.result.summary).not.toMatch(/Sep /);

    const followUp = await run(
      ctx.superintendent,
      "Approve today's report on 25-031",
      "dailyPlan.approve",
      { job: "25-031", date: day },
    );
    expect(followUp.result.refused).toBe(true);
    expect(followUp.result.summary).toMatch(/Which report should I approve/i);
    expect(followUp.result.summary).not.toMatch(/already approved/i);

    for (const planId of [bridge.planId, culvert.planId]) {
      const [row] = await db!
        .select()
        .from(dailyPlans)
        .where(eq(dailyPlans.id, planId));
      expect(row.status).toBe("reported");
    }

    const ambiguousReturn = await run(
      ctx.superintendent,
      "Return the report on 25-031 because recount",
      "dailyPlan.return",
      { job: "25-031", reason: "recount" },
    );
    expect(ambiguousReturn.result.refused).toBe(true);
    expect(ambiguousReturn.result.summary).toMatch(
      /Which report should I return/i,
    );

    // Two drafts on a free future day (+ seeded tomorrow) → job-only submit asks.
    const submitDay = "2026-10-24";
    for (const crewId of [ctx.bridgeCrewId, ctx.culvertCrewId]) {
      const draft = await createDailyPlan(ctx.superintendent, {
        jobId: ctx.cedarJobId,
        crewId,
        planDate: submitDay,
      });
      if ("refused" in draft) throw new Error(draft.refused);
    }
    const ambiguousSubmit = await run(
      ctx.superintendent,
      "Submit the plan for 25-031",
      "dailyPlan.submit",
      { job: "25-031" },
    );
    expect(ambiguousSubmit.result.refused).toBe(true);
    expect(ambiguousSubmit.result.summary).toMatch(
      /Which plan should I submit/i,
    );
  });

  it("rail approve today's report acts once (+203,500¢) despite seeded tomorrow draft", async () => {
    const ctx = await freshSandbox();
    const today = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in today) throw new Error(today.refused);
    const line = await addPlanLine(ctx.superintendent, today.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    if ("refused" in line) throw new Error(line.refused);

    const issued = await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
      job: "25-031",
      planId: today.planId,
    });
    expect(issued.result.refused).toBeFalsy();

    const reported = await run(ctx.foreman, "Report", "dailyReport.post", {
      job: "25-031",
      planId: today.planId,
      actuals: [{ lineId: line.lineId, manHours: 22, qty: 12 }],
    });
    expect(reported.result.refused).toBeFalsy();

    const [itemBefore] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, ctx.costOnCedar));
    const actualBefore = itemBefore.actualCents;

    const prompt = "Approve today's report on 25-031";
    const intent = route(prompt, JOB_REFS);
    expect(intent).toEqual({
      action: "dailyPlan.approve",
      args: { job: "25-031", date: "today" },
    });
    const approved = await run(
      ctx.superintendent,
      prompt,
      intent!.action,
      intent!.args,
    );
    expect(approved.result.refused).toBeFalsy();
    expect(approved.result.summary).toMatch(/Approved Bridge Crew 2/);
    expect(approved.result.summary).toMatch(/actual cost/);
    expect(approved.result.summary).not.toMatch(/Which report/i);
    expect(approved.result.summary).not.toMatch(/draft/i);

    const expected = 22 * BRIDGE_RATE;
    expect(expected).toBe(203_500);
    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, ctx.costOnCedar));
    expect(itemAfter.actualCents - actualBefore).toBe(expected);

    const [seededTomorrow] = await db!
      .select()
      .from(dailyPlans)
      .where(
        eq(dailyPlans.id, seedId(ctx.companyId, "plan:cedar:tomorrow")),
      );
    expect(seededTomorrow.status).toBe("draft");

    const again = await run(
      ctx.superintendent,
      prompt,
      intent!.action,
      intent!.args,
    );
    expect(again.result.summary).toMatch(/already approved/i);
    const [itemFinal] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, ctx.costOnCedar));
    expect(itemFinal.actualCents).toBe(itemAfter.actualCents);
  });

  it("rail approve with crew named hits today's reported plan", async () => {
    const ctx = await freshSandbox();
    const today = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in today) throw new Error(today.refused);
    const culvert = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.culvertCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in culvert) throw new Error(culvert.refused);
    const bLine = await addPlanLine(ctx.superintendent, today.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "1",
      hours: "10",
    });
    if ("refused" in bLine) throw new Error(bLine.refused);
    const cLine = await addPlanLine(ctx.superintendent, culvert.planId, {
      costItemId: ctx.cost310,
      qty: "100",
      workers: "1",
      hours: "10",
    });
    if ("refused" in cLine) throw new Error(cLine.refused);
    for (const planId of [today.planId, culvert.planId]) {
      expect(
        (
          await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
            job: "25-031",
            planId,
          })
        ).result.refused,
      ).toBeFalsy();
    }
    for (const [planId, lineId] of [
      [today.planId, bLine.lineId],
      [culvert.planId, cLine.lineId],
    ] as const) {
      expect(
        (
          await run(ctx.foreman, "Report", "dailyReport.post", {
            job: "25-031",
            planId,
            actuals: [{ lineId, manHours: 10, qty: 1 }],
          })
        ).result.refused,
      ).toBeFalsy();
    }

    const ambiguous = route("Approve today's report on 25-031", JOB_REFS)!;
    const ask = await run(
      ctx.superintendent,
      "Approve today's report on 25-031",
      ambiguous.action,
      ambiguous.args,
    );
    expect(ask.result.refused).toBe(true);
    expect(ask.result.summary).toMatch(/Which report should I approve/i);

    const prompt = "Approve today's Bridge Crew 2 report on 25-031";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent.args).toMatchObject({
      job: "25-031",
      date: "today",
      crew: "Bridge Crew 2",
    });
    const approved = await run(
      ctx.superintendent,
      prompt,
      intent.action,
      intent.args,
    );
    expect(approved.result.refused).toBeFalsy();
    expect(approved.result.summary).toMatch(/Approved Bridge Crew 2/);
    expect(approved.result.summary).not.toMatch(/Culvert/i);

    const [bridgeRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, today.planId));
    const [culvertRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, culvert.planId));
    expect(bridgeRow.status).toBe("approved");
    expect(culvertRow.status).toBe("reported");
  });

  it("job-only approve acts on the one reported plan beside the seeded draft", async () => {
    // Must-fail: if approve statuses also count draft (or approved), this asks
    // instead of acting — the seeded Oct 21 draft shares the job with no date.
    const ctx = await freshSandbox();
    const today = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in today) throw new Error(today.refused);
    const line = await addPlanLine(ctx.superintendent, today.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    if ("refused" in line) throw new Error(line.refused);
    expect(
      (
        await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
          job: "25-031",
          planId: today.planId,
        })
      ).result.refused,
    ).toBeFalsy();
    expect(
      (
        await run(ctx.foreman, "Report", "dailyReport.post", {
          job: "25-031",
          planId: today.planId,
          actuals: [{ lineId: line.lineId, manHours: 22, qty: 12 }],
        })
      ).result.refused,
    ).toBeFalsy();

    const [seededTomorrow] = await db!
      .select()
      .from(dailyPlans)
      .where(
        eq(dailyPlans.id, seedId(ctx.companyId, "plan:cedar:tomorrow")),
      );
    expect(seededTomorrow.status).toBe("draft");

    const prompt = "Approve the report on 25-031";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent.args).toEqual({ job: "25-031" });
    expect(intent.args.date).toBeUndefined();

    const [itemBefore] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, ctx.costOnCedar));
    const approved = await run(
      ctx.superintendent,
      prompt,
      intent.action,
      intent.args,
    );
    expect(approved.result.refused).toBeFalsy();
    expect(approved.result.summary).toMatch(/Approved Bridge Crew 2/);
    expect(approved.result.summary).toMatch(/actual cost/);
    expect(approved.result.summary).not.toMatch(/Which report/i);
    expect(approved.result.summary).not.toMatch(/draft/i);
    const [itemAfter] = await db!
      .select()
      .from(costItems)
      .where(eq(costItems.id, ctx.costOnCedar));
    expect(itemAfter.actualCents - itemBefore.actualCents).toBe(22 * BRIDGE_RATE);
    expect(seededTomorrow.status).toBe("draft");
  });

  it("job-only report acts on the issued working plan — never asks across history", async () => {
    // Must-fail: if scopedPlan includes past approved days, report asks with a
    // 30-day list instead of posting against tomorrow's issued seed plan.
    const ctx = await freshSandbox();
    const tomorrowId = seedId(ctx.companyId, "plan:cedar:tomorrow");
    expect(
      (
        await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
          job: "25-031",
          planId: tomorrowId,
        })
      ).result.refused,
    ).toBeFalsy();

    const pourLine = seedId(ctx.companyId, "plan-line:cedar:0");
    const reported = await run(ctx.foreman, "Report 72 MH on 04-210", "dailyReport.post", {
      job: "25-031",
      actuals: [{ lineId: pourLine, manHours: 72, qty: 38 }],
    });
    expect(reported.result.refused).toBeFalsy();
    expect(reported.result.summary).not.toMatch(/Which plan should I report/i);
    expect(reported.result.summary).not.toMatch(/Sep /);
    expect(reported.result.summary).toMatch(/72/);
    const [row] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, tomorrowId));
    expect(row.status).toBe("reported");
  });

  it("job-only return acts on the one reported plan beside the seeded draft", async () => {
    // Must-fail: if return statuses also count draft, this asks instead of acting.
    const ctx = await freshSandbox();
    const today = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in today) throw new Error(today.refused);
    const line = await addPlanLine(ctx.superintendent, today.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    if ("refused" in line) throw new Error(line.refused);
    expect(
      (
        await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
          job: "25-031",
          planId: today.planId,
        })
      ).result.refused,
    ).toBeFalsy();
    expect(
      (
        await run(ctx.foreman, "Report", "dailyReport.post", {
          job: "25-031",
          planId: today.planId,
          actuals: [{ lineId: line.lineId, manHours: 22, qty: 12 }],
        })
      ).result.refused,
    ).toBeFalsy();

    const prompt = "Return the report on 25-031 because Recount pour";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent.args).toEqual({
      job: "25-031",
      reason: "Recount pour",
    });
    expect(intent.args.date).toBeUndefined();

    const returned = await run(
      ctx.superintendent,
      prompt,
      intent.action,
      intent.args,
    );
    expect(returned.result.refused).toBeFalsy();
    expect(returned.result.summary).toMatch(/Returned Bridge Crew 2/);
    expect(returned.result.summary).not.toMatch(/Which report/i);
    expect(returned.result.summary).not.toMatch(/draft/i);
    const [todayRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, today.planId));
    expect(todayRow.status).toBe("issued");
    const [seededTomorrow] = await db!
      .select()
      .from(dailyPlans)
      .where(
        eq(dailyPlans.id, seedId(ctx.companyId, "plan:cedar:tomorrow")),
      );
    expect(seededTomorrow.status).toBe("draft");
  });

  it("approve today's report acts on the reported crew when another is already approved", async () => {
    // Bridge approved + Culvert reported today → act on Culvert; approved is not a choice.
    const ctx = await freshSandbox();
    const bridge = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in bridge) throw new Error(bridge.refused);
    const culvert = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.culvertCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in culvert) throw new Error(culvert.refused);
    const bLine = await addPlanLine(ctx.superintendent, bridge.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "1",
      hours: "10",
    });
    if ("refused" in bLine) throw new Error(bLine.refused);
    const cLine = await addPlanLine(ctx.superintendent, culvert.planId, {
      costItemId: ctx.cost310,
      qty: "100",
      workers: "1",
      hours: "10",
    });
    if ("refused" in cLine) throw new Error(cLine.refused);
    for (const planId of [bridge.planId, culvert.planId]) {
      expect(
        (
          await run(ctx.superintendent, "Submit", "dailyPlan.submit", {
            job: "25-031",
            planId,
          })
        ).result.refused,
      ).toBeFalsy();
    }
    for (const [planId, lineId] of [
      [bridge.planId, bLine.lineId],
      [culvert.planId, cLine.lineId],
    ] as const) {
      expect(
        (
          await run(ctx.foreman, "Report", "dailyReport.post", {
            job: "25-031",
            planId,
            actuals: [{ lineId, manHours: 10, qty: 1 }],
          })
        ).result.refused,
      ).toBeFalsy();
    }

    const bridgeApproved = await run(
      ctx.superintendent,
      "Approve (button)",
      "dailyPlan.approve",
      { job: "25-031", planId: bridge.planId },
    );
    expect(bridgeApproved.result.refused).toBeFalsy();
    expect(bridgeApproved.result.summary).toMatch(/Approved Bridge Crew 2/);

    const prompt = "Approve today's report on 25-031";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent.args).toEqual({ job: "25-031", date: "today" });
    const approved = await run(
      ctx.superintendent,
      prompt,
      intent.action,
      intent.args,
    );
    expect(approved.result.refused).toBeFalsy();
    expect(approved.result.summary).toMatch(/Approved Culvert Crew A/);
    expect(approved.result.summary).not.toMatch(/Which report/i);
    expect(approved.result.summary).not.toMatch(/Bridge Crew 2/);

    const [bridgeRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, bridge.planId));
    const [culvertRow] = await db!
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.id, culvert.planId));
    expect(bridgeRow.status).toBe("approved");
    expect(culvertRow.status).toBe("approved");
  });

  it("rail add-line with crew named hits that draft — not first-of-several", async () => {
    const ctx = await freshSandbox();
    const bridge = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in bridge) throw new Error(bridge.refused);
    const culvert = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.culvertCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in culvert) throw new Error(culvert.refused);

    const prompt =
      "Add 04-210 to today's Bridge Crew 2 plan on 25-031: 12 CY, 3 workers, 8 hours";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent).toMatchObject({
      action: "dailyPlan.addLine",
      args: {
        job: "25-031",
        costCode: "04-210",
        date: "today",
        crew: "Bridge Crew 2",
      },
    });
    const added = await run(
      ctx.superintendent,
      prompt,
      intent.action,
      intent.args,
    );
    expect(added.result.refused).toBeFalsy();
    expect(added.result.summary).toMatch(/Bridge Crew 2/);
    expect(added.result.summary).not.toMatch(/Which plan/i);
    expect(added.result.summary).not.toMatch(/no plan/i);

    const bridgeLines = await db!
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.planId, bridge.planId));
    const culvertLines = await db!
      .select()
      .from(dailyPlanLines)
      .where(eq(dailyPlanLines.planId, culvert.planId));
    expect(bridgeLines).toHaveLength(1);
    expect(culvertLines).toHaveLength(0);
  });

  it("rail add-line and remove-line ask when more than one plan matches", async () => {
    const ctx = await freshSandbox();
    const bridge = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.bridgeCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in bridge) throw new Error(bridge.refused);
    const culvert = await createDailyPlan(ctx.superintendent, {
      jobId: ctx.cedarJobId,
      crewId: ctx.culvertCrewId,
      planDate: "2026-10-20",
    });
    if ("refused" in culvert) throw new Error(culvert.refused);
    await addPlanLine(ctx.superintendent, bridge.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });
    await addPlanLine(ctx.superintendent, culvert.planId, {
      costItemId: ctx.costOnCedar,
      qty: "12",
      workers: "3",
      hours: "8",
    });

    const addPrompt =
      "Add 04-310 to today's plan on 25-031: 1 CY, 1 workers, 8 hours";
    const addIntent = route(addPrompt, JOB_REFS)!;
    expect(addIntent.args.crew).toBeUndefined();
    const addAsk = await run(
      ctx.superintendent,
      addPrompt,
      addIntent.action,
      addIntent.args,
    );
    expect(addAsk.result.refused).toBe(true);
    expect(addAsk.result.summary).toMatch(/Which plan should I add a line to/i);
    expect(addAsk.result.summary).toMatch(/Bridge Crew 2/);
    expect(addAsk.result.summary).toMatch(/Culvert Crew A/);
    expect(addAsk.result.summary).not.toMatch(/no plan/i);

    const removePrompt = "Remove 04-210 from today's plan on 25-031";
    const removeIntent = route(removePrompt, JOB_REFS)!;
    expect(removeIntent.args.crew).toBeUndefined();
    const removeAsk = await run(
      ctx.superintendent,
      removePrompt,
      removeIntent.action,
      removeIntent.args,
    );
    expect(removeAsk.result.refused).toBe(true);
    expect(removeAsk.result.summary).toMatch(/Which plan should I change/i);
    expect(removeAsk.result.summary).not.toMatch(/Removed/i);

    for (const planId of [bridge.planId, culvert.planId]) {
      const lines = await db!
        .select()
        .from(dailyPlanLines)
        .where(eq(dailyPlanLines.planId, planId));
      expect(lines).toHaveLength(1);
    }
  });
});

describe.skipIf(!db)("updateLine pour uniqueness after 24-118 reported seed", () => {
  const created: string[] = [];
  const prevSeedNow = process.env.V5_SEED_NOW;

  afterAll(async () => {
    if (prevSeedNow === undefined) delete process.env.V5_SEED_NOW;
    else process.env.V5_SEED_NOW = prevSeedNow;
    for (const id of created) {
      await db!.delete(companies).where(eq(companies.id, id));
    }
  }, 120_000);

  it("Change the pour picks Cedar draft when LA tomorrow lands on seeded today plans", async () => {
    // UTC morning = prior evening in America/Los_Angeles: seed isoDate(today)
    // equals LA "tomorrow", so date:"tomorrow" would see Culvert issued +
    // Interchange reported. Drafts + lineRef "pour" must still hit Cedar 04-210.
    process.env.V5_SEED_NOW = "2026-10-21T06:00:00.000Z";
    const companyId = await createSandbox();
    created.push(companyId);
    const foreman: CurrentUser = {
      userId: seedId(companyId, "user:foreman"),
      companyId,
      name: "Luis Ortega",
      title: "Foreman",
      role: "foreman",
      companyName: "Demo",
      seededAt: new Date("2026-10-21T06:00:00.000Z"),
      expiresAt: null,
    };
    const prompt = "Change the pour to 80 man-hours";
    const intent = route(prompt, JOB_REFS)!;
    expect(intent.action).toBe("dailyPlan.updateLine");
    const out = await run(foreman, prompt, intent.action, intent.args);
    expect(out.result.summary).toMatch(/man-hours 60 → 80/);
    expect(out.result.summary).toMatch(/04-210/);
    expect(out.result.summary).not.toMatch(/Which plan/);
    expect(out.result.summary).not.toMatch(/Culvert Crew A/);
    expect(out.result.summary).not.toMatch(/Interchange Crew 1/);
  }, 120_000);
});

describe("formatMhPerUnit", () => {
  it("shows stored thousandths, not toPrecision(2) rounding", () => {
    expect(formatMhPerUnit(2)).toBe("2.000");
    expect(formatMhPerUnit(1.6)).toBe("1.600");
    expect(formatMhPerUnit(0.004)).toBe("0.004");
    expect(formatMhPerUnit(0.006)).toBe("0.006");
    expect(formatMhPerUnit(1.6)).not.toBe((1.6).toPrecision(2));
  });
});
