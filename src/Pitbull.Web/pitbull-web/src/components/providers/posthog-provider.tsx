"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { posthog, initPostHog } from "@/lib/posthog";

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

    posthog.capture("$pageview", {
      $current_url: url,
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

  // Initialize PostHog once
  useEffect(() => {
    if (!initialized.current) {
      initPostHog();
      initialized.current = true;
    }
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
