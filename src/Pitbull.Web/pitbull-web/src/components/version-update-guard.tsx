"use client";

import { useEffect } from "react";
import {
  getAppVersion,
  shouldHardReloadForVersionChange,
  VERSION_STORAGE_KEYS,
} from "@/lib/app-version";
import { fetchChangelog } from "@/lib/changelog";

/**
 * Detects a newer deployed product version and force-reloads once so users
 * (especially mobile PWA / SW-cached shells) are not stuck on a stale build.
 *
 * Also reloads when a new service worker takes control.
 */
export function VersionUpdateGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Playwright / automation: hard reloads destroy evaluate() mid-flow (L4 E2E).
    // Real users never set navigator.webdriver.
    if (navigator.webdriver) return;

    let cancelled = false;

    // New SW activated → hard reload so the new shell is used.
    let swReloading = false;
    const onControllerChange = () => {
      if (swReloading) return;
      swReloading = true;
      window.location.reload();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange
      );
    }

    async function clearCachesAndReload(remote: string) {
      try {
        sessionStorage.setItem(VERSION_STORAGE_KEYS.reloadAttempt, remote);
        localStorage.setItem(VERSION_STORAGE_KEYS.remoteSeen, remote);
      } catch {
        // storage full / private mode
      }

      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // best-effort
      }

      // Cache-bust navigation so intermediaries don't re-serve the old shell.
      const url = new URL(window.location.href);
      url.searchParams.set("_pv", remote);
      window.location.replace(url.toString());
    }

    async function checkRemoteVersion() {
      try {
        const data = await fetchChangelog({ current: true });
        if (cancelled) return;

        let lastSeen: string | null = null;
        let attempted: string | null = null;
        try {
          lastSeen = localStorage.getItem(VERSION_STORAGE_KEYS.remoteSeen);
          attempted = sessionStorage.getItem(VERSION_STORAGE_KEYS.reloadAttempt);
        } catch {
          // ignore
        }

        const decision = shouldHardReloadForVersionChange({
          remoteVersion: data.appVersion,
          clientVersion: getAppVersion(),
          lastSeenRemote: lastSeen,
          alreadyAttemptedForRemote: attempted,
        });

        if (decision.storeRemote) {
          try {
            localStorage.setItem(
              VERSION_STORAGE_KEYS.remoteSeen,
              decision.storeRemote
            );
          } catch {
            // ignore
          }
        }

        if (decision.reload && decision.storeRemote) {
          await clearCachesAndReload(decision.storeRemote);
        }
      } catch {
        // Offline / API down — stay on current shell.
      }
    }

    void checkRemoteVersion();
    const interval = window.setInterval(checkRemoteVersion, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange
        );
      }
    };
  }, []);

  return null;
}
