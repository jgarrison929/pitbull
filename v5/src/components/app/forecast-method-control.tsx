"use client";

import { useActionState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import type { ForecastMethod } from "@/lib/ev";

const OPTIONS: { value: ForecastMethod; label: string }[] = [
  { value: "current_budget", label: "Current Budget" },
  { value: "average_performance", label: "Average Performance" },
];

/** PM-only switch for a leaf cost item's EAC forecast method. */
export function ForecastMethodControl({
  jobNumber,
  costItemId,
  code,
  method,
  canEdit,
}: {
  jobNumber: string;
  costItemId: string;
  code: string;
  method: ForecastMethod;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );

  if (!canEdit) {
    const label =
      OPTIONS.find((o) => o.value === method)?.label ?? method;
    return (
      <p
        className="text-body text-muted-foreground"
        data-testid="forecast-method-readonly"
        data-method={method}
      >
        Forecast method: {label}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3"
      data-testid="forecast-method-control"
    >
      <input type="hidden" name="action" value="costItem.setForecastMethod" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="costItemId" value={costItemId} />
      <input
        type="hidden"
        name="label"
        value={`Set forecast method on ${code}`}
      />
      <label
        data-text="label"
        className="flex min-w-[12rem] flex-1 flex-col gap-1 text-label"
      >
        Forecast method
        <select
          name="forecastMethod"
          defaultValue={method}
          className="tap-target rounded-md border bg-background px-3 py-2 text-body"
          data-testid="forecast-method-select"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="tap-target rounded-md border px-4 text-body font-medium hover:bg-muted disabled:opacity-60"
        data-testid="forecast-method-save"
      >
        {pending ? "Saving…" : "Apply"}
      </button>
      {state.summary ? (
        <p
          data-text="label"
          className="w-full text-label text-muted-foreground"
          data-testid="forecast-method-summary"
        >
          {state.summary}
        </p>
      ) : null}
    </form>
  );
}
