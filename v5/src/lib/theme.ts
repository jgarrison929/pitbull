/** Light/dark preference — cookie value read on the server for first paint. */
export const THEME_COOKIE = "pcs_theme";

export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined | null): Theme {
  return value === "dark" ? "dark" : "light";
}
