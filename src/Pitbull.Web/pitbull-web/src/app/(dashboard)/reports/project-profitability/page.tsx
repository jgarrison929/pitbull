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
  TrendingDown,
  Building2,
  RefreshCw,
  Download,
  Printer,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Project, Subcontract } from "@/lib/types";
import { toast } from "sonner";

interface LaborCostSummary {
  totalHours: number;
  totalCost: number;
}

interface ProjectCostSummary {
  projectId: string;
  projectName: string;
  projectNumber: string | null;
  cost: LaborCostSummary;
}

interface CostReportResponse {
  byProject: ProjectCostSummary[];
}

interface ProjectProfitability {
  projectId: string;
  projectName: string;
  projectNumber: string;
  status: number;
  contractAmount: number;
  laborCost: number;
  laborHours: number;
  equipmentCost: number;
  subcontractCost: number;
  totalCost: number;
  grossProfit: number;
  marginPercent: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const statusLabels: Record<number, string> = {
  0: "Bidding",
  1: "Active",
  2: "On Hold",
  3: "Completed",
};

const statusColors: Record<number, string> = {
  0: "bg-blue-100 text-blue-700",
  1: "bg-green-100 text-green-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-neutral-100 text-neutral-600",
};

export default function ProjectProfitabilityPage() {
  const [profitData, setProfitData] = useState<ProjectProfitability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectsRes, costRes, subsRes] = await Promise.all([
        api<PagedResult<Project>>("/api/projects?pageSize=200"),
        api<CostReportResponse>("/api/time-entries/cost-report?approvedOnly=false"),
        api<PagedResult<Subcontract>>("/api/subcontracts?pageSize=500"),
      ]);

      // Build labor cost map by project
      const laborMap = new Map<string, { cost: number; hours: number }>();
      for (const p of costRes.byProject) {
        laborMap.set(p.projectId, {
          cost: p.cost.totalCost,
          hours: p.cost.totalHours,
        });
      }

      // Build subcontract cost map by project
      const subMap = new Map<string, number>();
      for (const sub of subsRes.items) {
        const existing = subMap.get(sub.projectId) ?? 0;
        subMap.set(sub.projectId, existing + sub.currentValue);
      }

      // Build profitability for each project
      const results: ProjectProfitability[] = projectsRes.items
        .filter((p) => p.contractAmount > 0)
        .map((project) => {
          const labor = laborMap.get(project.id) ?? { cost: 0, hours: 0 };
          const subCost = subMap.get(project.id) ?? 0;
          const equipmentCost = 0; // Equipment costs are tracked in labor cost report phases
          const totalCost = labor.cost + subCost + equipmentCost;
          const grossProfit = project.contractAmount - totalCost;
          const marginPercent =
            project.contractAmount > 0
              ? (grossProfit / project.contractAmount) * 100
              : 0;

          return {
            projectId: project.id,
            projectName: project.name,
            projectNumber: project.number,
            status: project.status,
            contractAmount: project.contractAmount,
            laborCost: labor.cost,
            laborHours: labor.hours,
            equipmentCost,
            subcontractCost: subCost,
            totalCost,
            grossProfit,
            marginPercent,
          };
        })
        .sort((a, b) => b.contractAmount - a.contractAmount);

      setProfitData(results);
    } catch {
      toast.error("Failed to load profitability data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Aggregate totals
  const totalContract = profitData.reduce((s, p) => s + p.contractAmount, 0);
  const totalLaborCost = profitData.reduce((s, p) => s + p.laborCost, 0);
  const totalSubCost = profitData.reduce((s, p) => s + p.subcontractCost, 0);
  const totalCost = profitData.reduce((s, p) => s + p.totalCost, 0);
  const totalProfit = totalContract - totalCost;
  const overallMargin = totalContract > 0 ? (totalProfit / totalContract) * 100 : 0;

  const profitableProjects = profitData.filter((p) => p.grossProfit >= 0).length;
  const unprofitableProjects = profitData.filter((p) => p.grossProfit < 0).length;

  const exportCsv = () => {
    const rows = [
      [
        "Project Number",
        "Project Name",
        "Status",
        "Contract Amount",
        "Labor Cost",
        "Subcontract Cost",
        "Total Cost",
        "Gross Profit",
        "Margin %",
      ].join(","),
    ];

    for (const p of profitData) {
      rows.push(
        [
          p.projectNumber,
          `"${p.projectName}"`,
          statusLabels[p.status] ?? "Unknown",
          p.contractAmount.toFixed(2),
          p.laborCost.toFixed(2),
          p.subcontractCost.toFixed(2),
          p.totalCost.toFixed(2),
          p.grossProfit.toFixed(2),
          p.marginPercent.toFixed(1),
        ].join(",")
      );
    }

    rows.push(
      [
        "",
        "GRAND TOTAL",
        "",
        totalContract.toFixed(2),
        totalLaborCost.toFixed(2),
        totalSubCost.toFixed(2),
        totalCost.toFixed(2),
        totalProfit.toFixed(2),
        overallMargin.toFixed(1),
      ].join(",")
    );

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-profitability-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports/labor-cost" },
          { label: "Project Profitability" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Profitability</h1>
          <p className="text-muted-foreground">
            Revenue vs cost analysis across all projects
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
            disabled={isLoading || profitData.length === 0}
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

      {/* Summary Cards */}
      {!isLoading && profitData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contract Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalContract)}</div>
              <p className="text-xs text-muted-foreground">
                across {profitData.length} projects
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalLaborCost)} labor + {formatCurrency(totalSubCost)} subs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              {totalProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(totalProfit)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPercent(overallMargin)} overall margin
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projects</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitData.length}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{profitableProjects} profitable</span>
                {unprofitableProjects > 0 && (
                  <span className="text-red-600"> &middot; {unprofitableProjects} over budget</span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profitability Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Financial Summary</CardTitle>
          <CardDescription>
            Contract value, costs, and profit margin per project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block">
            {isLoading ? (
              <TableSkeleton
                headers={[
                  "Project",
                  "Status",
                  "Contract",
                  "Labor",
                  "Subcontracts",
                  "Total Cost",
                  "Gross Profit",
                  "Margin",
                ]}
                rows={5}
              />
            ) : profitData.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No project data found"
                description="No projects with contract amounts exist."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Contract</TableHead>
                      <TableHead className="text-right">Labor Cost</TableHead>
                      <TableHead className="text-right">Subcontracts</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">Gross Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profitData.map((p) => (
                      <TableRow key={p.projectId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{p.projectName}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {p.projectNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusColors[p.status] ?? ""}
                          >
                            {statusLabels[p.status] ?? "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(p.contractAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(p.laborCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(p.subcontractCost)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(p.totalCost)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-semibold ${
                            p.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(p.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              p.marginPercent >= 20
                                ? "bg-green-100 text-green-700"
                                : p.marginPercent >= 10
                                ? "bg-blue-100 text-blue-700"
                                : p.marginPercent >= 0
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {formatPercent(p.marginPercent)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>Grand Total ({profitData.length} projects)</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalContract)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalLaborCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalSubCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalCost)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          totalProfit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(totalProfit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(overallMargin)}
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
            ) : profitData.length === 0 ? (
              <EmptyState
                icon={AlertCircle}
                title="No project data found"
                description="No projects with contract amounts exist."
              />
            ) : (
              <div className="space-y-4">
                {/* Mobile Total */}
                <Card className="bg-primary text-primary-foreground">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Portfolio Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatCurrency(totalProfit)}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-sm opacity-90">
                      <div>
                        <div className="font-medium">{formatCurrency(totalContract)}</div>
                        <div className="text-xs">contract</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatCurrency(totalCost)}</div>
                        <div className="text-xs">cost</div>
                      </div>
                      <div>
                        <div className="font-medium">{formatPercent(overallMargin)}</div>
                        <div className="text-xs">margin</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Per-project cards */}
                {profitData.map((p) => (
                  <Card key={p.projectId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1 font-mono">
                            {p.projectNumber}
                          </Badge>
                          <CardTitle className="text-base">
                            {p.projectName}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            p.marginPercent >= 20
                              ? "bg-green-100 text-green-700"
                              : p.marginPercent >= 0
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {formatPercent(p.marginPercent)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Contract</p>
                          <p className="font-mono font-medium">{formatCurrency(p.contractAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Cost</p>
                          <p className="font-mono">{formatCurrency(p.totalCost)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Gross Profit</p>
                          <p
                            className={`font-mono font-medium ${
                              p.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {formatCurrency(p.grossProfit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge
                            variant="secondary"
                            className={statusColors[p.status] ?? ""}
                          >
                            {statusLabels[p.status] ?? "Unknown"}
                          </Badge>
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
        Report generated at {new Date().toLocaleString()} • All time entries included
      </div>
    </div>
  );
}
