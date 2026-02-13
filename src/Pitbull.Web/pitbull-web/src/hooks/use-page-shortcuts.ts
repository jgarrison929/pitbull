"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts, useRegisterShortcut } from "@/contexts/keyboard-shortcuts-context";

/**
 * Hook to add common shortcuts for a list page with a "New" action
 * @param newPath - The path to navigate to when "n" is pressed
 */
export function useNewShortcut(newPath: string) {
  const router = useRouter();
  
  const handleNew = useCallback(() => {
    router.push(newPath);
  }, [router, newPath]);

  useRegisterShortcut("n", "Create new item", handleNew);
}

/**
 * Hook to focus search input when "/" is pressed
 * @param searchInputRef - Ref to the search input element
 */
export function useSearchShortcut(searchInputRef: React.RefObject<HTMLInputElement | null>) {
  const handleSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, [searchInputRef]);

  useRegisterShortcut("/", "Focus search", handleSearch, {
    enabled: !!searchInputRef.current,
  });
}

/**
 * Hook to register an action shortcut with a callback
 */
export function useActionShortcut(
  key: string, 
  description: string, 
  action: () => void,
  options?: { enabled?: boolean; global?: boolean }
) {
  useRegisterShortcut(key, description, action, options);
}

/**
 * Combined hook for typical list pages
 */
export function useListPageShortcuts(options: {
  newPath?: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const router = useRouter();
  const { newPath, searchInputRef } = options;

  const handleNew = useCallback(() => {
    if (newPath) {
      router.push(newPath);
    }
  }, [router, newPath]);

  const handleSearch = useCallback(() => {
    searchInputRef?.current?.focus();
  }, [searchInputRef]);

  useRegisterShortcut("n", "Create new item", handleNew, {
    enabled: !!newPath,
  });

  // Only register search shortcut if we have a ref
  useRegisterShortcut("/", "Focus search", handleSearch, {
    enabled: !!searchInputRef,
  });
}
