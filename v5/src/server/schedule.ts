/**
 * Schedule baselines (5.1.2-a). Append-only set / re-baseline.
 * PV date reads from baseline land in 5.1.2-b; Gantt baseline bar in 5.1.2-c.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  activities,
  baselineActivities,
  jobs,
  scheduleBaselines,
} from "@/db/schema";
import { addCalendarDays } from "@/lib/plan-date";
import { getSeedClock } from "@/server/seed-clock";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Q = Db | Tx;

export type BaselineActor = { userId: string; role: string };

export type ScheduleBaselineView = {
  id: string;
  name: string;
  reason: string;
  setAt: string;
  setById: string | null;
  activityCount: number;
};

export type SetBaselineResult =
  | {
      ok: true;
      baseline: ScheduleBaselineView;
      job: { number: string; shortName: string };
      /** True when this was the first baseline on the job. */
      first: boolean;
    }
  | {
      ok: false;
      refusal:
        | { kind: "missing_job" }
        | { kind: "estimate_not_approved" }
        | { kind: "no_activities" }
        | { kind: "empty_name" }
        | { kind: "empty_reason" }
        | { kind: "baseline_exists" }
        | { kind: "no_baseline" }
        | { kind: "immutable" };
      job?: { number: string; shortName: string };
    };

/**
 * Inclusive CPM / activity finish → exclusive end for plannedValueCents.
 * A finish of 2026-11-12 spreads through that calendar day; PV needs finish+1.
 */
export function finishExclusiveOn(finishOn: string): string {
  return addCalendarDays(finishOn, 1);
}

/** Refuse any attempt to mutate a frozen baseline row (screen / rail). */
export function refuseBaselineEdit(): SetBaselineResult {
  return { ok: false, refusal: { kind: "immutable" } };
}

async function loadJob(q: Q, companyId: string, jobNumber: string) {
  const [row] = await q
    .select({
      id: jobs.id,
      number: jobs.number,
      shortName: jobs.shortName,
      estimateStatus: jobs.estimateStatus,
    })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  return row ?? null;
}

async function countBaselines(q: Q, companyId: string, jobId: string) {
  const [row] = await q
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(scheduleBaselines)
    .where(
      and(
        eq(scheduleBaselines.companyId, companyId),
        eq(scheduleBaselines.jobId, jobId),
      ),
    );
  return row?.n ?? 0;
}

async function copyActivitiesToBaseline(
  tx: Tx,
  args: {
    companyId: string;
    jobId: string;
    baselineId: string;
  },
): Promise<number> {
  const rows = await tx
    .select({
      id: activities.id,
      earlyStartOn: activities.earlyStartOn,
      earlyFinishOn: activities.earlyFinishOn,
      durationDays: activities.durationDays,
    })
    .from(activities)
    .where(
      and(
        eq(activities.companyId, args.companyId),
        eq(activities.jobId, args.jobId),
      ),
    )
    .orderBy(asc(activities.code));

  if (rows.length === 0) return 0;

  await tx.insert(baselineActivities).values(
    rows.map((a) => ({
      id: randomUUID(),
      companyId: args.companyId,
      baselineId: args.baselineId,
      activityId: a.id,
      startOn: a.earlyStartOn,
      finishOn: a.earlyFinishOn,
      durationDays: a.durationDays,
    })),
  );
  return rows.length;
}

async function insertBaseline(
  tx: Tx,
  args: {
    companyId: string;
    jobId: string;
    name: string;
    reason: string;
    setById: string;
    setAt: Date;
  },
): Promise<{ id: string; activityCount: number }> {
  const id = randomUUID();
  await tx.insert(scheduleBaselines).values({
    id,
    companyId: args.companyId,
    jobId: args.jobId,
    name: args.name,
    reason: args.reason,
    setAt: args.setAt,
    setById: args.setById,
  });
  const activityCount = await copyActivitiesToBaseline(tx, {
    companyId: args.companyId,
    jobId: args.jobId,
    baselineId: id,
  });
  return { id, activityCount };
}

function trimRequired(value: string | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length > 0 ? t : null;
}

/**
 * First baseline on a job. Refused when any baseline already exists — use rebaseline.
 * PM role is enforced by the assistant action wrapper, not here.
 */
export async function setBaseline(
  companyId: string,
  actor: BaselineActor,
  jobNumber: string,
  args: { name?: string; reason?: string },
): Promise<SetBaselineResult> {
  const name = trimRequired(args.name);
  if (!name) return { ok: false, refusal: { kind: "empty_name" } };
  const reason = trimRequired(args.reason);
  if (!reason) return { ok: false, refusal: { kind: "empty_reason" } };

  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await loadJob(tx, companyId, jobNumber);
    if (!job) return { ok: false, refusal: { kind: "missing_job" } };
    const jobRef = { number: job.number, shortName: job.shortName };
    if (job.estimateStatus !== "approved")
      return {
        ok: false,
        refusal: { kind: "estimate_not_approved" },
        job: jobRef,
      };

    const existing = await countBaselines(tx, companyId, job.id);
    if (existing > 0)
      return {
        ok: false,
        refusal: { kind: "baseline_exists" },
        job: jobRef,
      };

    const [actCount] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(activities)
      .where(
        and(eq(activities.companyId, companyId), eq(activities.jobId, job.id)),
      );
    if ((actCount?.n ?? 0) === 0)
      return {
        ok: false,
        refusal: { kind: "no_activities" },
        job: jobRef,
      };

    const setAt = getSeedClock();
    const { id, activityCount } = await insertBaseline(tx, {
      companyId,
      jobId: job.id,
      name,
      reason,
      setById: actor.userId,
      setAt,
    });

    return {
      ok: true,
      first: true,
      job: jobRef,
      baseline: {
        id,
        name,
        reason,
        setAt: setAt.toISOString(),
        setById: actor.userId,
        activityCount,
      },
    };
  });
}

/**
 * Append a new baseline. Prior baselines stay readable; PV (5.1.2-b) uses latest.
 * Requires a non-empty reason. Refused when no baseline exists yet — use setBaseline.
 */
export async function rebaseline(
  companyId: string,
  actor: BaselineActor,
  jobNumber: string,
  args: { name?: string; reason?: string },
): Promise<SetBaselineResult> {
  const name = trimRequired(args.name);
  if (!name) return { ok: false, refusal: { kind: "empty_name" } };
  const reason = trimRequired(args.reason);
  if (!reason) return { ok: false, refusal: { kind: "empty_reason" } };

  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await loadJob(tx, companyId, jobNumber);
    if (!job) return { ok: false, refusal: { kind: "missing_job" } };
    const jobRef = { number: job.number, shortName: job.shortName };
    if (job.estimateStatus !== "approved")
      return {
        ok: false,
        refusal: { kind: "estimate_not_approved" },
        job: jobRef,
      };

    const existing = await countBaselines(tx, companyId, job.id);
    if (existing === 0)
      return {
        ok: false,
        refusal: { kind: "no_baseline" },
        job: jobRef,
      };

    const [actCount] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(activities)
      .where(
        and(eq(activities.companyId, companyId), eq(activities.jobId, job.id)),
      );
    if ((actCount?.n ?? 0) === 0)
      return {
        ok: false,
        refusal: { kind: "no_activities" },
        job: jobRef,
      };

    const setAt = getSeedClock();
    const { id, activityCount } = await insertBaseline(tx, {
      companyId,
      jobId: job.id,
      name,
      reason,
      setById: actor.userId,
      setAt,
    });

    return {
      ok: true,
      first: false,
      job: jobRef,
      baseline: {
        id,
        name,
        reason,
        setAt: setAt.toISOString(),
        setById: actor.userId,
        activityCount,
      },
    };
  });
}

/** Baselines for a job, oldest first (append-only history). */
export async function listBaselines(
  companyId: string,
  jobNumber: string,
): Promise<{
  job: { number: string; shortName: string } | null;
  baselines: ScheduleBaselineView[];
}> {
  const db = requireDb();
  const job = await loadJob(db, companyId, jobNumber);
  if (!job) return { job: null, baselines: [] };

  const rows = await db
    .select({
      id: scheduleBaselines.id,
      name: scheduleBaselines.name,
      reason: scheduleBaselines.reason,
      setAt: scheduleBaselines.setAt,
      setById: scheduleBaselines.setById,
      activityCount: sql<number>`count(${baselineActivities.id})`.mapWith(
        Number,
      ),
    })
    .from(scheduleBaselines)
    .leftJoin(
      baselineActivities,
      eq(baselineActivities.baselineId, scheduleBaselines.id),
    )
    .where(
      and(
        eq(scheduleBaselines.companyId, companyId),
        eq(scheduleBaselines.jobId, job.id),
      ),
    )
    .groupBy(
      scheduleBaselines.id,
      scheduleBaselines.name,
      scheduleBaselines.reason,
      scheduleBaselines.setAt,
      scheduleBaselines.setById,
    )
    .orderBy(asc(scheduleBaselines.setAt), asc(scheduleBaselines.id));

  return {
    job: { number: job.number, shortName: job.shortName },
    baselines: rows.map((r) => ({
      id: r.id,
      name: r.name,
      reason: r.reason,
      setAt: r.setAt.toISOString(),
      setById: r.setById,
      activityCount: r.activityCount,
    })),
  };
}

/** Latest baseline for a job, or null when none. */
export async function latestBaseline(
  companyId: string,
  jobId: string,
  q: Q = requireDb(),
): Promise<{ id: string; name: string; setAt: Date } | null> {
  const [row] = await q
    .select({
      id: scheduleBaselines.id,
      name: scheduleBaselines.name,
      setAt: scheduleBaselines.setAt,
    })
    .from(scheduleBaselines)
    .where(
      and(
        eq(scheduleBaselines.companyId, companyId),
        eq(scheduleBaselines.jobId, jobId),
      ),
    )
    .orderBy(desc(scheduleBaselines.setAt), desc(scheduleBaselines.id))
    .limit(1);
  return row ?? null;
}
