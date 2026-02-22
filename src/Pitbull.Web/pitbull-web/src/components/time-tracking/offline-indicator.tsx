"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/lib/use-online-status";

export function OfflineIndicator() {
  const { isOnline, syncStatus, pendingCount, syncNow } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = React.useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      setShowReconnected(false);
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowReconnected(true);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!showReconnected) return;
    const timer = setTimeout(() => setShowReconnected(false), 3000);
    return () => clearTimeout(timer);
  }, [showReconnected]);

  // Syncing state
  if (syncStatus === "syncing") {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-200 text-sm animate-in fade-in-50 duration-300">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
        <div className="flex-1">
          <p className="font-medium">Syncing</p>
          <p className="text-xs text-blue-600 dark:text-blue-300">
            Syncing {pendingCount} {pendingCount === 1 ? "entry" : "entries"}...
          </p>
        </div>
      </div>
    );
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

  // Online with pending entries — show Sync Now button
  if (isOnline && pendingCount > 0) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
        <RefreshCw className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium">
            {pendingCount} {pendingCount === 1 ? "entry" : "entries"} pending sync
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={syncNow}
          className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          Sync Now
        </Button>
      </div>
    );
  }

  // Don't render if online with nothing pending
  if (isOnline) {
    return null;
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
            : "Entries will be saved locally and synced when online"}
        </p>
      </div>
    </div>
  );
}
