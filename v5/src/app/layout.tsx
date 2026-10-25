import type { Metadata } from "next";
import localFont from "next/font/local";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import type { DemoRole } from "@/lib/posthog-config";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/session";
import { getTheme } from "@/server/theme";
import "./globals.css";

/**
 * Static Geist faces (not the variable font). Variable `wght` axes produced
 * host-dependent subpixel AA (the 20 px harbor-phone "Earthwork" `w` miss
 * when baselines were agent-rendered). Bundled static woff2 pin the face
 * bytes; pixel-identical shots still require the same Chromium+OS as CI
 * (see `scripts/visual-in-playwright-docker.sh` / CI artifact adopt).
 */
const geistSans = localFont({
  src: [
    { path: "./fonts/Geist-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Geist-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Geist-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Geist-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "block",
  adjustFontFallback: false,
});

const geistMono = localFont({
  src: [
    {
      path: "./fonts/GeistMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/GeistMono-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    { path: "./fonts/GeistMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "block",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Pitbull",
  description: "Construction project controls",
};

/**
 * Theme cookie is read here so `<html class="dark">` is in the first HTML
 * bytes (no flash). That makes the root shell request-time; opt out of
 * instant/static-shell validation for this segment only.
 */
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cookie → `dark` class on first paint (no client flash). Default light.
  const theme = await getTheme();
  // Demo role only (no PII) for PostHog person properties when signed in.
  const user = await getCurrentUser();
  const demoRole = (user?.role ?? null) as DemoRole | null;
  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full antialiased",
        theme === "dark" && "dark",
      )}
      data-theme={theme}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider demoRole={demoRole}>{children}</PostHogProvider>
      </body>
    </html>
  );
}
