"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

interface TimecardSettingsResponse {
  weekStartDay: number;
}

/**
 * Fetches the company's configured week start day.
 * Returns 1 (Monday) as default while loading or on error.
 */
export function useWeekStartDay(): { weekStartDay: number; isLoading: boolean } {
  const [weekStartDay, setWeekStartDay] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const result = await api<TimecardSettingsResponse>(
          "/api/companies/settings/time-tracking"
        );
        if (!cancelled) {
          setWeekStartDay(result.weekStartDay ?? 1);
        }
      } catch {
        // Graceful fallback to Monday
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { weekStartDay, isLoading };
}
