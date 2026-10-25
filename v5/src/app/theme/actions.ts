"use server";

import { revalidatePath } from "next/cache";
import { parseTheme } from "@/lib/theme";
import { writeThemeCookie } from "@/server/theme";

/** User-menu Light/Dark switch. Cookie is httpOnly; layout reads it on SSR. */
export async function setTheme(formData: FormData) {
  const raw = formData.get("theme");
  const theme = parseTheme(typeof raw === "string" ? raw : null);
  await writeThemeCookie(theme);
  // Root layout owns the `dark` class on <html> — refresh every segment.
  revalidatePath("/", "layout");
}
