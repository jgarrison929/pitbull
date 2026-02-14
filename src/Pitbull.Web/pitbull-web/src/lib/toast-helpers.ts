/**
 * Enhanced toast helpers built on sonner.
 *
 * Provides:
 * - Success toasts with "View" navigation
 * - Error toasts with "Retry" action
 * - Undo support for delete operations
 * - Dismiss all utility
 */
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuccessToastOptions {
  /** Label for the item that was created/updated */
  label?: string;
  /** Navigation path to the created item */
  viewHref?: string;
}

interface ErrorToastOptions {
  /** Retry callback */
  onRetry?: () => void | Promise<void>;
}

interface UndoToastOptions {
  /** Label for the deleted item */
  label: string;
  /** Called if the user clicks Undo (restore the item) */
  onUndo: () => void | Promise<void>;
  /** Duration before the toast auto-dismisses (ms). Default 5000. */
  duration?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Show a success toast with an optional "View" link.
 */
export function toastSuccess(message: string, opts?: SuccessToastOptions) {
  toast.success(message, {
    description: opts?.label,
    action: opts?.viewHref
      ? {
          label: "View",
          onClick: () => {
            if (typeof window !== "undefined" && opts.viewHref) {
              window.location.assign(opts.viewHref);
            }
          },
        }
      : undefined,
  });
}

/**
 * Show an error toast with an optional "Retry" button.
 */
export function toastError(message: string, opts?: ErrorToastOptions) {
  toast.error(message, {
    action: opts?.onRetry
      ? {
          label: "Retry",
          onClick: () => {
            void opts.onRetry?.();
          },
        }
      : undefined,
    duration: opts?.onRetry ? 8000 : 5000,
  });
}

/**
 * Show a toast with an "Undo" action for destructive operations.
 *
 * Usage:
 *   toastUndo({
 *     label: "Time entry deleted",
 *     onUndo: () => restoreTimeEntry(id),
 *   });
 */
export function toastUndo(opts: UndoToastOptions) {
  toast(`${opts.label}`, {
    action: {
      label: "Undo",
      onClick: () => {
        void Promise.resolve(opts.onUndo());
      },
    },
    duration: opts.duration ?? 5000,
  });
}

/**
 * Dismiss all currently visible toasts.
 */
export function dismissAllToasts() {
  toast.dismiss();
}
