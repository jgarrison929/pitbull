import { describe, expect, it } from "vitest";
import {
  applyFieldAiSuggestion,
  FIELD_AI_OFFLINE_COPY,
  FIELD_AI_SUGGESTION_LABEL,
  isFieldAiAvailableOffline,
  normalizeFieldAiSuggestion,
  suggestionHasContent,
} from "./field-ai-suggestion";

const suggestion = {
  workNarrative: "Poured L1 east",
  delaysNarrative: "Rain delay AM",
  safetyNarrative: "",
  confidenceNote: "ok",
  label: FIELD_AI_SUGGESTION_LABEL,
  autoApplied: false,
};

describe("field-ai-suggestion apply confirm (2.19.5)", () => {
  it("does not apply without confirm", () => {
    const cur = {
      workNarrative: "existing",
      delaysNarrative: "",
      safetyNarrative: "",
    };
    const next = applyFieldAiSuggestion(cur, suggestion, { confirm: false });
    expect(next).toEqual(cur);
  });

  it("applies only after confirm (fill empty)", () => {
    const cur = {
      workNarrative: "keep me",
      delaysNarrative: "",
      safetyNarrative: "",
    };
    const next = applyFieldAiSuggestion(cur, suggestion, {
      confirm: true,
      mode: "fillEmpty",
    });
    expect(next.workNarrative).toBe("keep me");
    expect(next.delaysNarrative).toBe("Rain delay AM");
  });

  it("replace mode overwrites when confirmed", () => {
    const next = applyFieldAiSuggestion(
      { workNarrative: "old", delaysNarrative: "", safetyNarrative: "" },
      suggestion,
      { confirm: true, mode: "replace" }
    );
    expect(next.workNarrative).toBe("Poured L1 east");
  });

  it("normalizes API payload and never claims autoApplied by default", () => {
    const n = normalizeFieldAiSuggestion({
      WorkNarrative: "x",
      AutoApplied: true,
    });
    expect(n?.workNarrative).toBe("x");
    expect(n?.autoApplied).toBe(true); // pass-through for honesty if server lied
    expect(suggestionHasContent(n)).toBe(true);
    expect(FIELD_AI_SUGGESTION_LABEL).toMatch(/review before submit/i);
  });

  it("offline disables AI without silent success", () => {
    expect(isFieldAiAvailableOffline(false)).toBe(false);
    expect(isFieldAiAvailableOffline(true)).toBe(true);
    expect(FIELD_AI_OFFLINE_COPY).toMatch(/offline/i);
    expect(FIELD_AI_OFFLINE_COPY).not.toMatch(/queued for ai|will auto-run/i);
  });
});
