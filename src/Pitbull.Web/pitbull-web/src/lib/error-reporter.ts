import { API_BASE_URL } from "./config";

interface ErrorReport {
  source: "frontend";
  level?: "error" | "warning" | "fatal";
  httpStatusCode?: number;
  requestMethod?: string;
  requestPath?: string;
  message: string;
  stackTrace?: string;
  componentStack?: string;
  pageUrl?: string;
  browserInfo?: string;
  metadata?: string;
}

/**
 * Fire-and-forget error reporter.
 * POSTs to /api/diagnostics/errors (anonymous endpoint).
 * Silently swallows failures — must never cause secondary errors.
 */
export function reportError(report: ErrorReport): void {
  try {
    const payload = {
      ...report,
      source: "frontend" as const,
      pageUrl: report.pageUrl ?? (typeof window !== "undefined" ? window.location.href : undefined),
      browserInfo: report.browserInfo ?? (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
    };

    fetch(`${API_BASE_URL}/api/diagnostics/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Intentionally swallowed — error reporting must never cause secondary failures
    });
  } catch {
    // Intentionally swallowed
  }
}
