"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, FolderOpen, Tags, PlusCircle, CalendarClock } from "lucide-react";
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
  openBidCount: number;
  bidPipelineValue: number;
  activeProjectCount: number;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

/**
 * Preconstruction home: win work — real pipeline $ and open bid count.
 */
export function EstimatorDashboard({
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
  const dueSoon = data?.upcomingDeadlines.filter((d) => d.daysRemaining <= 7).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link href={roleKpiDrillHref("bidPipeline")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bid Pipeline</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums">
                    {formatCurrency(summary?.bidPipelineValue ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.openBidCount ?? 0} open bid
                    {(summary?.openBidCount ?? 0) !== 1 ? "s" : ""}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href={roleKpiDrillHref("bidPipeline")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Due this week</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums">{dueSoon}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deadlines in 7 days (from schedule / milestones)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href={roleKpiDrillHref("estimatorProjects")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {summary?.activeProjectCount ?? data?.activeProjects ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Cost history reference</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/bids/new">
            <PlusCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">New Bid</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href={roleKpiDrillHref("bidPipeline")}>
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Open Pipeline</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/cost-codes">
            <Tags className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Cost Codes</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming deadlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          {!isLoading &&
            data?.upcomingDeadlines.slice(0, 6).map((d, i) => (
              <div key={`${d.projectName}-${i}`} className="flex justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="truncate min-w-0">
                  <span className="font-medium">{d.projectName}</span>
                  <span className="text-muted-foreground"> — {d.milestone}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{d.daysRemaining}d</span>
              </div>
            ))}
          {!isLoading && (data?.upcomingDeadlines.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
