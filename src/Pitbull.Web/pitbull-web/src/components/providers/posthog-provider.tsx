"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { posthog, initPostHog, captureApiError } from "@/lib/posthog";
import { API_BASE_URL } from "@/lib/config";

/**
 * Inner component that uses useSearchParams (requires Suspense boundary).
 */
function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;

    let url = window.origin + pathname;
    const search = searchParams.toString();
    if (search) {
      url += "?" + search;
    }

    const width = window.innerWidth;
    posthog.capture("$pageview", {
      $current_url: url,
      path: pathname,
      viewport_width: width,
      viewport_class:
        width <= 640 ? "phone" : width <= 1023 ? "tablet" : "desktop",
      is_narrow_viewport: width <= 1023,
      mobile_chrome_expected: width <= 1023,
    });
  }, [pathname, searchParams]);

  return null;
}

/**
 * PostHog analytics provider.
 * - Initializes PostHog on mount
 * - Tracks page views on route changes (via inner Suspense-wrapped tracker)
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  // Initialize PostHog and install global fetch error interceptor (once)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initPostHog();

    // Monkey-patch window.fetch so ALL raw fetch() failures are captured in PostHog,
    // not just calls that go through the api() wrapper. Uses response.clone() to read
    // the error body without consuming the stream the caller needs (e.g. for .blob()).
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function fetchWithTracking(input, init) {
      const response = await originalFetch(input, init);

      if (!response.ok) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

        // Only track calls to our own backend; skip auth-refresh (expected failures)
        // and health-check pings (connectivity probe, not app errors).
        if (
          url.startsWith(API_BASE_URL) &&
          !url.includes("/api/auth/refresh") &&
          !url.includes("/api/health")
        ) {
          const method =
            init?.method ?? (input instanceof Request ? input.method : "GET");
          const endpoint = url.slice(API_BASE_URL.length).split("?")[0];

          // Fire-and-forget: clone lets us read the body without touching the
          // original stream that the caller will consume (blob, json, etc.).
          response
            .clone()
            .json()
            .catch(() => null)
            .then((errorData) => {
              captureApiError(response.status, method, endpoint, errorData);

              // Also emit $exception for 5xx so server errors appear in PostHog Error Tracking
              if (response.status >= 500 && posthog.__loaded) {
                const errorMsg =
                  (errorData as Record<string, string>)?.error ||
                  (errorData as Record<string, string>)?.message ||
                  `HTTP ${response.status}`;
                posthog.capture("$exception", {
                  $exception_message: errorMsg,
                  $exception_type: "ApiError",
                  $exception_source: "fetch_interceptor",
                  status_code: response.status,
                  method,
                  endpoint,
                });
              }
            });
        }
      }

      return response;
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageViewTracker />
      </Suspense>
      {children}
    </>
  );
}
