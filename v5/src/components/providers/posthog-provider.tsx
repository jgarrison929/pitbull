"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  capturePageview,
  identifyDemoRole,
  initPostHog,
} from "@/lib/posthog";
import type { DemoRole } from "@/lib/posthog-config";

function PostHogPageViewTracker({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready) return;
    capturePageview(pathname, searchParams.toString());
  }, [ready, pathname, searchParams]);

  return null;
}

/**
 * Client-only PostHog provider. Mount from the root layout.
 * Loads posthog-js lazily after hydration so page budgets stay under 1.5 s;
 * when the key is unset (CI / local / e2e) init is a complete no-op.
 */
export function PostHogProvider({
  children,
  demoRole = null,
}: {
  children: React.ReactNode;
  /** Signed-in demo role, or null on public/login pages. */
  demoRole?: DemoRole | null;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const boot = () => {
      void initPostHog().then((client) => {
        if (cancelled || !client) return;
        identifyDemoRole(demoRole);
        setReady(true);
      });
    };

    // Defer past first paint / hydration so TTI stays within the page budget.
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(boot, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(boot, 0);
    }

    return () => {
      cancelled = true;
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timeoutId != null) clearTimeout(timeoutId);
    };
    // Boot once after mount; demoRole updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  useEffect(() => {
    if (!ready) return;
    identifyDemoRole(demoRole);
  }, [demoRole, ready]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageViewTracker ready={ready} />
      </Suspense>
      {children}
    </>
  );
}
