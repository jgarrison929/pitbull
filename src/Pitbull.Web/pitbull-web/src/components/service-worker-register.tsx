"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    const onVisible = () => {
      if (document.visibilityState === "visible" && registration) {
        void registration.update();
      }
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        // Listen for new service worker versions
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New SW waiting — activate it; VersionUpdateGuard reloads on controllerchange
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // Mobile often keeps a long-lived tab; re-check SW when user returns.
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {
        // Service worker registration failed — app still works without it
      });

    // Listen for messages from the service worker
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        window.dispatchEvent(new CustomEvent("sw-sync-complete"));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}

/**
 * Request the service worker to register a Background Sync.
 * Falls back silently if SW or Background Sync is unavailable.
 */
export function requestBackgroundSync() {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    !navigator.serviceWorker.controller
  ) {
    return;
  }

  navigator.serviceWorker.controller.postMessage({ type: "REGISTER_SYNC" });
}
