/**
 * Plan revision display (2.13.7).
 * Never invent "latest" — only format API-provided revision fields.
 */

/**
 * Format a plan revision label for the viewer.
 * @returns null when no revision data (UI should omit, not invent).
 */
export function formatPlanRevisionLabel(
  revision: string | null | undefined,
  opts?: { revisionDate?: string | null }
): string | null {
  const rev = revision?.trim();
  if (!rev) return null;
  // Already labeled (e.g. "Rev 3", "IFC") — keep as-is; do not prefix "latest".
  const date = opts?.revisionDate?.trim();
  if (date) return `${rev} · ${date}`;
  return rev;
}
