"use client";

import localFont from "next/font/local";
import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import { cn } from "@/lib/utils";
import "./globals.css";

/**
 * Same static Geist faces as root layout — global-error replaces that layout,
 * so without this the document falls back to Times.
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

/**
 * Root-layout error boundary. Must own `<html>` / `<body>` and styles —
 * it replaces the root layout when active.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html
      lang="en"
      className={cn(geistSans.variable, "h-full antialiased")}
      data-theme="light"
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <title>Load failed · Pitbull</title>
        <RouteErrorFallback error={error} retry={retry} scope="global" />
      </body>
    </html>
  );
}
