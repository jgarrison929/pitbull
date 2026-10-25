"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getPendingSyncItems,
  updateSyncItem,
  removeSyncItem,
  getSyncQueueCount,
  type SyncQueueItem,
  type OfflineTimeEntry,
  type OfflineDailyReport,
} from "./offline-store";
import { buildOfflineDailyReportSyncBody } from "./daily-report-offline";
import { requestBackgroundSync } from "@/components/service-worker-register";
import { API_BASE_URL } from "./config";
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
          if (item.type === "daily-report") {
            await syncDailyReport(item);
          } else {
            await syncTimeEntry(item);
          }
        } catch (err) {
          // 409 Conflict = server already processed this idempotency key
          if (err instanceof SyncConflictError) {
            await removeSyncItem(item.id);
          } else {
            const newRetry = item.retryCount + 1;
            await updateSyncItem(item.id, {
              status: newRetry >= MAX_RETRIES ? "failed" : "pending",
              retryCount: newRetry,
              error: "Network error during sync",
            });
          }
        }
      }

      await refreshPendingCount();
      setSyncStatus(navigator.onLine ? "online" : "offline");

      // Also register Background Sync for any remaining items
      requestBackgroundSync();
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

  // Listen for SW sync-complete events
  useEffect(() => {
    const handler = () => refreshPendingCount();
    window.addEventListener("sw-sync-complete", handler);
    return () => window.removeEventListener("sw-sync-complete", handler);
  }, [refreshPendingCount]);

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

// --- Sync helpers ---

class SyncConflictError extends Error {
  constructor() {
    super("409 Conflict — already processed");
    this.name = "SyncConflictError";
  }
}

/** Build auth + idempotency headers from the stored queue item context. */
function buildHeaders(item: SyncQueueItem): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Idempotency-Key": item.idempotencyKey,
  };
  if (item.auth?.token) {
    headers["Authorization"] = `Bearer ${item.auth.token}`;
  }
  if (item.auth?.companyId) {
    headers["X-Company-Id"] = item.auth.companyId;
  }
  return headers;
}

async function syncTimeEntry(item: SyncQueueItem) {
  const entry = item.entry as OfflineTimeEntry;

  const response = await fetch(`${API_BASE_URL}/api/time-entries/batch`, {
    method: "POST",
    headers: buildHeaders(item),
    body: JSON.stringify({
      isDraft: false,
      allowPartialSuccess: false,
      submittedById: entry.employeeId,
      entries: [
        {
          date: entry.date,
          employeeId: entry.employeeId,
          projectId: entry.projectId,
          costCodeId: entry.costCodeId,
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours,
          doubletimeHours: entry.doubletimeHours,
          description: entry.description,
          phaseId: entry.phaseId,
          equipmentId: entry.equipmentId,
          equipmentHours: entry.equipmentHours,
          latitude: entry.latitude,
          longitude: entry.longitude,
          locationAccuracy: entry.locationAccuracy,
        },
      ],
    }),
  });

  if (response.status === 409) {
    throw new SyncConflictError();
  }

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }

  const result: BatchCreateTimeEntriesResult = await response.json();

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
}

async function syncDailyReport(item: SyncQueueItem) {
  const report = item.entry as OfflineDailyReport;
  // Shared body builder — keep public/sw.js daily-report branch in parity (tested).
  const body = buildOfflineDailyReportSyncBody(report);

  const response = await fetch(
    `${API_BASE_URL}/api/projects/${report.projectId}/daily-reports`,
    {
      method: "POST",
      headers: buildHeaders(item),
      body: JSON.stringify({ title: body.title, data: body.data }),
    }
  );

  if (response.status === 409) {
    throw new SyncConflictError();
  }

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }

  const created = (await response.json().catch(() => null)) as {
    id?: string;
  } | null;

  // Post-create workflow submit when offline entry was not a draft.
  if (created?.id && body.submitAfterCreate) {
    try {
      await fetch(
        `${API_BASE_URL}/api/projects/${report.projectId}/daily-reports/${created.id}/submit`,
        { method: "POST", headers: buildHeaders(item) }
      );
    } catch {
      // Report created; submit failure is non-fatal for queue drain
    }
  }

  // Best-effort: upload embedded offline photos (small data URLs only)
  const embedded = (report.photos ?? []).filter((p) => p.dataUrl);
  if (created?.id && embedded.length > 0) {
    try {
      const { dataUrlToBlob } = await import("./offline-photo");
      const form = new FormData();
      for (const photo of embedded) {
        if (!photo.dataUrl) continue;
        const blob = dataUrlToBlob(photo.dataUrl);
        form.append(
          embedded.length === 1 ? "file" : "files",
          blob,
          photo.name || "photo.jpg"
        );
      }
      form.append("relatedEntityType", "DailyReport");
      form.append("relatedEntityId", created.id);
      const uploadHeaders: Record<string, string> = {
        "X-Idempotency-Key": `${item.idempotencyKey}-photos`,
      };
      if (item.auth?.token) {
        uploadHeaders.Authorization = `Bearer ${item.auth.token}`;
      }
      if (item.auth?.companyId) {
        uploadHeaders["X-Company-Id"] = item.auth.companyId;
      }
      const endpoint =
        embedded.length === 1
          ? `${API_BASE_URL}/api/files/upload`
          : `${API_BASE_URL}/api/files/upload-multiple`;
      await fetch(endpoint, {
        method: "POST",
        headers: uploadHeaders,
        body: form,
      });
    } catch {
      // Report already saved; photo upload failure is non-fatal for queue drain
    }
  }

  await removeSyncItem(item.id);
}
