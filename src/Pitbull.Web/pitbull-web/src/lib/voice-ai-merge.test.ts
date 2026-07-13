import { describe, expect, it } from "vitest";
import { mergeVoiceAndAiSuggestions } from "./voice-ai-merge";
import { FIELD_AI_SUGGESTION_LABEL } from "./field-ai-suggestion";

describe("voice + AI merge (2.21.0)", () => {
  const empty = {
    workNarrative: "",
    delaysNarrative: "",
    safetyNarrative: "",
  };

  it("appends voice without AI when not confirmed", () => {
    const next = mergeVoiceAndAiSuggestions({
      current: empty,
      voiceTranscript: "poured east deck",
      aiSuggestion: {
        workNarrative: "AI would overwrite",
        delaysNarrative: "rain",
        safetyNarrative: "",
        confidenceNote: "",
        label: FIELD_AI_SUGGESTION_LABEL,
        autoApplied: false,
      },
      confirmAi: false,
    });
    expect(next.workNarrative.toLowerCase()).toContain("poured");
    expect(next.delaysNarrative).toBe("");
  });

  it("fills empty fields from AI only after confirm", () => {
    const next = mergeVoiceAndAiSuggestions({
      current: { workNarrative: "kept", delaysNarrative: "", safetyNarrative: "" },
      voiceTranscript: "",
      aiSuggestion: {
        workNarrative: "AI work",
        delaysNarrative: "AI delay",
        safetyNarrative: "AI safety",
        confidenceNote: "",
        label: FIELD_AI_SUGGESTION_LABEL,
        autoApplied: false,
      },
      confirmAi: true,
    });
    expect(next.workNarrative).toBe("kept");
    expect(next.delaysNarrative).toBe("AI delay");
    expect(next.safetyNarrative).toBe("AI safety");
  });

  it("classifies delay voice into delaysNarrative", () => {
    const next = mergeVoiceAndAiSuggestions({
      current: empty,
      voiceTranscript: "weather hold all morning",
      confirmAi: false,
    });
    expect(next.delaysNarrative.toLowerCase()).toMatch(/weather|hold/);
  });
});
