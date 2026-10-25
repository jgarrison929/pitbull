/**
 * Visual baseline rules — loosened maxDiffPixels and missing dark twins recur.
 */

/** Past mistake: agents raise maxDiffPixels to silence AA noise. Must stay 0. */
export function findLoosenedMaxDiff(source: string): number[] {
  const hits: number[] = [];
  const re = /maxDiffPixels\s*:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const n = Number(m[1]);
    if (n !== 0) hits.push(n);
  }
  return hits;
}

/**
 * When dark theme ships, every light `*-chromium-linux.png` needs a `-dark-`
 * twin. Past mistake: light-only baselines, then dark CI red / tolerance raised.
 */
export function missingDarkTwins(snapshotNames: string[]): string[] {
  const set = new Set(snapshotNames);
  const missing: string[] = [];
  for (const name of snapshotNames) {
    if (!name.endsWith(".png")) continue;
    if (name.includes("-dark-")) continue;
    const twin = name.replace(
      /-chromium-linux\.png$/,
      "-dark-chromium-linux.png",
    );
    if (twin === name) continue;
    if (!set.has(twin)) missing.push(name);
  }
  return missing;
}

/** True when the product has shipped dark theme (cookie / data-theme). */
export function darkThemeShipped(sources: string[]): boolean {
  return sources.some(
    (s) =>
      /\bpcs_theme\b/.test(s) ||
      /data-theme=["']dark["']/.test(s) ||
      (/setTheme|ThemeSwitch|pcs_theme/.test(s) && /\.dark\b/.test(s)),
  );
}
