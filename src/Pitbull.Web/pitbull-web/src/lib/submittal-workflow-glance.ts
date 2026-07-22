/**
 * Submittal workflow glance for phone detail (band 3.5 / 3.4.7).
 * Real status enums only — no invented register-complete %.
 */

export type WorkflowGlanceStep = {
  label: string;
  status: "completed" | "current" | "upcoming" | "overdue";
};

const NORMAL_FLOW = ["Draft", "Submitted", "InReview", "Approved", "Closed"] as const;

export function buildSubmittalWorkflowGlance(status: string | null | undefined): WorkflowGlanceStep[] {
  const s = status || "Draft";

  if (s === "Rejected") {
    return [
      { label: "Draft", status: "completed" },
      { label: "Submitted", status: "completed" },
      { label: "In Review", status: "completed" },
      { label: "Rejected", status: "overdue" },
    ];
  }

  if (s === "ReviseAndResubmit") {
    return [
      { label: "Draft", status: "completed" },
      { label: "Submitted", status: "completed" },
      { label: "In Review", status: "completed" },
      { label: "Revise & Resubmit", status: "overdue" },
    ];
  }

  const effective = s === "ApprovedAsNoted" ? "Approved" : s;
  const currentIndex = NORMAL_FLOW.indexOf(effective as (typeof NORMAL_FLOW)[number]);
  const idx = currentIndex < 0 ? 0 : currentIndex;

  return NORMAL_FLOW.map((step, i) => ({
    label: step === "InReview" ? "In Review" : step,
    status:
      i < idx ? ("completed" as const) : i === idx ? ("current" as const) : ("upcoming" as const),
  }));
}

/** Honest empty for history when server returns none */
export const SUBMITTAL_WORKFLOW_EMPTY =
  "No workflow events yet. Status changes will appear here when recorded — we do not invent history.";
