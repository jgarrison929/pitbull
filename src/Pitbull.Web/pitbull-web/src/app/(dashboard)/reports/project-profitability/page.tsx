"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Download, RefreshCw } from "lucide-react";
import { getProjectProfitabilityReport, type ProjectProfitabilityReportResponse } from "@/lib/reports-api";
import { csvRow, downloadCsvFile } from "@/lib/csv-utils";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function minusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export default function ProjectProfitabilityPage() {
  const [report, setReport] = useState<ProjectProfitabilityReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [from, setFrom] = useState(minusDaysIso(29));
  const [to, setTo] = useState(todayIso());

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getProjectProfitabilityReport({ from, to });
      setReport(result);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load project profitability report");
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      csvRow(["Project #", "Project Name", "Budget", "Labor", "Equipment", "Actual Cost", "Profit", "Margin %"]),
      ...report.rows.map((row) => csvRow([
        row.projectNumber, row.projectName, row.budget.toFixed(2),
        row.laborCost.toFixed(2), row.equipmentCost.toFixed(2),
        row.actualCost.toFixed(2), row.profit.toFixed(2),
        row.profitMarginPercent.toFixed(1),
      ])),
      csvRow([
        "", "TOTAL", report.totals.budget.toFixed(2), report.totals.laborCost.toFixed(2),
        report.totals.equipmentCost.toFixed(2), report.totals.actualCost.toFixed(2),
        report.totals.profit.toFixed(2), report.totals.profitMarginPercent.toFixed(1),
      ]),
    ];
    downloadCsvFile(rows, `project-profitability-${from}-to-${to}.csv`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Project Profitability" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Profitability</h1>
          <p className="text-muted-foreground">Budget vs actual cost with margin ranking (worst first).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!report || report.rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={fetchReport}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profitability Table</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton headers={["Project", "Budget", "Actual Cost", "Profit", "Margin"]} rows={10} />
          ) : !report || report.rows.length === 0 ? (
            <EmptyState title="No data for this period" description="Try adjusting the date range." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Equipment</TableHead>
                  <TableHead className="text-right">Actual Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => {
                  const isNegative = row.profitMarginPercent < 0;
                  const isGreat = row.profitMarginPercent > 20;

                  return (
                    <TableRow key={row.projectId}>
                      <TableCell>
                        <div className="font-medium">{row.projectNumber}</div>
                        <div className="text-xs text-muted-foreground">{row.projectName}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.budget)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.laborCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.equipmentCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.actualCost)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.profit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatCurrency(row.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={isNegative ? "bg-red-100 text-red-700" : isGreat ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}
                        >
                          {row.profitMarginPercent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.budget)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.laborCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.equipmentCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.actualCost)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.profit)}</TableCell>
                  <TableCell className="text-right">{report.totals.profitMarginPercent.toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
