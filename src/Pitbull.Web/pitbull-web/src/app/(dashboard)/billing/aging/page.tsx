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
import { Download, TrendingDown, TrendingUp, Scale } from "lucide-react";

// ── Types ──

interface AgingBuckets {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

interface VendorAgingLineItem {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  invoiceCount: number;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

interface CustomerAgingLineItem {
  projectId: string;
  projectName: string;
  projectNumber: string;
  applicationCount: number;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

interface VendorAgingResult {
  summary: AgingBuckets;
  vendors: VendorAgingLineItem[];
  asOfDate: string;
}

interface CustomerAgingResult {
  summary: AgingBuckets;
  projects: CustomerAgingLineItem[];
  asOfDate: string;
}

interface AgingSummaryResult {
  accountsPayable: AgingBuckets;
  accountsReceivable: AgingBuckets;
  netPosition: number;
  asOfDate: string;
}

// ── Helpers ──

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function agingCellClass(bucket: "days31To60" | "days61To90" | "days90Plus", value: number): string {
  if (value <= 0) return "";
  switch (bucket) {
    case "days31To60":
      return "text-amber-600 dark:text-amber-400 font-medium";
    case "days61To90":
      return "text-orange-600 dark:text-orange-400 font-semibold";
    case "days90Plus":
      return "text-red-600 dark:text-red-400 font-bold";
  }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ──

export default function AgingReportsPage() {
  const [summary, setSummary] = useState<AgingSummaryResult | null>(null);
  const [vendorAging, setVendorAging] = useState<VendorAgingResult | null>(null);
  const [customerAging, setCustomerAging] = useState<CustomerAgingResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = asOfDate ? `?asOfDate=${asOfDate}` : "";
      const [summaryData, vendorData, customerData] = await Promise.all([
        api<AgingSummaryResult>(`/api/aging-reports/summary${params}`),
        api<VendorAgingResult>(`/api/aging-reports/vendors${params}`),
        api<CustomerAgingResult>(`/api/aging-reports/customers${params}`),
      ]);
      setSummary(summaryData);
      setVendorAging(vendorData);
      setCustomerAging(customerData);
    } catch {
      toast.error("Failed to load aging reports");
    } finally {
      setIsLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportVendorCsv = () => {
    if (!vendorAging) return;
    const headers = ["Vendor", "Code", "Invoices", "Current", "1-30", "31-60", "61-90", "90+", "Total"];
    const rows = vendorAging.vendors.map((v) => [
      `"${v.vendorName}"`, v.vendorCode, String(v.invoiceCount),
      v.current.toFixed(2), v.days1To30.toFixed(2), v.days31To60.toFixed(2),
      v.days61To90.toFixed(2), v.days90Plus.toFixed(2), v.total.toFixed(2),
    ]);
    downloadCsv(`vendor-aging-${vendorAging.asOfDate}.csv`, headers, rows);
  };

  const exportCustomerCsv = () => {
    if (!customerAging) return;
    const headers = ["Project", "Number", "Applications", "Current", "1-30", "31-60", "61-90", "90+", "Total"];
    const rows = customerAging.projects.map((p) => [
      `"${p.projectName}"`, p.projectNumber, String(p.applicationCount),
      p.current.toFixed(2), p.days1To30.toFixed(2), p.days31To60.toFixed(2),
      p.days61To90.toFixed(2), p.days90Plus.toFixed(2), p.total.toFixed(2),
    ]);
    downloadCsv(`customer-aging-${customerAging.asOfDate}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aging Reports</h1>
          <p className="text-muted-foreground">
            AP/AR aging analysis{summary ? ` as of ${summary.asOfDate}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

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
      ) : summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Accounts Payable
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.accountsPayable.total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(summary.accountsPayable.days90Plus)} over 90 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Accounts Receivable
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.accountsReceivable.total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(summary.accountsReceivable.days90Plus)} over 90 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Net Position
              </CardTitle>
              <Scale className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  summary.netPosition >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(summary.netPosition)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                AR minus AP
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Vendor Aging (AP) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vendor Aging (Accounts Payable)</h2>
          <Button variant="outline" size="sm" onClick={exportVendorCsv} disabled={!vendorAging?.vendors.length}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
        {isLoading ? (
          <AgingTableSkeleton />
        ) : vendorAging && vendorAging.vendors.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30</TableHead>
                    <TableHead className="text-right">31-60</TableHead>
                    <TableHead className="text-right">61-90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorAging.vendors.map((v) => (
                    <TableRow key={v.vendorId}>
                      <TableCell>
                        <div className="font-medium">{v.vendorName}</div>
                        <div className="text-xs text-muted-foreground">
                          {v.vendorCode} &middot; {v.invoiceCount} invoice{v.invoiceCount !== 1 ? "s" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(v.current)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(v.days1To30)}</TableCell>
                      <TableCell className={`text-right ${agingCellClass("days31To60", v.days31To60)}`}>
                        {formatCurrency(v.days31To60)}
                      </TableCell>
                      <TableCell className={`text-right ${agingCellClass("days61To90", v.days61To90)}`}>
                        {formatCurrency(v.days61To90)}
                      </TableCell>
                      <TableCell className={`text-right ${agingCellClass("days90Plus", v.days90Plus)}`}>
                        {formatCurrency(v.days90Plus)}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(v.total)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Summary row */}
                  <TableRow className="border-t-2 bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(vendorAging.summary.current)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vendorAging.summary.days1To30)}</TableCell>
                    <TableCell className={`text-right ${agingCellClass("days31To60", vendorAging.summary.days31To60)}`}>
                      {formatCurrency(vendorAging.summary.days31To60)}
                    </TableCell>
                    <TableCell className={`text-right ${agingCellClass("days61To90", vendorAging.summary.days61To90)}`}>
                      {formatCurrency(vendorAging.summary.days61To90)}
                    </TableCell>
                    <TableCell className={`text-right ${agingCellClass("days90Plus", vendorAging.summary.days90Plus)}`}>
                      {formatCurrency(vendorAging.summary.days90Plus)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(vendorAging.summary.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No outstanding vendor invoices.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Aging (AR) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Customer Aging (Accounts Receivable)</h2>
          <Button variant="outline" size="sm" onClick={exportCustomerCsv} disabled={!customerAging?.projects.length}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
        {isLoading ? (
          <AgingTableSkeleton />
        ) : customerAging && customerAging.projects.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30</TableHead>
                    <TableHead className="text-right">31-60</TableHead>
                    <TableHead className="text-right">61-90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerAging.projects.map((p) => (
                    <TableRow key={p.projectId}>
                      <TableCell>
                        <div className="font-medium">{p.projectName}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.projectNumber} &middot; {p.applicationCount} app{p.applicationCount !== 1 ? "s" : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(p.current)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.days1To30)}</TableCell>
                      <TableCell className={`text-right ${agingCellClass("days31To60", p.days31To60)}`}>
                        {formatCurrency(p.days31To60)}
                      </TableCell>
                      <TableCell className={`text-right ${agingCellClass("days61To90", p.days61To90)}`}>
                        {formatCurrency(p.days61To90)}
                      </TableCell>
                      <TableCell className={`text-right ${agingCellClass("days90Plus", p.days90Plus)}`}>
                        {formatCurrency(p.days90Plus)}
                      </TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Summary row */}
                  <TableRow className="border-t-2 bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(customerAging.summary.current)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(customerAging.summary.days1To30)}</TableCell>
                    <TableCell className={`text-right ${agingCellClass("days31To60", customerAging.summary.days31To60)}`}>
                      {formatCurrency(customerAging.summary.days31To60)}
                    </TableCell>
                    <TableCell className={`text-right ${agingCellClass("days61To90", customerAging.summary.days61To90)}`}>
                      {formatCurrency(customerAging.summary.days61To90)}
                    </TableCell>
                    <TableCell className={`text-right ${agingCellClass("days90Plus", customerAging.summary.days90Plus)}`}>
                      {formatCurrency(customerAging.summary.days90Plus)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(customerAging.summary.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No outstanding billing applications.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AgingTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1-30</TableHead>
              <TableHead className="text-right">31-60</TableHead>
              <TableHead className="text-right">61-90</TableHead>
              <TableHead className="text-right">90+</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
