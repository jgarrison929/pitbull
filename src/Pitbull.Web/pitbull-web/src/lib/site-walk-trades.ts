/**
 * Rank project subs by relevance to near-term schedule language.
 * Truth: a pour walk should surface form/concrete/rebar trades before electrical.
 * Keyword map is heuristic — labels stay "likely related", not "certified correct".
 */

export interface TradeRankableSub {
  id: string;
  name: string;
  trade?: string | null;
  scope?: string | null;
  status: string;
}

const TRADE_KEYWORDS: { key: string; patterns: RegExp[] }[] = [
  {
    key: "concrete_form",
    patterns: [
      /\b(pour|concrete|form|formwork|screed|finish|rebar|reinforc|slab|vault|footer|footing|cip)\b/i,
    ],
  },
  {
    key: "earthwork",
    patterns: [/\b(excavat|grade|trench|backfill|dirt|haul)\b/i],
  },
  {
    key: "steel",
    patterns: [/\b(steel|ironworker|deck|joist|metal fram)\b/i],
  },
  {
    key: "mep_elec",
    patterns: [/\b(electric|elect|power|light|panel)\b/i],
  },
  {
    key: "mep_plumb",
    patterns: [/\b(plumb|pipe|under.?slab)\b/i],
  },
  {
    key: "mep_hvac",
    patterns: [/\b(hvac|mechanical|duct)\b/i],
  },
];

/**
 * Extract trade-interest keys from free text (activity names, notes).
 */
export function extractTradeInterests(texts: string[]): string[] {
  const blob = texts.filter(Boolean).join(" \n ");
  if (!blob.trim()) return [];
  const hits: string[] = [];
  for (const row of TRADE_KEYWORDS) {
    if (row.patterns.some((p) => p.test(blob))) hits.push(row.key);
  }
  return hits;
}

function subHaystack(sub: TradeRankableSub): string {
  return [sub.name, sub.trade, sub.scope, sub.status].filter(Boolean).join(" ");
}

/**
 * Score a sub against active trade interests (higher = more relevant to today's work).
 */
export function scoreSubForTrades(
  sub: TradeRankableSub,
  interestKeys: string[]
): number {
  if (interestKeys.length === 0) return 0;
  const hay = subHaystack(sub);
  let score = 0;
  for (const key of interestKeys) {
    const def = TRADE_KEYWORDS.find((t) => t.key === key);
    if (!def) continue;
    if (def.patterns.some((p) => p.test(hay))) score += 10;
  }
  // Soft boost: concrete-related names when pour interests present
  if (
    interestKeys.includes("concrete_form") &&
    /\b(concrete|form|finish|place)\b/i.test(hay)
  ) {
    score += 5;
  }
  return score;
}

/**
 * Sort subs so trades matching look-ahead language float first.
 * Does not drop others — super can still scroll to electrical later.
 */
export function rankSubsForLookAhead<T extends TradeRankableSub>(
  subs: T[],
  lookAheadTexts: string[]
): Array<T & { relevanceScore: number }> {
  const interests = extractTradeInterests(lookAheadTexts);
  return [...subs]
    .map((s) => ({
      ...s,
      relevanceScore: scoreSubForTrades(s, interests),
    }))
    .sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Crew members assigned to this project (from my-crew style assignment lists).
 */
export function filterCrewOnProject<
  T extends { fullName?: string; firstName?: string; lastName?: string; assignedProjects?: { projectId: string; isActive?: boolean }[] },
>(crew: T[], projectId: string): T[] {
  if (!projectId) return [];
  return crew.filter((m) =>
    (m.assignedProjects ?? []).some(
      (p) => p.projectId === projectId && p.isActive !== false
    )
  );
}

export function crewDisplayName(m: {
  fullName?: string;
  firstName?: string;
  lastName?: string;
}): string {
  if (m.fullName?.trim()) return m.fullName.trim();
  return [m.firstName, m.lastName].filter(Boolean).join(" ").trim() || "Crew member";
}
