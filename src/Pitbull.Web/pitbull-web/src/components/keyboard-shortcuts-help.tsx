"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useKeyboardShortcuts } from "@/contexts/keyboard-shortcuts-context";
import { Keyboard } from "lucide-react";

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-medium bg-muted border border-border rounded-md shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const { shortcuts, isHelpOpen, setHelpOpen } = useKeyboardShortcuts();

  // Convert shortcuts map to sorted array for display
  const shortcutList = Array.from(shortcuts.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  return (
    <Dialog open={isHelpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {shortcutList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shortcuts available on this page.
            </p>
          ) : (
            <div className="grid gap-3">
              {shortcutList.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground">
                    {shortcut.description}
                  </span>
                  <KeyboardKey>
                    {shortcut.key === "Escape" ? "Esc" : shortcut.key}
                  </KeyboardKey>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Press <KeyboardKey>Esc</KeyboardKey> to close this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
