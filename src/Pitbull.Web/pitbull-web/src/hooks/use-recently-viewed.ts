"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pitbull-recently-viewed";
const MAX_RECENT_ITEMS = 5;

export type RecentItemType = "project" | "bid" | "rfi";

export interface RecentlyViewedItem {
  id: string;
  type: RecentItemType;
  name: string;
  /** Optional identifier like project number, bid number, RFI number */
  identifier?: string;
  /** For RFIs, we need the project ID to navigate */
  projectId?: string;
  viewedAt: number;
}

/**
 * Hook for managing recently viewed items (projects, bids, RFIs) in localStorage.
 * Persists the last 5 items the user visited across all types.
 */
export function useRecentlyViewed() {
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentlyViewedItem[];
        setRecentItems(parsed);
      }
    } catch {
      // Invalid data, clear it
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Add an item to recent history
  const addRecentItem = useCallback(
    (item: Omit<RecentlyViewedItem, "viewedAt">) => {
      setRecentItems((prev) => {
        // Remove if already exists (same id AND type)
        const filtered = prev.filter(
          (p) => !(p.id === item.id && p.type === item.type)
        );

        // Add to front with current timestamp
        const updated = [
          { ...item, viewedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_ITEMS);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // localStorage might be full or unavailable
        }

        return updated;
      });
    },
    []
  );

  // Clear all recent items
  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    recentItems,
    addRecentItem,
    clearRecentItems,
  };
}
