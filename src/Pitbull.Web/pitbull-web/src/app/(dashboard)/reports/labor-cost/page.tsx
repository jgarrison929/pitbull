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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DollarSign,
  Clock,
  Building2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

interface LaborCostSummary {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  baseWageCost: number;
  burdenCost: number;
  totalCost: number;
  burdenRateApplied: number;
}

interface CostCodeCostSummary {
  costCodeId: string;
  costCodeNumber: string;
  costCodeName: string;
  cost: LaborCostSummary;
}

interface ProjectCostSummary {
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  cost: LaborCostSummary;
  byCostCode: CostCodeCostSummary[];
}

interface LaborCostReportResponse {
  generatedAt: string;
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
  approvedOnly: boolean;
  totalCost: LaborCostSummary;
  byProject: ProjectCostSummary[];
}

interface Project {
  id: string;
  name: string;
  number: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

// Get date presets
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

export default function LaborCostReportPage() {
  const [report, setReport] = useState<LaborCostReportResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [datePreset, setDatePreset] = useState<string>("this-month");
  const [approvedOnly, setApprovedOnly] = useState<string>("true");

  const fetchProjects = useCallback(async () => {
    try {
      const result = await api<{ items: Project[] }>("/api/projects?pageSize=100");
      setProjects(result.items);
    } catch {
      // Silently handle - projects dropdown will be empty
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const dateRange = getDatePreset(datePreset);

      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);
      if (projectFilter !== ALL_VALUE) params.set("projectId", projectFilter);
      params.set("approvedOnly", approvedOnly);

      const result = await api<LaborCostReportResponse>(
        `/api/time-entries/cost-report?${params.toString()}`
      );
      setReport(result);
    } catch {
      toast.error("Failed to load labor cost report");
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter, datePreset, approvedOnly]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (report) {
      setExpandedProjects(new Set(report.byProject.map((p) => p.projectId)));
    }
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Labor Cost Report</h1>
          <p className="text-muted-foreground">
            Job cost analysis by project and cost code
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchReport}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(report.totalCost.totalCost)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(report.totalCost.baseWageCost)} wages +{" "}
                {formatCurrency(report.totalCost.burdenCost)} burden
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatHours(report.totalCost.totalHours)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatHours(report.totalCost.regularHours)} reg /{" "}
                {formatHours(report.totalCost.overtimeHours)} OT /{" "}
                {formatHours(report.totalCost.doubletimeHours)} DT
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report.byProject.length}</div>
              <p className="text-xs text-muted-foreground">
                with labor entries
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Burden Rate</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPercent(report.totalCost.burdenRateApplied)}
              </div>
              <p className="text-xs text-muted-foreground">
                applied to base wages
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
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
            <div className="space-y-2">
              <Label htmlFor="approvedOnly">Status</Label>
              <Select value={approvedOnly} onValueChange={setApprovedOnly}>
                <SelectTrigger id="approvedOnly">
                  <SelectValue placeholder="Approved only" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Approved Only</SelectItem>
                  <SelectItem value="false">All Entries</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      <div className="space-y-4">
        {/* Expand/Collapse controls */}
        {report && report.byProject.length > 0 && (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block">
          {isLoading ? (
            <TableSkeleton
              headers={[
                "Project",
                "Hours",
                "Regular",
                "OT",
                "DT",
                "Base Wages",
                "Burden",
                "Total Cost",
              ]}
              rows={5}
            />
          ) : !report || report.byProject.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No labor data found"
              description="No approved time entries exist for the selected period and filters."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Project / Cost Code</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Regular</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">DT</TableHead>
                    <TableHead className="text-right">Base Wages</TableHead>
                    <TableHead className="text-right">Burden</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byProject.map((project) => {
                    const isExpanded = expandedProjects.has(project.projectId);
                    return (
                      <Collapsible
                        key={project.projectId}
                        open={isExpanded}
                        asChild
                      >
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleProject(project.projectId)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <div>
                                    <div className="font-semibold">
                                      {project.projectNumber && (
                                        <span className="text-muted-foreground">
                                          {project.projectNumber} -{" "}
                                        </span>
                                      )}
                                      {project.projectName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {project.byCostCode.length} cost codes
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatHours(project.cost.totalHours)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatHours(project.cost.regularHours)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatHours(project.cost.overtimeHours)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatHours(project.cost.doubletimeHours)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(project.cost.baseWageCost)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(project.cost.burdenCost)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(project.cost.totalCost)}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <>
                              {project.byCostCode.map((cc) => (
                                <TableRow
                                  key={cc.costCodeId}
                                  className="bg-muted/30"
                                >
                                  <TableCell className="pl-10">
                                    <span className="font-mono text-sm">
                                      {cc.costCodeNumber}
                                    </span>
                                    <span className="ml-2 text-muted-foreground">
                                      {cc.costCodeName}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatHours(cc.cost.totalHours)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatHours(cc.cost.regularHours)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatHours(cc.cost.overtimeHours)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatHours(cc.cost.doubletimeHours)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatCurrency(cc.cost.baseWageCost)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatCurrency(cc.cost.burdenCost)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(cc.cost.totalCost)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted font-semibold">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-right">
                      {formatHours(report.totalCost.totalHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(report.totalCost.regularHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(report.totalCost.overtimeHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatHours(report.totalCost.doubletimeHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totalCost.baseWageCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totalCost.burdenCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.totalCost.totalCost)}
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
          ) : !report || report.byProject.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No labor data found"
              description="No approved time entries exist for the selected period."
            />
          ) : (
            <div className="space-y-4">
              {/* Mobile Total Card */}
              <Card className="bg-primary text-primary-foreground">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Grand Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatCurrency(report.totalCost.totalCost)}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm opacity-90">
                    <div>
                      <div className="font-medium">
                        {formatHours(report.totalCost.totalHours)}
                      </div>
                      <div className="text-xs">hours</div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {formatCurrency(report.totalCost.baseWageCost)}
                      </div>
                      <div className="text-xs">wages</div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {formatCurrency(report.totalCost.burdenCost)}
                      </div>
                      <div className="text-xs">burden</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Project Cards */}
              {report.byProject.map((project) => (
                <Card key={project.projectId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        {project.projectNumber && (
                          <Badge variant="outline" className="mb-1">
                            {project.projectNumber}
                          </Badge>
                        )}
                        <CardTitle className="text-base">
                          {project.projectName}
                        </CardTitle>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatCurrency(project.cost.totalCost)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatHours(project.cost.totalHours)} hrs
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {project.byCostCode.slice(0, 3).map((cc) => (
                        <div
                          key={cc.costCodeId}
                          className="flex items-center justify-between text-sm"
                        >
                          <div>
                            <span className="font-mono">{cc.costCodeNumber}</span>
                            <span className="ml-2 text-muted-foreground">
                              {cc.costCodeName}
                            </span>
                          </div>
                          <div className="font-medium">
                            {formatCurrency(cc.cost.totalCost)}
                          </div>
                        </div>
                      ))}
                      {project.byCostCode.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center pt-2">
                          +{project.byCostCode.length - 3} more cost codes
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report metadata */}
      {report && (
        <div className="text-sm text-muted-foreground text-center">
          Report generated at {new Date(report.generatedAt).toLocaleString()} •{" "}
          {report.approvedOnly ? "Approved entries only" : "All entries"}
        </div>
      )}
    </div>
  );
}
