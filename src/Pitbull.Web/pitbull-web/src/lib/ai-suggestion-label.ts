/**
 * Canonical AI output label (2.19.8).
 * All field AI surfaces must show this before apply/submit.
 */
export const AI_SUGGESTION_REVIEW_LABEL =
  "Suggestion — review before submit" as const;

export function isAiSuggestionReviewLabel(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return t.includes("suggestion") && t.includes("review") && t.includes("submit");
}
