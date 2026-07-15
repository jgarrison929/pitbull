"use client";

import { useCallback, useEffect, useState } from "react";
import { deployRecoveryCopy } from "@/lib/deploy-recovery";
import { Button } from "@/components/ui/button";

/**
 * Shows an honest "refresh after deploy" banner when a Server Action / chunk
 * load error is observed (window error or unhandledrejection).
 */
export function DeployRecoveryBanner() {
  const [message, setMessage] = useState<string | null>(null);

  const consider = useCallback((raw: string | undefined) => {
    const copy = deployRecoveryCopy(raw);
    if (copy) setMessage(copy);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.webdriver) return;

    const onError = (ev: ErrorEvent) => {
      consider(ev.message || String(ev.error ?? ""));
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const msg =
        r instanceof Error ? r.message : typeof r === "string" ? r : String(r ?? "");
      consider(msg);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [consider]);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 z-[60] w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg dark:bg-amber-950/90 dark:text-amber-50"
      data-testid="deploy-recovery-banner"
    >
      <p className="mb-2 font-medium">{message}</p>
      <Button type="button" size="sm" onClick={() => window.location.reload()}>
        Refresh now
      </Button>
    </div>
  );
}
