/**
 * Ban hard-coded colors in product UI so theme tokens stay the only path.
 * Detector ships before dark theme (#724); allowlist covers pre-Part-C hits.
 */

export const RAW_PALETTE_CLASS =
  /\b(?:text|bg|border|ring|outline|from|to|via|fill|stroke|decoration|accent|caret|divide|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/(?:\d{1,3}|\[\d+(?:\.\d+)?%?\]))?\b/g;

export const RAW_COLOR_LITERAL =
  /(?:#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8}|[0-9a-fA-F]{3}(?![0-9]))\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|hwb|color)\s*\()/g;

export type RawColorHit = { line: number; match: string };

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

/**
 * Existing hits on main before Part C — fail only on new files/lines.
 * Expiry: 2026-11-30 (after dark-theme Part C lands tokens). Human: /correct.
 */
export const RAW_COLOR_ALLOWLIST: Readonly<Record<string, readonly string[]>> =
  {
    "src/components/app/assistant-panel.tsx": ["text-white"],
    "src/components/app/cost-table.tsx": [
      "text-amber-700",
      "text-amber-400",
      "text-red-700",
      "text-red-400",
    ],
    "src/components/app/shell.tsx": ["text-white", "bg-white"],
    "src/app/app/jobs/[number]/cost-items/[code]/page.tsx": [
      "bg-amber-50",
      "bg-amber-950",
      "text-amber-700",
      "text-amber-400",
      "text-amber-800",
      "text-amber-300",
    ],
    "src/app/app/jobs/[number]/page.tsx": ["text-amber-800", "text-amber-200"],
  };
