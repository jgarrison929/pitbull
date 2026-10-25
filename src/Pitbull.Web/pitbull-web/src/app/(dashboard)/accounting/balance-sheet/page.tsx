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
import { Download, RefreshCw, Printer, CheckCircle, AlertTriangle } from "lucide-react";
import { csvRow, downloadCsvFile } from "@/lib/csv-utils";

// ── Types ──

interface BalanceSheetAccountLine {
  accountId: string;
  accountNumber: string;
  accountName: string;
  balance: number;
  children: BalanceSheetAccountLine[];
}

interface BalanceSheetSection {
  sectionName: string;
  accountType: number;
  accounts: BalanceSheetAccountLine[];
  total: number;
}

interface BalanceSheetResult {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  asOfDate: string;
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
  accounts: BalanceSheetAccountLine[],
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
  account: BalanceSheetAccountLine;
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

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = asOfDate ? `?asOfDate=${asOfDate}` : "";
      const result = await api<BalanceSheetResult>(
        `/api/financial-statements/balance-sheet${params}`
      );
      setData(result);
    } catch {
      toast.error("Failed to load balance sheet");
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      csvRow(["Section", "Account Number", "Account Name", "Balance"]),
      ...flattenForCsv(data.assets.accounts, "Assets").map((r) => csvRow(r)),
      csvRow(["Assets", "", "TOTAL ASSETS", data.assets.total.toFixed(2)]),
      "",
      ...flattenForCsv(data.liabilities.accounts, "Liabilities").map((r) => csvRow(r)),
      csvRow(["Liabilities", "", "TOTAL LIABILITIES", data.liabilities.total.toFixed(2)]),
      "",
      ...flattenForCsv(data.equity.accounts, "Equity").map((r) => csvRow(r)),
      csvRow(["Equity", "", "TOTAL EQUITY", data.equity.total.toFixed(2)]),
      "",
      csvRow(["", "", "TOTAL L&E", data.totalLiabilitiesAndEquity.toFixed(2)]),
    ];
    downloadCsvFile(rows, `balance-sheet-${data.asOfDate}.csv`);
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Accounting", href: "/accounting/journal-entries" },
          { label: "Balance Sheet" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">
            Assets = Liabilities + Equity
            {data && ` · As of ${data.asOfDate}`}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Label htmlFor="asOfDate" className="text-sm whitespace-nowrap">
            As of:
          </Label>
          <Input
            id="asOfDate"
            type="date"
            className="w-40"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
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

      {/* Balance Status */}
      {data && (
        <div className="flex justify-center">
          {data.isBalanced ? (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-sm px-4 py-1">
              <CheckCircle className="h-4 w-4 mr-1" />
              Balance Sheet is balanced
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm px-4 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Out of balance by {formatCurrency(Math.abs(data.assets.total - data.totalLiabilitiesAndEquity))}
            </Badge>
          )}
        </div>
      )}

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
              <CardTitle className="text-sm text-muted-foreground">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(data.assets.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(data.liabilities.total)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(data.equity.total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Includes current period net income
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-full mb-2" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Assets Section */}
          <SectionTable
            title="Assets"
            section={data.assets}
            colorClass="text-blue-600 dark:text-blue-400"
          />

          {/* Liabilities Section */}
          <SectionTable
            title="Liabilities"
            section={data.liabilities}
            colorClass="text-orange-600 dark:text-orange-400"
          />

          {/* Equity Section */}
          <SectionTable
            title="Equity"
            section={data.equity}
            colorClass="text-purple-600 dark:text-purple-400"
          />

          {/* Grand Totals */}
          <Card className="border-2">
            <CardContent className="py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold">Total Liabilities &amp; Equity</p>
                </div>
                <p className="text-2xl font-bold font-mono">
                  {formatCurrency(data.totalLiabilitiesAndEquity)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No posted journal entries found.
          </CardContent>
        </Card>
      )}

      {/* Report footer */}
      {data && (
        <div className="text-sm text-muted-foreground text-center">
          As of {data.asOfDate} · Generated at{" "}
          {new Date(data.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ── Section Table Component ──

function SectionTable({
  title,
  section,
  colorClass,
}: {
  title: string;
  section: BalanceSheetSection;
  colorClass: string;
}) {
  if (section.accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={`text-lg ${colorClass}`}>{title}</CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-center text-muted-foreground">
          No {title.toLowerCase()} accounts with balances.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-lg ${colorClass}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead className="text-right w-[180px]">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.accounts.map((account) => (
              <AccountRow key={account.accountId} account={account} />
            ))}
            <TableRow className="border-t-2 bg-muted/50">
              <TableCell className="font-bold">Total {title}</TableCell>
              <TableCell className={`text-right font-mono font-bold ${colorClass}`}>
                {formatCurrency(section.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
