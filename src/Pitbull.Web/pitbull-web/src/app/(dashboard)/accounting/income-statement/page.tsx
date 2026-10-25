"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, RefreshCw, Printer, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { csvRow, downloadCsvFile } from "@/lib/csv-utils";

// ── Types ──

interface IncomeStatementAccountLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  children: IncomeStatementAccountLine[];
}

interface IncomeStatementSection {
  sectionName: string;
  accountType: number;
  accounts: IncomeStatementAccountLine[];
  total: number;
}

interface IncomeStatementResult {
  revenue: IncomeStatementSection;
  expenses: IncomeStatementSection;
  netIncome: number;
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

function flattenForCsv(
  accounts: IncomeStatementAccountLine[],
  section: string,
  depth: number = 0
): string[][] {
  const rows: string[][] = [];
  for (const account of accounts) {
    const indent = "  ".repeat(depth);
    rows.push([section, `${indent}${account.accountNumber}`, `${indent}${account.accountName}`, account.balance.toFixed(2)]);
    if (account.children.length > 0) {
      rows.push(...flattenForCsv(account.children, section, depth + 1));
    }
  }
  return rows;
}

// ── Account Row Component ──

function AccountRow({
  account,
  depth = 0,
}: {
  account: IncomeStatementAccountLine;
  depth?: number;
}) {
  const hasChildren = account.children.length > 0;

  return (
    <>
      <TableRow className={hasChildren ? "font-medium" : ""}>
        <TableCell style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {account.accountNumber}
            </span>
            <span>{account.accountName}</span>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatCurrency(account.balance)}
        </TableCell>
      </TableRow>
      {account.children.map((child) => (
        <AccountRow key={child.accountId} account={child} depth={depth + 1} />
      ))}
    </>
  );
}

// ── Component ──

export default function IncomeStatementPage() {
  const [data, setData] = useState<IncomeStatementResult | null>(null);
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
      const result = await api<IncomeStatementResult>(
        `/api/financial-statements/income-statement${qs ? `?${qs}` : ""}`
      );
      setData(result);
    } catch {
      toast.error("Failed to load income statement");
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
      csvRow(["Section", "Account Number", "Account Name", "Amount"]),
      ...flattenForCsv(data.revenue.accounts, "Revenue").map((r) => csvRow(r)),
      csvRow(["Revenue", "", "TOTAL REVENUE", data.revenue.total.toFixed(2)]),
      csvRow([]),
      ...flattenForCsv(data.expenses.accounts, "Expenses").map((r) => csvRow(r)),
      csvRow(["Expenses", "", "TOTAL EXPENSES", data.expenses.total.toFixed(2)]),
      csvRow([]),
      csvRow(["", "", "NET INCOME", data.netIncome.toFixed(2)]),
    ];
    downloadCsvFile(rows, `income-statement-${data.periodStart}-to-${data.periodEnd}.csv`);
    toast.success("CSV exported");
  };

  const netIncomeColor = data
    ? data.netIncome >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400"
    : "";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Accounting", href: "/accounting/journal-entries" },
          { label: "Income Statement" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Income Statement</h1>
          <p className="text-muted-foreground">
            Profit &amp; Loss
            {data && ` · ${data.periodStart} to ${data.periodEnd}`}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4 mr-1" />
            Export
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
          <div className="grid gap-4 sm:grid-cols-2">
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(data.revenue.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(data.expenses.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Net Income</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${netIncomeColor}`}>
                {formatCurrency(data.netIncome)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.revenue.total > 0
                  ? `${((data.netIncome / data.revenue.total) * 100).toFixed(1)}% margin`
                  : "No revenue"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Revenue Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-green-600 dark:text-green-400">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.revenue.accounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right w-[180px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.revenue.accounts.map((account) => (
                      <AccountRow key={account.accountId} account={account} />
                    ))}
                    <TableRow className="border-t-2 bg-muted/50">
                      <TableCell className="font-bold">Total Revenue</TableCell>
                      <TableCell className="text-right font-mono font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(data.revenue.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  No revenue recorded for this period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-red-600 dark:text-red-400">Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.expenses.accounts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right w-[180px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expenses.accounts.map((account) => (
                      <AccountRow key={account.accountId} account={account} />
                    ))}
                    <TableRow className="border-t-2 bg-muted/50">
                      <TableCell className="font-bold">Total Expenses</TableCell>
                      <TableCell className="text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(data.expenses.total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  No expenses recorded for this period.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Net Income */}
          <Card className="border-2">
            <CardContent className="py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold">
                    {data.netIncome >= 0 ? "Net Income" : "Net Loss"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Revenue minus Expenses
                  </p>
                </div>
                <p className={`text-3xl font-bold font-mono ${netIncomeColor}`}>
                  {formatCurrency(data.netIncome)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
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
