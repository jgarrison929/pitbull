"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  FileWarning,
  HeartPulse,
  Shield,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";
import { roleKpiDrillHref } from "@/lib/role-kpi-drills";

interface DashboardAnalytics {
  activeProjects: number;
  totalEmployees: number;
  hoursThisWeek: number;
  hoursLastWeek: number;
  pendingApprovals: number;
  openRFIs: number;
  upcomingDeadlines: { date: string; projectName: string; milestone: string; daysRemaining: number }[];
  recentActivity: { user: string; action: string; entity: string; timestamp: string; description?: string | null }[];
  projectBudgetHealth: { name: string; budget: number; spent: number; percentUsed: number }[];
  laborHoursTrend: { weekStart: string; totalHours: number }[];
}

interface RoleSummary {
  activeProjectCount: number;
  portfolioContractValue: number;
  billedToDate: number;
  billedToDateLabel: string;
  unbilledContractValue: number;
  unbilledContractValueLabel: string;
  arTotal: number;
  arOverdue: number;
  apTotal: number;
  apDueNearTerm: number;
  arApNetPosition: number;
  arApNetPositionLabel: string;
  openChangeOrderCount: number;
  openChangeOrderAmount: number;
  openRfiCount: number;
  safetyIncidentsYtd: number;
  compliance: {
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
  };
  activeEmployeeCount: number;
  terminationsYtd: number;
  hiresYtd: number;
  openBidCount: number;
  bidPipelineValue: number;
  activeCustomerCount: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatCurrencyCompact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(v / 1_000).toFixed(0)}K`;
  return formatCurrency(v);
}

/** CEO home: exceptions first, then 4 money headlines — not a metric museum. */
export function ExecutiveDashboard({
  data,
  isLoading,
}: {
  data: DashboardAnalytics | null;
  isLoading: boolean;
}) {
  const { activeCompany } = useCompany();
  const [summary, setSummary] = useState<RoleSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      try {
        const result = await api<RoleSummary>("/api/dashboard/role-summary");
        if (!cancelled) setSummary(result);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const loading = isLoading || summaryLoading;
  const alertCount =
    data?.projectBudgetHealth.filter((p) => p.percentUsed >= 75).length ?? 0;
  const complianceIssues =
    (summary?.compliance.expiringSoon ?? 0) + (summary?.compliance.expired ?? 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            <>
              <Link
                href={roleKpiDrillHref("arOverdue")}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
              >
                <DollarSign
                  className={`h-5 w-5 shrink-0 ${
                    (summary?.arOverdue ?? 0) > 0 ? "text-red-500" : "text-emerald-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    AR overdue 31+: {formatCurrency(summary?.arOverdue ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Aging report — not bank cash</p>
                </div>
              </Link>
              <Link
                href={roleKpiDrillHref("budgetAlert")}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
              >
                <AlertTriangle
                  className={`h-5 w-5 shrink-0 ${
                    alertCount > 0 ? "text-amber-500" : "text-emerald-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {alertCount} job{alertCount !== 1 ? "s" : ""} over 75% labor-to-contract
                  </p>
                  <p className="text-xs text-muted-foreground">Proxy — not full job cost</p>
                </div>
              </Link>
              <Link
                href={roleKpiDrillHref("safetyYtd")}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
              >
                <HeartPulse
                  className={`h-5 w-5 shrink-0 ${
                    (summary?.safetyIncidentsYtd ?? 0) > 0 ? "text-amber-500" : "text-emerald-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {summary?.safetyIncidentsYtd ?? 0} safety incident
                    {(summary?.safetyIncidentsYtd ?? 0) !== 1 ? "s" : ""} YTD
                  </p>
                  <p className="text-xs text-muted-foreground">From daily reports</p>
                </div>
              </Link>
              <Link
                href={roleKpiDrillHref("complianceAttention")}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
              >
                <Shield
                  className={`h-5 w-5 shrink-0 ${
                    complianceIssues > 0 ? "text-amber-500" : "text-emerald-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {complianceIssues} compliance doc{complianceIssues !== 1 ? "s" : ""} need action
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {summary?.compliance.expiringSoon ?? 0} expiring ·{" "}
                    {summary?.compliance.expired ?? 0} expired
                  </p>
                </div>
              </Link>
              <Link
                href={roleKpiDrillHref("openRfis")}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40 sm:col-span-2"
              >
                <FileWarning
                  className={`h-5 w-5 shrink-0 ${
                    (summary?.openRfiCount ?? data?.openRFIs ?? 0) > 5
                      ? "text-amber-500"
                      : "text-emerald-500"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {summary?.openRfiCount ?? data?.openRFIs ?? 0} open RFIs ·{" "}
                    {summary?.openChangeOrderCount ?? 0} open COs (
                    {formatCurrency(summary?.openChangeOrderAmount ?? 0)})
                  </p>
                </div>
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Link
          href={roleKpiDrillHref("activeProjects")}
          className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
                Active Projects
              </CardTitle>
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
                  {summary?.activeProjectCount ?? data?.activeProjects ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link
          href={roleKpiDrillHref("billedToDate")}
          className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
                Billed to Date
              </CardTitle>
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-xl font-bold tabular-nums sm:text-2xl">
                    {formatCurrency(summary?.billedToDate ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {summary?.billedToDateLabel ?? "Owner billed (G702)"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link
          href={roleKpiDrillHref("unbilledBacklog")}
          className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
                Unbilled Backlog
              </CardTitle>
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-xl font-bold tabular-nums sm:text-2xl">
                    {formatCurrency(summary?.unbilledContractValue ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    Portfolio {formatCurrencyCompact(summary?.portfolioContractValue ?? 0)} − billed
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link
          href={roleKpiDrillHref("arApNet")}
          className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
                AR − AP Net
              </CardTitle>
              <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div
                    className={`text-xl font-bold tabular-nums sm:text-2xl ${
                      (summary?.arApNetPosition ?? 0) < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrency(summary?.arApNetPosition ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    From aging — not bank cash
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/reports/financial-overview">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Financials</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/accounting/wip">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">WIP</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href={roleKpiDrillHref("activeProjects")}>
            <FolderOpen className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">Projects</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          {!isLoading &&
            data?.projectBudgetHealth.slice(0, 6).map((p) => (
              <div
                key={p.name}
                className="rounded-md border p-3 space-y-2 overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <p className="font-medium text-sm leading-snug min-w-0 break-words">
                    {p.name}
                  </p>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-sm font-semibold whitespace-nowrap">
                      {formatCurrencyCompact(p.budget)}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {p.percentUsed.toFixed(0)}% labor
                    </p>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${
                      p.percentUsed >= 90
                        ? "bg-red-500"
                        : p.percentUsed >= 75
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(p.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          {!isLoading && (data?.projectBudgetHealth.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
