"use client";

import { useActionState, useId, useMemo, useState } from "react";
import {
  runActionState,
  type ActionState,
} from "@/app/app/assistant/actions";
import { ChoiceField } from "@/components/form/combobox";
import type { Option } from "@/components/form/form";
import {
  activitiesCoveringDate,
  type PlanActivityOption,
} from "@/lib/plan-activity";
import { LIMITS } from "@/lib/plan-line";

/** Add a cost-item line to a draft daily plan. */
export function AddPlanLineForm({
  jobNumber,
  planId,
  planDate,
  costItems,
  activities = [],
  searchUrl,
}: {
  jobNumber: string;
  planId: string;
  /** Plan date (YYYY-MM-DD) — picker lists activities covering this day. */
  planDate: string;
  costItems: (Option & { unit: string })[];
  /** Job schedule activities; filtered to those covering planDate. */
  activities?: PlanActivityOption[];
  searchUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const covering = useMemo(
    () => activitiesCoveringDate(activities, planDate),
    [activities, planDate],
  );
  const activityOptions: Option[] = useMemo(
    () => [
      { value: "", label: "Free text (no schedule activity)" },
      ...covering.map((a) => ({
        value: a.id,
        label: `${a.code} · ${a.name}`,
        hint: a.costItemId ?? undefined,
      })),
    ],
    [covering],
  );
  const [activityId, setActivityId] = useState("");
  const [costItemId, setCostItemId] = useState(costItems[0]?.value ?? "");
  const [activityText, setActivityText] = useState("");
  const [unit, setUnit] = useState(costItems[0]?.unit ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );

  const linkedCostOnly = Boolean(activityId);

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

  const onPickActivity = (value: string) => {
    setActivityId(value);
    const next = covering.find((a) => a.id === value);
    if (!next) {
      setActivityText("");
      return;
    }
    setActivityText(next.name);
    if (next.costItemId) {
      setCostItemId(next.costItemId);
      const opt = costItems.find((c) => c.value === next.costItemId);
      if (opt?.unit) setUnit(opt.unit);
      else if (opt?.hint) setUnit(opt.hint);
    }
  };

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
      {activityId ? (
        <input type="hidden" name="activityId" value={activityId} />
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {covering.length > 0 ? (
          <label
            className="flex flex-col gap-0.5 text-xs sm:col-span-2"
            data-testid="add-line-activity-picker"
          >
            Schedule activity
            <ChoiceField
              id={`${uid}-activity-pick`}
              name="_activityPick"
              options={activityOptions}
              defaultValue=""
              onChange={(value) => onPickActivity(value)}
            />
            <span className="text-muted-foreground">
              Lists activities whose dates cover this plan day. Picking one
              fills the name and linked cost item.
            </span>
          </label>
        ) : null}
        <label className="flex flex-col gap-0.5 text-xs sm:col-span-2">
          Cost item
          {/* Remount when activity pick changes the cost item so defaultValue sticks. */}
          <ChoiceField
            key={costItemId}
            id={`${uid}-cost`}
            name="costItemId"
            options={costItems}
            defaultValue={costItemId}
            searchUrl={linkedCostOnly ? undefined : searchUrl}
            onChange={(value, option) => {
              setCostItemId(value);
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
            value={activityText}
            onChange={(ev) => setActivityText(ev.target.value)}
            readOnly={linkedCostOnly}
            className="rounded-md border bg-background px-2 py-1.5 text-sm read-only:bg-muted/40"
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
