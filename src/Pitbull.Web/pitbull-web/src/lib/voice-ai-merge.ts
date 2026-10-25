/**
 * Merge browser voice transcript with optional AI structured suggestion (2.21.0).
 * Confirm required for AI apply; never invents content.
 */

import {
  applyFieldAiSuggestion,
  type FieldAiSuggestion,
  type NarrativeFields,
} from "./field-ai-suggestion";
import {
  applyVoiceTranscriptToNarratives,
  type DailyReportNarrativeFields,
} from "./voice-transcript";

export type VoiceAiMergeInput = {
  current: NarrativeFields;
  voiceTranscript?: string | null;
  aiSuggestion?: FieldAiSuggestion | null;
  /** Must be true to apply AI fields */
  confirmAi: boolean;
};

/**
 * 1) Append classified voice transcript into narratives.
 * 2) Optionally fill empty fields from AI suggestion when confirmAi.
 */
export function mergeVoiceAndAiSuggestions(
  input: VoiceAiMergeInput
): NarrativeFields {
  let next: NarrativeFields = { ...input.current };
  const transcript = input.voiceTranscript?.trim() ?? "";
  if (transcript) {
    const asDaily: DailyReportNarrativeFields = {
      workNarrative: next.workNarrative,
      delaysNarrative: next.delaysNarrative,
      safetyNarrative: next.safetyNarrative,
    };
    const merged = applyVoiceTranscriptToNarratives(asDaily, transcript);
    next = {
      workNarrative: merged.workNarrative,
      delaysNarrative: merged.delaysNarrative,
      safetyNarrative: merged.safetyNarrative,
    };
  }
  if (input.aiSuggestion && input.confirmAi) {
    next = applyFieldAiSuggestion(next, input.aiSuggestion, {
      confirm: true,
      mode: "fillEmpty",
    });
  }
  return next;
}
