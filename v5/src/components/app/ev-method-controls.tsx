"use client";

import { useActionState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";

export type MilestoneRow = {
  id: string;
  costItemId: string;
  code: string;
  name: string;
  weightMilli: number;
  complete: boolean;
};

export type PmPercentRow = {
  costItemId: string;
  code: string;
  description: string;
  percentMilli: number;
};

/** On-screen PM percent log and milestone toggles — every EV method is enterable. */
export function EvMethodControls({
  jobNumber,
  milestones,
  pmItems,
}: {
  jobNumber: string;
  milestones: MilestoneRow[];
  pmItems: PmPercentRow[];
}) {
  if (milestones.length === 0 && pmItems.length === 0) return null;
  return (
    <div className="flex flex-col gap-4" data-testid="ev-method-controls">
      {pmItems.length > 0 && (
        <section className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold">PM percent complete</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Log a percent with a reason. The latest entry is what a claim lock
            freezes.
          </p>
          <ul className="flex flex-col gap-3">
            {pmItems.map((p) => (
              <PmPercentForm key={p.costItemId} jobNumber={jobNumber} item={p} />
            ))}
          </ul>
        </section>
      )}
      {milestones.length > 0 && (
        <section className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold">Milestones</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Mark weighted milestones complete. Who/why is stored on the
            milestone log (not the PM percent log).
          </p>
          <ul className="divide-y">
            {milestones.map((m) => (
              <MilestoneRowForm
                key={m.id}
                jobNumber={jobNumber}
                milestone={m}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PmPercentForm({
  jobNumber,
  item,
}: {
  jobNumber: string;
  item: PmPercentRow;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  return (
    <form
      action={action}
      className="grid gap-2 sm:grid-cols-[1fr_5rem_1fr_auto] sm:items-end"
      data-testid={`pm-percent-${item.code}`}
    >
      <input type="hidden" name="action" value="costItem.setPmPercent" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="costItemId" value={item.costItemId} />
      <input
        type="hidden"
        name="label"
        value={`Log PM % on ${item.code}`}
      />
      <div>
        <div className="text-sm font-medium">
          <span className="mr-1 font-mono text-xs text-muted-foreground">
            {item.code}
          </span>
          {item.description}
        </div>
        <div className="text-xs text-muted-foreground">
          Current log {item.percentMilli / 10}%
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        Percent
        <input
          name="percent"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={item.percentMilli / 10}
          required
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        Reason
        <input
          name="reason"
          type="text"
          required
          placeholder="Field walk / why"
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log"}
      </button>
      {state.summary && (
        <p className="sm:col-span-4 text-xs text-muted-foreground">
          {state.summary}
        </p>
      )}
    </form>
  );
}

function MilestoneRowForm({
  jobNumber,
  milestone,
}: {
  jobNumber: string;
  milestone: MilestoneRow;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="action" value="costItem.setMilestone" />
        <input type="hidden" name="job" value={jobNumber} />
        <input type="hidden" name="milestoneId" value={milestone.id} />
        <input
          type="hidden"
          name="complete"
          value={milestone.complete ? "false" : "true"}
        />
        <input
          type="hidden"
          name="label"
          value={`${milestone.complete ? "Reopen" : "Complete"} ${milestone.name}`}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {milestone.code}
        </span>
        <span className="font-medium">{milestone.name}</span>
        <span className="text-xs text-muted-foreground">
          {milestone.weightMilli / 10}%
        </span>
        <span
          className={
            milestone.complete ? "text-xs text-positive" : "text-xs text-muted-foreground"
          }
          data-testid={`milestone-${milestone.id}`}
        >
          {milestone.complete ? "Complete" : "Open"}
        </span>
        <input
          name="reason"
          type="text"
          placeholder="Who/why (optional)"
          className="rounded-md border bg-background px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {pending
            ? "…"
            : milestone.complete
              ? "Mark open"
              : "Mark complete"}
        </button>
      </form>
      {state.summary && (
        <span className="w-full text-xs text-muted-foreground">
          {state.summary}
        </span>
      )}
    </li>
  );
}
