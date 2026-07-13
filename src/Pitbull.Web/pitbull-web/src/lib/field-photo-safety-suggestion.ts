/**
 * Optional photo-assist safety suggestion (2.19.7).
 * Labeled suggestion only — never auto-posts safety narratives or incidents.
 */

export const PHOTO_SAFETY_SUGGESTION_LABEL =
  "Suggestion — review before submit" as const;

export type PhotoSafetySuggestion = {
  /** Short safety narrative candidate from photo context */
  safetyNarrative: string;
  /** Optional flags for UI chips (not automated compliance) */
  flags: string[];
  label: string;
  autoApplied: boolean;
  confidenceNote: string;
};

/** Heuristic scaffold when server AI is unavailable — still labeled suggestion only. */
export function heuristicPhotoSafetySuggestion(opts: {
  caption?: string | null;
  hasPhoto: boolean;
}): PhotoSafetySuggestion {
  const caption = (opts.caption ?? "").trim().toLowerCase();
  const flags: string[] = [];
  if (/\b(ladder|scaffold|height|fall)\b/.test(caption)) flags.push("work-at-height");
  if (/\b(ppe|hard hat|vest|glove|glasses)\b/.test(caption)) flags.push("ppe-mentioned");
  if (/\b(near miss|incident|injury|hazard)\b/.test(caption)) flags.push("hazard-language");
  if (/\b(trench|excavation|cave)\b/.test(caption)) flags.push("excavation");

  let safetyNarrative = "";
  if (flags.length > 0) {
    safetyNarrative =
      "Photo caption mentions potential safety topics (" +
      flags.join(", ") +
      "). Confirm on-site conditions and document PPE/toolbox as needed.";
  } else if (opts.hasPhoto) {
    safetyNarrative = "";
  }

  return {
    safetyNarrative,
    flags,
    label: PHOTO_SAFETY_SUGGESTION_LABEL,
    autoApplied: false,
    confidenceNote:
      flags.length > 0
        ? "Heuristic from caption keywords only — not a site inspection or compliance finding."
        : "No safety keywords in caption — no invented hazard.",
  };
}

export function applyPhotoSafetySuggestion(
  currentSafety: string,
  suggestion: PhotoSafetySuggestion,
  confirm: boolean
): string {
  if (!confirm) return currentSafety;
  if (!suggestion.safetyNarrative.trim()) return currentSafety;
  if (currentSafety.trim()) {
    return `${currentSafety.trim()}\n${suggestion.safetyNarrative.trim()}`;
  }
  return suggestion.safetyNarrative.trim();
}
