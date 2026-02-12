"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface CopyYesterdayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function CopyYesterdayDialog({
  open,
  onOpenChange,
  onConfirm,
}: CopyYesterdayDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy Yesterday's Entries
          </DialogTitle>
          <DialogDescription>
            This will copy hours from yesterday for all crew members who had time
            entries. Existing values in the form will be overwritten.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Copy Yesterday
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
