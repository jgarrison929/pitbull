/**
 * Twin storey lazy-load helpers (2.17.4).
 * Load storey schematic zones on demand — not all storeys at once on mobile.
 */

export type TwinNodeLike = {
  id: string;
  parentNodeId?: string | null;
  nodeType: string;
  code: string;
  name: string;
};

/** True when node is a storey (API may send "Storey" or "storey"). */
export function isStoreyNode(n: TwinNodeLike): boolean {
  return n.nodeType.toLowerCase() === "storey";
}

export function isZoneNode(n: TwinNodeLike): boolean {
  return n.nodeType.toLowerCase() === "zone";
}

/**
 * Zones under a storey: walk descendants of storeyId that are zones.
 * When storeyId is null/all, return all zones.
 */
export function zonesForStorey(
  nodes: TwinNodeLike[],
  storeyId: string | null | undefined
): TwinNodeLike[] {
  const zones = nodes.filter(isZoneNode);
  if (!storeyId || storeyId === "__all__") return zones;

  const byParent = new Map<string | null, TwinNodeLike[]>();
  for (const n of nodes) {
    const k = n.parentNodeId ?? null;
    const list = byParent.get(k) ?? [];
    list.push(n);
    byParent.set(k, list);
  }

  const under = new Set<string>();
  const stack = [storeyId];
  while (stack.length) {
    const id = stack.pop()!;
    under.add(id);
    for (const c of byParent.get(id) ?? []) stack.push(c.id);
  }

  return zones.filter((z) => under.has(z.id));
}

/** Default storey selection for lazy load: first storey or all. */
export function defaultStoreyFilter(nodes: TwinNodeLike[]): string {
  const storeys = nodes.filter(isStoreyNode);
  if (storeys.length === 0) return "__all__";
  // Prefer first storey for mobile-friendly initial load (not all floors at once).
  return storeys[0]!.id;
}
