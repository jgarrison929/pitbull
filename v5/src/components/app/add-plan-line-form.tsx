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
      <div className="border-t px-4 py-3">
        <button
          type="button"
          className="tap-target w-full rounded-md border px-3 py-2 text-body font-medium sm:w-auto"
          data-testid="add-plan-line"
          onClick={() => setOpen(true)}
        >
          Add line
        </button>
      </div>
    );
  }
  return (
    <form
      action={action}
      className="flex w-full flex-col gap-3 border-t px-4 py-3"
      data-testid="add-plan-line-form"
    >
      <input type="hidden" name="action" value="dailyPlan.addLine" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Add plan line" />
      {/* Every field required before submit stays visible — never behind details. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-label font-medium sm:col-span-2">
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
        <label className="flex flex-col gap-1 text-label font-medium">
          Activity
          <input
            name="activity"
            type="text"
            required
            maxLength={LIMITS.text.max}
            className="tap-target rounded-md border bg-background px-3 py-2 text-body"
            data-testid="add-line-activity"
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          Location
          <input
            name="location"
            type="text"
            maxLength={LIMITS.text.max}
            className="tap-target rounded-md border bg-background px-3 py-2 text-body"
            data-testid="add-line-location"
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          Quantity {unit ? `(${unit})` : ""}
          <input
            name="qty"
            type="number"
            required
            min={LIMITS.qty.min}
            max={LIMITS.qty.max}
            step={LIMITS.qty.step}
            className="tap-target rounded-md border bg-background px-3 py-2 text-body tabular-nums"
            data-testid="add-line-qty"
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          Workers
          <input
            name="workers"
            type="number"
            required
            min={LIMITS.workers.min}
            max={LIMITS.workers.max}
            step={LIMITS.workers.step}
            defaultValue={3}
            className="tap-target rounded-md border bg-background px-3 py-2 text-body tabular-nums"
            data-testid="add-line-workers"
          />
        </label>
        <label className="flex flex-col gap-1 text-label font-medium">
          Hours per worker
          <input
            name="hours"
            type="number"
            required
            min={LIMITS.hours.min}
            max={LIMITS.hours.max}
            step={LIMITS.hours.step}
            defaultValue={8}
            className="tap-target rounded-md border bg-background px-3 py-2 text-body tabular-nums"
            data-testid="add-line-hours"
          />
        </label>
      </div>
      {state.summary ? (
        <p
          className="text-label text-muted-foreground"
          data-testid="add-line-summary"
          data-text="label"
        >
          {state.summary}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className="tap-target w-full rounded-md bg-brand px-3 py-2 text-body font-medium text-brand-foreground disabled:opacity-50 sm:w-auto"
          data-testid="add-line-submit"
        >
          {pending ? "Adding…" : "Add line"}
        </button>
        <button
          type="button"
          className="tap-target w-full rounded-md border px-3 py-2 text-body font-medium sm:w-auto"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
