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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/skeletons";
import { Input } from "@/components/ui/input";
import { Plus, ShieldAlert } from "lucide-react";
import { getNextVendorInvoiceStatuses } from "@/lib/workflow-transitions";

interface InvoiceMatchResult {
  variancePercent: number;
}

interface VendorInvoiceDto {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  statusName: string;
  latestMatchResult?: InvoiceMatchResult | null;
}

interface ListResult {
  items: VendorInvoiceDto[];
}

export default function ProcurementInvoicesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<VendorInvoiceDto[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isMatchingId, setIsMatchingId] = useState<string | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setPermissionDenied(false);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const result = await api<ListResult>(`/api/vendor-invoices?${params.toString()}`);
      setInvoices(result.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPermissionDenied(true);
      } else {
        toast.error("Failed to load invoices");
      }
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function runMatch(invoiceId: string) {
    setIsMatchingId(invoiceId);
    try {
      await api(`/api/vendor-invoices/${invoiceId}/match`, { method: "POST", body: {} });
      toast.success("Invoice matched");
      fetchInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to match invoice");
    } finally {
      setIsMatchingId(null);
    }
  }

  async function updateInvoiceStatus(
    invoice: VendorInvoiceDto,
    nextStatus: "Approved" | "Paid",
    label: string
  ) {
    setIsUpdatingId(invoice.id);
    try {
      await api(`/api/vendor-invoices/${invoice.id}`, {
        method: "PUT",
        body: { status: nextStatus },
      });
      toast.success(label);
      fetchInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed: ${label}`);
    } finally {
      setIsUpdatingId(null);
    }
  }

  function getMatchIndicator(invoice: VendorInvoiceDto) {
    if (!invoice.latestMatchResult) {
      return <Badge className="bg-red-100 text-red-800 border-red-300">Unmatched</Badge>;
    }

    const variance = Math.abs(invoice.latestMatchResult.variancePercent);
    if (variance <= 5) {
      return <Badge className="bg-green-100 text-green-800 border-green-300">Matched</Badge>;
    }

    return <Badge className="bg-yellow-100 text-yellow-900 border-yellow-300">Variance</Badge>;
  }

  if (permissionDenied) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor Invoices</h1>
          <p className="text-muted-foreground">Review invoice matching status and resolve variances</p>
        </div>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have permission to view invoices. Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor Invoices</h1>
          <p className="text-muted-foreground">Review invoice matching status and resolve variances</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
          <Link href="/procurement/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number..."
            className="max-w-sm"
          />
          {isLoading ? (
            <TableSkeleton rows={8} headers={["Invoice #", "Amount", "Status", "Match", "Actions"]} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-right">${invoice.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <StatusBadge entityType="VendorInvoice" status={invoice.statusName} />
                    </TableCell>
                    <TableCell>{getMatchIndicator(invoice)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {invoice.statusName === "Pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runMatch(invoice.id)}
                            disabled={isMatchingId === invoice.id}
                          >
                            {isMatchingId === invoice.id ? "Matching..." : "Match"}
                          </Button>
                        )}
                        {getNextVendorInvoiceStatuses(invoice.statusName).includes("Approved") && (
                          <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => updateInvoiceStatus(invoice, "Approved", "Invoice approved")}
                            disabled={isUpdatingId === invoice.id}
                          >
                            Approve
                          </Button>
                        )}
                        {getNextVendorInvoiceStatuses(invoice.statusName).includes("Paid") && (
                          <Button
                            size="sm"
                            onClick={() => updateInvoiceStatus(invoice, "Paid", "Invoice marked paid")}
                            disabled={isUpdatingId === invoice.id}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No invoices found
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
