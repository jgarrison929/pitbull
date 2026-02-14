"use client";

import { useEffect, useCallback, useRef } from "react";

/**
 * Hook to warn users about unsaved changes when navigating away.
 * Uses beforeunload for browser navigation and can be extended
 * for Next.js router events.
 */
export function useUnsavedChanges(hasChanges: boolean) {
  const hasChangesRef = useRef(hasChanges);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChangesRef.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (hasChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges, handleBeforeUnload]);
}
