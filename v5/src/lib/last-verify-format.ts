/**
 * Status-page / JSON display: time alone, or time · commit when both known.
 * Missing stamp → "not recorded".
 */
export function formatLastVerify(
  at: string | null,
  commit: string | null,
): string {
  if (!at) return "not recorded";
  if (!commit) return at;
  return `${at} · ${commit}`;
}
