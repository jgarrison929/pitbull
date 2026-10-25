"use client";

import { useActionState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";

/** Superintendent approve — posts pending hours/qty once, dated by plan date. */
export function ApproveReportForm({
  jobNumber,
  planId,
}: {
  jobNumber: string;
  planId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-1" data-testid="approve-form">
      <input type="hidden" name="action" value="dailyPlan.approve" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Approve daily report" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        data-testid="approve-report"
      >
        {pending ? "Approving…" : "Approve report"}
      </button>
      {state.summary ? (
        <p className="text-xs text-muted-foreground" data-testid="approve-summary">
          {state.summary}
        </p>
      ) : null}
    </form>
  );
}

/** Superintendent return — requires a reason; keeps values; posts nothing. */
export function ReturnReportForm({
  jobNumber,
  planId,
}: {
  jobNumber: string;
  planId: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="return-form">
      <input type="hidden" name="action" value="dailyPlan.return" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Return daily report" />
      <label className="flex flex-col gap-0.5 text-xs">
        Return reason
        <input
          name="reason"
          type="text"
          required
          maxLength={500}
          placeholder="Why is this going back?"
          className="rounded-md border bg-background px-2 py-1 text-sm"
          data-testid="return-reason"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        data-testid="return-report"
      >
        {pending ? "Returning…" : "Return to foreman"}
      </button>
      {state.summary ? (
        <p className="text-xs text-muted-foreground" data-testid="return-summary">
          {state.summary}
        </p>
      ) : null}
    </form>
  );
}
