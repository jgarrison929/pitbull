import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { requireDb } from "@/db";
import {
  costItems,
  crews,
  dailyPlanEvents,
  dailyPlanLines,
  dailyPlans,
  jobs,
  users,
} from "@/db/schema";
import { CREW_RATE_EXPAND_DEFAULT_CENTS } from "@/lib/crew-rates";
import { isUuid } from "@/lib/uuid";
import { planLine } from "@/server/data";
import type { PlanEventKind } from "@/server/plan-events";
import { planLaborRateCentsSql } from "@/server/plans";
import type { Role } from "@/server/session";

export type PlanHistoryEvent = {
  kind: PlanEventKind;
  at: string;
  actorRole: Role;
  detail?: string;
};

/**
 * Read-only daily plan: header, lines, and lifecycle history.
 * Invalid plan ids return null (page calls notFound) — never query Postgres
 * with a non-UUID (that throws and becomes a 500).
 *
 * After the job lookup, plan header (+ rate), lines, and history overlap —
 * same numbers as the prior serial chain, fewer RTTs on cold / burst paths.
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

  const [row, lineRows, history] = await Promise.all([
    db
      .select({
        plan: dailyPlans,
        foreman: users.name,
        crewName: crews.name,
        // Same coalesce as laborRateForPlan — one RTT instead of a follow-up.
        rateCents: planLaborRateCentsSql,
      })
      .from(dailyPlans)
      .innerJoin(users, eq(users.id, dailyPlans.foremanId))
      .innerJoin(crews, eq(crews.id, dailyPlans.crewId))
      .where(
        and(
          eq(dailyPlans.companyId, companyId),
          eq(dailyPlans.jobId, job.id),
          eq(dailyPlans.id, planId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ line: dailyPlanLines, item: costItems })
      .from(dailyPlanLines)
      .innerJoin(costItems, eq(costItems.id, dailyPlanLines.costItemId))
      .where(
        and(
          eq(dailyPlanLines.companyId, companyId),
          eq(dailyPlanLines.planId, planId),
        ),
      )
      .orderBy(asc(dailyPlanLines.sort)),
    buildPlanHistory(companyId, planId),
  ]);

  if (!row) return null;

  const { plan, foreman, crewName, rateCents } = row;

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
      crew: crewName,
      foreman,
      status: plan.status,
      weather: plan.weather,
      rateCents: rateCents ?? CREW_RATE_EXPAND_DEFAULT_CENTS,
      returnReason: plan.returnReason,
    },
    lines,
    history,
  };
}

export type PlanPage = NonNullable<Awaited<ReturnType<typeof getPlanPage>>>;

/**
 * History from append-only daily_plan_events only — roles, never display names.
 */
export async function buildPlanHistory(
  companyId: string,
  planId: string,
): Promise<PlanHistoryEvent[]> {
  const db = requireDb();
  const rows = await db
    .select({
      kind: dailyPlanEvents.kind,
      at: dailyPlanEvents.at,
      actorRole: dailyPlanEvents.actorRole,
      detail: dailyPlanEvents.detail,
    })
    .from(dailyPlanEvents)
    .where(
      and(
        eq(dailyPlanEvents.companyId, companyId),
        eq(dailyPlanEvents.planId, planId),
      ),
    )
    .orderBy(asc(dailyPlanEvents.at), asc(dailyPlanEvents.id));

  return rows.map((r) => ({
    kind: r.kind,
    at: r.at.toISOString(),
    actorRole: r.actorRole,
    ...(r.detail ? { detail: r.detail } : {}),
  }));
}
