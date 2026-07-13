import { describe, it, expect } from "vitest";
import {
  AI_SUGGESTION_APPLIED_EVENT,
  FIELD_REPORT_STEP_EVENT,
  FIELD_REPORT_SUBMITTED_EVENT,
  buildAiSuggestionAppliedProps,
  buildFieldReportStepProps,
  buildFieldReportSubmittedProps,
} from "./field-report-analytics";
import { classifyViewportWidth } from "./viewport-class";

describe("field-report-analytics (2.12.9)", () => {
  it("uses documented event names (extend submitted; step for funnel)", () => {
    expect(FIELD_REPORT_SUBMITTED_EVENT).toBe("field_report_submitted");
    expect(FIELD_REPORT_STEP_EVENT).toBe("field_report_step");
  });

  it("submit props include online/offline flag for both paths", () => {
    const online = buildFieldReportSubmittedProps({
      project_id: "p1",
      as_draft: false,
      photo_count: 0,
      offline: false,
    });
    const offline = buildFieldReportSubmittedProps({
      project_id: "p1",
      as_draft: false,
      photo_count: 1,
      offline: true,
    });
    expect(online.offline).toBe(false);
    expect(offline.offline).toBe(true);
    expect(offline.photo_count).toBe(1);
  });

  it("step props capture wizard transitions", () => {
    const props = buildFieldReportStepProps({
      from_step: "Project",
      to_step: "Field",
      direction: "next",
      project_id: "p1",
    });
    expect(props.from_step).toBe("Project");
    expect(props.to_step).toBe("Field");
    expect(props.direction).toBe("next");
  });

  it("viewport_class phone/desktop classification used by captureProductEvent", () => {
    // captureProductEvent always merges viewport_class from this helper.
    expect(classifyViewportWidth(390)).toBe("phone");
    expect(classifyViewportWidth(1280)).toBe("desktop");
  });
});

describe("ai_suggestion_applied (2.20.4)", () => {
  it("exports diagnostic event name and props builder", () => {
    expect(AI_SUGGESTION_APPLIED_EVENT).toBe("ai_suggestion_applied");
    const p = buildAiSuggestionAppliedProps({
      project_id: "p1",
      suggestion_kind: "field_voice",
      offline: false,
    });
    expect(p.suggestion_kind).toBe("field_voice");
    expect(p.project_id).toBe("p1");
  });
});
