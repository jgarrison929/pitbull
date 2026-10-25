/**
 * Pure helpers: speech transcript → daily report form field updates.
 * Kept I/O-free so unit tests drive the real mapping used by the mic button.
 */

export type DailyReportNarrativeFields = {
  workNarrative: string;
  delaysNarrative: string;
  safetyNarrative: string;
};

export type NarrativeFieldKey = keyof DailyReportNarrativeFields;

/**
 * Classify a free-form field voice transcript for routing.
 * Construction jargon: delay/weather → delays; safety/PPE/near miss → safety; else work.
 */
export function classifyVoiceTranscript(transcript: string): NarrativeFieldKey {
  const t = transcript.trim().toLowerCase();
  if (!t) return "workNarrative";

  if (
    /\b(delay|delayed|waiting|weather hold|rain out|standby|idle)\b/.test(t)
  ) {
    return "delaysNarrative";
  }
  if (
    /\b(safety|ppe|near\s*miss|incident|toolbox|jsa|hazard|injury|osha)\b/.test(
      t
    )
  ) {
    return "safetyNarrative";
  }
  return "workNarrative";
}

/**
 * Append a cleaned transcript segment into the target narrative field.
 * Returns a new fields object (immutable) for form state.
 */
export function applyVoiceTranscriptToNarratives(
  current: DailyReportNarrativeFields,
  rawTranscript: string,
  field?: NarrativeFieldKey
): DailyReportNarrativeFields {
  const cleaned = cleanTranscript(rawTranscript);
  if (!cleaned) return { ...current };

  const target = field ?? classifyVoiceTranscript(cleaned);
  const existing = current[target].trim();
  const next = existing ? `${existing} ${cleaned}` : cleaned;

  return {
    ...current,
    [target]: next,
  };
}

/** Normalize speech API output for form storage. */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

/**
 * Build OfflineDailyReport-compatible narrative snapshot after voice apply.
 * Used by tests and offline queue builders to assert form → queue continuity.
 */
export function narrativesFromVoiceApply(
  current: DailyReportNarrativeFields,
  transcript: string
): DailyReportNarrativeFields {
  return applyVoiceTranscriptToNarratives(current, transcript);
}
