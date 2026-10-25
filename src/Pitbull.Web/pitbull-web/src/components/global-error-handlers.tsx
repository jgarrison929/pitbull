"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporter";

/**
 * Installs global window.onerror and unhandledrejection handlers
 * to capture JS runtime errors that happen outside React's error boundary.
 * reportError dual-writes diagnostics API + PostHog captureException.
 */
export function GlobalErrorHandlers() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportError({
        source: "frontend",
        level: "error",
        message: String(event.message),
        stackTrace: event.error?.stack,
        metadata: JSON.stringify({
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          handler: "window_onerror",
        }),
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportError({
        source: "frontend",
        level: "error",
        message: reason?.message || String(reason),
        stackTrace: reason?.stack,
        metadata: JSON.stringify({ handler: "unhandled_rejection" }),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
