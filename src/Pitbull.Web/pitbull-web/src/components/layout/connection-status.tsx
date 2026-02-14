"use client";

import { useState, useEffect, useCallback, useSyncExternalStore, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Online status via useSyncExternalStore ──────────────────────────────────

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
  return true;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionState = "connected" | "slow" | "offline";

const stateConfig: Record<
  ConnectionState,
  { color: string; pingColor: string; label: string }
> = {
  connected: {
    color: "bg-green-500",
    pingColor: "bg-green-400",
    label: "Connected",
  },
  slow: {
    color: "bg-amber-500",
    pingColor: "bg-amber-400",
    label: "Slow connection",
  },
  offline: {
    color: "bg-red-500",
    pingColor: "bg-red-400",
    label: "Offline",
  },
};

// ─── Latency hook ────────────────────────────────────────────────────────────

function useLatencyCheck(isOnline: boolean) {
  const [latency, setLatency] = useState<number | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const checkLatency = useCallback(async () => {
    if (!isOnline) {
      setLatency(null);
      return;
    }
    try {
      const start = performance.now();
      await fetch("/api/health", {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }).catch(() => {
        // Measure round-trip even on failure
      });
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);
      setLastSynced(new Date());
    } catch {
      setLatency(null);
    }
  }, [isOnline]);

  useEffect(() => {
    // Use an interval that calls checkLatency; the interval callback (not effect body) sets state.
    const runCheck = () => {
      void checkLatency();
    };
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, [checkLatency]);

  return { latency, lastSynced };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConnectionStatus() {
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot
  );
  const { latency, lastSynced } = useLatencyCheck(isOnline);
  const [showPulse, setShowPulse] = useState(false);
  const prevStateRef = useRef<ConnectionState>("connected");

  // Determine connection state
  const connectionState: ConnectionState = !isOnline
    ? "offline"
    : latency !== null && latency > 2000
      ? "slow"
      : "connected";

  // Pulse on state changes (use setTimeout to avoid direct setState in effect)
  useEffect(() => {
    if (connectionState !== prevStateRef.current) {
      prevStateRef.current = connectionState;
      // Use requestAnimationFrame then setTimeout so the setState is async
      const handle = requestAnimationFrame(() => {
        setShowPulse(true);
      });
      const t = setTimeout(() => setShowPulse(false), 2000);
      return () => {
        cancelAnimationFrame(handle);
        clearTimeout(t);
      };
    }
  }, [connectionState]);

  const cfg = stateConfig[connectionState];

  const tooltipText = lastSynced
    ? `${cfg.label}${latency != null ? ` (${latency}ms)` : ""} · Last synced ${formatTimeAgo(lastSynced)}`
    : cfg.label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="relative flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label={cfg.label}
        >
          <span className="relative flex h-2.5 w-2.5">
            {showPulse && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                  cfg.pingColor
                )}
              />
            )}
            <span
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5 transition-colors duration-300",
                cfg.color
              )}
            />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}
