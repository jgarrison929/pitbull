import posthog from "posthog-js";

// Tracks whether we've flagged this page-load session as having API errors
let sessionErrorFlagged = false;

/**
 * Capture a failed API call in PostHog.
 * Called by the global fetch interceptor in posthog-provider.tsx, which covers all
 * fetch() calls: JSON API responses, PDF downloads, file uploads, offline sync, etc.
 */
export function captureApiError(
  status: number,
  method: string,
  endpoint: string,
  errorData: unknown
): void {
  if (!posthog.__loaded) return;

  const errorMsg =
    (errorData as Record<string, string>)?.error ||
    (errorData as Record<string, string>)?.message ||
    `${status}`;

  const rawBody = errorData ? JSON.stringify(errorData).slice(0, 500) : undefined;

  if (!sessionErrorFlagged) {
    posthog.register_for_session({ has_api_errors: true });
    sessionErrorFlagged = true;
  }

  posthog.capture("api_error", {
    status,
    method,
    endpoint,
    error_message: errorMsg,
    error: rawBody,
    error_code: (errorData as Record<string, string>)?.code ?? undefined,
    trace_id: (errorData as Record<string, string>)?.traceId ?? undefined,
    correlation_id: (errorData as Record<string, string>)?.correlationId ?? undefined,
    severity: status >= 500 ? "error" : "warning",
  });
}

/**
 * Initialize PostHog analytics (client-side only).
 * Safe to call multiple times — guards against double-init and SSR.
 */
export function initPostHog() {
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key) {
    // PostHog not configured — skip silently (dev/test environments)
    return;
  }

  // Don't re-initialize
  if (posthog.__loaded) return;

  posthog.init(key, {
    api_host: host || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We handle this manually via the PageViewTracker
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    },
    // Respect Do Not Track
    respect_dnt: true,
    // Don't track localhost in dev unless explicitly testing
    // To enable PostHog debug mode in development:
    // loaded: (ph) => { if (process.env.NODE_ENV === "development") ph.debug(); },
  });
}

export { posthog };
