/**
 * Field AI suggestion helpers (2.19.5).
 * Suggestions never auto-apply — require explicit user confirm.
 */

export type FieldAiSuggestion = {
  workNarrative: string;
  delaysNarrative: string;
  safetyNarrative: string;
  confidenceNote: string;
  label: string;
  autoApplied: boolean;
};

export type NarrativeFields = {
  workNarrative: string;
  delaysNarrative: string;
  safetyNarrative: string;
};

import { AI_SUGGESTION_REVIEW_LABEL } from "./ai-suggestion-label";

export const FIELD_AI_SUGGESTION_LABEL = AI_SUGGESTION_REVIEW_LABEL;

/** Normalize API camel/Pascal payload into a suggestion. */
export function normalizeFieldAiSuggestion(raw: unknown): FieldAiSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    workNarrative: String(o.workNarrative ?? o.WorkNarrative ?? "").trim(),
    delaysNarrative: String(o.delaysNarrative ?? o.DelaysNarrative ?? "").trim(),
    safetyNarrative: String(o.safetyNarrative ?? o.SafetyNarrative ?? "").trim(),
    confidenceNote: String(o.confidenceNote ?? o.ConfidenceNote ?? "").trim(),
    label: String(o.label ?? o.Label ?? FIELD_AI_SUGGESTION_LABEL),
    autoApplied: Boolean(o.autoApplied ?? o.AutoApplied ?? false),
  };
}

export function suggestionHasContent(s: FieldAiSuggestion | null | undefined): boolean {
  if (!s) return false;
  return Boolean(
    s.workNarrative || s.delaysNarrative || s.safetyNarrative
  );
}

/**
 * Apply suggestion into form fields only after confirm=true.
 * Without confirm, returns original fields unchanged.
 */
export function applyFieldAiSuggestion(
  current: NarrativeFields,
  suggestion: FieldAiSuggestion,
  opts: { confirm: boolean; mode?: "replace" | "fillEmpty" }
): NarrativeFields {
  if (!opts.confirm) return { ...current };
  const mode = opts.mode ?? "fillEmpty";
  const pick = (cur: string, next: string) => {
    if (!next) return cur;
    if (mode === "replace") return next;
    return cur.trim() ? cur : next;
  };
  return {
    workNarrative: pick(current.workNarrative, suggestion.workNarrative),
    delaysNarrative: pick(current.delaysNarrative, suggestion.delaysNarrative),
    safetyNarrative: pick(current.safetyNarrative, suggestion.safetyNarrative),
  };
}
