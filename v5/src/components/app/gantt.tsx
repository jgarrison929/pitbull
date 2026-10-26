import Link from "next/link";
import { utcDay } from "@/lib/dates";
import {
  barPlacement,
  ganttAxisRange,
  holidaysOnAxis,
} from "@/lib/schedule";
import type {
  JobScheduleView,
  ScheduleActivityRow,
} from "@/server/schedule-view";

/** Honest empty copy for an approved job with zero activities — never "No activities yet". */
export const SCHEDULE_EMPTY_GUIDANCE =
  "Add an activity to build the schedule. Use the assistant or ask the project manager to enter the first activity with a code, name, and duration in working days.";

function DurationLabel({ days }: { days: number }) {
  return (
    <span className="tabular-nums">
      {days} {days === 1 ? "working day" : "working days"}
    </span>
  );
}

function DateSpan({
  startOn,
  finishOn,
}: {
  startOn: string;
  finishOn: string;
}) {
  return (
    <span className="tabular-nums text-muted-foreground">
      <time dateTime={startOn}>{utcDay(startOn)}</time>
      {" – "}
      <time dateTime={finishOn}>{utcDay(finishOn)}</time>
    </span>
  );
}

function LinkedCostItems({
  activity,
  jobNumber,
}: {
  activity: ScheduleActivityRow;
  jobNumber: string;
}) {
  if (activity.costItems.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        No cost items linked to this activity.
      </p>
    );
  }
  return (
    <ul className="divide-y border-t text-sm">
      {activity.costItems.map((ci) => (
        <li key={ci.id} className="px-3 py-2" data-testid="gantt-linked-cost">
          <Link
            href={`/app/jobs/${jobNumber}/cost-items/${ci.code}`}
            className="font-medium underline hover:no-underline"
          >
            {ci.code}
          </Link>
          <span className="text-muted-foreground"> · {ci.description}</span>
        </li>
      ))}
    </ul>
  );
}

/** Phone / narrow: stacked activity list — no sideways scroll. */
function ActivityStack({
  activities,
  jobNumber,
}: {
  activities: ScheduleActivityRow[];
  jobNumber: string;
}) {
  return (
    <ul className="divide-y md:hidden" data-testid="gantt-stack">
      {activities.map((a) => (
        <li key={a.id} data-testid="gantt-activity" data-code={a.code}>
          <details className="group">
            <summary
              className="flex min-h-11 cursor-pointer list-none flex-col gap-0.5 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden"
              data-testid="gantt-activity-toggle"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-xs font-semibold">{a.code}</span>
                <span className="text-sm font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  <DurationLabel days={a.durationDays} />
                </span>
              </div>
              <DateSpan startOn={a.earlyStartOn} finishOn={a.earlyFinishOn} />
              <span className="text-xs text-muted-foreground group-open:hidden">
                {a.costItems.length === 0
                  ? "No linked cost items"
                  : `${a.costItems.length} linked cost ${a.costItems.length === 1 ? "item" : "items"}`}
              </span>
            </summary>
            <LinkedCostItems activity={a} jobNumber={jobNumber} />
          </details>
        </li>
      ))}
    </ul>
  );
}

/** Desktop: shared date axis + bars; holiday columns shaded. */
function GanttChart({
  activities,
  holidays,
  jobNumber,
}: {
  activities: ScheduleActivityRow[];
  holidays: JobScheduleView["holidays"];
  jobNumber: string;
}) {
  const axis = ganttAxisRange(activities);
  if (!axis) return null;
  const holidayCols = holidaysOnAxis(holidays, axis.startOn, axis.finishOn);

  return (
    <div className="hidden md:block" data-testid="gantt-chart">
      <div className="grid grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] border-b text-xs text-muted-foreground">
        <div className="px-4 py-2 font-medium">Activity</div>
        <div className="relative min-w-0 px-2 py-2">
          <div className="flex justify-between tabular-nums">
            <time dateTime={axis.startOn}>{utcDay(axis.startOn)}</time>
            <time dateTime={axis.finishOn}>{utcDay(axis.finishOn)}</time>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-2 right-2" aria-hidden>
            {holidayCols.map((h) => (
              <div
                key={h.on}
                title={h.name}
                data-testid="gantt-holiday"
                data-on={h.on}
                className="absolute inset-y-0 bg-caution-soft/70"
                style={{ left: `${h.leftPct}%`, width: `${h.widthPct}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <ul>
        {activities.map((a) => {
          const bar = barPlacement(
            a.earlyStartOn,
            a.earlyFinishOn,
            axis.startOn,
            axis.finishOn,
          );
          return (
            <li
              key={a.id}
              className="border-b last:border-b-0"
              data-testid="gantt-activity"
              data-code={a.code}
            >
              <details className="group">
                <summary
                  className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] items-stretch marker:content-none [&::-webkit-details-marker]:hidden"
                  data-testid="gantt-activity-toggle"
                >
                  <div className="flex min-w-0 flex-col justify-center gap-0.5 px-4 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-xs font-semibold">
                        {a.code}
                      </span>
                      <span className="text-sm font-medium">{a.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      <DurationLabel days={a.durationDays} />
                      <DateSpan
                        startOn={a.earlyStartOn}
                        finishOn={a.earlyFinishOn}
                      />
                    </div>
                  </div>
                  <div className="relative min-h-11 min-w-0 px-2 py-2">
                    <div
                      className="pointer-events-none absolute inset-y-0 left-2 right-2"
                      aria-hidden
                    >
                      {holidayCols.map((h) => (
                        <div
                          key={h.on}
                          className="absolute inset-y-0 bg-caution-soft/40"
                          style={{
                            left: `${h.leftPct}%`,
                            width: `${h.widthPct}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="absolute inset-y-0 left-2 right-2">
                      <div
                        className="absolute top-1/2 h-5 -translate-y-1/2 rounded-sm bg-brand"
                        data-testid="gantt-bar"
                        style={{
                          left: `${bar.leftPct}%`,
                          width: `${bar.widthPct}%`,
                          minWidth: "0.5rem",
                        }}
                        title={`${a.code} ${a.name}`}
                      />
                    </div>
                  </div>
                </summary>
                <div className="border-t bg-muted/30">
                  <LinkedCostItems activity={a} jobNumber={jobNumber} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Full schedule body for `/app/jobs/[number]/schedule`. */
export function JobGantt({ schedule }: { schedule: JobScheduleView }) {
  if (schedule.activities.length === 0) {
    return (
      <p
        className="px-4 py-6 text-sm text-muted-foreground"
        data-testid="schedule-empty"
      >
        {SCHEDULE_EMPTY_GUIDANCE}
      </p>
    );
  }

  return (
    <div data-testid="job-gantt">
      <ActivityStack
        activities={schedule.activities}
        jobNumber={schedule.job.number}
      />
      <GanttChart
        activities={schedule.activities}
        holidays={schedule.holidays}
        jobNumber={schedule.job.number}
      />
    </div>
  );
}

/** Compact Schedule section on the job page (approved jobs only). */
export function JobScheduleSection({
  schedule,
}: {
  schedule: JobScheduleView;
}) {
  if (!schedule.showScheduleNav) return null;

  const count = schedule.activities.length;
  return (
    <section
      className="rounded-lg border bg-card"
      data-testid="job-schedule-section"
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Schedule</h2>
          <p className="text-xs leading-snug text-muted-foreground">
            Activities on one calendar. Bars use early start and early finish as
            entered. This view is read-only.
          </p>
        </div>
        <Link
          href={`/app/jobs/${schedule.job.number}/schedule`}
          className="inline-flex min-h-11 shrink-0 items-center text-xs font-medium underline hover:no-underline"
          data-testid="job-schedule-link"
        >
          Open Gantt
        </Link>
      </header>
      {count === 0 ? (
        <p
          className="px-4 py-3 text-sm text-muted-foreground"
          data-testid="schedule-empty"
        >
          {SCHEDULE_EMPTY_GUIDANCE}
        </p>
      ) : (
        <ul className="divide-y px-4 text-sm" data-testid="job-schedule-preview">
          {schedule.activities.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 py-2"
              data-testid="gantt-activity"
              data-code={a.code}
            >
              <span className="font-mono text-xs font-semibold">{a.code}</span>
              <span className="font-medium">{a.name}</span>
              <span className="text-xs text-muted-foreground">
                <DurationLabel days={a.durationDays} />
              </span>
              <DateSpan startOn={a.earlyStartOn} finishOn={a.earlyFinishOn} />
            </li>
          ))}
          {count > 5 ? (
            <li className="py-2 text-xs text-muted-foreground">
              And {count - 5} more on the Gantt.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
