"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  Users,
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Shield,
  ClipboardList,
  FileWarning,
  HeartPulse,
  Building2,
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";

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
  const compliancePct =
    summary && summary.compliance.total > 0
      ? Math.round((summary.compliance.active / summary.compliance.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/projects?status=active" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">
                  {summary?.activeProjectCount ?? data?.activeProjects ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing/applications" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Billed to Date</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.billedToDate ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.billedToDateLabel ?? "Owner billed (G702)"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/projects" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unbilled Backlog</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.unbilledContractValue ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Portfolio {formatCurrency(summary?.portfolioContractValue ?? 0)} − billed
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/billing/aging" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">AR − AP Net</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div
                    className={`text-2xl font-bold ${
                      (summary?.arApNetPosition ?? 0) < 0 ? "text-red-600" : ""
                    }`}
                  >
                    {formatCurrency(summary?.arApNetPosition ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    AR {formatCurrency(summary?.arTotal ?? 0)} · AP{" "}
                    {formatCurrency(summary?.apTotal ?? 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/employees" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Workforce</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {summary?.activeEmployeeCount ?? data?.totalEmployees ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    YTD hires {summary?.hiresYtd ?? 0} · terms{" "}
                    {summary?.terminationsYtd ?? 0}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/daily-reports/mobile" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Safety (YTD)</CardTitle>
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {summary?.safetyIncidentsYtd ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Daily-report incidents this year
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/compliance" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compliance</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {compliancePct != null ? `${compliancePct}%` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.compliance.active ?? 0} active ·{" "}
                    {summary?.compliance.expiringSoon ?? 0} expiring ·{" "}
                    {summary?.compliance.expired ?? 0} expired
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/bids" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bid Pipeline</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary?.bidPipelineValue ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.openBidCount ?? 0} open bids ·{" "}
                    {summary?.activeCustomerCount ?? 0} customers
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
          <Link href="/projects">
            <FolderOpen className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">Projects</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/customers">
            <Building2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Customers</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            {!isLoading &&
              data?.projectBudgetHealth.slice(0, 8).map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
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
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Labor cost vs contract (proxy — not full job cost)
                    </p>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-sm font-medium">{formatCurrency(p.budget)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.percentUsed.toFixed(0)}% labor
                    </p>
                  </div>
                </div>
              ))}
            {!isLoading && (data?.projectBudgetHealth.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risks &amp; Exceptions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <AlertTriangle
                      className={`h-5 w-5 ${alertCount > 0 ? "text-amber-500" : "text-emerald-500"}`}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {alertCount} project{alertCount !== 1 ? "s" : ""} over 75%
                        labor-to-contract
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Review cost projections
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/rfis"
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <FileWarning
                      className={`h-5 w-5 ${
                        (summary?.openRfiCount ?? data?.openRFIs ?? 0) > 5
                          ? "text-amber-500"
                          : "text-emerald-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {summary?.openRfiCount ?? data?.openRFIs ?? 0} open RFIs
                      </p>
                      <p className="text-xs text-muted-foreground">
                        May impact schedule
                      </p>
                    </div>
                  </Link>
                  <Link
                    href="/change-orders"
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        (summary?.openChangeOrderCount ?? 0) > 0
                          ? "text-amber-500"
                          : "text-emerald-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {summary?.openChangeOrderCount ?? 0} open change orders (
                        {formatCurrency(summary?.openChangeOrderAmount ?? 0)})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pending / under review
                      </p>
                    </div>
                  </Link>
                  <Link
                    href="/billing/aging"
                    className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <DollarSign
                      className={`h-5 w-5 ${
                        (summary?.arOverdue ?? 0) > 0
                          ? "text-red-500"
                          : "text-emerald-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        AR overdue 31+ days: {formatCurrency(summary?.arOverdue ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        From aging report
                      </p>
                    </div>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
