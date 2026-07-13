"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  MessageCircle,
  Inbox,
  Clock3,
  CheckCircle2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { roleKpiDrillHref } from "@/lib/role-kpi-drills";
import api from "@/lib/api";
import {
  normalizePendingApprovals,
  pendingApprovalsEmptyCopy,
  type PendingApprovalsDto,
} from "@/lib/pending-approvals";

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

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

/** PM home: run today's jobs — approvals, RFIs, open jobs. */
export function PmDashboard({ data, isLoading }: { data: DashboardAnalytics | null; isLoading: boolean }) {
  const hoursDelta = data ? trendPercent(data.hoursThisWeek, data.hoursLastWeek) : 0;
  const [pending, setPending] = useState<PendingApprovalsDto | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const raw = await api<unknown>("/api/approvals/pending");
      setPending(normalizePendingApprovals(raw));
    } catch {
      // Fall back to analytics proxy only for attention banner; card shows honest load fail
      setPending(null);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  // Prefer live aggregate (2.21.4 API); analytics.pendingApprovals is time-entries-only proxy
  const liveTotal = pending?.total;
  const displayPending =
    liveTotal !== undefined && liveTotal !== null
      ? liveTotal
      : (data?.pendingApprovals ?? 0);
  const needsAttention =
    displayPending > 0 || (data?.openRFIs ?? 0) > 5;

  return (
    <div className="space-y-6">
      {/* 2.21.6 — dedicated pending approvals card from real API */}
      <Card
        className="border-amber-200/80"
        data-testid="pm-pending-approvals-card"
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-amber-600" />
            Pending approvals
          </CardTitle>
          <Button asChild size="sm" variant="outline" className="min-h-[40px]">
            <Link href="/my-approvals">Open queue</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingLoading ? (
            <Skeleton className="h-10 w-24" />
          ) : pending ? (
            <>
              <div
                className="text-3xl font-bold tabular-nums"
                data-testid="pm-pending-approvals-total"
              >
                {pending.total}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span data-testid="pm-pending-time-entries">
                  Time entries: {pending.timeEntries}
                </span>
                <span>·</span>
                <span data-testid="pm-pending-change-orders">
                  Change orders: {pending.changeOrders}
                </span>
              </div>
              {pending.total === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {pendingApprovalsEmptyCopy()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Expanded lifecycle: {pending.expandedLifecycle}.{" "}
                  {pending.truthNote}
                </p>
              )}
              {pending.timeEntries > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 min-h-[40px]">
                    <Link href="/time-tracking/approval/mobile">
                      Mobile approve ({pending.timeEntries})
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="min-h-[40px]">
                    <Link href="/time-tracking/approval">Desktop queue</Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not load live approvals count. Analytics proxy:{" "}
              {data?.pendingApprovals ?? "—"}. Retry from Open queue.
            </p>
          )}
        </CardContent>
      </Card>

      {needsAttention && (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Needs you today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {displayPending > 0 && (
              <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700">
                <Link href="/my-approvals">
                  {displayPending} pending approval
                  {displayPending !== 1 ? "s" : ""}
                </Link>
              </Button>
            )}
            {(data?.openRFIs ?? 0) > 0 && (
              <Button asChild size="sm" variant="outline">
                <Link href={roleKpiDrillHref("openRfis")}>
                  {data!.openRFIs} open RFI{(data!.openRFIs ?? 0) !== 1 ? "s" : ""}
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href="/time-tracking/approval">Timecard queue</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href={roleKpiDrillHref("activeProjects")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{data?.activeProjects ?? 0}</div>}
            </CardContent>
          </Card>
        </Link>
        <Link href={roleKpiDrillHref("openRfis")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open RFIs</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-2xl font-bold">{data?.openRFIs ?? 0}</div>
                  {(data?.openRFIs ?? 0) > 5 && <Badge className="mt-1 bg-amber-100 text-amber-800">Needs attention</Badge>}
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/time-tracking/approval" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Time entries queue</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {pendingLoading || isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className="text-2xl font-bold">
                    {pending?.timeEntries ?? data?.pendingApprovals ?? 0}
                  </div>
                  {(pending?.timeEntries ?? data?.pendingApprovals ?? 0) > 0 && (
                    <Badge className="mt-1 bg-amber-100 text-amber-800">Needs review</Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href={roleKpiDrillHref("hoursThisWeek")} className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
              <Clock3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold">{(data?.hoursThisWeek ?? 0).toFixed(1)}</div>
                  <p className={`text-xs ${hoursDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {hoursDelta >= 0 ? "+" : ""}{hoursDelta.toFixed(1)}% vs last week
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/projects">
            <FolderOpen className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">My Projects</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/my-approvals">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Approvals</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href={roleKpiDrillHref("viewRfis")}>
            <MessageCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">RFIs</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/daily-reports/mobile">
            <FileText className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Field Report</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Project Budget Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.projectBudgetHealth.slice(0, 6).map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div
                      className={`h-full ${p.percentUsed >= 90 ? "bg-red-500" : p.percentUsed >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(p.percentUsed, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Labor vs contract (proxy)</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-sm font-medium">{formatCurrency(p.spent)} / {formatCurrency(p.budget)}</p>
                  <p className="text-xs text-muted-foreground">{p.percentUsed.toFixed(0)}% spent</p>
                </div>
              </div>
            ))}
            {!isLoading && (data?.projectBudgetHealth.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming Deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.upcomingDeadlines.slice(0, 6).map((d, i) => (
              <div key={`${d.projectName}-${i}`} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{d.projectName}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.milestone}</p>
                </div>
                <Badge className={d.daysRemaining < 7 ? "bg-red-100 text-red-800" : d.daysRemaining < 14 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800"}>
                  {d.daysRemaining}d
                </Badge>
              </div>
            ))}
            {!isLoading && (data?.upcomingDeadlines.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
