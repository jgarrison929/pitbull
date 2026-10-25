"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY_PREFIX = "pitbull_recent_";
const MAX_RECENT = 5;

interface RecentItem {
  id: string;
  label: string;
  timestamp: number;
}

function loadFromStorage(storageKey: string): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as RecentItem[];
      return parsed.slice(0, MAX_RECENT);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Hook to manage recent selections in localStorage.
 * Stores the last N selections for a given category (e.g., "project", "costCode", "equipment").
 */
export function useRecentSelections(category: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${category}`;
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() =>
    loadFromStorage(storageKey)
  );

  const addRecent = useCallback(
    (id: string, label: string) => {
      setRecentItems((prev) => {
        // Remove existing entry with same id
        const filtered = prev.filter((item) => item.id !== id);
        // Add to front
        const updated = [{ id, label, timestamp: Date.now() }, ...filtered].slice(
          0,
          MAX_RECENT
        );
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Storage full or unavailable
        }
        return updated;
      });
    },
    [storageKey]
  );

  const clearRecent = useCallback(() => {
    setRecentItems([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  return { recentItems, addRecent, clearRecent };
}
