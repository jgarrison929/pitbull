"use client";

import { useActionState } from "react";
import { runActionState, type ActionState } from "@/app/app/assistant/actions";
import { usePlanScope } from "@/components/app/plan-scope";
import { ConfirmForm } from "@/components/form/confirm-form";
import { approveReportCopy, returnReportCopy } from "@/lib/confirm-copy";

/** Superintendent approve — posts pending hours/qty once, dated by plan date. */
export function ApproveReportForm({
  jobNumber,
  planId,
}: {
  jobNumber: string;
  planId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  const scope = usePlanScope();
  const copy = approveReportCopy({
    jobNumber,
    crew: scope?.crew ?? null,
    planDate: scope?.planDate ?? null,
  });
  return (
    <ConfirmForm
      action={action}
      className="flex w-full flex-col gap-2"
      testId="approve-form"
      triggerLabel="Approve report"
      pendingLabel="Approving…"
      triggerClassName="tap-target w-full rounded-md bg-brand px-3 py-2 text-body font-medium text-brand-foreground disabled:opacity-60 sm:w-auto"
      triggerTestId="approve-report"
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive={copy.destructive}
      footer={
        state.summary ? (
          <p
            className="text-label text-muted-foreground"
            data-testid="approve-summary"
            data-text="label"
          >
            {state.summary}
          </p>
        ) : null
      }
    >
      <input type="hidden" name="action" value="dailyPlan.approve" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Approve daily report" />
    </ConfirmForm>
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
  const [state, action] = useActionState<ActionState, FormData>(
    runActionState,
    {},
  );
  const scope = usePlanScope();
  const copy = returnReportCopy({
    jobNumber,
    crew: scope?.crew ?? null,
    planDate: scope?.planDate ?? null,
  });
  return (
    <ConfirmForm
      action={action}
      className="flex w-full flex-col gap-2"
      testId="return-form"
      triggerLabel="Return to foreman"
      pendingLabel="Returning…"
      triggerClassName="tap-target w-full rounded-md border px-3 py-2 text-body font-medium disabled:opacity-60 sm:w-auto"
      triggerTestId="return-report"
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive={copy.destructive}
      footer={
        state.summary ? (
          <p
            className="text-label text-muted-foreground"
            data-testid="return-summary"
            data-text="label"
          >
            {state.summary}
          </p>
        ) : null
      }
    >
      <input type="hidden" name="action" value="dailyPlan.return" />
      <input type="hidden" name="job" value={jobNumber} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="label" value="Return daily report" />
      {/* Required reason stays outside any collapsed region (5.0.4-d). */}
      <label className="flex flex-col gap-1 text-label font-medium">
        Return reason
        <input
          name="reason"
          type="text"
          required
          maxLength={500}
          placeholder="Why is this going back?"
          className="tap-target rounded-md border bg-background px-3 py-2 text-body"
          data-testid="return-reason"
        />
      </label>
    </ConfirmForm>
  );
}
