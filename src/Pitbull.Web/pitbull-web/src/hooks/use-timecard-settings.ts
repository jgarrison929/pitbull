"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";

export type TimecardMode = "daily" | "weekly";
export type WeeklyEntryMode = "simple" | "detailed";

export interface TimeTrackingSettings {
  timecardMode: TimecardMode;
  weeklyEntryMode: WeeklyEntryMode;
  defaultProjectId: string | null;
  requirePhase: boolean;
  requireEquipment: boolean;
  weekStartDay: number;
}

const DEFAULT_SETTINGS: TimeTrackingSettings = {
  timecardMode: "daily",
  weeklyEntryMode: "detailed",
  defaultProjectId: null,
  requirePhase: false,
  requireEquipment: false,
  weekStartDay: 1,
};

export interface UseTimecardSettingsReturn {
  settings: TimeTrackingSettings;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches time tracking settings from the company settings API.
 * Falls back to daily mode if the endpoint is unavailable.
 */
export function useTimecardSettings(): UseTimecardSettingsReturn {
  const [settings, setSettings] = useState<TimeTrackingSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const result = await api<TimeTrackingSettings>(
          "/api/companies/settings/time-tracking"
        );
        if (!cancelled) {
          setSettings({
            timecardMode: result.timecardMode || "daily",
            weeklyEntryMode: result.weeklyEntryMode || "detailed",
            defaultProjectId: result.defaultProjectId || null,
            requirePhase: result.requirePhase ?? false,
            requireEquipment: result.requireEquipment ?? false,
            weekStartDay: result.weekStartDay ?? 1,
          });
        }
      } catch (err) {
        // Graceful fallback - if endpoint doesn't exist yet, use daily mode
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
          console.warn(
            "Time tracking settings not available, falling back to daily mode"
          );
          setSettings(DEFAULT_SETTINGS);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, isLoading, error };
}
