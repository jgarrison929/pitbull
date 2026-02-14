"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/contexts/keyboard-shortcuts-context";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Platform detection ──────────────────────────────────────────────────────

function subscribeNoop() {
  return () => {};
}

function getIsMacSnapshot() {
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
}

function getIsMacServerSnapshot() {
  return false;
}

function useIsMac() {
  return useSyncExternalStore(subscribeNoop, getIsMacSnapshot, getIsMacServerSnapshot);
}

// ─── Key rendering ───────────────────────────────────────────────────────────

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-medium bg-muted border border-border rounded-md shadow-sm">
      {children}
    </kbd>
  );
}

function PlatformKey({ keys, isMac }: { keys: string; isMac: boolean }) {
  // Replace platform-specific modifiers
  const display = keys
    .replace(/Ctrl/g, isMac ? "⌘" : "Ctrl")
    .replace(/Alt/g, isMac ? "⌥" : "Alt")
    .replace(/Shift/g, isMac ? "⇧" : "Shift");

  // Split on + to render each key separately
  const parts = display.split("+").map((p) => p.trim());

  return (
    <div className="flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
          <KeyboardKey>{part === "Escape" ? "Esc" : part}</KeyboardKey>
        </span>
      ))}
    </div>
  );
}

// ─── Section categorization ──────────────────────────────────────────────────

interface ShortcutSection {
  title: string;
  shortcuts: { key: string; description: string }[];
}

function categorizeShortcuts(
  shortcuts: Map<string, { key: string; description: string }>
): ShortcutSection[] {
  const navigation: ShortcutSection = { title: "Navigation", shortcuts: [] };
  const actions: ShortcutSection = { title: "Actions", shortcuts: [] };
  const timeEntry: ShortcutSection = { title: "Time Entry", shortcuts: [] };
  const general: ShortcutSection = { title: "General", shortcuts: [] };

  for (const shortcut of shortcuts.values()) {
    const desc = shortcut.description.toLowerCase();

    if (
      desc.includes("navigate") ||
      desc.includes("go to") ||
      desc.includes("search") ||
      desc.includes("command palette") ||
      shortcut.key === "g"
    ) {
      navigation.shortcuts.push(shortcut);
    } else if (
      desc.includes("time") ||
      desc.includes("hours") ||
      desc.includes("entry")
    ) {
      timeEntry.shortcuts.push(shortcut);
    } else if (
      desc.includes("create") ||
      desc.includes("save") ||
      desc.includes("delete") ||
      desc.includes("submit") ||
      desc.includes("approve") ||
      desc.includes("new")
    ) {
      actions.shortcuts.push(shortcut);
    } else {
      general.shortcuts.push(shortcut);
    }
  }

  // Only return sections that have shortcuts
  return [navigation, actions, timeEntry, general].filter(
    (s) => s.shortcuts.length > 0
  );
}

// ─── Built-in shortcuts (always shown) ───────────────────────────────────────

const builtInShortcuts = [
  { key: "?", description: "Show keyboard shortcuts help", section: "General" },
  { key: "Escape", description: "Close modal/dialog", section: "General" },
  { key: "Ctrl+k", description: "Open command palette", section: "Navigation" },
  { key: "n", description: "Quick-add time entry", section: "Time Entry" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function KeyboardShortcutsHelp() {
  const { shortcuts, isHelpOpen, setHelpOpen } = useKeyboardShortcuts();
  const isMac = useIsMac();

  const sections = useMemo(() => {
    // Merge built-in with registered shortcuts
    const merged = new Map(shortcuts);
    for (const s of builtInShortcuts) {
      if (!merged.has(s.key)) {
        merged.set(s.key, { key: s.key, description: s.description, action: () => {} });
      }
    }
    return categorizeShortcuts(merged);
  }, [shortcuts]);

  return (
    <Dialog open={isHelpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            {isMac ? "⌘" : "Ctrl"} based shortcuts for quick navigation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shortcuts available on this page.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <h4
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1"
                  )}
                >
                  {section.title}
                </h4>
                <div className="grid gap-1.5">
                  {section.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">
                        {shortcut.description}
                      </span>
                      <PlatformKey keys={shortcut.key} isMac={isMac} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <KeyboardKey>{isMac ? "?" : "?"}</KeyboardKey>{" "}
            anywhere to toggle this dialog
          </p>
          <p className="text-xs text-muted-foreground">
            {isMac ? "Mac" : "Windows/Linux"} detected
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
