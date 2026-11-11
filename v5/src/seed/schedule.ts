/**
 * 5.1.0-a Cedar / portfolio schedule seed rows (schema + seed).
 * Working-day arithmetic uses `@/lib/working-calendar` only (no parallel module).
 *
 * Frozen V5_SEED_NOW=2026-10-20 → job start 2026-11-02 (intel ladder).
 * Staging: same relative offset from seedNow(). Dates stay inside 1990–2140.
 */
import type {
  activities,
  activityCostItems,
  baselineActivities,
  calendarHolidays,
  costItems,
  jobCalendars,
  jobs,
  scheduleBaselines,
} from "@/db/schema";
import { addCalendarDays } from "@/lib/plan-date";
import {
  ACTIVITY_DURATION_MAX_DAYS,
  ACTIVITY_DURATION_MIN_DAYS,
  activityDatesBeforeCpm,
  DEFAULT_WORKDAYS_MASK,
} from "@/lib/schedule";
import {
  createWorkingCalendar,
  type WorkingCalendar,
} from "@/lib/working-calendar";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Matches createWorkingCalendar default index range. */
export const WORKING_CALENDAR_RANGE_FROM = "1990-01-01";
export const WORKING_CALENDAR_RANGE_TO = "2140-12-31";

/** Anchor seed day for the absolute intel ladder. */
export const SEED_ANCHOR_TODAY = "2026-10-20";

/**
 * Calendar days from frozen seed Tuesday 2026-10-20 → Monday 2026-11-02.
 * Staging shifts the same offset from whatever seedNow() is.
 */
export const SEED_TO_JOB_START_DAYS = 13;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00.000Z`).getTime();
  const b = new Date(`${toIso}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Shift an anchor YYYY-MM-DD by the seed clock's calendar delta. */
function shiftOn(anchorOn: string, today: Date): string {
  const delta = daysBetween(SEED_ANCHOR_TODAY, isoDate(today));
  return addCalendarDays(anchorOn, delta);
}

/** Fourth Thursday of November (holiday label). */
function thanksgivingInYear(year: number): string {
  const nov1 = new Date(Date.UTC(year, 10, 1, 12));
  const dow = nov1.getUTCDay();
  const firstThu = 1 + ((4 - dow + 7) % 7);
  return `${year}-11-${String(firstThu + 21).padStart(2, "0")}`;
}

/**
 * Calendar-shifted job start for the Cedar graph (and absolute CI fixture).
 * May land on a weekend when seedNow() is not the frozen Tuesday — callers that
 * build activities must snap via {@link seedWorkingJobStartOn}.
 */
export function seedJobStartOn(today: Date): string {
  return shiftOn("2026-11-02", today);
}

/** First working day on or after the calendar-shifted job start. */
export function seedWorkingJobStartOn(
  today: Date,
  cal: WorkingCalendar,
): string {
  const shifted = seedJobStartOn(today);
  return cal.isWorkingDay(shifted) ? shifted : cal.nextWorkingDay(shifted);
}

/** Inclusive early finish: duration working days starting on `startOn`. */
function earlyFinishOn(
  cal: WorkingCalendar,
  startOn: string,
  durationDays: number,
): string {
  return durationDays === 1
    ? startOn
    : cal.addWorkingDays(startOn, durationDays - 1);
}

function assertInWorkingCalendarRange(on: string, label: string) {
  if (on < WORKING_CALENDAR_RANGE_FROM || on > WORKING_CALENDAR_RANGE_TO) {
    throw new Error(
      `${label} date ${on} is outside working-calendar range ${WORKING_CALENDAR_RANGE_FROM}…${WORKING_CALENDAR_RANGE_TO}`,
    );
  }
}

export type ScheduleSeedRows = {
  jobCalendars: Insert<typeof jobCalendars>[];
  calendarHolidays: Insert<typeof calendarHolidays>[];
  activities: Insert<typeof activities>[];
  activityCostItems: Insert<typeof activityCostItems>[];
  scheduleBaselines: Insert<typeof scheduleBaselines>[];
  baselineActivities: Insert<typeof baselineActivities>[];
};

type JobRef = Pick<(typeof jobs)["$inferSelect"], "id" | "number">;
type CostRef = Pick<
  (typeof costItems)["$inferSelect"],
  "id" | "code" | "jobId" | "isLeaf"
>;

function pushActivity(
  out: ScheduleSeedRows,
  args: {
    id: string;
    companyId: string;
    jobId: string;
    code: string;
    name: string;
    durationDays: number;
    earlyStartOn: string;
    earlyFinishOn: string;
  },
) {
  if (
    args.durationDays < ACTIVITY_DURATION_MIN_DAYS ||
    args.durationDays > ACTIVITY_DURATION_MAX_DAYS
  ) {
    throw new Error(
      `seed activity ${args.code} duration ${args.durationDays} out of range`,
    );
  }
  assertInWorkingCalendarRange(args.earlyStartOn, `activity ${args.code} start`);
  assertInWorkingCalendarRange(
    args.earlyFinishOn,
    `activity ${args.code} finish`,
  );
  out.activities.push({
    id: args.id,
    companyId: args.companyId,
    jobId: args.jobId,
    code: args.code,
    name: args.name,
    durationDays: args.durationDays,
    startNoEarlierOn: null,
    version: 1,
    ...activityDatesBeforeCpm(args.earlyStartOn, args.earlyFinishOn),
  });
}

function linkLeaf(
  out: ScheduleSeedRows,
  companyId: string,
  activityId: string,
  item: CostRef | undefined,
) {
  if (!item || !item.isLeaf) return;
  out.activityCostItems.push({
    activityId,
    costItemId: item.id,
    companyId,
  });
}

function pushCalendar(
  out: ScheduleSeedRows,
  args: {
    companyId: string;
    jobId: string;
    jobKey: string;
    id: (key: string) => string;
    thanksgiving: string;
  },
) {
  assertInWorkingCalendarRange(args.thanksgiving, "Thanksgiving");
  const calId = args.id(`calendar:${args.jobKey}`);
  out.jobCalendars.push({
    id: calId,
    companyId: args.companyId,
    jobId: args.jobId,
    name: "Job calendar",
    workdaysMask: DEFAULT_WORKDAYS_MASK,
  });
  out.calendarHolidays.push({
    id: args.id(`holiday:${args.jobKey}:thanksgiving`),
    companyId: args.companyId,
    calendarId: calId,
    on: args.thanksgiving,
    name: "Thanksgiving",
  });
}

/** Short three-activity graph so portfolio jobs show a finish date. */
function seedShortGraph(
  out: ScheduleSeedRows,
  args: {
    companyId: string;
    job: JobRef;
    jobKey: string;
    id: (key: string) => string;
    cal: WorkingCalendar;
    jobStart: string;
    thanksgiving: string;
    leaveCodes: readonly string[];
    costByCode: Map<string, CostRef>;
  },
) {
  const { companyId, job, jobKey, id, cal, jobStart, thanksgiving, leaveCodes } =
    args;
  pushCalendar(out, {
    companyId,
    jobId: job.id,
    jobKey,
    id,
    thanksgiving,
  });

  const aStart = jobStart;
  const aFinish = earlyFinishOn(cal, aStart, 3);
  const bStart = cal.nextWorkingDay(aFinish);
  const bFinish = earlyFinishOn(cal, bStart, 2);
  const cStart = cal.nextWorkingDay(bFinish);
  const cFinish = earlyFinishOn(cal, cStart, 2);

  const specs: {
    code: string;
    name: string;
    duration: number;
    start: string;
    finish: string;
  }[] = [
    { code: "A", name: "Mobilize", duration: 3, start: aStart, finish: aFinish },
    {
      code: "B",
      name: "Primary work",
      duration: 2,
      start: bStart,
      finish: bFinish,
    },
    {
      code: "C",
      name: "Closeout",
      duration: 2,
      start: cStart,
      finish: cFinish,
    },
  ];

  specs.forEach((s, i) => {
    const actId = id(`activity:${jobKey}:${s.code}`);
    pushActivity(out, {
      id: actId,
      companyId,
      jobId: job.id,
      code: s.code,
      name: s.name,
      durationDays: s.duration,
      earlyStartOn: s.start,
      earlyFinishOn: s.finish,
    });
    const leafCode = leaveCodes[i];
    if (leafCode) {
      linkLeaf(out, companyId, actId, args.costByCode.get(leafCode));
    }
  });
}

/**
 * Snapshot current activity dates into an immutable baseline (5.1.2-a seed).
 * Harbor never gets a baseline (no activities).
 */
function pushBaseline(
  out: ScheduleSeedRows,
  args: {
    companyId: string;
    jobId: string;
    jobKey: string;
    id: (key: string) => string;
    name: string;
    reason: string;
    setById: string;
    setAt: Date;
  },
) {
  const acts = out.activities.filter((a) => a.jobId === args.jobId);
  if (acts.length === 0) return;
  const baselineId = args.id(`baseline:${args.jobKey}`);
  out.scheduleBaselines.push({
    id: baselineId,
    companyId: args.companyId,
    jobId: args.jobId,
    name: args.name,
    reason: args.reason,
    setAt: args.setAt,
    setById: args.setById,
  });
  for (const a of acts) {
    out.baselineActivities.push({
      id: args.id(`baseline-activity:${args.jobKey}:${a.code}`),
      companyId: args.companyId,
      baselineId,
      activityId: a.id!,
      startOn: a.earlyStartOn!,
      finishOn: a.earlyFinishOn!,
      durationDays: a.durationDays!,
    });
  }
}

/**
 * Build schedule rows for approved jobs. Harbor (26-010) is never included.
 * Activity dates come from `createWorkingCalendar` + the intel graph shape.
 * After the graph, seeds Award / portfolio baselines (5.1.2-a).
 */
export function buildScheduleSeed(args: {
  companyId: string;
  today: Date;
  id: (key: string) => string;
  jobs: JobRef[];
  costItems: CostRef[];
  /** ISO date of Cedar Bridge Crew 2 draft plan (covers activity E). */
  cedarPlanDate: string;
  /** PM user id recorded on seeded baselines. */
  setById: string;
}): ScheduleSeedRows {
  const { companyId, today, id } = args;
  const out: ScheduleSeedRows = {
    jobCalendars: [],
    calendarHolidays: [],
    activities: [],
    activityCostItems: [],
    scheduleBaselines: [],
    baselineActivities: [],
  };

  const shiftedStart = seedJobStartOn(today);
  assertInWorkingCalendarRange(shiftedStart, "job start");
  assertInWorkingCalendarRange(args.cedarPlanDate, "Cedar plan date");

  const thanksgiving = thanksgivingInYear(Number(shiftedStart.slice(0, 4)));
  const cal = createWorkingCalendar([thanksgiving]);
  // Calendar-day shift can land on Sat/Sun (staging real clock). Snap so
  // Activity A never starts on a non-working day.
  const jobStart = seedWorkingJobStartOn(today, cal);
  assertInWorkingCalendarRange(jobStart, "working job start");

  const byNumber = new Map(args.jobs.map((j) => [j.number, j]));
  const costsFor = (jobId: string) => {
    const m = new Map<string, CostRef>();
    for (const c of args.costItems) {
      if (c.jobId === jobId) m.set(c.code, c);
    }
    return m;
  };

  const cedar = byNumber.get("25-031");
  if (cedar) {
    pushCalendar(out, {
      companyId,
      jobId: cedar.id,
      jobKey: "cedar",
      id,
      thanksgiving,
    });
    const costs = costsFor(cedar.id);

    const aStart = jobStart;
    const aFinish = earlyFinishOn(cal, aStart, 5);
    const afterA = cal.nextWorkingDay(aFinish);
    const bStart = afterA;
    const bFinish = earlyFinishOn(cal, bStart, 3);
    const cStart = afterA;
    const cFinish = earlyFinishOn(cal, cStart, 4);
    const afterBC =
      bFinish >= cFinish
        ? cal.nextWorkingDay(bFinish)
        : cal.nextWorkingDay(cFinish);
    const dStart = afterBC;
    const dFinish = earlyFinishOn(cal, dStart, 2);

    // E: 2 working days covering the Bridge Crew 2 plan date.
    let eFinish = args.cedarPlanDate;
    if (!cal.isWorkingDay(eFinish)) eFinish = cal.nextWorkingDay(eFinish);
    const eStart = cal.prevWorkingDay(eFinish);
    // Confirm inclusive 2-day span.
    const eCheck = earlyFinishOn(cal, eStart, 2);
    if (eCheck !== eFinish) {
      throw new Error(
        `seed activity E span mismatch: ${eStart}..${eCheck} vs plan finish ${eFinish}`,
      );
    }

    const cedarActs = [
      {
        code: "A",
        name: "Drive piles",
        duration: 5,
        start: aStart,
        finish: aFinish,
        link: "03-450" as string | null,
      },
      {
        code: "B",
        name: "Pile caps",
        duration: 3,
        start: bStart,
        finish: bFinish,
        link: "04-110",
      },
      {
        code: "C",
        name: "Pier columns",
        duration: 4,
        start: cStart,
        finish: cFinish,
        link: "04-210",
      },
      {
        code: "D",
        name: "Cap beam",
        duration: 2,
        start: dStart,
        finish: dFinish,
        link: null,
      },
      {
        code: "E",
        name: "Tie column cage",
        duration: 2,
        start: eStart,
        finish: eFinish,
        link: "04-310",
      },
    ];

    for (const s of cedarActs) {
      const actId = id(`activity:cedar:${s.code}`);
      pushActivity(out, {
        id: actId,
        companyId,
        jobId: cedar.id,
        code: s.code,
        name: s.name,
        durationDays: s.duration,
        earlyStartOn: s.start,
        earlyFinishOn: s.finish,
      });
      if (s.link) linkLeaf(out, companyId, actId, costs.get(s.link));
    }

    const e = out.activities.find((a) => a.id === id("activity:cedar:E"))!;
    if (
      e.earlyStartOn! > args.cedarPlanDate ||
      e.earlyFinishOn! < args.cedarPlanDate
    ) {
      throw new Error(
        `seed activity E (${e.earlyStartOn}..${e.earlyFinishOn}) must cover plan ${args.cedarPlanDate}`,
      );
    }
  }

  const sr99 = byNumber.get("24-118");
  if (sr99) {
    seedShortGraph(out, {
      companyId,
      job: sr99,
      jobKey: "sr99",
      id,
      cal,
      jobStart,
      thanksgiving,
      leaveCodes: ["02-100", "03-200", "09-600"],
      costByCode: costsFor(sr99.id),
    });
  }

  const i5 = byNumber.get("24-077");
  if (i5) {
    seedShortGraph(out, {
      companyId,
      job: i5,
      jobKey: "i5",
      id,
      cal,
      jobStart,
      thanksgiving,
      leaveCodes: ["03-210", "07-120", "07-300"],
      costByCode: costsFor(i5.id),
    });
  }

  // Must never seed Harbor (draft estimate).
  if (byNumber.has("26-010")) {
    // Intentionally empty — acceptance: zero schedule rows for draft jobs.
  }

  // 5.1.2-a: one baseline on each approved job with activities. Harbor: none.
  if (cedar) {
    pushBaseline(out, {
      companyId,
      jobId: cedar.id,
      jobKey: "cedar",
      id,
      name: "Award baseline",
      reason: "Award",
      setById: args.setById,
      setAt: today,
    });
  }
  if (sr99) {
    pushBaseline(out, {
      companyId,
      jobId: sr99.id,
      jobKey: "sr99",
      id,
      name: "Award baseline",
      reason: "Award",
      setById: args.setById,
      setAt: today,
    });
  }
  if (i5) {
    pushBaseline(out, {
      companyId,
      jobId: i5.id,
      jobKey: "i5",
      id,
      name: "Award baseline",
      reason: "Award",
      setById: args.setById,
      setAt: today,
    });
  }

  return out;
}
