"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Wrench,
  Clock,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Download,
  TrendingUp,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import type { Equipment, TimeEntry, Project } from "@/lib/types";

const ALL_VALUE = "__all__";

interface EquipmentUsageSummary {
  equipment: Equipment;
  totalHours: number;
  internalCost: number;
  billingRevenue: number;
  margin: number;
  projectBreakdown: {
    projectId: string;
    projectName: string;
    projectNumber: string;
    hours: number;
  }[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

function getDatePreset(preset: string): { start: string; end: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "this-week": {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      return { start: formatDate(start), end: formatDate(today) };
    }
    case "last-week": {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: formatDate(start), end: formatDate(end) };
    }
    case "this-month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDate(start), end: formatDate(today) };
    }
    case "last-month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end) };
    }
    case "ytd": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: formatDate(start), end: formatDate(today) };
    }
    default:
      return { start: "", end: "" };
  }
}

export default function EquipmentUtilizationReportPage() {
  const [summaries, setSummaries] = useState<EquipmentUsageSummary[]>([]);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState<string>("this-month");
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateRange = getDatePreset(datePreset);
      const params = new URLSearchParams();
      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);
      if (projectFilter !== ALL_VALUE) params.set("projectId", projectFilter);
      params.set("pageSize", "1000");

      const [equipmentResult, entriesResult, projectsResult] = await Promise.all([
        api<{ items: Equipment[] }>("/api/equipment?pageSize=200"),
        api<{ items: TimeEntry[] }>(`/api/time-entries?${params.toString()}`),
        api<{ items: Project[] }>("/api/projects?pageSize=100"),
      ]);

      setAllEquipment(equipmentResult.items);
      setProjects(projectsResult.items);

      // Build usage map per equipment
      const usageMap = new Map<
        string,
        {
          hours: number;
          projects: Map<string, { projectId: string; projectName: string; projectNumber: string; hours: number }>;
        }
      >();

      for (const entry of entriesResult.items) {
        if (!entry.equipmentId || entry.equipmentHours <= 0) continue;

        if (!usageMap.has(entry.equipmentId)) {
          usageMap.set(entry.equipmentId, { hours: 0, projects: new Map() });
        }
        const record = usageMap.get(entry.equipmentId)!;
        record.hours += entry.equipmentHours;

        if (!record.projects.has(entry.projectId)) {
          record.projects.set(entry.projectId, {
            projectId: entry.projectId,
            projectName: entry.projectName,
            projectNumber: entry.projectNumber,
            hours: 0,
          });
        }
        record.projects.get(entry.projectId)!.hours += entry.equipmentHours;
      }

      // Build summaries for ALL equipment (to identify idle ones too)
      const results: EquipmentUsageSummary[] = equipmentResult.items.map((equip) => {
        const usage = usageMap.get(equip.id);
        const totalHours = usage?.hours ?? 0;
        const internalCost = totalHours * equip.hourlyRate;
        const billingRevenue = totalHours * (equip.billingRate ?? equip.hourlyRate);
        const margin = billingRevenue - internalCost;

        const projectBreakdown = usage
          ? Array.from(usage.projects.values()).sort((a, b) => b.hours - a.hours)
          : [];

        return {
          equipment: equip,
          totalHours,
          internalCost,
          billingRevenue,
          margin,
          projectBreakdown,
        };
      });

      // Sort: used equipment first (by hours desc), then idle ones
      results.sort((a, b) => b.totalHours - a.totalHours);
      setSummaries(results);
    } catch {
      toast.error("Failed to load equipment utilization data");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, projectFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalHours = summaries.reduce((sum, s) => sum + s.totalHours, 0);
  const totalInternalCost = summaries.reduce((sum, s) => sum + s.internalCost, 0);
  const totalBillingRevenue = summaries.reduce((sum, s) => sum + s.billingRevenue, 0);
  const totalMargin = totalBillingRevenue - totalInternalCost;
  const activeEquipment = summaries.filter((s) => s.totalHours > 0);
  const idleEquipment = summaries.filter(
    (s) => s.totalHours === 0 && s.equipment.isActive
  );

  const exportCsv = () => {
    const rows = [
      [
        "Equipment Code",
        "Equipment Name",
        "Type",
        "Hours",
        "Hourly Rate",
        "Billing Rate",
        "Internal Cost",
        "Billing Revenue",
        "Margin",
        "Status",
      ].join(","),
    ];

    for (const s of summaries) {
      rows.push(
        [
          s.equipment.code,
          `"${s.equipment.name}"`,
          s.equipment.typeName,
          s.totalHours.toFixed(1),
          s.equipment.hourlyRate.toFixed(2),
          (s.equipment.billingRate ?? s.equipment.hourlyRate).toFixed(2),
          s.internalCost.toFixed(2),
          s.billingRevenue.toFixed(2),
          s.margin.toFixed(2),
          s.totalHours > 0 ? "Used" : s.equipment.isActive ? "Idle" : "Inactive",
        ].join(",")
      );
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipment-utilization-${getDatePreset(datePreset).start}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports/labor-cost" },
          { label: "Equipment Utilization" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipment Utilization</h1>
          <p className="text-muted-foreground">
            Equipment usage, costs, and billing analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={isLoading}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              {activeEquipment.length} equipment used
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Internal Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalInternalCost)}</div>
            <p className="text-xs text-muted-foreground">
              at internal hourly rates
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billing Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalBillingRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">at billing rates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalMargin >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {formatCurrency(totalMargin)}
            </div>
            <p className="text-xs text-muted-foreground">
              billing minus internal cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="datePreset">Date Range</Label>
              <Select value={datePreset} onValueChange={setDatePreset}>
                <SelectTrigger id="datePreset">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Idle Equipment Alert */}
      {!isLoading && idleEquipment.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {idleEquipment.length} idle equipment{" "}
                  {idleEquipment.length === 1 ? "item" : "items"}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {idleEquipment.map((s) => s.equipment.name).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipment Table (Desktop) */}
      <div className="hidden md:block">
        {isLoading ? (
          <TableSkeleton
            headers={[
              "Equipment",
              "Type",
              "Hours",
              "Rate",
              "Billing Rate",
              "Internal Cost",
              "Billing Revenue",
              "Margin",
            ]}
            rows={6}
          />
        ) : summaries.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No equipment found"
            description="Add equipment to start tracking utilization."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Equipment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Internal Rate</TableHead>
                  <TableHead className="text-right">Billing Rate</TableHead>
                  <TableHead className="text-right">Internal Cost</TableHead>
                  <TableHead className="text-right">Billing Revenue</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow
                    key={s.equipment.id}
                    className={s.totalHours === 0 ? "opacity-50" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="font-medium">{s.equipment.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {s.equipment.code}
                          </div>
                        </div>
                        {s.totalHours === 0 && s.equipment.isActive && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-600 border-amber-300"
                          >
                            Idle
                          </Badge>
                        )}
                        {!s.equipment.isActive && (
                          <Badge variant="outline" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{s.equipment.typeName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatHours(s.totalHours)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${s.equipment.hourlyRate.toFixed(2)}/hr
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${(s.equipment.billingRate ?? s.equipment.hourlyRate).toFixed(2)}/hr
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(s.internalCost)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(s.billingRevenue)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${s.margin >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(s.margin)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted font-semibold">
                  <TableCell>
                    Grand Total ({allEquipment.length} equipment)
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatHours(totalHours)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">
                    {formatCurrency(totalInternalCost)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(totalBillingRevenue)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${totalMargin >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(totalMargin)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {isLoading ? (
          <CardListSkeleton rows={5} />
        ) : summaries.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No equipment found"
            description="Add equipment to start tracking utilization."
          />
        ) : (
          <div className="space-y-3">
            {/* Mobile Total */}
            <Card className="bg-primary text-primary-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Grand Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatHours(totalHours)} hrs</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm opacity-90">
                  <div>
                    <div className="font-medium">{formatCurrency(totalInternalCost)}</div>
                    <div className="text-xs">cost</div>
                  </div>
                  <div>
                    <div className="font-medium">{formatCurrency(totalBillingRevenue)}</div>
                    <div className="text-xs">revenue</div>
                  </div>
                  <div>
                    <div className="font-medium">{formatCurrency(totalMargin)}</div>
                    <div className="text-xs">margin</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment Cards */}
            {summaries
              .filter((s) => s.totalHours > 0 || s.equipment.isActive)
              .map((s) => (
                <Card key={s.equipment.id} className={s.totalHours === 0 ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="mb-1 text-xs font-mono">
                          {s.equipment.code}
                        </Badge>
                        <CardTitle className="text-base">{s.equipment.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{s.equipment.typeName}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatHours(s.totalHours)} hrs
                        </div>
                        {s.totalHours === 0 && s.equipment.isActive && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-600 border-amber-300"
                          >
                            Idle
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {s.totalHours > 0 && (
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Cost</p>
                          <p className="font-medium">{formatCurrency(s.internalCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(s.billingRevenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Margin</p>
                          <p
                            className={`font-medium ${s.margin >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(s.margin)}
                          </p>
                        </div>
                      </div>
                      {s.projectBreakdown.length > 0 && (
                        <div className="mt-3 pt-3 border-t space-y-1">
                          {s.projectBreakdown.slice(0, 3).map((p) => (
                            <div
                              key={p.projectId}
                              className="flex justify-between text-xs"
                            >
                              <span className="text-muted-foreground truncate">
                                {p.projectNumber} — {p.projectName}
                              </span>
                              <span className="font-medium shrink-0 ml-2">
                                {formatHours(p.hours)}h
                              </span>
                            </div>
                          ))}
                          {s.projectBreakdown.length > 3 && (
                            <p className="text-[10px] text-muted-foreground text-center">
                              +{s.projectBreakdown.length - 3} more projects
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
