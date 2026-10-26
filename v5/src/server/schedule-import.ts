/**
 * Shared schedule-import apply path for 5.1.3-a (XER) and 5.1.3-b (MSP XML).
 * All-or-nothing: any row error rolls the transaction back.
 * Does not invent cost-item links (C34 refused). Links persist when 5.1.1
 * registers a writer via {@link ScheduleImportLinkWriter}; until then they are
 * validated (missing id fails) but not stored.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { requireDb, type Db } from "@/db";
import {
  activities,
  calendarHolidays,
  jobCalendars,
  jobs,
} from "@/db/schema";
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  activityDatesBeforeCpm,
  DEFAULT_WORKDAYS_MASK,
} from "@/lib/schedule";
import {
  isScheduleImportParseErr,
  parseXer,
  SCHEDULE_IMPORT_MAX_BYTES,
  type ScheduleImportDraft,
  type ScheduleImportLink,
  type ScheduleImportMode,
  type ScheduleImportSkipped,
} from "@/lib/schedule-import";
import { createWorkingCalendar } from "@/lib/working-calendar";
import { seedNow } from "@/server/seed-clock";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ScheduleImportLinkWriter = (
  tx: Tx,
  args: {
    companyId: string;
    jobId: string;
    /** activity code → id after inserts */
    activityIds: ReadonlyMap<string, string>;
    links: readonly ScheduleImportLink[];
  },
) => Promise<void>;

export type ScheduleImportCpmRunner = (
  tx: Tx,
  args: { companyId: string; jobId: string },
) => Promise<void>;

export type ScheduleImportApplyOptions = {
  /** Set by 5.1.1 when `activity_links` exists. */
  writeLinks?: ScheduleImportLinkWriter;
  /** Set by 5.1.1 when the CPM pass is wired. */
  runCpm?: ScheduleImportCpmRunner;
};

export type ScheduleImportOk = {
  ok: true;
  jobNumber: string;
  shortName: string;
  activityCount: number;
  linkCount: number;
  holidayCount: number;
  skipped: ScheduleImportSkipped[];
  mode: ScheduleImportMode;
  summary: string;
};

export type ScheduleImportErr = {
  ok: false;
  jobNumber: string;
  shortName?: string;
  reason:
    | "not_found"
    | "draft_estimate"
    | "too_large"
    | "invalid_file"
    | "apply"
    | "code_conflict";
  summary: string;
  errors?: string[];
};

export type ScheduleImportResult = ScheduleImportOk | ScheduleImportErr;

function earlyFinishOn(
  cal: ReturnType<typeof createWorkingCalendar>,
  startOn: string,
  durationDays: number,
): string {
  return durationDays === 1
    ? startOn
    : cal.addWorkingDays(startOn, durationDays - 1);
}

function snapWorking(
  cal: ReturnType<typeof createWorkingCalendar>,
  on: string,
): string {
  return cal.isWorkingDay(on) ? on : cal.nextWorkingDay(on);
}

/**
 * Validate draft integrity before any write. Throws a string reason for the
 * caller to turn into a refused result (transaction rolls back on throw).
 */
export function assertScheduleImportDraft(
  draft: ScheduleImportDraft,
  existingCodes: ReadonlySet<string>,
  mode: ScheduleImportMode,
): void {
  const codes = new Set<string>();
  for (const a of draft.activities) {
    if (!a.code.trim()) throw "Activity code is blank.";
    if (codes.has(a.code)) throw `Duplicate activity code "${a.code}" in the file.`;
    codes.add(a.code);
    if (
      a.durationDays < ACTIVITY_DURATION_MIN_DAYS ||
      a.durationDays > ACTIVITY_DURATION_MAX_DAYS
    ) {
      throw `Activity ${a.code} duration ${a.durationDays} is out of range.`;
    }
  }

  if (mode === "merge") {
    for (const code of codes) {
      if (existingCodes.has(code)) {
        throw `Activity code "${code}" already exists on this job. Import with mode replace, or remove the conflict.`;
      }
    }
  }

  // Replace wipes the job first, so only the file's codes resolve predecessors.
  const resolvable =
    mode === "merge" ? new Set([...codes, ...existingCodes]) : codes;

  for (const link of draft.links) {
    if (link.lagDays < 0) {
      throw `Negative lag is refused on ${link.predecessorCode} → ${link.successorCode}.`;
    }
    if (!resolvable.has(link.predecessorCode)) {
      throw `Couldn't import schedule: activity ${link.successorCode} links to missing predecessor "${link.predecessorCode}".`;
    }
    if (!resolvable.has(link.successorCode)) {
      throw `Couldn't import schedule: link names missing successor "${link.successorCode}".`;
    }
  }
}

function summarizeOk(
  shortName: string,
  draft: ScheduleImportDraft,
  mode: ScheduleImportMode,
  linksWritten: number,
): string {
  const skipPart =
    draft.skipped.length === 0
      ? "Nothing skipped."
      : `Skipped: ${draft.skipped
          .map((s) => `${s.count} ${s.kind}`)
          .join(", ")}.`;
  return (
    `Imported schedule on ${shortName} (${mode}): ` +
    `${draft.activities.length} activities` +
    (linksWritten > 0 ? `, ${linksWritten} links` : "") +
    (draft.holidays.length > 0 ? `, ${draft.holidays.length} holidays` : "") +
    `. ${skipPart}`
  );
}

/**
 * Write one validated draft inside an open transaction.
 * Shared by XER and MSP XML importers.
 */
export async function applyScheduleImportDraft(
  tx: Tx,
  args: {
    companyId: string;
    jobId: string;
    draft: ScheduleImportDraft;
    mode: ScheduleImportMode;
    /** Fallback start when an activity has no startOn. */
    defaultStartOn: string;
  },
  opts: ScheduleImportApplyOptions = {},
): Promise<{ activityIds: Map<string, string>; linksWritten: number }> {
  const { companyId, jobId, draft, mode, defaultStartOn } = args;

  const existing = await tx
    .select({ id: activities.id, code: activities.code })
    .from(activities)
    .where(and(eq(activities.companyId, companyId), eq(activities.jobId, jobId)));
  const existingCodes = new Set(existing.map((r) => r.code));
  assertScheduleImportDraft(draft, existingCodes, mode);

  if (mode === "replace" && existing.length > 0) {
    await tx
      .delete(activities)
      .where(
        and(eq(activities.companyId, companyId), eq(activities.jobId, jobId)),
      );
  }

  let [calendar] = await tx
    .select()
    .from(jobCalendars)
    .where(
      and(eq(jobCalendars.companyId, companyId), eq(jobCalendars.jobId, jobId)),
    )
    .limit(1);

  if (!calendar) {
    const id = randomUUID();
    await tx.insert(jobCalendars).values({
      id,
      companyId,
      jobId,
      name: "Job calendar",
      workdaysMask: DEFAULT_WORKDAYS_MASK,
    });
    calendar = {
      id,
      companyId,
      jobId,
      name: "Job calendar",
      workdaysMask: DEFAULT_WORKDAYS_MASK,
    };
  }

  if (mode === "replace") {
    await tx
      .delete(calendarHolidays)
      .where(
        and(
          eq(calendarHolidays.companyId, companyId),
          eq(calendarHolidays.calendarId, calendar.id),
        ),
      );
  }

  const holidayOns = draft.holidays.map((h) => h.on);
  if (draft.holidays.length > 0) {
    if (mode === "merge") {
      const existingHolidays = await tx
        .select({ on: calendarHolidays.on })
        .from(calendarHolidays)
        .where(eq(calendarHolidays.calendarId, calendar.id));
      const have = new Set(existingHolidays.map((h) => h.on));
      const toAdd = draft.holidays.filter((h) => !have.has(h.on));
      if (toAdd.length) {
        await tx.insert(calendarHolidays).values(
          toAdd.map((h) => ({
            id: randomUUID(),
            companyId,
            calendarId: calendar!.id,
            on: h.on,
            name: h.name,
          })),
        );
      }
    } else {
      await tx.insert(calendarHolidays).values(
        draft.holidays.map((h) => ({
          id: randomUUID(),
          companyId,
          calendarId: calendar!.id,
          on: h.on,
          name: h.name,
        })),
      );
    }
  }

  // Merge path: include DB holidays already on the calendar for date math.
  const dbHolidayOns =
    mode === "merge"
      ? (
          await tx
            .select({ on: calendarHolidays.on })
            .from(calendarHolidays)
            .where(eq(calendarHolidays.calendarId, calendar.id))
        ).map((h) => h.on)
      : holidayOns;
  const cal = createWorkingCalendar(dbHolidayOns);
  const jobStart = snapWorking(cal, defaultStartOn);

  const activityIds = new Map<string, string>();
  if (mode === "merge") {
    for (const row of existing) activityIds.set(row.code, row.id);
  }

  const rows = draft.activities.map((a) => {
    const id = randomUUID();
    activityIds.set(a.code, id);
    const start = snapWorking(cal, a.startOn ?? jobStart);
    const finish = earlyFinishOn(cal, start, a.durationDays);
    return {
      id,
      companyId,
      jobId,
      code: a.code,
      name: a.name,
      durationDays: a.durationDays,
      startNoEarlierOn: null as string | null,
      version: 1,
      ...activityDatesBeforeCpm(start, finish),
    };
  });
  if (rows.length) await tx.insert(activities).values(rows);

  let linksWritten = 0;
  if (opts.writeLinks && draft.links.length > 0) {
    await opts.writeLinks(tx, {
      companyId,
      jobId,
      activityIds,
      links: draft.links,
    });
    linksWritten = draft.links.length;
  }

  if (opts.runCpm && linksWritten > 0) {
    await opts.runCpm(tx, { companyId, jobId });
  }

  return { activityIds, linksWritten };
}

async function importScheduleDraft(
  companyId: string,
  jobNumber: string,
  draft: ScheduleImportDraft,
  mode: ScheduleImportMode,
  opts: ScheduleImportApplyOptions,
): Promise<ScheduleImportResult> {
  const db = requireDb();
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!job) {
    return {
      ok: false,
      jobNumber,
      reason: "not_found",
      summary: `Couldn't find job ${jobNumber}.`,
    };
  }
  if (job.estimateStatus === "draft") {
    return {
      ok: false,
      jobNumber: job.number,
      shortName: job.shortName,
      reason: "draft_estimate",
      summary: `Approve the estimate before scheduling on ${job.shortName}.`,
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.id, job.id))
        .for("update");
      if (locked.estimateStatus === "draft") {
        return {
          ok: false as const,
          jobNumber: locked.number,
          shortName: locked.shortName,
          reason: "draft_estimate" as const,
          summary: `Approve the estimate before scheduling on ${locked.shortName}.`,
        };
      }

      // Default start: earliest startOn in the file, else seed clock day.
      const starts = draft.activities
        .map((a) => a.startOn)
        .filter((s): s is string => Boolean(s))
        .sort();
      const defaultStartOn =
        starts[0] ?? seedNow().toISOString().slice(0, 10);

      const { linksWritten } = await applyScheduleImportDraft(
        tx,
        {
          companyId,
          jobId: locked.id,
          draft,
          mode,
          defaultStartOn,
        },
        opts,
      );

      return {
        ok: true as const,
        jobNumber: locked.number,
        shortName: locked.shortName,
        activityCount: draft.activities.length,
        linkCount: linksWritten,
        holidayCount: draft.holidays.length,
        skipped: draft.skipped,
        mode,
        summary: summarizeOk(locked.shortName, draft, mode, linksWritten),
      };
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // assertScheduleImportDraft throws plain strings.
    const text = message.startsWith("Couldn't import")
      ? message
      : message.includes("already exists")
        ? message
        : message.includes("missing predecessor") ||
            message.includes("missing successor")
          ? message
          : `Couldn't import schedule on ${job.shortName}: ${message}`;
    const reason: ScheduleImportErr["reason"] = message.includes(
      "already exists",
    )
      ? "code_conflict"
      : "apply";
    return {
      ok: false,
      jobNumber: job.number,
      shortName: job.shortName,
      reason,
      summary: text.startsWith("Couldn't")
        ? text
        : `Couldn't import schedule on ${job.shortName}: ${text}`,
      errors: [message],
    };
  }
}

/**
 * Import a P6 XER into a job. PM-only at the action layer.
 * Default mode is `replace` (5.1.3 verify).
 */
export async function importXerSchedule(
  companyId: string,
  jobNumber: string,
  file: Uint8Array | string,
  mode: ScheduleImportMode = "replace",
  opts: ScheduleImportApplyOptions = {},
): Promise<ScheduleImportResult> {
  const bytes =
    typeof file === "string" ? new TextEncoder().encode(file) : file;
  if (bytes.byteLength > SCHEDULE_IMPORT_MAX_BYTES) {
    return {
      ok: false,
      jobNumber,
      reason: "too_large",
      summary: `Schedule file is over ${SCHEDULE_IMPORT_MAX_BYTES / (1024 * 1024)} MB and was refused before parse.`,
    };
  }
  const parsed = parseXer(bytes);
  if (isScheduleImportParseErr(parsed)) {
    return {
      ok: false,
      jobNumber,
      reason: "invalid_file",
      summary: parsed.error,
      errors: [parsed.error],
    };
  }
  return importScheduleDraft(companyId, jobNumber, parsed, mode, opts);
}

/** Re-export for 5.1.3-b MSP XML to call the same apply path. */
export { importScheduleDraft };

/** Test helper: delete activities by job number (clean import target). */
export async function clearJobActivitiesForTests(
  companyId: string,
  jobNumber: string,
) {
  const db = requireDb();
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.number, jobNumber)))
    .limit(1);
  if (!job) return;
  await db
    .delete(activities)
    .where(and(eq(activities.companyId, companyId), eq(activities.jobId, job.id)));
}
