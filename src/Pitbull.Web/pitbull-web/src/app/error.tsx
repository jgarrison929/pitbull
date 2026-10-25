"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportError } from "@/lib/error-reporter";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);

    // Diagnostics API + PostHog Error Tracking (single path)
    reportError({
      source: "frontend",
      level: "error",
      message: error.message,
      stackTrace: error.stack,
      metadata: JSON.stringify({
        digest: error.digest,
        handler: "error_boundary",
      }),
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        {/* Construction-themed error icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              {/* Construction warning triangle */}
              <svg
                className="w-10 h-10 text-red-500 dark:text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            {/* Hard hat on top */}
            <div className="absolute -top-2 -right-2">
              <span className="text-2xl" role="img" aria-label="construction">🏗️</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong on the jobsite
          </h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Don&apos;t worry — no data was lost. Try again or head back to the dashboard.
          </p>
        </div>

        {/* Error details (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              🔧 Error details (dev only)
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {error.message}
              {error.digest && `\n\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-background"
          >
            🔄 Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            🏠 Go to Dashboard
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            🔍 Search
          </Link>
        </div>

        {/* Quick navigation */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Or jump to a section:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/projects"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/bids"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Bids
            </Link>
            <Link
              href="/time-tracking"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Time Tracking
            </Link>
            <Link
              href="/employees"
              className="text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              Employees
            </Link>
          </div>
        </div>

        {/* Branding */}
        <p className="text-xs text-muted-foreground/60 pt-4">
          Pitbull Construction Solutions
        </p>
      </div>
    </div>
  );
}
