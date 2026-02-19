"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import api from "@/lib/api";
import {
  getLaborCostReport,
  type LaborCostReportResponse,
  type LaborGroupBy,
} from "@/lib/reports-api";
import { toast } from "sonner";
import { csvRow, downloadCsvFile } from "@/lib/csv-utils";

interface ProjectOption {
  id: string;
  name: string;
  number: string;
}

const ALL_PROJECTS = "__all__";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatHours(value: number) {
  return value.toFixed(2);
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function minusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export default function LaborCostReportPage() {
  const [report, setReport] = useState<LaborCostReportResponse | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [from, setFrom] = useState(minusDaysIso(29));
  const [to, setTo] = useState(todayIso());
  const [projectId, setProjectId] = useState(ALL_PROJECTS);
  const [groupBy, setGroupBy] = useState<LaborGroupBy>("employee");

  const fetchProjects = useCallback(async () => {
    try {
      const result = await api<{ items: ProjectOption[] }>("/api/projects?pageSize=200");
      setProjects(result.items);
    } catch {
      setProjects([]);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getLaborCostReport({
        from,
        to,
        groupBy,
        projectId: projectId !== ALL_PROJECTS ? projectId : undefined,
      });
      setReport(result);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load labor cost report");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, groupBy, projectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const groupByLabel = useMemo(() => {
    if (groupBy === "costCode") return "Cost Code";
    if (groupBy === "phase") return "Phase";
    return "Employee";
  }, [groupBy]);

  const exportCsv = () => {
    if (!report) return;

    const rows = [
      csvRow([groupByLabel, "Total Hours", "Regular Hours", "Overtime Hours", "Total Cost"]),
      ...report.rows.map((row) => csvRow([
        row.groupLabel, row.totalHours.toFixed(2), row.regularHours.toFixed(2),
        row.overtimeHours.toFixed(2), row.totalCost.toFixed(2),
      ])),
      csvRow([
        "TOTAL", report.totals.totalHours.toFixed(2), report.totals.regularHours.toFixed(2),
        report.totals.overtimeHours.toFixed(2), report.totals.totalCost.toFixed(2),
      ]),
    ];

    downloadCsvFile(rows, `labor-cost-${from}-to-${to}.csv`);
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Labor Cost" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Labor Cost Report</h1>
          <p className="text-muted-foreground">Real-time labor cost aggregation by employee, cost code, or phase.</p>
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
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.number} - {project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Group By</Label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as LaborGroupBy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="costCode">Cost Code</SelectItem>
                <SelectItem value="phase">Phase</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Labor Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton headers={[groupByLabel, "Hours", "Regular", "Overtime", "Cost"]} rows={8} />
          ) : !report || report.rows.length === 0 ? (
            <EmptyState title="No data found" description="Try adjusting the date range or project filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupByLabel}</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Regular Hours</TableHead>
                  <TableHead className="text-right">Overtime Hours</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.groupKey}>
                    <TableCell className="font-medium">{row.groupLabel}</TableCell>
                    <TableCell className="text-right">{formatHours(row.totalHours)}</TableCell>
                    <TableCell className="text-right">{formatHours(row.regularHours)}</TableCell>
                    <TableCell className="text-right">{formatHours(row.overtimeHours)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.totalCost)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatHours(report.totals.totalHours)}</TableCell>
                  <TableCell className="text-right">{formatHours(report.totals.regularHours)}</TableCell>
                  <TableCell className="text-right">{formatHours(report.totals.overtimeHours)}</TableCell>
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
