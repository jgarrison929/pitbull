"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getPendingSyncItems,
  updateSyncItem,
  removeSyncItem,
  getSyncQueueCount,
  type SyncQueueItem,
} from "./offline-store";
import api from "./api";
import type { BatchCreateTimeEntriesResult } from "@/types/crew-entry.types";

type SyncStatus = "online" | "offline" | "syncing";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

export function useOnlineStatus() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isOnline ? "online" : "offline");
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  const syncPendingEntries = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncStatus("syncing");

    try {
      const items = await getPendingSyncItems();
      if (items.length === 0) {
        setSyncStatus("online");
        syncingRef.current = false;
        return;
      }

      for (const item of items) {
        if (!navigator.onLine) break;

        await updateSyncItem(item.id, {
          status: "syncing",
          lastAttempt: new Date().toISOString(),
        });

        try {
          const result = await api<BatchCreateTimeEntriesResult>("/api/time-entries/batch", {
            method: "POST",
            body: {
              isDraft: false,
              allowPartialSuccess: false,
              submittedById: item.entry.employeeId,
              entries: [
                {
                  date: item.entry.date,
                  employeeId: item.entry.employeeId,
                  projectId: item.entry.projectId,
                  costCodeId: item.entry.costCodeId,
                  regularHours: item.entry.regularHours,
                  overtimeHours: item.entry.overtimeHours,
                  description: item.entry.description,
                  latitude: item.entry.latitude,
                  longitude: item.entry.longitude,
                  locationAccuracy: item.entry.locationAccuracy,
                },
              ],
            },
          });

          if (result.failureCount === 0) {
            await removeSyncItem(item.id);
          } else {
            const errorMsg = result.results.find((r) => !r.success)?.error;
            await updateSyncItem(item.id, {
              status: "failed",
              retryCount: item.retryCount + 1,
              error: errorMsg || "Server rejected entry",
            });
          }
        } catch {
          const newRetry = item.retryCount + 1;
          await updateSyncItem(item.id, {
            status: newRetry >= MAX_RETRIES ? "failed" : "pending",
            retryCount: newRetry,
            error: "Network error during sync",
          });
        }
      }

      await refreshPendingCount();
      setSyncStatus(navigator.onLine ? "online" : "offline");
    } catch {
      setSyncStatus(navigator.onLine ? "online" : "offline");
    } finally {
      syncingRef.current = false;
    }
  }, [refreshPendingCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline) {
      syncPendingEntries();
    } else {
      setSyncStatus("offline");
    }
  }, [isOnline, syncPendingEntries]);

  // Poll pending count
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 10_000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    syncNow: syncPendingEntries,
    refreshPendingCount,
  };
}
