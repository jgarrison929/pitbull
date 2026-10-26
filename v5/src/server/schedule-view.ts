/**
 * Read-only schedule view for 5.1.0-c Gantt UI.
 * Writes stay in 5.1.0-b (`schedule.ts`) when that slice lands — this module
 * only loads seeded / stored activities, holidays, and cost-item links.
 */
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireDb } from "@/db";
import { costItems, jobs } from "@/db/schema";
import {
  activities,
  activityCostItems,
  calendarHolidays,
  jobCalendars,
} from "@/lib/schedule";
import { isEstimateDraft } from "@/lib/portfolio";

export type ScheduleLinkedCostItem = {
  id: string;
  code: string;
  description: string;
};

export type ScheduleActivityRow = {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  earlyStartOn: string;
  earlyFinishOn: string;
  costItems: ScheduleLinkedCostItem[];
};

export type JobScheduleView = {
  job: {
    id: string;
    number: string;
    name: string;
    estimateStatus: string;
  };
  /** Draft-estimate jobs never get a Schedule nav entry (Harbor). */
  showScheduleNav: boolean;
  activities: ScheduleActivityRow[];
  holidays: { on: string; name: string }[];
};

/**
 * Load the job's schedule for the Gantt page and job Schedule section.
 * Returns null when the job is not in this company.
 */
export async function getJobSchedule(
  companyId: string,
  number: string,
): Promise<JobScheduleView | null> {
  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, number)))
    .limit(1);
  if (!job) return null;

  const draft = isEstimateDraft(job);
  if (draft) {
    return {
      job: {
        id: job.id,
        number: job.number,
        name: job.name,
        estimateStatus: job.estimateStatus,
      },
      showScheduleNav: false,
      activities: [],
      holidays: [],
    };
  }

  const [calendar] = await db
    .select()
    .from(jobCalendars)
    .where(
      and(
        eq(jobCalendars.companyId, companyId),
        eq(jobCalendars.jobId, job.id),
      ),
    )
    .limit(1);

  const holidayRows = calendar
    ? await db
        .select({
          on: calendarHolidays.on,
          name: calendarHolidays.name,
        })
        .from(calendarHolidays)
        .where(
          and(
            eq(calendarHolidays.companyId, companyId),
            eq(calendarHolidays.calendarId, calendar.id),
          ),
        )
        .orderBy(asc(calendarHolidays.on))
    : [];

  // Early-start order (spec). Tie-break by code so Cedar A–E stay stable.
  const activityRows = await db
    .select()
    .from(activities)
    .where(
      and(eq(activities.companyId, companyId), eq(activities.jobId, job.id)),
    )
    .orderBy(asc(activities.earlyStartOn), asc(activities.code));

  const activityIds = activityRows.map((a) => a.id);
  const linkRows =
    activityIds.length === 0
      ? []
      : await db
          .select({
            activityId: activityCostItems.activityId,
            id: costItems.id,
            code: costItems.code,
            description: costItems.description,
          })
          .from(activityCostItems)
          .innerJoin(
            costItems,
            eq(costItems.id, activityCostItems.costItemId),
          )
          .where(
            and(
              eq(activityCostItems.companyId, companyId),
              inArray(activityCostItems.activityId, activityIds),
            ),
          )
          .orderBy(asc(costItems.code));

  const linksByActivity = new Map<string, ScheduleLinkedCostItem[]>();
  for (const row of linkRows) {
    const list = linksByActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      code: row.code,
      description: row.description,
    });
    linksByActivity.set(row.activityId, list);
  }

  return {
    job: {
      id: job.id,
      number: job.number,
      name: job.name,
      estimateStatus: job.estimateStatus,
    },
    showScheduleNav: true,
    activities: activityRows.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      durationDays: a.durationDays,
      earlyStartOn: a.earlyStartOn,
      earlyFinishOn: a.earlyFinishOn,
      costItems: linksByActivity.get(a.id) ?? [],
    })),
    holidays: holidayRows.map((h) => ({
      on: h.on,
      name: h.name || "Holiday",
    })),
  };
}
