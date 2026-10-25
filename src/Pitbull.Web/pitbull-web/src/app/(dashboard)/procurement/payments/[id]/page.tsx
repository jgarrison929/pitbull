"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Check, XCircle } from "lucide-react";

interface PaymentApplication {
  id: string;
  vendorInvoiceId: string;
  invoiceNumber: string;
  invoiceTotalAmount: number;
  appliedAmount: number;
}

interface VendorPaymentDto {
  id: string;
  paymentNumber: string;
  vendorId: string;
  vendorName: string | null;
  paymentDate: string;
  totalAmount: number;
  paymentMethod: number;
  paymentMethodName: string;
  referenceNumber: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  status: number;
  statusName: string;
  memo: string | null;
  journalEntryId: string | null;
  applications: PaymentApplication[];
  createdAt: string;
  updatedAt: string | null;
}

export default function VendorPaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [payment, setPayment] = useState<VendorPaymentDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  const fetchPayment = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<VendorPaymentDto>(`/api/vendor-payments/${id}`);
      setPayment(data);
    } catch {
      toast.error("Failed to load payment");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  async function handleApprove() {
    setIsActioning(true);
    try {
      await api(`/api/vendor-payments/${id}/approve`, { method: "POST" });
      toast.success("Payment approved");
      fetchPayment();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve payment"
      );
    } finally {
      setIsActioning(false);
    }
  }

  async function handleVoid() {
    if (!confirm("Are you sure you want to void this payment?")) return;
    setIsActioning(true);
    try {
      await api(`/api/vendor-payments/${id}/void`, {
        method: "POST",
        body: { reason: "Voided by user" },
      });
      toast.success("Payment voided");
      fetchPayment();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to void payment"
      );
    } finally {
      setIsActioning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this draft payment?")) return;
    setIsActioning(true);
    try {
      await api(`/api/vendor-payments/${id}`, { method: "DELETE" });
      toast.success("Payment deleted");
      router.push("/procurement/payments");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete payment"
      );
    } finally {
      setIsActioning(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Payment not found.</p>
        <Button variant="outline" onClick={() => router.push("/procurement/payments")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Payments
        </Button>
      </div>
    );
  }

  const methodColors: Record<string, string> = {
    Check: "bg-blue-100 text-blue-800 border-blue-300",
    ACH: "bg-green-100 text-green-800 border-green-300",
    Wire: "bg-purple-100 text-purple-800 border-purple-300",
    CreditCard: "bg-orange-100 text-orange-800 border-orange-300",
    Cash: "bg-gray-100 text-gray-800 border-gray-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/procurement/payments")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {payment.paymentNumber}
            </h1>
            <p className="text-muted-foreground">
              Payment to {payment.vendorName || "Unknown Vendor"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge entityType="VendorPayment" status={payment.statusName} />

          {payment.statusName === "Draft" && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isActioning}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                disabled={isActioning}
              >
                Delete
              </Button>
            </>
          )}

          {(payment.statusName === "Approved" ||
            payment.statusName === "Posted") && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleVoid}
              disabled={isActioning}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle className="mr-1 h-4 w-4" /> Void
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Date</span>
              <span className="font-medium">{payment.paymentDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold text-lg">
                ${payment.totalAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <Badge
                className={
                  methodColors[payment.paymentMethodName] ||
                  "bg-gray-100 text-gray-800"
                }
              >
                {payment.paymentMethodName}
              </Badge>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference #</span>
                <span className="font-medium">{payment.referenceNumber}</span>
              </div>
            )}
            {payment.bankAccountName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank Account</span>
                <span className="font-medium">{payment.bankAccountName}</span>
              </div>
            )}
            {payment.memo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memo</span>
                <span>{payment.memo}</span>
              </div>
            )}
            {payment.journalEntryId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Journal Entry</span>
                <Link
                  href={`/accounting/journal-entries/${payment.journalEntryId}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  View Entry
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(payment.createdAt).toLocaleString()}</span>
            </div>
            {payment.updatedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(payment.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applied Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Invoice Total</TableHead>
                <TableHead className="text-right">Amount Applied</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payment.applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <Link
                      href={`/procurement/invoices`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {app.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    ${app.invoiceTotalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${app.appliedAmount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {payment.applications.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground py-4"
                  >
                    No invoice applications
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
