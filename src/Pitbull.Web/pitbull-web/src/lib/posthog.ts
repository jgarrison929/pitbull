import posthog from "posthog-js";

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
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        // Uncomment to debug PostHog in dev:
        // ph.debug();
      }
    },
  });
}

export { posthog };
