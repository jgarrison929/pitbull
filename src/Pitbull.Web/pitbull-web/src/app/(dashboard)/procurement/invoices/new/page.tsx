"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  InvoiceExtraction,
  type InvoiceFormValues,
  type InvoiceExtractionResult,
} from "@/components/dashboard/invoice-extraction";

interface VendorOption {
  id: string;
  name: string;
}

export default function NewVendorInvoicePage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    async function loadVendors() {
      try {
        const data = await api<{ items: VendorOption[] }>(
          "/api/vendors?pageSize=200"
        );
        setVendors(data.items || []);
      } catch {
        // Vendors may not be available yet
      }
    }
    loadVendors();
  }, []);

  const handleAiApply = useCallback(
    (values: InvoiceFormValues, _result: InvoiceExtractionResult) => {
      const filled = new Set<string>();

      if (values.vendorId) {
        setVendorId(values.vendorId);
        filled.add("vendorId");
      }
      if (values.invoiceNumber) {
        setInvoiceNumber(values.invoiceNumber);
        filled.add("invoiceNumber");
      }
      if (values.invoiceDate) {
        setInvoiceDate(values.invoiceDate);
        filled.add("invoiceDate");
      }
      if (values.dueDate) {
        setDueDate(values.dueDate);
        filled.add("dueDate");
      }
      if (values.totalAmount) {
        setTotalAmount(String(values.totalAmount));
        filled.add("totalAmount");
      }

      setAutoFilledFields(filled);

      // Clear the auto-fill highlight after 5 seconds
      setTimeout(() => setAutoFilledFields(new Set()), 5000);
    },
    []
  );

  async function handleSubmit() {
    if (!vendorId) {
      toast.error("Vendor is required");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (!invoiceDate) {
      toast.error("Invoice date is required");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Total amount must be a positive number");
      return;
    }

    setIsSubmitting(true);
    try {
      await api("/api/vendor-invoices", {
        method: "POST",
        body: {
          vendorId,
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          dueDate,
          totalAmount: amount,
          purchaseOrderId: purchaseOrderId || null,
        },
      });

      toast.success("Vendor invoice created");
      router.push("/procurement/invoices");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create vendor invoice"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const autoFillRing =
    "ring-2 ring-blue-300 dark:ring-blue-700 transition-all duration-500";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          New Vendor Invoice
        </h1>
        <p className="text-muted-foreground">
          Create a new vendor invoice or use AI to extract data from an uploaded
          document
        </p>
      </div>

      {/* AI Extraction Section */}
      <InvoiceExtraction onApply={handleAiApply} />

      {/* Manual Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor</Label>
              <Select
                value={vendorId}
                onValueChange={(v) => {
                  setVendorId(v);
                  setAutoFilledFields((prev) => {
                    const next = new Set(prev);
                    next.delete("vendorId");
                    return next;
                  });
                }}
              >
                <SelectTrigger
                  className={cn(
                    autoFilledFields.has("vendorId") && autoFillRing
                  )}
                >
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setAutoFilledFields((prev) => {
                    const next = new Set(prev);
                    next.delete("invoiceNumber");
                    return next;
                  });
                }}
                placeholder="INV-001"
                className={cn(
                  autoFilledFields.has("invoiceNumber") && autoFillRing
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => {
                  setInvoiceDate(e.target.value);
                  setAutoFilledFields((prev) => {
                    const next = new Set(prev);
                    next.delete("invoiceDate");
                    return next;
                  });
                }}
                className={cn(
                  autoFilledFields.has("invoiceDate") && autoFillRing
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setAutoFilledFields((prev) => {
                    const next = new Set(prev);
                    next.delete("dueDate");
                    return next;
                  });
                }}
                className={cn(
                  autoFilledFields.has("dueDate") && autoFillRing
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount</Label>
              <Input
                id="totalAmount"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  setAutoFilledFields((prev) => {
                    const next = new Set(prev);
                    next.delete("totalAmount");
                    return next;
                  });
                }}
                placeholder="0.00"
                className={cn(
                  autoFilledFields.has("totalAmount") && autoFillRing
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderId">
                Purchase Order (Optional)
              </Label>
              <Input
                id="purchaseOrderId"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                placeholder="PO ID (optional)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/procurement/invoices")}
        >
          Cancel
        </Button>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
