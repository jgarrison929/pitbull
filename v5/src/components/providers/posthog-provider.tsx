"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  capturePageview,
  identifyDemoRole,
  initPostHog,
} from "@/lib/posthog";
import { schedulePostHogBoot } from "@/lib/posthog-boot";
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
 * Boots posthog-js only after window load + a min delay + idle so `/flags`
 * does not inflate the verify crawl's networkidle page budget; when the key
 * is unset (CI / local / e2e) init is a complete no-op.
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
    const cancelSchedule = schedulePostHogBoot(() => {
      void initPostHog().then((client) => {
        if (cancelled || !client) return;
        identifyDemoRole(demoRole);
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelSchedule();
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
