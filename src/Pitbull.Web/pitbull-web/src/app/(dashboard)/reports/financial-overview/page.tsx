"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  DollarSign,
  TrendingUp,
  FileText,
  Receipt,
  RefreshCw,
  Download,
  Printer,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import type {
  PagedResult,
  Subcontract,
  ChangeOrder,
  PaymentApplication,
} from "@/lib/types";
import {
  ChangeOrderStatus,
  PaymentApplicationStatus,
} from "@/lib/types";
import {
  subcontractStatusLabel,
  subcontractStatusBadgeClass,
  formatCurrency,
  formatPercent,
} from "@/lib/contracts";
import { toast } from "sonner";

interface SubcontractSummary {
  id: string;
  subcontractNumber: string;
  subcontractorName: string;
  originalValue: number;
  approvedCOs: number;
  currentValue: number;
  billedToDate: number;
  paidToDate: number;
  retainageHeld: number;
  balanceToFinish: number;
  percentBilled: number;
  status: number;
}

export default function FinancialOverviewPage() {
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subRes, coRes, paRes] = await Promise.all([
        api<PagedResult<Subcontract>>("/api/subcontracts?pageSize=200"),
        api<PagedResult<ChangeOrder>>("/api/changeorders?pageSize=200"),
        api<PagedResult<PaymentApplication>>("/api/paymentapplications?pageSize=200"),
      ]);
      setSubcontracts(subRes.items);
      setChangeOrders(coRes.items);
      setPayApps(paRes.items);
    } catch {
      toast.error("Failed to load financial data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate summaries
  const approvedCOs = changeOrders.filter((co) => co.status === ChangeOrderStatus.Approved);
  const pendingCOs = changeOrders.filter(
    (co) => co.status === ChangeOrderStatus.Pending || co.status === ChangeOrderStatus.UnderReview
  );

  const totalOriginalValue = subcontracts.reduce((sum, s) => sum + s.originalValue, 0);
  const totalCurrentValue = subcontracts.reduce((sum, s) => sum + s.currentValue, 0);
  const totalBilledToDate = subcontracts.reduce((sum, s) => sum + s.billedToDate, 0);
  const totalPaidToDate = subcontracts.reduce((sum, s) => sum + s.paidToDate, 0);
  const totalRetainageHeld = subcontracts.reduce((sum, s) => sum + s.retainageHeld, 0);
  const totalApprovedCOValue = approvedCOs.reduce((sum, co) => sum + co.amount, 0);
  const totalPendingCOValue = pendingCOs.reduce((sum, co) => sum + co.amount, 0);

  const outstandingPayApps = payApps.filter(
    (pa) =>
      pa.status === PaymentApplicationStatus.Submitted ||
      pa.status === PaymentApplicationStatus.Reviewed ||
      pa.status === PaymentApplicationStatus.Approved
  );
  const outstandingAmount = outstandingPayApps.reduce(
    (sum, pa) => sum + pa.currentPaymentDue,
    0
  );

  // Per-subcontract summary with CO aggregation
  const summaryRows: SubcontractSummary[] = subcontracts.map((sub) => {
    const subCOs = approvedCOs.filter((co) => co.subcontractId === sub.id);
    const approvedCOTotal = subCOs.reduce((sum, co) => sum + co.amount, 0);
    const balanceToFinish = sub.currentValue - sub.billedToDate;
    const percentBilled = sub.currentValue > 0 ? (sub.billedToDate / sub.currentValue) * 100 : 0;

    return {
      id: sub.id,
      subcontractNumber: sub.subcontractNumber,
      subcontractorName: sub.subcontractorName,
      originalValue: sub.originalValue,
      approvedCOs: approvedCOTotal,
      currentValue: sub.currentValue,
      billedToDate: sub.billedToDate,
      paidToDate: sub.paidToDate,
      retainageHeld: sub.retainageHeld,
      balanceToFinish,
      percentBilled,
      status: sub.status,
    };
  });

  const exportCsv = () => {
    const rows = [
      [
        "Sub #",
        "Subcontractor",
        "Original Value",
        "Approved COs",
        "Current Value",
        "Billed to Date",
        "Paid to Date",
        "Retainage Held",
        "Balance to Finish",
        "% Billed",
      ].join(","),
    ];

    for (const row of summaryRows) {
      rows.push(
        [
          row.subcontractNumber,
          `"${row.subcontractorName}"`,
          row.originalValue.toFixed(2),
          row.approvedCOs.toFixed(2),
          row.currentValue.toFixed(2),
          row.billedToDate.toFixed(2),
          row.paidToDate.toFixed(2),
          row.retainageHeld.toFixed(2),
          row.balanceToFinish.toFixed(2),
          row.percentBilled.toFixed(1),
        ].join(",")
      );
    }

    rows.push(
      [
        "",
        "GRAND TOTAL",
        totalOriginalValue.toFixed(2),
        totalApprovedCOValue.toFixed(2),
        totalCurrentValue.toFixed(2),
        totalBilledToDate.toFixed(2),
        totalPaidToDate.toFixed(2),
        totalRetainageHeld.toFixed(2),
        (totalCurrentValue - totalBilledToDate).toFixed(2),
        totalCurrentValue > 0
          ? ((totalBilledToDate / totalCurrentValue) * 100).toFixed(1)
          : "0.0",
      ].join(",")
    );

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-overview-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports/labor-cost" },
          { label: "Financial Overview" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground">
            Contract values, billing progress, and change order impact
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={isLoading}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={isLoading || subcontracts.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Top-Level Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCurrentValue)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalOriginalValue)} original + {formatCurrency(totalApprovedCOValue)} COs
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billed to Date</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBilledToDate)}</div>
            <p className="text-xs text-muted-foreground">
              {totalCurrentValue > 0
                ? formatPercent((totalBilledToDate / totalCurrentValue) * 100)
                : "0.0%"}{" "}
              of contract value
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retainage Held</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRetainageHeld)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalPaidToDate)} paid to date
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Pay Apps</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outstandingPayApps.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(outstandingAmount)} awaiting payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Change Order Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approved Change Orders</CardTitle>
            <CardDescription>{approvedCOs.length} approved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalApprovedCOValue >= 0 ? "+" : ""}{formatCurrency(totalApprovedCOValue)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              impact on contract values
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Change Orders</CardTitle>
            <CardDescription>{pendingCOs.length} pending review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {totalPendingCOValue >= 0 ? "+" : ""}{formatCurrency(totalPendingCOValue)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              potential additional cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subcontract Financial Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subcontract Financial Summary</CardTitle>
          <CardDescription>
            Billing and payment status for each subcontract
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden md:block">
            {isLoading ? (
              <TableSkeleton
                headers={[
                  "Subcontract",
                  "Original",
                  "COs",
                  "Current",
                  "Billed",
                  "Paid",
                  "Retainage",
                  "Balance",
                  "% Billed",
                ]}
                rows={5}
              />
            ) : summaryRows.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No subcontracts found"
                description="Create subcontracts to see financial data."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Subcontract</TableHead>
                      <TableHead className="text-right">Original Value</TableHead>
                      <TableHead className="text-right">Approved COs</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                      <TableHead className="text-right">Billed to Date</TableHead>
                      <TableHead className="text-right">Paid to Date</TableHead>
                      <TableHead className="text-right">Retainage</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">% Billed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.subcontractorName}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {row.subcontractNumber}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.originalValue)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${row.approvedCOs !== 0 ? (row.approvedCOs > 0 ? "text-red-600" : "text-green-600") : ""}`}>
                          {row.approvedCOs !== 0
                            ? `${row.approvedCOs > 0 ? "+" : ""}${formatCurrency(row.approvedCOs)}`
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(row.currentValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.billedToDate)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.paidToDate)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.retainageHeld)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(row.balanceToFinish)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              row.percentBilled >= 90
                                ? "bg-green-100 text-green-700"
                                : row.percentBilled >= 50
                                ? "bg-blue-100 text-blue-700"
                                : "bg-neutral-100 text-neutral-600"
                            }
                          >
                            {formatPercent(row.percentBilled)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals */}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>Grand Total ({summaryRows.length} subcontracts)</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalOriginalValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {totalApprovedCOValue !== 0
                          ? `${totalApprovedCOValue > 0 ? "+" : ""}${formatCurrency(totalApprovedCOValue)}`
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalCurrentValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalBilledToDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalPaidToDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalRetainageHeld)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalCurrentValue - totalBilledToDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalCurrentValue > 0
                          ? formatPercent((totalBilledToDate / totalCurrentValue) * 100)
                          : "0.0%"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            {isLoading ? (
              <CardListSkeleton rows={5} />
            ) : summaryRows.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No subcontracts found"
                description="Create subcontracts to see financial data."
              />
            ) : (
              <div className="space-y-4">
                {/* Total card */}
                <Card className="bg-primary text-primary-foreground">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Grand Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatCurrency(totalCurrentValue)}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm opacity-90">
                      <div>
                        <div className="font-medium">{formatCurrency(totalBilledToDate)}</div>
                        <div className="text-xs">billed</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatCurrency(totalPaidToDate)}</div>
                        <div className="text-xs">paid</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatCurrency(totalRetainageHeld)}</div>
                        <div className="text-xs">retainage</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Per-subcontract cards */}
                {summaryRows.map((row) => (
                  <Card key={row.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {row.subcontractNumber}
                          </Badge>
                          <CardTitle className="text-base">
                            {row.subcontractorName}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className={subcontractStatusBadgeClass(row.status)}
                        >
                          {subcontractStatusLabel(row.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Contract Value</p>
                          <p className="font-mono font-medium">{formatCurrency(row.currentValue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Billed</p>
                          <p className="font-mono">{formatCurrency(row.billedToDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Paid</p>
                          <p className="font-mono">{formatCurrency(row.paidToDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">% Billed</p>
                          <p className="font-mono">{formatPercent(row.percentBilled)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report footer */}
      <div className="text-sm text-muted-foreground text-center">
        Report generated at {new Date().toLocaleString()}
      </div>
    </div>
  );
}
