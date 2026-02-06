"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { AlertTriangle, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Additional content to show in the dialog body */
  children?: React.ReactNode;
  /** Text for the confirm button. Default: "Confirm" */
  confirmLabel?: string;
  /** Text for the cancel button. Default: "Cancel" */
  cancelLabel?: string;
  /** Callback when user confirms the action */
  onConfirm: () => void | Promise<void>;
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
  /** Loading text to show. Default: "Processing..." */
  loadingText?: string;
  /** Visual variant. Default: "danger" */
  variant?: ConfirmVariant;
  /** Whether to show an icon. Default: true */
  showIcon?: boolean;
}

const variantConfig: Record<
  ConfirmVariant,
  { icon: typeof AlertTriangle; iconClass: string; buttonClass: string }
> = {
  danger: {
    icon: Trash2,
    iconClass: "text-destructive",
    buttonClass: "bg-destructive hover:bg-destructive/90 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-500",
    buttonClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  info: {
    icon: AlertCircle,
    iconClass: "text-blue-500",
    buttonClass: "bg-blue-500 hover:bg-blue-600 text-white",
  },
};

/**
 * ConfirmDialog provides a consistent pattern for confirmation dialogs,
 * especially for destructive actions like delete operations.
 *
 * Features:
 * - Accessible with proper ARIA attributes
 * - Focus trap and keyboard navigation (via Radix Dialog)
 * - Loading state support for async operations
 * - Visual variants for different severity levels
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
  loadingText = "Processing...",
  variant = "danger",
  showIcon = true,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    await onConfirm();
  };

  // Close on cancel, but not while loading
  const handleCancel = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => isLoading && e.preventDefault()}
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showIcon && <Icon className={cn("h-5 w-5", config.iconClass)} />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children && <div className="py-2">{children}</div>}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="min-h-[44px]"
          >
            {cancelLabel}
          </Button>
          <LoadingButton
            className={cn("min-h-[44px]", config.buttonClass)}
            onClick={handleConfirm}
            loading={isLoading}
            loadingText={loadingText}
          >
            {confirmLabel}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps, ConfirmVariant };
