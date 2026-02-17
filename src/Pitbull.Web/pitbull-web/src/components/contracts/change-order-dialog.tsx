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
  subcontractId?: string;
  originatingRfiId?: string;
  prefillDescription?: string;
  onCreated?: (changeOrder: ChangeOrder) => void;
}

interface CreateChangeOrderPayload {
  subcontractId: string;
  number: string;
  title: string;
  description: string;
  amount: number;
  status: number;
  scheduleImpactDays?: number;
  costImpact?: number;
  requestedBy?: string;
  requestDate?: string;
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

  const [subcontractId, setSubcontractId] = useState(initialSubcontractId || "");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(prefillDescription || "");
  const [amount, setAmount] = useState("");
  const [scheduleImpactDays, setScheduleImpactDays] = useState("");
  const [costImpact, setCostImpact] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [requestDate, setRequestDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setSubcontractId(initialSubcontractId || "");
      setDescription(prefillDescription || "");
      setNumber("");
      setTitle(prefillDescription ? prefillDescription.substring(0, 100) : "");
      setAmount("");
      setScheduleImpactDays("");
      setCostImpact("");
      setRequestedBy("");
      setRequestDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, initialSubcontractId, prefillDescription]);

  useEffect(() => {
    async function loadSubcontracts() {
      if (!open) return;
      setIsLoadingSubcontracts(true);
      try {
        const result = await api<PagedResult<Subcontract>>("/api/subcontracts?pageSize=100");
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
    if (!number.trim()) {
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
        number: number.trim(),
        title: title.trim(),
        description: description.trim(),
        amount: parsedAmount,
        status: 0,
        scheduleImpactDays: scheduleImpactDays
          ? parseInt(scheduleImpactDays, 10)
          : undefined,
        costImpact: costImpact ? parseFloat(costImpact) : undefined,
        requestedBy: requestedBy.trim() || undefined,
        requestDate: requestDate || undefined,
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
              <span className="mt-1 block text-amber-600">
                This change order will be linked to the originating RFI.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subcontract">
              Subcontract <span className="text-destructive">*</span>
            </Label>
            <Select value={subcontractId} onValueChange={setSubcontractId}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoadingSubcontracts ? "Loading..." : "Select a subcontract"
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

          <div className="space-y-2">
            <Label htmlFor="coNumber">
              Change Order # <span className="text-destructive">*</span>
            </Label>
            <Input
              id="coNumber"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="CO-001"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="requestedBy">Requested By</Label>
              <Input
                id="requestedBy"
                value={requestedBy}
                onChange={(e) => setRequestedBy(e.target.value)}
                placeholder="Foreman / PM / Owner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requestDate">Request Date</Label>
              <Input
                id="requestDate"
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="scheduleImpactDays">Schedule Impact</Label>
              <Input
                id="scheduleImpactDays"
                type="number"
                value={scheduleImpactDays}
                onChange={(e) => setScheduleImpactDays(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costImpact">Cost Impact ($)</Label>
              <Input
                id="costImpact"
                type="number"
                step="0.01"
                value={costImpact}
                onChange={(e) => setCostImpact(e.target.value)}
                placeholder="0.00"
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
              className="bg-amber-500 text-white hover:bg-amber-600"
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
