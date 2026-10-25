import { API_BASE_URL } from "./config";
import { captureAppException } from "./posthog";

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
 * 1) POST /api/diagnostics/errors (server diagnostics)
 * 2) PostHog Error Tracking via captureException
 * Silently swallows failures — must never cause secondary errors.
 */
export function reportError(report: ErrorReport): void {
  try {
    const pageUrl =
      report.pageUrl ??
      (typeof window !== "undefined" ? window.location.href : undefined);
    const browserInfo =
      report.browserInfo ??
      (typeof navigator !== "undefined" ? navigator.userAgent : undefined);

    const payload = {
      ...report,
      source: "frontend" as const,
      pageUrl,
      browserInfo,
    };

    fetch(`${API_BASE_URL}/api/diagnostics/errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Intentionally swallowed
    });

    // Dual-write to PostHog Error Tracking (same payload context)
    const err = new Error(report.message);
    if (report.stackTrace) err.stack = report.stackTrace;
    captureAppException(err, {
      source: "reportError",
      level: report.level,
      httpStatusCode: report.httpStatusCode,
      requestMethod: report.requestMethod,
      requestPath: report.requestPath,
      componentStack: report.componentStack,
      pageUrl,
      extra: report.metadata ? { metadata: report.metadata } : undefined,
    });
  } catch {
    // Intentionally swallowed
  }
}
