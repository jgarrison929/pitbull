"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, BarChart2, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import api from "@/lib/api";
import type { CostCode, ListCostCodesResult } from "@/lib/types";
import type { PmEntityDto } from "@/lib/pm-types";
import {
  getEarnedValueSummary,
  getEarnedValueSnapshots,
  recalculateEarnedValue,
} from "@/lib/progress-api";
import { cn } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function d(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isNaN(n) ? 0 : n; }
  return 0;
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
  }).format(v);
}
function fmtIndex(v: number): string {
  return v.toFixed(3);
}
function indexBadgeClass(val: number): string {
  if (val >= 1.0) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (val >= 0.9) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}
function varianceBadgeClass(val: number): string {
  if (val >= 0) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── EV Summary type (from PmActionResultDto.data) ───────────────────────────

interface EvSummary {
  AsOfDate?: string;
  CostCodeCount?: number;
  TotalBAC?: number;
  TotalBCWS?: number;
  TotalBCWP?: number;
  TotalACWP?: number;
  SPI?: number;
  CPI?: number;
  EAC?: number;
  VAC?: number;
  OverallPercentComplete?: number;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function EarnedValuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [projectName, setProjectName] = useState("Project");
  const [summary, setSummary] = useState<EvSummary | null>(null);
  const [snapshots, setSnapshots] = useState<PmEntityDto[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [asOfDate, setAsOfDate] = useState(todayStr());

  // Selected cost code for drill-down
  const [drilldownId, setDrilldownId] = useState<string | null>(null);

  async function loadData(date: string) {
    try {
      const [summaryResult, snapshotsResult, costCodeData] = await Promise.all([
        getEarnedValueSummary(id, date).catch(() => null),
        getEarnedValueSnapshots(id, { pageSize: 200 }),
        api<ListCostCodesResult>(`/api/cost-codes?pageSize=200`).catch(
          () => ({ items: [] as CostCode[], totalCount: 0, page: 1, pageSize: 200, totalPages: 0 })
        ),
      ]);
      if (summaryResult?.data && typeof summaryResult.data === "object") {
        setSummary(summaryResult.data as EvSummary);
      }
      setSnapshots(snapshotsResult.items);
      setCostCodes(costCodeData.items);
    } catch {
      toast.error("Failed to load earned value data");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const projectData = await api<{ name: string }>(`/api/projects/${id}`).catch(
          () => ({ name: "Project" })
        );
        if (cancelled) return;
        setProjectName(projectData.name);
        await loadData(asOfDate);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await recalculateEarnedValue(id, asOfDate);
      toast.success("Earned value recalculated");
      await loadData(asOfDate);
    } catch {
      toast.error("Failed to recalculate earned value");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleDateChange(date: string) {
    setAsOfDate(date);
    await loadData(date);
  }

  function getCostCodeLabel(costCodeId: unknown): string {
    const ccId = asStr(costCodeId);
    const cc = costCodes.find((c) => c.id === ccId);
    return cc ? `${cc.code} — ${cc.description}` : ccId.slice(0, 8) + "…";
  }

  // Drill-down: snapshots for selected cost code
  const drilldownSnapshots = drilldownId
    ? snapshots.filter((s) => asStr(d(s.data).CostCodeId) === drilldownId)
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: "Projects", href: "/projects" },
          { label: projectName, href: `/projects/${id}` },
          { label: "Earned Value" },
        ]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-14 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const spi = summary?.SPI ?? 0;
  const cpi = summary?.CPI ?? 0;
  const noData = !summary || !summary.TotalBAC;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Projects", href: "/projects" },
        { label: projectName, href: `/projects/${id}` },
        { label: "Earned Value" },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Earned Value Analysis</h1>
          <p className="text-sm text-muted-foreground">
            BCWS · BCWP · ACWP · SPI · CPI — PMBOK standard metrics as of{" "}
            <span className="font-medium">{asOfDate}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${id}/progress`}>
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Field Progress
            </Link>
          </Button>
          <Button
            onClick={handleRecalculate}
            disabled={recalculating}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", recalculating && "animate-spin")} />
            {recalculating ? "Recalculating…" : "Recalculate"}
          </Button>
        </div>
      </div>

      {noData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No earned value data yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Log field progress entries and click Recalculate to generate EV metrics.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild variant="outline">
                <Link href={`/projects/${id}/progress`}>Log Progress</Link>
              </Button>
              <Button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {recalculating ? "Calculating…" : "Calculate Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project-level EV summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">BAC</p>
                <p className="text-xl font-bold font-mono">
                  {fmtCurrency(summary?.TotalBAC ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Budget at Completion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">EAC</p>
                <p className="text-xl font-bold font-mono">
                  {fmtCurrency(summary?.EAC ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Estimate at Completion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ETC</p>
                <p className="text-xl font-bold font-mono">
                  {fmtCurrency(Math.max(0, (summary?.EAC ?? 0) - (summary?.TotalACWP ?? 0)))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Estimate to Complete</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">VAC</p>
                <p className={cn("text-xl font-bold font-mono",
                  (summary?.VAC ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {fmtCurrency(summary?.VAC ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Variance at Completion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SPI</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold font-mono">{fmtIndex(spi)}</p>
                  <Badge className={cn("text-xs", indexBadgeClass(spi))}>
                    {spi >= 1.0 ? (
                      <TrendingUp className="h-3 w-3 mr-1 inline" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1 inline" />
                    )}
                    {spi >= 1.0 ? "On Track" : spi >= 0.9 ? "Warning" : "Behind"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Schedule Performance Index</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CPI</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold font-mono">{fmtIndex(cpi)}</p>
                  <Badge className={cn("text-xs", indexBadgeClass(cpi))}>
                    {cpi >= 1.0 ? (
                      <TrendingUp className="h-3 w-3 mr-1 inline" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1 inline" />
                    )}
                    {cpi >= 1.0 ? "Under Budget" : cpi >= 0.9 ? "Warning" : "Over Budget"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cost Performance Index</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SV ($)</p>
                <p className={cn("text-xl font-bold font-mono",
                  (summary?.TotalBCWP ?? 0) - (summary?.TotalBCWS ?? 0) >= 0
                    ? "text-green-600" : "text-red-600"
                )}>
                  {fmtCurrency((summary?.TotalBCWP ?? 0) - (summary?.TotalBCWS ?? 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Schedule Variance</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CV ($)</p>
                <p className={cn("text-xl font-bold font-mono",
                  (summary?.TotalBCWP ?? 0) - (summary?.TotalACWP ?? 0) >= 0
                    ? "text-green-600" : "text-red-600"
                )}>
                  {fmtCurrency((summary?.TotalBCWP ?? 0) - (summary?.TotalACWP ?? 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cost Variance</p>
              </CardContent>
            </Card>
          </div>

          {/* Per cost-code snapshots table */}
          {snapshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Cost Code Breakdown ({snapshots.length})
                </CardTitle>
                <CardDescription>
                  Click a row to drill down into individual snapshots.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost Code</TableHead>
                        <TableHead className="text-right">BAC</TableHead>
                        <TableHead className="text-right">BCWP</TableHead>
                        <TableHead className="text-right">ACWP</TableHead>
                        <TableHead className="text-center">SPI</TableHead>
                        <TableHead className="text-center">CPI</TableHead>
                        <TableHead className="text-right">EAC</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshots.map((snap) => {
                        const data = d(snap.data);
                        const snapSpi = asNum(data.SPI);
                        const snapCpi = asNum(data.CPI);
                        const ccId = asStr(data.CostCodeId);
                        const isExpanded = drilldownId === ccId;
                        return (
                          <TableRow
                            key={snap.id}
                            className="cursor-pointer"
                            onClick={() => setDrilldownId(isExpanded ? null : ccId)}
                          >
                            <TableCell className="text-sm">
                              {getCostCodeLabel(data.CostCodeId)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.BAC))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.BCWP))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.ACWP))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-xs font-mono", indexBadgeClass(snapSpi))}>
                                {fmtIndex(snapSpi)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-xs font-mono", indexBadgeClass(snapCpi))}>
                                {fmtIndex(snapCpi)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.EAC))}
                            </TableCell>
                            <TableCell>
                              <ArrowRight className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                isExpanded && "rotate-90"
                              )} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drill-down panel */}
          {drilldownId && drilldownSnapshots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {getCostCodeLabel(drilldownId)} — Snapshot Detail
                </CardTitle>
                <CardDescription>
                  Historical earned value snapshots for this cost code.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Snapshot Date</TableHead>
                        <TableHead className="text-right">BCWS</TableHead>
                        <TableHead className="text-right">BCWP</TableHead>
                        <TableHead className="text-right">ACWP</TableHead>
                        <TableHead className="text-center">SPI</TableHead>
                        <TableHead className="text-center">CPI</TableHead>
                        <TableHead className="text-right">SV</TableHead>
                        <TableHead className="text-right">CV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownSnapshots.map((snap) => {
                        const data = d(snap.data);
                        const snapSpi = asNum(data.SPI);
                        const snapCpi = asNum(data.CPI);
                        const sv = asNum(data.SV);
                        const cv = asNum(data.CV);
                        return (
                          <TableRow key={snap.id}>
                            <TableCell className="font-mono text-sm">
                              {asStr(data.SnapshotDate).slice(0, 10) || snap.createdAt.slice(0, 10)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.BCWS))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.BCWP))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {fmtCurrency(asNum(data.ACWP))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-xs font-mono", indexBadgeClass(snapSpi))}>
                                {fmtIndex(snapSpi)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-xs font-mono", indexBadgeClass(snapCpi))}>
                                {fmtIndex(snapCpi)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs font-mono", varianceBadgeClass(sv))}>
                                {fmtCurrency(sv)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge className={cn("text-xs font-mono", varianceBadgeClass(cv))}>
                                {fmtCurrency(cv)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
