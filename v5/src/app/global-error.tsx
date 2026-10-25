"use client";

import { RouteErrorFallback } from "@/components/app/route-error-fallback";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased" data-theme="light">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <title>Load failed · Pitbull</title>
        <RouteErrorFallback error={error} retry={retry} scope="global" />
      </body>
    </html>
  );
}
