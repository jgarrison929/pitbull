/**
 * Product honesty — strings Verify and operators reject in user-facing copy.
 * Pitbull is project controls, never an "ERP". No stub / coming-soon theater.
 */

export const PRODUCT_BANNED = [
  { id: "erp", re: /\bERP\b/ },
  { id: "coming-soon", re: /coming\s+soon/i },
  { id: "placeholder-copy", re: /\bplaceholder\b/i },
  { id: "tbd", re: /\bTBD\b/ },
  { id: "wip", re: /\bWIP\b/ },
  { id: "lorem", re: /lorem\s+ipsum/i },
  { id: "not-implemented", re: /not\s+implemented/i },
  { id: "todo-user", re: /\bTODO\b/ },
  { id: "fixme-user", re: /\bFIXME\b/ },
] as const;

export type BannedHit = { id: string; line: number; match: string };

/** Drop comments so code/PR notes are not scanned as product copy. */
export function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function findBannedStrings(source: string): BannedHit[] {
  const hits: BannedHit[] = [];
  const lines = stripComments(source).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const ban of PRODUCT_BANNED) {
      ban.re.lastIndex = 0;
      const m = ban.re.exec(line);
      if (m) hits.push({ id: ban.id, line: i + 1, match: m[0] });
    }
  }
  return hits;
}
