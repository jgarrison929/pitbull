"use client"

import { AlertDialog } from "radix-ui"
import { Button } from "@/components/ui/button"

/**
 * Confirm before a consequential action.
 * Focus is trapped. Esc and Cancel close without confirming. Focus returns to
 * the control that opened the dialog. The confirm button is the verb.
 * Void, reject, and remove pass destructive.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          data-slot="confirm-dialog-overlay"
          className="fixed inset-0 z-50 bg-chrome/70"
        />
        <AlertDialog.Content
          data-slot="confirm-dialog"
          data-testid="confirm-dialog"
          data-destructive={destructive ? "true" : "false"}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg outline-none"
        >
          <AlertDialog.Title className="text-base font-semibold text-balance">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-pretty text-muted-foreground tabular-nums">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                variant="outline"
                className="h-11! w-full px-4 sm:w-auto"
                data-testid="confirm-dialog-cancel"
              >
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant={destructive ? "destructive" : "default"}
              className="h-11! w-full px-4 sm:w-auto"
              data-testid="confirm-dialog-confirm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
