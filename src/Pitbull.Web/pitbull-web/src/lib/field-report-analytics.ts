/**
 * Field report funnel analytics (2.12.9).
 * Event names align with CHANGELOG `field_report_submitted` — extend properties only.
 * `viewport_class` is injected by captureProductEvent; callers pass funnel props.
 */

export const FIELD_REPORT_SUBMITTED_EVENT = "field_report_submitted";
export const FIELD_REPORT_STEP_EVENT = "field_report_step";

/** Diagnostic only (2.20.4) — not a vanity KPI. */
export const AI_SUGGESTION_APPLIED_EVENT = "ai_suggestion_applied";

export type FieldReportSubmitProps = {
  project_id: string;
  as_draft: boolean;
  photo_count: number;
  offline: boolean;
};

export type AiSuggestionAppliedProps = {
  project_id?: string | null;
  suggestion_kind: "field_voice" | "photo_safety" | "field_eod";
  offline: boolean;
};

export type FieldReportStepProps = {
  from_step: string;
  to_step: string;
  direction: "next" | "back";
  project_id?: string | null;
};

/** Build submit funnel props (online or offline). */
export function buildFieldReportSubmittedProps(
  input: FieldReportSubmitProps
): FieldReportSubmitProps {
  return {
    project_id: input.project_id,
    as_draft: input.as_draft,
    photo_count: input.photo_count,
    offline: input.offline,
  };
}

/** Build step funnel props when the wizard advances. */
export function buildFieldReportStepProps(
  input: FieldReportStepProps
): FieldReportStepProps {
  return {
    from_step: input.from_step,
    to_step: input.to_step,
    direction: input.direction,
    project_id: input.project_id ?? null,
  };
}

/** Build PostHog props when user confirms apply on an AI suggestion. */
export function buildAiSuggestionAppliedProps(
  input: AiSuggestionAppliedProps
): AiSuggestionAppliedProps {
  return {
    project_id: input.project_id ?? null,
    suggestion_kind: input.suggestion_kind,
    offline: input.offline,
  };
}
