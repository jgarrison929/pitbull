"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Listen for new service worker versions
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New SW waiting — activate it immediately
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {
        // Service worker registration failed — app still works without it
      });

    // Listen for messages from the service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        // Dispatch custom event so useOnlineStatus can refresh
        window.dispatchEvent(new CustomEvent("sw-sync-complete"));
      }
    });
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
