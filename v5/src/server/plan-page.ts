import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  actionRuns,
  costItems,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { utcDay } from "@/lib/dates";
import { isUuid } from "@/lib/uuid";
import { planLine } from "@/server/data";
import { laborRateForPlan } from "@/server/plans";

export type PlanHistoryEvent = {
  kind: "created" | "issued" | "reported" | "returned" | "approved";
  at: string;
  who: string | null;
  detail?: string;
};

/**
 * Read-only daily plan: header, lines, and lifecycle history.
 * Invalid plan ids return null (page calls notFound) — never query Postgres
 * with a non-UUID (that throws and becomes a 500).
 */
export async function getPlanPage(
  companyId: string,
  jobNumber: string,
  planId: string,
) {
  if (!isUuid(planId)) return null;

  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!job) return null;

  const [row] = await db
    .select({
      plan: dailyPlans,
      foreman: users.name,
    })
    .from(dailyPlans)
    .innerJoin(users, eq(users.id, dailyPlans.foremanId))
    .where(
      and(
        eq(dailyPlans.companyId, companyId),
        eq(dailyPlans.jobId, job.id),
        eq(dailyPlans.id, planId),
      ),
    )
    .limit(1);
  if (!row) return null;

  const { plan, foreman } = row;

  const [approver] = plan.approvedById
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(
          and(
            eq(users.id, plan.approvedById),
            eq(users.companyId, companyId),
          ),
        )
        .limit(1)
    : [];

  const lineRows = await db
    .select({ line: dailyPlanLines, item: costItems })
    .from(dailyPlanLines)
    .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
    .where(
      and(
        eq(dailyPlanLines.companyId, companyId),
        eq(dailyPlanLines.planId, plan.id),
      ),
    )
    .orderBy(asc(dailyPlanLines.sort));

  const lines = lineRows.map(({ line, item }) => {
    const base = planLine(line, item);
    return {
      ...base,
      reportedManHours:
        line.reportedHoursTenths == null
          ? null
          : line.reportedHoursTenths / 10,
      reportedQtyMilli: line.reportedQtyMilli,
    };
  });

  const rateCents = await laborRateForPlan(requireDb(), plan.id);
  const history = await buildPlanHistory({
    companyId,
    jobNumber,
    plan,
    foreman,
    approverName: approver?.name ?? null,
  });

  return {
    job: {
      id: job.id,
      number: job.number,
      name: job.name,
      shortName: job.shortName,
    },
    plan: {
      id: plan.id,
      planDate: plan.planDate,
      crew: plan.crew,
      foreman,
      status: plan.status,
      weather: plan.weather,
      rateCents,
      returnReason: plan.returnReason,
    },
    lines,
    history,
  };
}

export type PlanPage = NonNullable<Awaited<ReturnType<typeof getPlanPage>>>;

/**
 * History keyed by plan date + crew identity (crewId when Part A dual-writes it,
 * else the crew text). Matching by crew name alone floods every plan after Part B's
 * 30 working days.
 */
async function buildPlanHistory(args: {
  companyId: string;
  jobNumber: string;
  plan: typeof dailyPlans.$inferSelect;
  foreman: string;
  approverName: string | null;
}): Promise<PlanHistoryEvent[]> {
  const { companyId, jobNumber, plan, foreman, approverName } = args;
  const db = requireDb();

  const extra = plan as typeof plan & {
    createdAt?: Date | null;
    createdById?: string | null;
    reportedAt?: Date | null;
    crewId?: string | null;
  };

  let createdByName: string | null = null;
  if (extra.createdById) {
    const [u] = await db
      .select({ name: users.name })
      .from(users)
      .where(
        and(eq(users.id, extra.createdById), eq(users.companyId, companyId)),
      )
      .limit(1);
    createdByName = u?.name ?? null;
  }

  const dateLabel = utcDay(plan.planDate);
  const crewKey = (extra.crewId ?? plan.crew).toLowerCase();

  const runs = await db
    .select({
      action: actionRuns.action,
      summary: actionRuns.summary,
      args: actionRuns.args,
      createdAt: actionRuns.createdAt,
      userName: users.name,
    })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(
      and(
        eq(actionRuns.companyId, companyId),
        sql`${actionRuns.args}->>'job' = ${jobNumber}`,
        sql`${actionRuns.action} in (
          'dailyPlan.submit',
          'dailyReport.post',
          'dailyPlan.return',
          'dailyPlan.approve'
        )`,
      ),
    )
    .orderBy(asc(actionRuns.createdAt));

  /** This plan only: date label in the summary, plus crew id or crew name. */
  const forThisPlan = (r: {
    summary: string;
    args: unknown;
  }) => {
    const args = (r.args ?? {}) as Record<string, unknown>;
    if (typeof args.planId === "string" && args.planId === plan.id) return true;
    if (typeof args.crewId === "string" && extra.crewId) {
      return (
        args.crewId === extra.crewId &&
        r.summary.includes(dateLabel)
      );
    }
    const s = r.summary.toLowerCase();
    return r.summary.includes(dateLabel) && s.includes(crewKey);
  };

  const events: PlanHistoryEvent[] = [];

  if (extra.createdAt) {
    events.push({
      kind: "created",
      at: extra.createdAt.toISOString(),
      who: createdByName ?? foreman,
    });
  }

  if (plan.submittedAt) {
    const issueRun = runs.find(
      (r) => r.action === "dailyPlan.submit" && forThisPlan(r),
    );
    events.push({
      kind: "issued",
      at: plan.submittedAt.toISOString(),
      who: issueRun?.userName ?? foreman,
    });
  }

  const reportRuns = runs.filter(
    (r) => r.action === "dailyReport.post" && forThisPlan(r),
  );
  if (reportRuns.length) {
    for (const r of reportRuns) {
      events.push({
        kind: "reported",
        at: r.createdAt.toISOString(),
        who: r.userName,
      });
    }
  } else if (extra.reportedAt) {
    events.push({
      kind: "reported",
      at: extra.reportedAt.toISOString(),
      who: foreman,
    });
  }

  if (plan.returnedAt && plan.returnReason) {
    const returnRun = runs.find(
      (r) => r.action === "dailyPlan.return" && forThisPlan(r),
    );
    events.push({
      kind: "returned",
      at: plan.returnedAt.toISOString(),
      who: returnRun?.userName ?? null,
      detail: plan.returnReason,
    });
  } else {
    for (const r of runs.filter(
      (x) => x.action === "dailyPlan.return" && forThisPlan(x),
    )) {
      const reason =
        r.summary.match(/:\s*(.+)$/)?.[1]?.trim() ||
        r.summary.match(/Returned[^:]*:\s*(.+)$/i)?.[1]?.trim() ||
        undefined;
      events.push({
        kind: "returned",
        at: r.createdAt.toISOString(),
        who: r.userName,
        detail: reason,
      });
    }
  }

  if (plan.approvedAt) {
    events.push({
      kind: "approved",
      at: plan.approvedAt.toISOString(),
      who: approverName,
    });
  }

  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}
