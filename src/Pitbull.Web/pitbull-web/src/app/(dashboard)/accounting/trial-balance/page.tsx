"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Download, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { csvRow, downloadCsvFile } from "@/lib/csv-utils";

// ── Types ──

interface TrialBalanceLineItem {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: number;
  accountTypeName: string;
  normalBalance: number;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceResult {
  accounts: TrialBalanceLineItem[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
}

// ── Helpers ──

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function accountTypeBadgeClass(type: string): string {
  switch (type) {
    case "Asset":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "Liability":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
    case "Equity":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    case "Revenue":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "Expense":
      return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default:
      return "";
  }
}

// ── Component ──

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodStart) params.set("periodStart", periodStart);
      if (periodEnd) params.set("periodEnd", periodEnd);
      const qs = params.toString();
      const result = await api<TrialBalanceResult>(
        `/api/financial-statements/trial-balance${qs ? `?${qs}` : ""}`
      );
      setData(result);
    } catch {
      toast.error("Failed to load trial balance");
    } finally {
      setIsLoading(false);
    }
  }, [periodStart, periodEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      csvRow(["Account Number", "Account Name", "Type", "Debit", "Credit"]),
      ...data.accounts.map((a) =>
        csvRow([
          a.accountNumber,
          a.accountName,
          a.accountTypeName,
          a.debitBalance.toFixed(2),
          a.creditBalance.toFixed(2),
        ])
      ),
      csvRow(["", "", "TOTALS", data.totalDebits.toFixed(2), data.totalCredits.toFixed(2)]),
    ];
    downloadCsvFile(rows, `trial-balance-${data.periodStart}-to-${data.periodEnd}.csv`);
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Accounting", href: "/accounting/journal-entries" },
          { label: "Trial Balance" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">
            All account balances for the selected period
            {data && !data.isBalanced && (
              <span className="text-red-500 font-medium ml-2">⚠ Out of balance</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data?.accounts.length}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Period Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              {data && (
                <div className="flex items-center gap-2">
                  {data.isBalanced ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Balanced
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Out of Balance: {formatCurrency(Math.abs(data.totalDebits - data.totalCredits))}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Debits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data.totalDebits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data.totalCredits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Accounts with Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.accounts.length}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Trial Balance Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : data && data.accounts.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Account #</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="text-right w-[150px]">Debit</TableHead>
                  <TableHead className="text-right w-[150px]">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.map((account) => (
                  <TableRow key={account.accountId}>
                    <TableCell className="font-mono text-sm">{account.accountNumber}</TableCell>
                    <TableCell className="font-medium">{account.accountName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={accountTypeBadgeClass(account.accountTypeName)}>
                        {account.accountTypeName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {account.debitBalance > 0 ? formatCurrency(account.debitBalance) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {account.creditBalance > 0 ? formatCurrency(account.creditBalance) : ""}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="border-t-2 bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatCurrency(data.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatCurrency(data.totalCredits)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No posted journal entries found for the selected period.
          </CardContent>
        </Card>
      )}

      {/* Report footer */}
      {data && (
        <div className="text-sm text-muted-foreground text-center">
          Period: {data.periodStart} to {data.periodEnd} · Generated at{" "}
          {new Date(data.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
