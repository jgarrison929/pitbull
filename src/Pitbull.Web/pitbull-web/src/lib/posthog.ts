import posthog from "posthog-js";
import {
  classifyViewportWidth,
  isNarrowViewport,
} from "./viewport-class";

// Tracks whether we've flagged this page-load session as having API errors
let sessionErrorFlagged = false;

export {
  classifyViewportWidth,
  isNarrowViewport,
  MOBILE_VIEWPORT_MAX_PX,
  type ViewportClass,
} from "./viewport-class";

/**
 * Super-properties for mobile-first demo traffic analysis in PostHog.
 * Call after init and on resize.
 */
export function registerViewportContext(): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const viewportClass = classifyViewportWidth(width);
  const narrow = isNarrowViewport(width);

  posthog.register({
    viewport_class: viewportClass,
    is_narrow_viewport: narrow,
    // Matches bottom-nav visibility (lg:hidden → visible below 1024)
    mobile_chrome_expected: narrow,
    viewport_width: width,
    viewport_height: height,
    touch_capable: navigator.maxTouchPoints > 0,
  });

  posthog.register_for_session({
    viewport_class: viewportClass,
    is_narrow_viewport: narrow,
    mobile_chrome_expected: narrow,
  });
}

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

  const width = typeof window !== "undefined" ? window.innerWidth : undefined;

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
    viewport_class: width != null ? classifyViewportWidth(width) : undefined,
    is_narrow_viewport: width != null ? isNarrowViewport(width) : undefined,
  });
}

/**
 * Initialize PostHog analytics (client-side only).
 * Safe to call multiple times — guards against double-init and SSR.
 */
export function initPostHog() {
  if (typeof window === "undefined") return;

  const key =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key) {
    // PostHog not configured — skip silently (dev/test environments)
    return;
  }

  // Don't re-initialize
  if (posthog.__loaded) return;

  posthog.init(key, {
    api_host: host || "https://us.i.posthog.com",
    defaults: "2026-05-30",
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
    loaded: () => {
      registerViewportContext();
    },
  });

  // Keep viewport class current as users rotate phones / resize
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => registerViewportContext(), 250);
  });
}

export { posthog };
