"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";
import type { Subcontract, PagedResult, ChangeOrder } from "@/lib/types";
import { toast } from "sonner";

interface ChangeOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected subcontract ID */
  subcontractId?: string;
  /** ID of the originating RFI (for linking) */
  originatingRfiId?: string;
  /** Pre-filled description from RFI */
  prefillDescription?: string;
  /** Callback when change order is created */
  onCreated?: (changeOrder: ChangeOrder) => void;
}

interface CreateChangeOrderPayload {
  subcontractId: string;
  changeOrderNumber: string;
  title: string;
  description: string;
  reason?: string;
  amount: number;
  daysExtension?: number;
  referenceNumber?: string;
  originatingRfiId?: string;
}

export function ChangeOrderDialog({
  open,
  onOpenChange,
  subcontractId: initialSubcontractId,
  originatingRfiId,
  prefillDescription,
  onCreated,
}: ChangeOrderDialogProps) {
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [isLoadingSubcontracts, setIsLoadingSubcontracts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [subcontractId, setSubcontractId] = useState(initialSubcontractId || "");
  const [changeOrderNumber, setChangeOrderNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(prefillDescription || "");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [daysExtension, setDaysExtension] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSubcontractId(initialSubcontractId || "");
      setDescription(prefillDescription || "");
      setChangeOrderNumber("");
      setTitle(prefillDescription ? prefillDescription.substring(0, 100) : "");
      setReason("");
      setAmount("");
      setDaysExtension("");
    }
  }, [open, initialSubcontractId, prefillDescription]);

  // Load subcontracts when dialog opens
  useEffect(() => {
    async function loadSubcontracts() {
      if (!open) return;
      setIsLoadingSubcontracts(true);
      try {
        const result = await api<PagedResult<Subcontract>>(
          "/api/subcontracts?pageSize=100"
        );
        setSubcontracts(result.items);
      } catch {
        toast.error("Failed to load subcontracts");
      } finally {
        setIsLoadingSubcontracts(false);
      }
    }
    loadSubcontracts();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!subcontractId) {
      toast.error("Please select a subcontract");
      return;
    }
    if (!changeOrderNumber.trim()) {
      toast.error("Change order number is required");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateChangeOrderPayload = {
        subcontractId,
        changeOrderNumber: changeOrderNumber.trim(),
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim() || undefined,
        amount: parsedAmount,
        daysExtension: daysExtension ? parseInt(daysExtension, 10) : undefined,
        originatingRfiId: originatingRfiId || undefined,
      };

      const result = await api<ChangeOrder>("/api/changeorders", {
        method: "POST",
        body: payload,
      });

      toast.success("Change order created successfully");
      onOpenChange(false);
      onCreated?.(result);
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "Failed to create change order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Change Order</DialogTitle>
          <DialogDescription>
            Create a new change order for a subcontract.
            {originatingRfiId && (
              <span className="block mt-1 text-amber-600">
                This change order will be linked to the originating RFI.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subcontract Selection */}
          <div className="space-y-2">
            <Label htmlFor="subcontract">
              Subcontract <span className="text-destructive">*</span>
            </Label>
            <Select value={subcontractId} onValueChange={setSubcontractId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoadingSubcontracts
                      ? "Loading..."
                      : "Select a subcontract"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {subcontracts.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.subcontractNumber} - {sub.subcontractorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Change Order Number */}
          <div className="space-y-2">
            <Label htmlFor="coNumber">
              Change Order # <span className="text-destructive">*</span>
            </Label>
            <Input
              id="coNumber"
              value={changeOrderNumber}
              onChange={(e) => setChangeOrderNumber(e.target.value)}
              placeholder="CO-001"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief title for this change order"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the change..."
              rows={3}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Field condition, Design change, Owner request"
            />
          </div>

          {/* Amount and Days Extension in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daysExtension">Days Extension</Label>
              <Input
                id="daysExtension"
                type="number"
                value={daysExtension}
                onChange={(e) => setDaysExtension(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={isSubmitting || isLoadingSubcontracts}
            >
              {isSubmitting ? "Creating..." : "Create Change Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
