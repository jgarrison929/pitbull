"use client";

import { ErrorBoundary, PageErrorFallback } from "@/components/error-boundary";
import type { ReactNode } from "react";

/**
 * Top-level error boundary for the root layout.
 * Separate client component because layout.tsx is a server component.
 */
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      section="Root"
      fallback={({ error, reset }) => (
        <PageErrorFallback error={error} reset={reset} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
