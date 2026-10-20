"use client";

import { useActionState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import { qty } from "@/lib/ev";

export type ReportLine = {
  id: string;
  code: string;
  activity: string;
  unit: string;
  /** Planned man-hours (workers × hours). */
  manHours: number;
  qtyMilli: number;
};

/**
 * After a plan is submitted, the foreman enters actual MH and quantity per line
 * (defaults = plan). The submitted plan is not changed.
 */
export function ReportWorkForm({
  jobNumber,
  lines,
}: {
  jobNumber: string;
  lines: ReportLine[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2"
      data-testid="report-work-form"
    >
      <input type="hidden" name="action" value="dailyReport.post" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="Report day's work" />
      <ul className="divide-y rounded-md border bg-background text-xs">
        {lines.map((l) => (
          <li
            key={l.id}
            className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_6rem_6rem] sm:items-end"
            data-testid={`report-line-${l.code}`}
          >
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                <span className="mr-1 font-mono text-muted-foreground">
                  {l.code}
                </span>
                {l.activity}
              </div>
              <div className="text-muted-foreground">
                Plan {l.manHours} MH · {qty(l.qtyMilli)} {l.unit}
              </div>
            </div>
            <label className="flex flex-col gap-0.5">
              Actual MH
              <input
                name={`actualMh[${l.id}]`}
                type="number"
                min={0}
                max={1200}
                step={0.1}
                defaultValue={l.manHours}
                required
                className="rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
                data-testid={`report-mh-${l.code}`}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              Actual {l.unit}
              <input
                name={`actualQty[${l.id}]`}
                type="number"
                min={0}
                step={0.001}
                defaultValue={l.qtyMilli / 1000}
                required
                className="rounded-md border bg-background px-2 py-1 text-sm tabular-nums"
                data-testid={`report-qty-${l.code}`}
              />
            </label>
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        data-testid="report-work"
      >
        {pending ? "Reporting…" : "Report day's work"}
      </button>
      {state.summary && (
        <p className="text-xs text-muted-foreground" data-testid="report-summary">
          {state.summary}
        </p>
      )}
    </form>
  );
}
