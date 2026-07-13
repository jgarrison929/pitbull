import { describe, expect, it } from "vitest";
import {
  AI_SUGGESTION_REVIEW_LABEL,
  isAiSuggestionReviewLabel,
} from "./ai-suggestion-label";
import { FIELD_AI_SUGGESTION_LABEL } from "./field-ai-suggestion";
import { PHOTO_SAFETY_SUGGESTION_LABEL } from "./field-photo-safety-suggestion";

describe("AI suggestion review label (2.19.8)", () => {
  it("is shared across field AI surfaces", () => {
    expect(FIELD_AI_SUGGESTION_LABEL).toBe(AI_SUGGESTION_REVIEW_LABEL);
    expect(PHOTO_SAFETY_SUGGESTION_LABEL).toBe(AI_SUGGESTION_REVIEW_LABEL);
    expect(isAiSuggestionReviewLabel(AI_SUGGESTION_REVIEW_LABEL)).toBe(true);
    expect(isAiSuggestionReviewLabel("final answer")).toBe(false);
  });
});
