"use client";

import { useActionState, useId, useState } from "react";
import {
  runActionState,
  type ActionState,
} from "@/app/app/assistant/actions";
import { ChoiceField } from "@/components/form/combobox";
import type { Option } from "@/components/form/form";
import { LIMITS } from "@/lib/plan-line";

/** Add a cost-item line to a draft daily plan. */
export function AddPlanLineForm({
  jobNumber,
  planId,
  costItems,
  searchUrl,
}: {
  jobNumber: string;
  planId: string;
  costItems: (Option & { unit: string })[];
  searchUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const [unit, setUnit] = useState(costItems[0]?.unit ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-xs font-medium"
        data-testid="add-plan-line"
        onClick={() => setOpen(true)}
      >
        Add line
      </button>
    );
  }
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2 border-t px-4 py-3"
      data-testid="add-plan-line-form"
    >
      <input type="hidden" name="action" value="dailyPlan.addLine" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Add plan line" />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5 text-xs sm:col-span-2">
          Cost item
          <ChoiceField
            id={`${uid}-cost`}
            name="costItemId"
            options={costItems}
            defaultValue={costItems[0]?.value ?? ""}
            searchUrl={searchUrl}
            onChange={(_value, option) => {
              const next = option?.unit ?? option?.hint;
              if (next) setUnit(next);
            }}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Activity
          <input
            name="activity"
            type="text"
            required
            maxLength={LIMITS.text.max}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            data-testid="add-line-activity"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Location
          <input
            name="location"
            type="text"
            maxLength={LIMITS.text.max}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            data-testid="add-line-location"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Quantity {unit ? `(${unit})` : ""}
          <input
            name="qty"
            type="number"
            required
            min={LIMITS.qty.min}
            max={LIMITS.qty.max}
            step={LIMITS.qty.step}
            className="rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            data-testid="add-line-qty"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Workers
          <input
            name="workers"
            type="number"
            required
            min={LIMITS.workers.min}
            max={LIMITS.workers.max}
            step={LIMITS.workers.step}
            defaultValue={3}
            className="rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            data-testid="add-line-workers"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          Hours per worker
          <input
            name="hours"
            type="number"
            required
            min={LIMITS.hours.min}
            max={LIMITS.hours.max}
            step={LIMITS.hours.step}
            defaultValue={8}
            className="rounded-md border bg-background px-2 py-1.5 text-sm tabular-nums"
            data-testid="add-line-hours"
          />
        </label>
      </div>
      {state.summary ? (
        <p className="text-xs text-muted-foreground" data-testid="add-line-summary">
          {state.summary}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          data-testid="add-line-submit"
        >
          {pending ? "Adding…" : "Add line"}
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1.5 text-xs font-medium"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
