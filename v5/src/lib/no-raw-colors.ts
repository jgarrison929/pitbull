/**
 * Ban hard-coded colors in product UI so Light/Dark tokens stay the only path.
 * Scans className / style strings for Tailwind palette utilities and CSS color literals.
 */

/** Tailwind default palette (+ white/black), with optional shade and /opacity. */
export const RAW_PALETTE_CLASS =
  /\b(?:text|bg|border|ring|outline|from|to|via|fill|stroke|decoration|accent|caret|divide|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/(?:\d{1,3}|\[\d+(?:\.\d+)?%?\]))?\b/g;

/**
 * Hex / functional colors. Require a non-digit after `#` for 3-digit form so
 * PR refs like `#671` in prose are ignored; 6/8-digit hex still matches.
 */
export const RAW_COLOR_LITERAL =
  /(?:#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3}(?![0-9]))\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|hwb|color)\s*\()/g;

export type RawColorHit = { line: number; match: string };

/** Drop JS / JSX comments so PR refs and notes are not scanned as colors. */
export function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function findRawColors(source: string): RawColorHit[] {
  const hits: RawColorHit[] = [];
  const lines = stripComments(source).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const code = lines[i]!;
    for (const re of [RAW_PALETTE_CLASS, RAW_COLOR_LITERAL]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        hits.push({ line: i + 1, match: m[0] });
      }
    }
  }
  return hits;
}
