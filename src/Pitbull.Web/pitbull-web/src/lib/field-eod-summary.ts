/**
 * End-of-day field summary — rule-based first (2.20.0).
 * No LLM required. Never invents % complete, cost, or green status.
 */

export type EodSummaryInput = {
  projectLabel: string;
  reportDate: string;
  activities: string[];
  crewHeadcount: number;
  workNarrative: string;
  delaysNarrative: string;
  safetyNarrative: string;
  photoCount: number;
  hasZone: boolean;
};

export type EodSummary = {
  title: string;
  bullets: string[];
  truthNote: string;
  source: "rule-based" | "llm-suggestion";
};

/** Build a labeled LLM-suggestion summary from free text bullets (never auto-applied). */
export function buildLlmEodSuggestionFromText(opts: {
  prose: string;
  model?: string | null;
}): EodSummary {
  const lines = opts.prose
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
  return {
    title: "End-of-day field summary (AI suggestion)",
    bullets: lines.length > 0 ? lines : ["(empty AI response — use rule-based summary)"],
    truthNote:
      "Suggestion — review before submit. Optional LLM path (flag fieldLlmEod). Not an executive KPI; no invented cost/% complete. Model: " +
      (opts.model?.trim() || "unknown"),
    source: "llm-suggestion",
  };
}

export function buildRuleBasedEodSummary(input: EodSummaryInput): EodSummary {
  const bullets: string[] = [];
  const job = input.projectLabel.trim() || "Job";
  bullets.push(`${job} — ${input.reportDate}`);

  if (input.activities.length > 0) {
    bullets.push(`Work focus: ${input.activities.join(", ")}`);
  } else if (input.workNarrative.trim()) {
    const w = input.workNarrative.trim();
    bullets.push(`Work notes: ${w.length > 160 ? `${w.slice(0, 157)}…` : w}`);
  } else {
    bullets.push("Work notes: none entered");
  }

  if (input.crewHeadcount > 0) {
    bullets.push(`Crew headcount (sum of counts): ${input.crewHeadcount}`);
  }

  if (input.delaysNarrative.trim()) {
    const d = input.delaysNarrative.trim();
    bullets.push(`Delays: ${d.length > 120 ? `${d.slice(0, 117)}…` : d}`);
  } else {
    bullets.push("Delays: none noted");
  }

  if (input.safetyNarrative.trim()) {
    const s = input.safetyNarrative.trim();
    bullets.push(`Safety: ${s.length > 120 ? `${s.slice(0, 117)}…` : s}`);
  } else {
    bullets.push("Safety: none noted");
  }

  bullets.push(
    `Photos: ${input.photoCount}${input.hasZone ? " · zone selected" : " · no zone"}`
  );

  return {
    title: "End-of-day field summary (rule-based)",
    bullets,
    truthNote:
      "Built from form fields only — not an executive KPI, not % complete, not cost. No LLM.",
    source: "rule-based",
  };
}
