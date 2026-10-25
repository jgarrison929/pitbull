"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorOption {
  id: string;
  name: string;
}

interface BankAccountOption {
  id: string;
  accountName: string;
  bankName: string;
}

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  statusName: string;
}

interface SelectedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  appliedAmount: string;
}

export default function NewVendorPaymentPage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<SelectedInvoice[]>(
    []
  );

  const [vendorId, setVendorId] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("Check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [memo, setMemo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadVendors() {
      try {
        const data = await api<{ items: VendorOption[] }>(
          "/api/vendors?pageSize=200"
        );
        setVendors(data.items || []);
      } catch {
        // Vendors may not be available
      }
    }
    async function loadBankAccounts() {
      try {
        const data = await api<{ items: BankAccountOption[] }>(
          "/api/bank-accounts?pageSize=50"
        );
        setBankAccounts(data.items || []);
      } catch {
        // Bank accounts may not be available
      }
    }
    loadVendors();
    loadBankAccounts();
  }, []);

  const loadInvoicesForVendor = useCallback(async (vid: string) => {
    if (!vid) {
      setInvoices([]);
      return;
    }
    try {
      const data = await api<{ items: InvoiceOption[] }>(
        `/api/vendor-invoices?vendorId=${vid}&pageSize=100`
      );
      // Show Approved invoices that can receive payments
      setInvoices(
        (data.items || []).filter(
          (i) =>
            i.statusName === "Approved" ||
            i.statusName === "Matched" ||
            i.statusName === "PartiallyMatched"
        )
      );
    } catch {
      setInvoices([]);
    }
  }, []);

  function handleVendorChange(vid: string) {
    setVendorId(vid);
    setSelectedInvoices([]);
    loadInvoicesForVendor(vid);
  }

  function toggleInvoice(invoice: InvoiceOption, checked: boolean) {
    if (checked) {
      setSelectedInvoices((prev) => [
        ...prev,
        {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          appliedAmount: String(invoice.totalAmount),
        },
      ]);
    } else {
      setSelectedInvoices((prev) =>
        prev.filter((s) => s.invoiceId !== invoice.id)
      );
    }
  }

  function updateAppliedAmount(invoiceId: string, amount: string) {
    setSelectedInvoices((prev) =>
      prev.map((s) =>
        s.invoiceId === invoiceId ? { ...s, appliedAmount: amount } : s
      )
    );
  }

  const totalPayment = selectedInvoices.reduce(
    (sum, s) => sum + (parseFloat(s.appliedAmount) || 0),
    0
  );

  const methodMap: Record<string, number> = {
    Check: 1,
    ACH: 2,
    Wire: 3,
    CreditCard: 4,
    Cash: 5,
    Other: 6,
  };

  async function handleSubmit() {
    if (!vendorId) {
      toast.error("Vendor is required");
      return;
    }
    if (!paymentDate) {
      toast.error("Payment date is required");
      return;
    }
    if (selectedInvoices.length === 0) {
      toast.error("Select at least one invoice to pay");
      return;
    }

    for (const si of selectedInvoices) {
      const amount = parseFloat(si.appliedAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error(`Invalid amount for invoice ${si.invoiceNumber}`);
        return;
      }
      if (amount > si.totalAmount) {
        toast.error(
          `Amount exceeds invoice total for ${si.invoiceNumber}`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await api("/api/vendor-payments", {
        method: "POST",
        body: {
          vendorId,
          paymentDate,
          paymentMethod: methodMap[paymentMethod] || 1,
          referenceNumber: referenceNumber || null,
          bankAccountId: bankAccountId || null,
          memo: memo || null,
          applications: selectedInvoices.map((si) => ({
            vendorInvoiceId: si.invoiceId,
            appliedAmount: parseFloat(si.appliedAmount),
          })),
        },
      });

      toast.success("Payment created");
      router.push("/procurement/payments");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create payment"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          New Vendor Payment
        </h1>
        <p className="text-muted-foreground">
          Record a payment against one or more vendor invoices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendorId">Vendor</Label>
              <Select value={vendorId} onValueChange={handleVendorChange}>
                <SelectTrigger>
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
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Wire">Wire Transfer</SelectItem>
                  <SelectItem value="CreditCard">Credit Card</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference / Check #</Label>
              <Input
                id="referenceNumber"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Check # or ref"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccountId">Bank Account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba.id} value={ba.id}>
                      {ba.accountName} ({ba.bankName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">Memo</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional payment memo..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {vendorId && (
        <Card>
          <CardHeader>
            <CardTitle>Apply to Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No payable invoices found for this vendor
              </p>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => {
                  const isSelected = selectedInvoices.some(
                    (s) => s.invoiceId === invoice.id
                  );
                  const selected = selectedInvoices.find(
                    (s) => s.invoiceId === invoice.id
                  );
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-4 p-3 rounded-lg border"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleInvoice(invoice, checked === true)
                        }
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total: ${invoice.totalAmount.toFixed(2)} •{" "}
                          {invoice.statusName}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">
                            Pay:
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            max={invoice.totalAmount}
                            value={selected?.appliedAmount || ""}
                            onChange={(e) =>
                              updateAppliedAmount(invoice.id, e.target.value)
                            }
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedInvoices.length > 0 && (
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {selectedInvoices.length} invoice
                  {selectedInvoices.length !== 1 ? "s" : ""} selected
                </div>
                <div className="text-lg font-bold">
                  Total: ${totalPayment.toFixed(2)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/procurement/payments")}
        >
          Cancel
        </Button>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleSubmit}
          disabled={isSubmitting || selectedInvoices.length === 0}
        >
          {isSubmitting ? "Creating..." : "Create Payment"}
        </Button>
      </div>
    </div>
  );
}
