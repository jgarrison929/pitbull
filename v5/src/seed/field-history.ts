/**
 * 5.0.2 Part B — 30 working days of approved daily plans + labor cost rows.
 * Pure `(companyId, today, …) → rows`. Does not call `run()`.
 * 5.0.3 Part D — also emits append-only daily_plan_events (role + time).
 */
import type {
  costEntries,
  dailyPlanEvents,
  dailyPlanLines,
  dailyPlans,
} from "@/db/schema";
import { laborCents } from "@/lib/ev";
import {
  addCalendarDays,
  planDateToday,
  timeZoneForJob,
} from "@/lib/plan-date";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export const FIELD_HISTORY_WORKING_DAYS = 30;
export const CEDAR_RETURN_REASON = "Recount pour 3";

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

/**
 * Mon–Fri plan dates strictly before plan-today in the job zone, oldest first.
 * Must use the same calendar as seeded open plans / assistant "today".
 */
export function workingDaysBefore(today: Date, count: number): string[] {
  const tz = timeZoneForJob();
  const out: string[] = [];
  let cursor = addCalendarDays(planDateToday(today, tz), -1);
  while (out.length < count) {
    const dow = new Date(`${cursor}T12:00:00.000Z`).getUTCDay(); // 0 Sun … 6 Sat
    if (dow !== 0 && dow !== 6) out.push(cursor);
    cursor = addCalendarDays(cursor, -1);
  }
  return out.reverse();
}

/** Split a non-negative integer into `n` parts that sum to `total`. */
export function distributeInt(total: number, n: number): number[] {
  if (n <= 0) return [];
  if (total <= 0) return Array.from({ length: n }, () => 0);
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export type FieldHistoryItem = {
  jobKey: string;
  code: string;
  costItemId: string;
  description: string;
  unit: string;
  evMethod: string;
  plannedStartOn: string;
  plannedFinishOn: string;
  /** Installed qty (milli) to spread across units lines; 0 when not units. */
  installedMilli: number;
  /** Total labor hours in tenths (same as former single Crew labor row). */
  hoursTenths: number;
  rateCents: number;
  /** Exact sum of labor cost_entries.amount_cents for this item. */
  laborAmountCents: number;
};

export type FieldHistoryCrew = {
  id: string;
  name: string;
};

export type FieldHistoryJob = {
  key: string;
  id: string;
  crew: FieldHistoryCrew;
};

export type FieldHistoryRows = {
  dailyPlans: Insert<typeof dailyPlans>[];
  dailyPlanLines: Insert<typeof dailyPlanLines>[];
  dailyPlanEvents: Insert<typeof dailyPlanEvents>[];
  costEntries: Insert<typeof costEntries>[];
  /** plan id of the Cedar returned-then-approved story row. */
  cedarReturnedPlanId: string;
};

function spansDay(start: string, finish: string, day: string): boolean {
  return start <= day && day <= finish;
}

function atUtc(day: string, hour: number, minute = 0): Date {
  return new Date(
    `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  );
}

/**
 * Build approved field history for every active job on each of the last
 * `FIELD_HISTORY_WORKING_DAYS` working days before `today`.
 */
export function buildFieldHistory(args: {
  companyId: string;
  today: Date;
  /** Stable UUID builder — same `seedId(companyId, key)` the rest of seed uses. */
  id: (key: string) => string;
  jobs: FieldHistoryJob[];
  items: FieldHistoryItem[];
  foremanId: string;
  superintendentId: string;
}): FieldHistoryRows {
  const { companyId, today, id, jobs, items, foremanId, superintendentId } =
    args;
  const days = workingDaysBefore(today, FIELD_HISTORY_WORKING_DAYS);
  const byJob = new Map(jobs.map((j) => [j.key, j]));

  const planRows: Insert<typeof dailyPlans>[] = [];
  const lineRows: Insert<typeof dailyPlanLines>[] = [];
  const eventRows: Insert<typeof dailyPlanEvents>[] = [];
  const entryRows: Insert<typeof costEntries>[] = [];

  const pushEvent = (
    planId: string,
    kind: Insert<typeof dailyPlanEvents>["kind"],
    actorRole: Insert<typeof dailyPlanEvents>["actorRole"],
    actorId: string | null,
    at: Date,
    detail = "",
    keySuffix = "",
  ) => {
    eventRows.push({
      id: id(`plan-event:hist:${planId}:${kind}${keySuffix}`),
      companyId,
      planId,
      kind,
      actorRole,
      actorId,
      detail,
      at,
    });
  };

  // Per item: which history days it spans, and qty/hours slices.
  type DaySlice = { day: string; qtyMilli: number; hoursTenths: number };
  const slices = new Map<string, DaySlice[]>();

  for (const item of items) {
    const eligible = days.filter((d) =>
      spansDay(item.plannedStartOn, item.plannedFinishOn, d),
    );
    // If the schedule misses the window, pin everything on the newest day so
    // totals still reconcile (hours stay the same as 5.0.0; only the rate path).
    const useDays = eligible.length > 0 ? eligible : [days[days.length - 1]!];
    const qtyParts = distributeInt(item.installedMilli, useDays.length);
    const hourParts = distributeInt(item.hoursTenths, useDays.length);
    const daySlices: DaySlice[] = useDays.map((day, i) => ({
      day,
      qtyMilli: qtyParts[i]!,
      hoursTenths: hourParts[i]!,
    }));
    slices.set(item.costItemId, daySlices);
  }

  // Cedar return story: most recent working day that carries a 04-210 line.
  const cedarJob = byJob.get("cedar");
  let cedarReturnedPlanId = "";
  let cedarReturnDay: string | null = null;
  if (cedarJob) {
    const pier = items.find(
      (i) => i.jobKey === "cedar" && i.code === "04-210" && i.hoursTenths > 0,
    );
    if (pier) {
      const pierDays = (slices.get(pier.costItemId) ?? [])
        .filter((s) => s.hoursTenths > 0 || s.qtyMilli > 0)
        .map((s) => s.day);
      cedarReturnDay = pierDays[pierDays.length - 1] ?? null;
      if (cedarReturnDay) {
        cedarReturnedPlanId = id(`plan:hist:cedar:${cedarReturnDay}`);
      }
    }
  }

  for (const job of jobs) {
    const jobItems = items.filter((i) => i.jobKey === job.key);
    for (const day of days) {
      const planId = id(`plan:hist:${job.key}:${day}`);
      const isReturnStory =
        job.key === "cedar" && cedarReturnDay === day && cedarReturnedPlanId === planId;

      const nextDay = isoDate(addDays(new Date(`${day}T12:00:00.000Z`), 1));
      const createdAt = atUtc(day, 6, 0);
      const submittedAt = atUtc(day, 7, 0);
      const firstReportedAt = atUtc(day, 16, 0);
      const returnedAt = isReturnStory ? atUtc(day, 17, 30) : null;
      const reportedAt = isReturnStory ? atUtc(nextDay, 10, 0) : firstReportedAt;
      const approvedAt = isReturnStory
        ? atUtc(nextDay, 14, 0)
        : atUtc(day, 18, 0);

      planRows.push({
        id: planId,
        companyId,
        jobId: job.id,
        crewId: job.crew.id,
        foremanId,
        planDate: day,
        status: "approved",
        weather: "Clear, 58°F",
        equipment: [],
        submittedAt,
        returnReason: isReturnStory ? CEDAR_RETURN_REASON : null,
        returnedAt,
        approvedAt,
        approvedById: superintendentId,
        createdAt,
        createdById: foremanId,
        reportedAt,
      });

      // Roles only — seed author of history plans is the superintendent.
      pushEvent(planId, "created", "superintendent", superintendentId, createdAt);
      pushEvent(
        planId,
        "submitted",
        "superintendent",
        superintendentId,
        submittedAt,
      );
      if (isReturnStory) {
        // Full return-then-approve arc: first report → return → re-report → approve.
        pushEvent(
          planId,
          "reported",
          "foreman",
          foremanId,
          firstReportedAt,
          "",
          ":1",
        );
        pushEvent(
          planId,
          "returned",
          "superintendent",
          superintendentId,
          returnedAt!,
          CEDAR_RETURN_REASON,
        );
        pushEvent(
          planId,
          "reported",
          "foreman",
          foremanId,
          reportedAt!,
          "",
          ":2",
        );
        pushEvent(
          planId,
          "approved",
          "superintendent",
          superintendentId,
          approvedAt!,
        );
      } else {
        pushEvent(planId, "reported", "foreman", foremanId, reportedAt!);
        pushEvent(
          planId,
          "approved",
          "superintendent",
          superintendentId,
          approvedAt!,
        );
      }

      let sort = 0;
      for (const item of jobItems) {
        const slice = (slices.get(item.costItemId) ?? []).find(
          (s) => s.day === day,
        );
        if (!slice) continue;
        if (slice.hoursTenths <= 0 && slice.qtyMilli <= 0) continue;

        const lineId = id(`plan-line:hist:${job.key}:${day}:${item.code}`);
        // cost_entries / reportedHoursTenths use total MH tenths.
        // daily_plan_lines.hours_tenths is hours-per-worker (× workers = plan MH).
        const totalMhTenths = slice.hoursTenths;
        const manHours = totalMhTenths / 10;
        // Keep shift ≤ 24 h so addPlanLine / plan-line LIMITS accept a replay.
        const workers =
          totalMhTenths > 0
            ? Math.max(1, Math.min(50, Math.ceil(manHours / 24) || 1))
            : 1;
        const shiftTenths =
          totalMhTenths > 0
            ? Math.max(5, Math.min(240, Math.round((manHours / workers) * 10)))
            : 10;

        lineRows.push({
          id: lineId,
          companyId,
          planId,
          costItemId: item.costItemId,
          activity: item.description,
          location: "",
          // Planned qty mirrors reported so the card shows the day's work.
          qtyMilli: slice.qtyMilli,
          workers,
          hoursTenths: shiftTenths,
          notes: "",
          sort: sort++,
          reportedQtyMilli: slice.qtyMilli > 0 ? slice.qtyMilli : null,
          reportedHoursTenths: totalMhTenths > 0 ? totalMhTenths : null,
        });
      }
    }
  }

  // Labor cost entries: one per approved line with reported hours.
  // Amounts sum exactly to each item's laborAmountCents (remainder on last day).
  for (const item of items) {
    if (item.hoursTenths <= 0 || item.laborAmountCents <= 0) continue;
    const daySlices = (slices.get(item.costItemId) ?? []).filter(
      (s) => s.hoursTenths > 0,
    );
    let remaining = item.laborAmountCents;
    daySlices.forEach((slice, i) => {
      const lineId = id(
        `plan-line:hist:${item.jobKey}:${slice.day}:${item.code}`,
      );
      const isLast = i === daySlices.length - 1;
      const manHours = slice.hoursTenths / 10;
      const amount = isLast
        ? remaining
        : laborCents(manHours, item.rateCents);
      remaining -= amount;
      entryRows.push({
        id: id(`ce:hist:${item.jobKey}:${slice.day}:${item.code}`),
        companyId,
        costItemId: item.costItemId,
        kind: "labor",
        hoursTenths: slice.hoursTenths,
        rateCents: item.rateCents,
        amountCents: amount,
        note: `Approved: ${item.description}`,
        sourcePlanLineId: lineId,
        at: new Date(`${slice.day}T12:00:00.000Z`),
      });
    });
  }

  return {
    dailyPlans: planRows,
    dailyPlanLines: lineRows,
    dailyPlanEvents: eventRows,
    costEntries: entryRows,
    cedarReturnedPlanId,
  };
}

/** Stable seed key for a historical plan (tests / replay). */
export function histPlanKey(jobKey: string, day: string) {
  return `plan:hist:${jobKey}:${day}`;
}

export function histPlanLineKey(jobKey: string, day: string, code: string) {
  return `plan-line:hist:${jobKey}:${day}:${code}`;
}
