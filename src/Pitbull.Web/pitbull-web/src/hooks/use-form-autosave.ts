"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Auto-save form data to localStorage with debounce.
 * Returns helpers to load, save, and clear the draft.
 */
export function useFormAutosave<T extends Record<string, unknown>>(
  key: string,
  data: T,
  { debounceMs = 1000, enabled = true }: { debounceMs?: number; enabled?: boolean } = {}
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save to localStorage (debounced)
  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(`draft:${key}`, serialized);
        localStorage.setItem(`draft:${key}:ts`, new Date().toISOString());
      } catch {
        // localStorage might be full or unavailable
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [key, data, debounceMs, enabled]);

  // Load from localStorage
  const loadDraft = useCallback((): { data: T; savedAt: string } | null => {
    try {
      const raw = localStorage.getItem(`draft:${key}`);
      const ts = localStorage.getItem(`draft:${key}:ts`);
      if (raw && ts) {
        return { data: JSON.parse(raw) as T, savedAt: ts };
      }
    } catch {
      // ignore
    }
    return null;
  }, [key]);

  // Clear the draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`draft:${key}`);
      localStorage.removeItem(`draft:${key}:ts`);
    } catch {
      // ignore
    }
  }, [key]);

  // Check if draft exists
  const hasDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(`draft:${key}`) !== null;
    } catch {
      return false;
    }
  }, [key]);

  return { loadDraft, clearDraft, hasDraft };
}
