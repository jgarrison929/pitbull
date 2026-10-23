/** Join clause parts into one sentence with a single terminal period. */
export function sentence(lead: string, parts: string[]): string {
  if (!parts.length) return lead.endsWith(".") ? lead : `${lead}.`;
  const body = parts.join("; ");
  const base = `${lead}${body}`;
  return /[.!?]"?\s*$/.test(base) ? base : `${base}.`;
}
