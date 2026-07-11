/**
 * Pure entity find-and-match helpers for mobile data entry.
 * Keep I/O out of this module so unit tests can assert ranking + selection
 * without mounting pages or mocking storage.
 */

export interface EntityOption {
  id: string;
  label: string;
  /** Secondary line (e.g. employee number, project name alone). */
  sublabel?: string;
  /** Extra tokens matched by search (codes, aliases). */
  searchText?: string;
}

export interface EntitySelection {
  id: string;
  label: string;
  sublabel?: string;
}

/** Normalize query for case-insensitive substring match. */
export function normalizeLookupQuery(query: string): string {
  return query.trim().toLowerCase();
}

function haystack(item: EntityOption): string {
  return [item.label, item.sublabel, item.searchText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Filter entities by free-text query and rank recent matches first.
 * Empty query returns all items with recents first (stable within groups).
 */
export function filterAndRankEntities(
  items: EntityOption[],
  query: string,
  recentIds: string[] = []
): EntityOption[] {
  const q = normalizeLookupQuery(query);
  const recentIndex = new Map(recentIds.map((id, i) => [id, i]));

  const matched = q
    ? items.filter((item) => haystack(item).includes(q))
    : [...items];

  return matched.sort((a, b) => {
    const ai = recentIndex.has(a.id) ? recentIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const bi = recentIndex.has(b.id) ? recentIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Apply a selection: resolve id → form-ready { id, label } from the catalog.
 * Returns null when the id is not in the list (stale recent, deleted entity).
 */
export function selectEntity(
  items: EntityOption[],
  id: string
): EntitySelection | null {
  if (!id) return null;
  const found = items.find((item) => item.id === id);
  if (!found) return null;
  return {
    id: found.id,
    label: found.label,
    sublabel: found.sublabel,
  };
}

/**
 * Keep only recent ids that still exist in the current catalog.
 */
export function getValidRecentIds(
  recentItems: { id: string }[],
  validIds: Iterable<string>
): string[] {
  const set = new Set(validIds);
  return recentItems.filter((item) => set.has(item.id)).map((item) => item.id);
}

/**
 * Build form state patch after user picks an entity from a lookup.
 * Used by callers that store entityId + optional display label.
 */
export function applyEntitySelectionToFormState(
  current: { entityId: string; entityLabel: string },
  items: EntityOption[],
  selectedId: string
): { entityId: string; entityLabel: string } {
  const selected = selectEntity(items, selectedId);
  if (!selected) {
    return { entityId: "", entityLabel: "" };
  }
  return {
    entityId: selected.id,
    entityLabel: selected.sublabel
      ? `${selected.label} (${selected.sublabel})`
      : selected.label,
  };
}
