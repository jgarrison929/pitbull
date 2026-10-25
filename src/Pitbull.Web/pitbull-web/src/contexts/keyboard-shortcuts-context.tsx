"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  /** If true, shortcut works even when focused on input/textarea */
  global?: boolean;
}

interface KeyboardShortcutsContextType {
  shortcuts: Map<string, KeyboardShortcut>;
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string) => void;
  isHelpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | null>(null);

export function useKeyboardShortcuts() {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      "useKeyboardShortcuts must be used within a KeyboardShortcutsProvider"
    );
  }
  return context;
}

/**
 * Hook to register a keyboard shortcut that auto-unregisters on unmount
 */
export function useRegisterShortcut(
  key: string,
  description: string,
  action: () => void,
  options?: { global?: boolean; enabled?: boolean }
) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();
  const enabled = options?.enabled ?? true;
  const global = options?.global ?? false;

  useEffect(() => {
    if (!enabled) return;
    
    registerShortcut({ key, description, action, global });
    return () => unregisterShortcut(key);
  }, [key, description, action, global, enabled, registerShortcut, unregisterShortcut]);
}

interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
}

export function KeyboardShortcutsProvider({
  children,
}: KeyboardShortcutsProviderProps) {
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<Map<string, KeyboardShortcut>>(
    () =>
      new Map([
        [
          "?",
          {
            key: "?",
            description: "Show keyboard shortcuts help",
            action: () => setHelpOpen(true),
            global: false,
          },
        ],
        [
          "Escape",
          {
            key: "Escape",
            description: "Close modal/dialog",
            action: () => setHelpOpen(false),
            global: true,
          },
        ],
      ])
  );

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.set(shortcut.key, shortcut);
      return next;
    });
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Global keydown listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs (unless global)
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Get the key - handle shift+/ for ?
      let key = event.key;
      
      // For ?, check if shift is pressed and key is /
      if (event.shiftKey && event.key === "/") {
        key = "?";
      }

      const shortcut = shortcuts.get(key);
      
      if (!shortcut) return;

      // Skip non-global shortcuts when in input
      if (isInput && !shortcut.global) return;

      // Don't prevent default for Escape on inputs (let them blur/cancel normally too)
      if (key !== "Escape" || !isInput) {
        event.preventDefault();
      }
      
      shortcut.action();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  const value = useMemo(
    () => ({
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      isHelpOpen,
      setHelpOpen,
    }),
    [shortcuts, registerShortcut, unregisterShortcut, isHelpOpen]
  );

  return (
    <KeyboardShortcutsContext.Provider value={value}>
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}
