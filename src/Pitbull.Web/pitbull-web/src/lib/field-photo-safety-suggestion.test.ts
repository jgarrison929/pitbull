import { describe, expect, it } from "vitest";
import {
  applyPhotoSafetySuggestion,
  heuristicPhotoSafetySuggestion,
  PHOTO_SAFETY_SUGGESTION_LABEL,
} from "./field-photo-safety-suggestion";

describe("photo safety suggestion (2.19.7)", () => {
  it("labels as review-before-submit and never auto-applies", () => {
    const s = heuristicPhotoSafetySuggestion({
      caption: "crew on ladder without hard hat mention",
      hasPhoto: true,
    });
    expect(s.label).toBe(PHOTO_SAFETY_SUGGESTION_LABEL);
    expect(s.autoApplied).toBe(false);
    expect(s.flags).toContain("work-at-height");
    expect(s.confidenceNote).toMatch(/not a site inspection/i);
  });

  it("does not invent hazards without keywords", () => {
    const s = heuristicPhotoSafetySuggestion({
      caption: "pour complete east deck",
      hasPhoto: true,
    });
    expect(s.safetyNarrative).toBe("");
    expect(s.flags).toHaveLength(0);
  });

  it("apply requires confirm", () => {
    const s = heuristicPhotoSafetySuggestion({
      caption: "near miss at trench",
      hasPhoto: true,
    });
    expect(applyPhotoSafetySuggestion("", s, false)).toBe("");
    expect(applyPhotoSafetySuggestion("", s, true)).toContain("safety");
  });
});
