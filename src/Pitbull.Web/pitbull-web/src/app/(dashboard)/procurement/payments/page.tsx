"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import api, { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";
import { Plus, ShieldAlert } from "lucide-react";

interface VendorPaymentDto {
  id: string;
  paymentNumber: string;
  vendorName: string | null;
  paymentDate: string;
  totalAmount: number;
  paymentMethodName: string;
  referenceNumber: string | null;
  statusName: string;
  applications: { invoiceNumber: string; appliedAmount: number }[];
}

interface ListResult {
  items: VendorPaymentDto[];
  totalCount: number;
}

export default function VendorPaymentsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<VendorPaymentDto[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setPermissionDenied(false);
    try {
      const result = await api<ListResult>(
        "/api/vendor-payments?page=1&pageSize=100"
      );
      setPayments(result.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPermissionDenied(true);
      } else {
        toast.error("Failed to load payments");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  function getMethodBadge(method: string) {
    const colors: Record<string, string> = {
      Check: "bg-blue-100 text-blue-800 border-blue-300",
      ACH: "bg-green-100 text-green-800 border-green-300",
      Wire: "bg-purple-100 text-purple-800 border-purple-300",
      CreditCard: "bg-orange-100 text-orange-800 border-orange-300",
      Cash: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return (
      <Badge className={colors[method] || "bg-gray-100 text-gray-800"}>
        {method}
      </Badge>
    );
  }

  if (permissionDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Vendor Payments
          </h1>
          <p className="text-muted-foreground">
            Record and manage payments to vendors
          </p>
        </div>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have permission to view vendor payments. Contact your
            administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Vendor Payments
          </h1>
          <p className="text-muted-foreground">
            Record and manage payments to vendors
          </p>
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          <Link href="/procurement/payments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Payment
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton
              rows={8}
              headers={[
                "Payment #",
                "Vendor",
                "Date",
                "Amount",
                "Method",
                "Reference",
                "Status",
              ]}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Link
                        href={`/procurement/payments/${payment.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {payment.paymentNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{payment.vendorName || "—"}</TableCell>
                    <TableCell>{payment.paymentDate}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${payment.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getMethodBadge(payment.paymentMethodName)}
                    </TableCell>
                    <TableCell>{payment.referenceNumber || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        entityType="VendorPayment"
                        status={payment.statusName}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No payments found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
