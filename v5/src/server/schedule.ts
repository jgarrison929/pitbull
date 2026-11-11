/**
 * 5.1.0-b: schedule writes. One owner for activity / holiday / cost-item date sync.
 * Planned dates on a linked cost item are written only via syncCostItemDatesFromActivities.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  actionRuns,
  activities,
  activityCostItems,
  calendarHolidays,
  costItems,
  jobCalendars,
  jobs,
  users,
} from "@/db/schema";
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  activityDatesBeforeCpm,
  DEFAULT_WORKDAYS_MASK,
} from "@/lib/schedule";
import { isUuid } from "@/lib/uuid";
import {
  createWorkingCalendar,
  type WorkingCalendar,
} from "@/lib/working-calendar";

/** Transaction or shared client. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

export type ScheduleActor = { userId: string; name: string };

export type ScheduleOk<T> = { ok: true } & T;
export type ScheduleRefused = {
  ok: false;
  summary: string;
  refused: true;
};
export type ScheduleResult<T> = ScheduleOk<T> | ScheduleRefused;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DRAFT_REFUSAL = "Approve the estimate before scheduling";

function refused(summary: string): ScheduleRefused {
  return { ok: false, summary, refused: true };
}

/** Inclusive early finish: duration working days starting on `startOn`. */
export function earlyFinishOn(
  cal: WorkingCalendar,
  startOn: string,
  durationDays: number,
): string {
  return durationDays === 1
    ? startOn
    : cal.addWorkingDays(startOn, durationDays - 1);
}

function parseDuration(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isInteger(n)) return null;
  if (n < ACTIVITY_DURATION_MIN_DAYS || n > ACTIVITY_DURATION_MAX_DAYS)
    return null;
  return n;
}

function parseVersion(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function lockJob(tx: Tx, companyId: string, jobNumber: string) {
  const [job] = await tx
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1)
    .for("update");
  return job ?? null;
}

async function loadCalendar(
  tx: Tx,
  companyId: string,
  jobId: string,
): Promise<{
  calendar: typeof jobCalendars.$inferSelect;
  holidays: string[];
  holidayRows: (typeof calendarHolidays.$inferSelect)[];
  working: WorkingCalendar;
} | null> {
  const [calendar] = await tx
    .select()
    .from(jobCalendars)
    .where(
      and(eq(jobCalendars.companyId, companyId), eq(jobCalendars.jobId, jobId)),
    )
    .limit(1);
  if (!calendar) return null;
  const holidayRows = await tx
    .select()
    .from(calendarHolidays)
    .where(
      and(
        eq(calendarHolidays.companyId, companyId),
        eq(calendarHolidays.calendarId, calendar.id),
      ),
    );
  const holidays = holidayRows.map((h) => h.on);
  return {
    calendar,
    holidays,
    holidayRows,
    working: createWorkingCalendar(holidays),
  };
}

async function ensureCalendar(
  tx: Tx,
  companyId: string,
  jobId: string,
): Promise<{
  calendar: typeof jobCalendars.$inferSelect;
  holidays: string[];
  holidayRows: (typeof calendarHolidays.$inferSelect)[];
  working: WorkingCalendar;
}> {
  const existing = await loadCalendar(tx, companyId, jobId);
  if (existing) return existing;
  const id = randomUUID();
  await tx.insert(jobCalendars).values({
    id,
    companyId,
    jobId,
    name: "Job calendar",
    workdaysMask: DEFAULT_WORKDAYS_MASK,
  });
  const created = await loadCalendar(tx, companyId, jobId);
  if (!created) throw new Error("failed to create job calendar");
  return created;
}

async function resolveActivity(
  tx: Tx,
  companyId: string,
  jobId: string,
  activityRef: string,
) {
  const ref = activityRef.trim();
  if (!ref) return null;
  if (isUuid(ref)) {
    const [byId] = await tx
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.companyId, companyId),
          eq(activities.jobId, jobId),
          eq(activities.id, ref),
        ),
      )
      .limit(1)
      .for("update");
    return byId ?? null;
  }
  const [byCode] = await tx
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.companyId, companyId),
        eq(activities.jobId, jobId),
        eq(activities.code, ref),
      ),
    )
    .limit(1)
    .for("update");
  return byCode ?? null;
}

/**
 * Who last successfully wrote this activity (or any schedule write on the job).
 * Used when refusing a stale version (I8) — no updated_by column in 5.1.0-a.
 */
async function lastScheduleEditorName(
  tx: Tx,
  companyId: string,
  jobNumber: string,
  activityCode: string,
): Promise<string | null> {
  const forActivity = await tx
    .select({ name: users.name })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(
      and(
        eq(actionRuns.companyId, companyId),
        sql`${actionRuns.action} like 'schedule.%'`,
        sql`${actionRuns.args}->>'job' = ${jobNumber}`,
        sql`${actionRuns.args}->>'activity' = ${activityCode}`,
        sql`coalesce(${actionRuns.args}->>'refused', '') <> 'true'`,
      ),
    )
    .orderBy(desc(actionRuns.createdAt))
    .limit(1);
  if (forActivity[0]?.name) return forActivity[0].name;

  const forJob = await tx
    .select({ name: users.name })
    .from(actionRuns)
    .innerJoin(users, eq(users.id, actionRuns.userId))
    .where(
      and(
        eq(actionRuns.companyId, companyId),
        sql`${actionRuns.action} like 'schedule.%'`,
        sql`${actionRuns.args}->>'job' = ${jobNumber}`,
        sql`coalesce(${actionRuns.args}->>'refused', '') <> 'true'`,
      ),
    )
    .orderBy(desc(actionRuns.createdAt))
    .limit(1);
  return forJob[0]?.name ?? null;
}

async function staleRefusal(
  tx: Tx,
  companyId: string,
  jobNumber: string,
  act: typeof activities.$inferSelect,
  expectVersion: number,
): Promise<ScheduleRefused> {
  const editor =
    (await lastScheduleEditorName(tx, companyId, jobNumber, act.code)) ??
    "another editor";
  return refused(
    `Activity ${act.code} was edited by ${editor} (now version ${act.version}). You had version ${expectVersion}. Reload and try again.`,
  );
}

/**
 * Earliest earlyStart and latest earlyFinish of linked activities → cost_items.planned_*.
 * Only writer of those columns for a linked cost item.
 */
export async function syncCostItemDatesFromActivities(
  tx: Tx,
  companyId: string,
  costItemIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(costItemIds.filter(Boolean))];
  if (ids.length === 0) return;

  for (const costItemId of ids) {
    const linked = await tx
      .select({
        earlyStartOn: activities.earlyStartOn,
        earlyFinishOn: activities.earlyFinishOn,
      })
      .from(activityCostItems)
      .innerJoin(activities, eq(activities.id, activityCostItems.activityId))
      .where(
        and(
          eq(activityCostItems.companyId, companyId),
          eq(activityCostItems.costItemId, costItemId),
        ),
      );
    if (linked.length === 0) continue;

    let start = linked[0]!.earlyStartOn;
    let finish = linked[0]!.earlyFinishOn;
    for (const row of linked) {
      if (row.earlyStartOn < start) start = row.earlyStartOn;
      if (row.earlyFinishOn > finish) finish = row.earlyFinishOn;
    }
    await tx
      .update(costItems)
      .set({ plannedStartOn: start, plannedFinishOn: finish })
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.id, costItemId),
        ),
      );
  }
}

async function linkedCostItemIds(
  tx: Tx,
  companyId: string,
  activityIds: readonly string[],
): Promise<string[]> {
  if (activityIds.length === 0) return [];
  const rows = await tx
    .select({ costItemId: activityCostItems.costItemId })
    .from(activityCostItems)
    .where(
      and(
        eq(activityCostItems.companyId, companyId),
        inArray(activityCostItems.activityId, [...activityIds]),
      ),
    );
  return [...new Set(rows.map((r) => r.costItemId))];
}

/** Recompute early/late dates from duration + calendar; bump version; sync linked cost items. */
async function recomputeJobActivityDates(
  tx: Tx,
  companyId: string,
  jobId: string,
  working: WorkingCalendar,
): Promise<string[]> {
  const rows = await tx
    .select()
    .from(activities)
    .where(
      and(eq(activities.companyId, companyId), eq(activities.jobId, jobId)),
    )
    .for("update");

  const touched: string[] = [];
  for (const act of rows) {
    let start = act.earlyStartOn;
    if (!working.isWorkingDay(start)) start = working.nextWorkingDay(start);
    const finish = earlyFinishOn(working, start, act.durationDays);
    const dates = activityDatesBeforeCpm(start, finish);
    if (
      start === act.earlyStartOn &&
      finish === act.earlyFinishOn &&
      dates.lateStartOn === act.lateStartOn &&
      dates.lateFinishOn === act.lateFinishOn
    ) {
      continue;
    }
    await tx
      .update(activities)
      .set({
        ...dates,
        version: act.version + 1,
      })
      .where(eq(activities.id, act.id));
    touched.push(act.id);
  }
  const costIds = await linkedCostItemIds(tx, companyId, touched);
  await syncCostItemDatesFromActivities(tx, companyId, costIds);
  return touched;
}

export async function addActivity(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: {
    code: string;
    name: string;
    durationDays: unknown;
    startOn: string;
  },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    activity: { id: string; code: string; name: string; version: number };
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const code = input.code.trim();
    const name = input.name.trim();
    if (!code) return refused("Give the activity a code, like F or PILE-1.");
    if (!name) return refused("Give the activity a name.");
    const durationDays = parseDuration(input.durationDays);
    if (durationDays === null) {
      return refused(
        `Duration must be a whole number of working days from ${ACTIVITY_DURATION_MIN_DAYS} to ${ACTIVITY_DURATION_MAX_DAYS}.`,
      );
    }
    const startRaw = String(input.startOn ?? "").trim();
    if (!ISO_DAY.test(startRaw)) {
      return refused("Start date must be YYYY-MM-DD.");
    }

    const cal = await ensureCalendar(tx, companyId, job.id);
    let startOn = startRaw;
    if (!cal.working.isWorkingDay(startOn)) {
      startOn = cal.working.nextWorkingDay(startOn);
    }
    const finishOn = earlyFinishOn(cal.working, startOn, durationDays);

    const [dup] = await tx
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.companyId, companyId),
          eq(activities.jobId, job.id),
          eq(activities.code, code),
        ),
      )
      .limit(1);
    if (dup) {
      return refused(
        `Activity ${code} already exists on ${job.shortName}. Pick another code.`,
      );
    }

    const id = randomUUID();
    await tx.insert(activities).values({
      id,
      companyId,
      jobId: job.id,
      code,
      name,
      durationDays,
      startNoEarlierOn: null,
      version: 1,
      ...activityDatesBeforeCpm(startOn, finishOn),
    });

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      activity: { id, code, name, version: 1 },
    };
  });
}

export async function editActivity(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: {
    activity: string;
    version: unknown;
    code?: string;
    name?: string;
    durationDays?: unknown;
    startOn?: string;
  },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    activity: {
      id: string;
      code: string;
      name: string;
      version: number;
      earlyStartOn: string;
      earlyFinishOn: string;
    };
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const expectVersion = parseVersion(input.version);
    if (expectVersion === null) {
      return refused(
        "That edit needs the activity version from the schedule screen. Reload and try again.",
      );
    }
    const act = await resolveActivity(
      tx,
      companyId,
      job.id,
      input.activity,
    );
    if (!act) {
      return refused(
        `There is no activity ${input.activity.trim() || "(blank)"} on ${job.shortName}.`,
      );
    }
    if (act.version !== expectVersion) {
      return staleRefusal(tx, companyId, job.number, act, expectVersion);
    }

    const nextCode =
      input.code !== undefined ? input.code.trim() : act.code;
    const nextName =
      input.name !== undefined ? input.name.trim() : act.name;
    if (!nextCode) return refused("Give the activity a code, like F or PILE-1.");
    if (!nextName) return refused("Give the activity a name.");

    let nextDuration = act.durationDays;
    if (input.durationDays !== undefined && input.durationDays !== "") {
      const parsed = parseDuration(input.durationDays);
      if (parsed === null) {
        return refused(
          `Duration must be a whole number of working days from ${ACTIVITY_DURATION_MIN_DAYS} to ${ACTIVITY_DURATION_MAX_DAYS}.`,
        );
      }
      nextDuration = parsed;
    }

    const cal = await ensureCalendar(tx, companyId, job.id);
    let nextStart = act.earlyStartOn;
    if (input.startOn !== undefined && String(input.startOn).trim() !== "") {
      const startRaw = String(input.startOn).trim();
      if (!ISO_DAY.test(startRaw)) {
        return refused("Start date must be YYYY-MM-DD.");
      }
      nextStart = startRaw;
    }
    if (!cal.working.isWorkingDay(nextStart)) {
      nextStart = cal.working.nextWorkingDay(nextStart);
    }
    const nextFinish = earlyFinishOn(cal.working, nextStart, nextDuration);

    if (nextCode !== act.code) {
      const [dup] = await tx
        .select({ id: activities.id })
        .from(activities)
        .where(
          and(
            eq(activities.companyId, companyId),
            eq(activities.jobId, job.id),
            eq(activities.code, nextCode),
          ),
        )
        .limit(1);
      if (dup) {
        return refused(
          `Activity ${nextCode} already exists on ${job.shortName}. Pick another code.`,
        );
      }
    }

    const newVersion = act.version + 1;
    const dates = activityDatesBeforeCpm(nextStart, nextFinish);
    await tx
      .update(activities)
      .set({
        code: nextCode,
        name: nextName,
        durationDays: nextDuration,
        version: newVersion,
        ...dates,
      })
      .where(eq(activities.id, act.id));

    const costIds = await linkedCostItemIds(tx, companyId, [act.id]);
    await syncCostItemDatesFromActivities(tx, companyId, costIds);

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      activity: {
        id: act.id,
        code: nextCode,
        name: nextName,
        version: newVersion,
        earlyStartOn: nextStart,
        earlyFinishOn: nextFinish,
      },
    };
  });
}

export async function removeActivity(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: { activity: string; version: unknown },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    activity: { id: string; code: string; name: string };
    unlinkedCostCodes: string[];
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const expectVersion = parseVersion(input.version);
    if (expectVersion === null) {
      return refused(
        "That delete needs the activity version from the schedule screen. Reload and try again.",
      );
    }
    const act = await resolveActivity(
      tx,
      companyId,
      job.id,
      input.activity,
    );
    if (!act) {
      return refused(
        `There is no activity ${input.activity.trim() || "(blank)"} on ${job.shortName}.`,
      );
    }
    if (act.version !== expectVersion) {
      return staleRefusal(tx, companyId, job.number, act, expectVersion);
    }

    const links = await tx
      .select({
        costItemId: activityCostItems.costItemId,
        code: costItems.code,
      })
      .from(activityCostItems)
      .innerJoin(costItems, eq(costItems.id, activityCostItems.costItemId))
      .where(
        and(
          eq(activityCostItems.companyId, companyId),
          eq(activityCostItems.activityId, act.id),
        ),
      );
    const costItemIds = links.map((l) => l.costItemId);
    const unlinkedCostCodes = links.map((l) => l.code);

    await tx.delete(activities).where(eq(activities.id, act.id));
    // Remaining links on those cost items (other activities) still drive dates.
    await syncCostItemDatesFromActivities(tx, companyId, costItemIds);

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      activity: { id: act.id, code: act.code, name: act.name },
      unlinkedCostCodes,
    };
  });
}

export async function linkCostItem(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: { activity: string; costCode: string },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    activity: { id: string; code: string; name: string };
    costCode: string;
    plannedStartOn: string;
    plannedFinishOn: string;
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const act = await resolveActivity(
      tx,
      companyId,
      job.id,
      input.activity,
    );
    if (!act) {
      return refused(
        `There is no activity ${input.activity.trim() || "(blank)"} on ${job.shortName}.`,
      );
    }
    const costCode = input.costCode.trim();
    if (!costCode) return refused("Which cost item should I link? Name the code.");

    const [item] = await tx
      .select()
      .from(costItems)
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.jobId, job.id),
          eq(costItems.code, costCode),
        ),
      )
      .limit(1)
      .for("update");
    if (!item) {
      return refused(
        `There is no cost item ${costCode} on ${job.shortName}.`,
      );
    }
    if (!item.isLeaf) {
      return refused(
        `${costCode} is a summary WBS code. Link a leaf cost item instead.`,
      );
    }

    const [existing] = await tx
      .select({ activityId: activityCostItems.activityId })
      .from(activityCostItems)
      .where(
        and(
          eq(activityCostItems.activityId, act.id),
          eq(activityCostItems.costItemId, item.id),
        ),
      )
      .limit(1);
    if (!existing) {
      await tx.insert(activityCostItems).values({
        activityId: act.id,
        costItemId: item.id,
        companyId,
      });
    }

    await syncCostItemDatesFromActivities(tx, companyId, [item.id]);
    const [synced] = await tx
      .select({
        plannedStartOn: costItems.plannedStartOn,
        plannedFinishOn: costItems.plannedFinishOn,
      })
      .from(costItems)
      .where(eq(costItems.id, item.id))
      .limit(1);

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      activity: { id: act.id, code: act.code, name: act.name },
      costCode: item.code,
      plannedStartOn: synced!.plannedStartOn,
      plannedFinishOn: synced!.plannedFinishOn,
    };
  });
}

export async function unlinkCostItem(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: { activity: string; costCode: string },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    activity: { id: string; code: string; name: string };
    costCode: string;
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const act = await resolveActivity(
      tx,
      companyId,
      job.id,
      input.activity,
    );
    if (!act) {
      return refused(
        `There is no activity ${input.activity.trim() || "(blank)"} on ${job.shortName}.`,
      );
    }
    const costCode = input.costCode.trim();
    if (!costCode) {
      return refused("Which cost item should I unlink? Name the code.");
    }

    const [item] = await tx
      .select()
      .from(costItems)
      .where(
        and(
          eq(costItems.companyId, companyId),
          eq(costItems.jobId, job.id),
          eq(costItems.code, costCode),
        ),
      )
      .limit(1)
      .for("update");
    if (!item) {
      return refused(
        `There is no cost item ${costCode} on ${job.shortName}.`,
      );
    }

    await tx
      .delete(activityCostItems)
      .where(
        and(
          eq(activityCostItems.activityId, act.id),
          eq(activityCostItems.costItemId, item.id),
        ),
      );

    // If other activities still link this item, dates follow them; otherwise leave as-is.
    await syncCostItemDatesFromActivities(tx, companyId, [item.id]);

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      activity: { id: act.id, code: act.code, name: act.name },
      costCode: item.code,
    };
  });
}

export async function setHoliday(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: { date: string; name: string },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    date: string;
    name: string;
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const on = String(input.date ?? "").trim();
    if (!ISO_DAY.test(on)) return refused("Holiday date must be YYYY-MM-DD.");
    const name = String(input.name ?? "").trim() || "Holiday";

    const cal = await ensureCalendar(tx, companyId, job.id);
    const existing = cal.holidayRows.find((h) => h.on === on);
    if (existing) {
      await tx
        .update(calendarHolidays)
        .set({ name })
        .where(eq(calendarHolidays.id, existing.id));
    } else {
      await tx.insert(calendarHolidays).values({
        id: randomUUID(),
        companyId,
        calendarId: cal.calendar.id,
        on,
        name,
      });
    }

    const refreshed = await loadCalendar(tx, companyId, job.id);
    if (!refreshed) throw new Error("calendar missing after holiday write");
    await recomputeJobActivityDates(
      tx,
      companyId,
      job.id,
      refreshed.working,
    );

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      date: on,
      name,
    };
  });
}

export async function removeHoliday(
  companyId: string,
  _actor: ScheduleActor,
  jobNumber: string,
  input: { date: string },
): Promise<
  ScheduleResult<{
    jobNumber: string;
    shortName: string;
    date: string;
  }>
> {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const job = await lockJob(tx, companyId, jobNumber);
    if (!job) return refused(`There is no job ${jobNumber} in this sandbox.`);
    if (job.estimateStatus !== "approved") return refused(DRAFT_REFUSAL);

    const on = String(input.date ?? "").trim();
    if (!ISO_DAY.test(on)) return refused("Holiday date must be YYYY-MM-DD.");

    const cal = await ensureCalendar(tx, companyId, job.id);
    const existing = cal.holidayRows.find((h) => h.on === on);
    if (!existing) {
      return refused(`There is no holiday on ${on} for ${job.shortName}.`);
    }
    await tx
      .delete(calendarHolidays)
      .where(eq(calendarHolidays.id, existing.id));

    const refreshed = await loadCalendar(tx, companyId, job.id);
    if (!refreshed) throw new Error("calendar missing after holiday remove");
    await recomputeJobActivityDates(
      tx,
      companyId,
      job.id,
      refreshed.working,
    );

    return {
      ok: true,
      jobNumber: job.number,
      shortName: job.shortName,
      date: on,
    };
  });
}
