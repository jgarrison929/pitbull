"use client";

import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { RefreshCw } from "lucide-react";
import { getEquipmentUtilizationReport, type EquipmentUtilizationReportResponse } from "@/lib/reports-api";
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

export default function EquipmentUtilizationReportPage() {
  const [report, setReport] = useState<EquipmentUtilizationReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [from, setFrom] = useState(minusDaysIso(29));
  const [to, setTo] = useState(todayIso());

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getEquipmentUtilizationReport({ from, to });
      setReport(result);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load equipment utilization report");
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Equipment Utilization" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipment Utilization</h1>
          <p className="text-muted-foreground">Usage and utilization rates by equipment.</p>
        </div>
        <Button variant="outline" onClick={fetchReport}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
          <CardTitle>Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton headers={["Equipment", "Hours", "Days", "Utilization", "Cost"]} rows={10} />
          ) : !report || report.rows.length === 0 ? (
            <EmptyState title="No equipment data" description="No utilization records in this date range." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="text-right">Hours Used</TableHead>
                  <TableHead className="text-right">Days Assigned</TableHead>
                  <TableHead>Utilization %</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.equipmentId}>
                    <TableCell>
                      <div className="font-medium">{row.equipmentCode}</div>
                      <div className="text-xs text-muted-foreground">{row.equipmentName} ({row.equipmentType})</div>
                    </TableCell>
                    <TableCell className="text-right">{row.totalHoursUsed.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.daysAssigned}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={Math.min(Math.max(row.utilizationPercent, 0), 100)} />
                        <div className="text-xs text-muted-foreground">{row.utilizationPercent.toFixed(1)}%</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.cost)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{report.totals.totalHoursUsed.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{report.totals.totalDaysAssigned}</TableCell>
                  <TableCell>{report.totals.averageUtilizationPercent.toFixed(1)}% avg</TableCell>
                  <TableCell className="text-right">{formatCurrency(report.totals.totalCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
