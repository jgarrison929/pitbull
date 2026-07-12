/**
 * Field report funnel analytics (2.12.9).
 * Event names align with CHANGELOG `field_report_submitted` — extend properties only.
 * `viewport_class` is injected by captureProductEvent; callers pass funnel props.
 */

export const FIELD_REPORT_SUBMITTED_EVENT = "field_report_submitted";
export const FIELD_REPORT_STEP_EVENT = "field_report_step";

export type FieldReportSubmitProps = {
  project_id: string;
  as_draft: boolean;
  photo_count: number;
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
