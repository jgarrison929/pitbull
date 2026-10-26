import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, max, or, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  costItems,
  crews,
  dailyPlanLines,
  dailyPlans,
  jobs,
} from "@/db/schema";
import { CREW_RATE_EXPAND_DEFAULT_CENTS } from "@/lib/crew-rates";
import {
  applyLineInput,
  type LineInput,
  type LineValues,
} from "@/lib/plan-line";
import {
  planDateInWindow,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";
import { preferPlanKeep } from "@/lib/plan-keep";
import { recordPlanEvent } from "@/server/plan-events";
import { seedNow, getSeedClock } from "@/server/seed-clock";
import type { CurrentUser } from "@/server/session";

export { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";

/** Transaction or shared client — same select surface approve/pending use. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

/**
 * Labor rate on a plan row already joined in a query that LEFT JOINs `crews`
 * on `daily_plans.crew_id`. Coalesce: joined rate → name match → expand DEFAULT.
 * Never null — pending/approve always get a sane cents/MH.
 */
export const planLaborRateCentsSql = sql<number>`coalesce(
  ${crews.laborRateCents},
  (
    select c.labor_rate_cents from crews c
    where c.company_id = ${dailyPlans.companyId}
      and c.name = ${dailyPlans.crew}
    limit 1
  ),
  ${CREW_RATE_EXPAND_DEFAULT_CENTS}
)`.mapWith(Number);

/**
 * Labor rate (cents per MH) for a plan's crew.
 *
 * 1. `crew_id` → crews.labor_rate_cents
 * 2. else match crews by (company_id, daily_plans.crew) — 0013-window NULL crew_id
 * 3. else expand DEFAULT 8500
 *
 * Never throws on a missing crew. Posted cost_entries snapshot this rate.
 */
export async function laborRateForPlan(
  tx: Tx,
  planId: string,
): Promise<number> {
  const [byId] = await tx
    .select({ rateCents: crews.laborRateCents })
    .from(dailyPlans)
    .innerJoin(crews, eq(crews.id, dailyPlans.crewId))
    .where(eq(dailyPlans.id, planId))
    .limit(1);
  if (byId) return byId.rateCents;

  const [byName] = await tx
    .select({ rateCents: crews.laborRateCents })
    .from(dailyPlans)
    .innerJoin(
      crews,
      and(
        eq(crews.companyId, dailyPlans.companyId),
        eq(crews.name, dailyPlans.crew),
      ),
    )
    .where(eq(dailyPlans.id, planId))
    .limit(1);
  if (byName) return byName.rateCents;

  return CREW_RATE_EXPAND_DEFAULT_CENTS;
}

export type PlanWriteOk<T> = T;
export type PlanWriteRefused = { refused: string };
export type PlanWriteResult<T> = PlanWriteOk<T> | PlanWriteRefused;

function refused(msg: string): PlanWriteRefused {
  return { refused: msg };
}

/** Company crews for pickers, seed asserts, and tests. */
export async function listCrews(companyId: string) {
  const db = requireDb();
  return db
    .select({
      id: crews.id,
      name: crews.name,
      foremanId: crews.foremanId,
      laborRateCents: crews.laborRateCents,
    })
    .from(crews)
    .where(eq(crews.companyId, companyId))
    .orderBy(asc(crews.name));
}

export async function findCrewByName(companyId: string, name: string) {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const rows = await listCrews(companyId);
  return (
    rows.find((c) => c.name.toLowerCase() === needle) ??
    rows.find((c) => c.name.toLowerCase().includes(needle)) ??
    null
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function jobRow(companyId: string, jobIdOrNumber: string) {
  const db = requireDb();
  if (UUID_RE.test(jobIdOrNumber)) {
    const [byId] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobIdOrNumber)))
      .limit(1);
    if (byId) return byId;
  }
  const [byNumber] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobIdOrNumber)))
    .limit(1);
  return byNumber ?? null;
}

/**
 * Create a draft daily plan for one job, crew, and date.
 * Copies the crew's foreman at create time onto the plan.
 */
export async function createDailyPlan(
  user: CurrentUser,
  input: { jobId: string; crewId: string; planDate: string },
): Promise<PlanWriteResult<{ planId: string }>> {
  const db = requireDb();
  const job = await jobRow(user.companyId, input.jobId);
  if (!job) return refused("There is no job to plan.");
  if (job.estimateStatus === "draft")
    return refused("Approve the estimate before planning field work.");

  const today = planDateToday(seedNow(), timeZoneForJob(job));
  if (!planDateInWindow(input.planDate, today))
    return refused(
      `Pick a plan date within 14 days of today (${today}).`,
    );

  const [crew] = await db
    .select()
    .from(crews)
    .where(
      and(eq(crews.id, input.crewId), eq(crews.companyId, user.companyId)),
    )
    .limit(1);
  if (!crew) return refused("Pick a crew from this company's list.");

  // Match crew_id, or legacy NULL crew_id rows with the same text crew name.
  const sameCrew = or(
    eq(dailyPlans.crewId, crew.id),
    and(isNull(dailyPlans.crewId), eq(dailyPlans.crew, crew.name)),
  );
  // Same keep rule as 0013: issued (and later) over draft, then newest.
  const dups = await db
    .select({
      id: dailyPlans.id,
      planDate: dailyPlans.planDate,
      status: dailyPlans.status,
      submittedAt: dailyPlans.submittedAt,
      createdAt: dailyPlans.createdAt,
    })
    .from(dailyPlans)
    .where(
      and(
        eq(dailyPlans.companyId, user.companyId),
        eq(dailyPlans.jobId, job.id),
        sameCrew,
        eq(dailyPlans.planDate, input.planDate),
      ),
    );
  const dup = preferPlanKeep(dups);
  if (dup) {
    return refused(
      `${crew.name} already has a ${dup.status} plan for ${dup.planDate} on ${job.number}.`,
    );
  }

  const planId = randomUUID();
  const createdAt = getSeedClock();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(dailyPlans).values({
        id: planId,
        companyId: user.companyId,
        jobId: job.id,
        // Dual-write legacy text until a later contract migration drops it.
        crew: crew.name,
        crewId: crew.id,
        foremanId: crew.foremanId,
        planDate: input.planDate,
        status: "draft",
        weather: "",
        equipment: [],
        createdById: user.userId,
        createdAt,
      });
      await recordPlanEvent(tx, {
        companyId: user.companyId,
        planId,
        kind: "created",
        actor: { userId: user.userId, role: user.role },
        at: createdAt,
      });
    });
  } catch (err) {
    // Race: unique (job, crew, date) — same friendly copy as the pre-check.
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "23505") {
      const raced = await db
        .select({
          id: dailyPlans.id,
          planDate: dailyPlans.planDate,
          status: dailyPlans.status,
          submittedAt: dailyPlans.submittedAt,
          createdAt: dailyPlans.createdAt,
        })
        .from(dailyPlans)
        .where(
          and(
            eq(dailyPlans.companyId, user.companyId),
            eq(dailyPlans.jobId, job.id),
            sameCrew,
            eq(dailyPlans.planDate, input.planDate),
          ),
        );
      const existing = preferPlanKeep(raced);
      if (existing) {
        return refused(
          `${crew.name} already has a ${existing.status} plan for ${existing.planDate} on ${job.number}.`,
        );
      }
      return refused(
        `${crew.name} already has a plan for ${input.planDate} on ${job.number}.`,
      );
    }
    throw err;
  }
  return { planId };
}

async function loadPlan(companyId: string, planId: string) {
  const db = requireDb();
  const [row] = await db
    .select({
      plan: dailyPlans,
      crewName: sql<string>`coalesce(${crews.name}, ${dailyPlans.crew})`.mapWith(
        String,
      ),
      jobNumber: jobs.number,
      jobShortName: jobs.shortName,
    })
    .from(dailyPlans)
    .leftJoin(crews, eq(crews.id, dailyPlans.crewId))
    .innerJoin(jobs, eq(jobs.id, dailyPlans.jobId))
    .where(
      and(eq(dailyPlans.id, planId), eq(dailyPlans.companyId, companyId)),
    )
    .limit(1);
  return row ?? null;
}

/** Resolve a plan by id, or by job + date (+ optional crew name/id). */
export async function resolvePlanForWrite(
  user: CurrentUser,
  opts: {
    planId?: string;
    job?: string;
    date?: string;
    crew?: string;
    crewId?: string;
  },
) {
  const db = requireDb();
  if (opts.planId) {
    const row = await loadPlan(user.companyId, opts.planId);
    return row;
  }
  const job = opts.job ? await jobRow(user.companyId, opts.job) : null;
  if (!job) return null;
  const today = planDateToday(seedNow(), timeZoneForJob(job));
  const planDate = opts.date ?? today;
  let crewId = opts.crewId;
  if (!crewId && opts.crew) {
    const c = await findCrewByName(user.companyId, opts.crew);
    crewId = c?.id;
  }
  const rows = await db
    .select({
      plan: dailyPlans,
      crewName: sql<string>`coalesce(${crews.name}, ${dailyPlans.crew})`.mapWith(
        String,
      ),
      jobNumber: jobs.number,
      jobShortName: jobs.shortName,
    })
    .from(dailyPlans)
    .leftJoin(crews, eq(crews.id, dailyPlans.crewId))
    .innerJoin(jobs, eq(jobs.id, dailyPlans.jobId))
    .where(
      and(
        eq(dailyPlans.companyId, user.companyId),
        eq(dailyPlans.jobId, job.id),
        eq(dailyPlans.planDate, planDate),
        crewId ? eq(dailyPlans.crewId, crewId) : undefined,
      ),
    );
  // Exactly one match — never keep-winner guess (cards pass planId; rail asks).
  if (rows.length !== 1) return null;
  return rows[0];
}

export async function addPlanLine(
  user: CurrentUser,
  planId: string,
  line: LineInput & {
    costItemId?: string;
    activity?: string;
    location?: string;
  },
): Promise<PlanWriteResult<{ lineId: string }>> {
  const db = requireDb();
  const found = await loadPlan(user.companyId, planId);
  if (!found) return refused("There is no plan to add a line to.");
  if (found.plan.status !== "draft")
    return refused(
      `${found.crewName}'s plan for ${found.plan.planDate} is ${found.plan.status}, so lines are locked.`,
    );

  const costItemId = line.costItemId;
  if (!costItemId) return refused("Pick a cost item on this job.");

  // Load by id + company, then require the item's job to match the plan.
  // (Must-fail: removing the jobId check must let a foreign leaf insert.)
  const [item] = await db
    .select()
    .from(costItems)
    .where(
      and(
        eq(costItems.id, costItemId),
        eq(costItems.companyId, user.companyId),
      ),
    )
    .limit(1);
  if (!item || !item.isLeaf)
    return refused(
      "Pick a leaf cost item on this job. Summary codes and other jobs are refused.",
    );
  if (item.jobId !== found.plan.jobId)
    return refused(
      "Pick a leaf cost item on this job. Summary codes and other jobs are refused.",
    );

  const blank: LineValues = {
    costItemId: item.id,
    activity: "",
    location: "",
    qtyMilli: 0,
    workers: 1,
    hoursTenths: 80,
    notes: "",
  };
  const result = applyLineInput(
    blank,
    {
      costItemId: item.id,
      activity: line.activity?.trim() || item.description,
      location: line.location ?? "",
      qty: line.qty,
      workers: line.workers,
      hours: line.hours,
      notes: line.notes,
    },
    [item.id],
  );
  if (result.errors)
    return refused(Object.values(result.errors).join(" "));

  const [sortRow] = await db
    .select({ m: max(dailyPlanLines.sort) })
    .from(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.planId, planId),
        eq(dailyPlanLines.companyId, user.companyId),
      ),
    );
  const sort = (sortRow?.m ?? -1) + 1;
  const lineId = randomUUID();
  await db.insert(dailyPlanLines).values({
    id: lineId,
    companyId: user.companyId,
    planId,
    costItemId: result.values.costItemId,
    activity: result.values.activity,
    location: result.values.location,
    qtyMilli: result.values.qtyMilli,
    workers: result.values.workers,
    hoursTenths: result.values.hoursTenths,
    notes: result.values.notes,
    sort,
  });
  return { lineId };
}

export async function removePlanLine(
  user: CurrentUser,
  planId: string,
  lineId: string,
): Promise<PlanWriteResult<{ ok: true }>> {
  const db = requireDb();
  const found = await loadPlan(user.companyId, planId);
  if (!found) return refused("There is no plan to change.");
  if (found.plan.status !== "draft")
    return refused(
      `${found.crewName}'s plan for ${found.plan.planDate} is ${found.plan.status}, so lines are locked.`,
    );

  const deleted = await db
    .delete(dailyPlanLines)
    .where(
      and(
        eq(dailyPlanLines.id, lineId),
        eq(dailyPlanLines.planId, planId),
        eq(dailyPlanLines.companyId, user.companyId),
      ),
    )
    .returning({ id: dailyPlanLines.id });
  if (!deleted.length) return refused("That plan line isn't on this plan.");
  return { ok: true };
}

export { planDateToday, planDateInWindow };
