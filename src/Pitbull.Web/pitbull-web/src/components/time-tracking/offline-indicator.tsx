"use client";

import React, { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // SSR assumes online
}

/**
 * Get count of pending (unsynced) time entries from localStorage.
 */
function getPendingCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const pending = localStorage.getItem("pitbull_pending_entries");
    return pending ? JSON.parse(pending).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Indicates pending entries stored locally (UI shell - actual sync is backend work).
 */
export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribeOnlineStatus, getOnlineSnapshot, getServerSnapshot);
  const [showReconnected, setShowReconnected] = useState(false);
  const [pendingCount] = useState(getPendingCount);

  const wasOfflineRef = React.useRef(false);

  const handleOnlineChange = useCallback(() => {
    if (!navigator.onLine) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnlineChange);
    window.addEventListener("offline", handleOnlineChange);
    return () => {
      window.removeEventListener("online", handleOnlineChange);
      window.removeEventListener("offline", handleOnlineChange);
    };
  }, [handleOnlineChange]);

  useEffect(() => {
    if (!showReconnected) return;
    const timer = setTimeout(() => setShowReconnected(false), 3000);
    return () => clearTimeout(timer);
  }, [showReconnected]);

  // Don't render if online and no reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  // Reconnected message
  if (isOnline && showReconnected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200 text-sm animate-in fade-in-50 duration-300">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Back Online</p>
          <p className="text-xs text-green-600 dark:text-green-300">
            {pendingCount > 0
              ? `Syncing ${pendingCount} pending ${pendingCount === 1 ? "entry" : "entries"}...`
              : "Connection restored"}
          </p>
        </div>
      </div>
    );
  }

  // Offline indicator
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
      <WifiOff className="h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Offline Mode</p>
        <p className="text-xs text-amber-600 dark:text-amber-300">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "entry" : "entries"} saved locally`
            : "Time entries will be saved locally"}
        </p>
      </div>
      <RefreshCw className="h-4 w-4 shrink-0 animate-spin opacity-50" />
    </div>
  );
}
