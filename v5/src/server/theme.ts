import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

const THEME_MAX_AGE_S = 60 * 60 * 24 * 365; // 1 year

/** Theme for this request — defaults to light when the cookie is absent. */
export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

/** Persist the theme cookie so the next SSR paints the matching class. */
export async function writeThemeCookie(theme: Theme) {
  const jar = await cookies();
  jar.set(THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THEME_MAX_AGE_S,
  });
}
