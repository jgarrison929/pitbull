"use client";

import { useState } from "react";
import { runAction } from "@/app/app/assistant/actions";

type CrewOption = { id: string; name: string };

/** Superintendent: create a draft daily plan for a crew and date on this job. */
export function NewPlanForm({
  jobNumber,
  crews,
  defaultDate,
}: {
  jobNumber: string;
  crews: CrewOption[];
  /** YYYY-MM-DD default (today in America/Los_Angeles). */
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className="rounded-md border px-3 py-1.5 text-xs font-medium"
        data-testid="new-plan"
        onClick={() => setOpen(true)}
      >
        New plan
      </button>
    );
  }
  return (
    <form
      action={runAction}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end"
      data-testid="new-plan-form"
    >
      <input type="hidden" name="action" value="dailyPlan.create" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="label" value="New plan" />
      <label className="flex min-w-36 flex-1 flex-col gap-0.5 text-xs">
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={defaultDate}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          data-testid="new-plan-date"
        />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-0.5 text-xs">
        Crew
        <select
          name="crewId"
          required
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          data-testid="new-plan-crew"
          defaultValue={crews[0]?.id ?? ""}
        >
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          data-testid="new-plan-submit"
        >
          Create plan
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
