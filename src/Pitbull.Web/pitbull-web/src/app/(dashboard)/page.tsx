"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Clock3, Inbox, MessageCircle, RefreshCw, Activity } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";

interface DashboardAnalytics {
  activeProjects: number;
  totalEmployees: number;
  hoursThisWeek: number;
  hoursLastWeek: number;
  pendingApprovals: number;
  openRFIs: number;
  upcomingDeadlines: UpcomingDeadline[];
  recentActivity: ActivityItem[];
  projectBudgetHealth: ProjectBudgetHealth[];
  laborHoursTrend: LaborTrendPoint[];
}

interface UpcomingDeadline {
  date: string;
  projectName: string;
  milestone: string;
  daysRemaining: number;
}

interface ActivityItem {
  user: string;
  action: string;
  entity: string;
  timestamp: string;
}

interface ProjectBudgetHealth {
  name: string;
  budget: number;
  spent: number;
  percentUsed: number;
}

interface LaborTrendPoint {
  weekStart: string;
  totalHours: number;
}

function formatHours(value: number): string {
  return value.toFixed(1);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function relativeTime(value: string): string {
  const now = Date.now();
  const target = new Date(value).getTime();
  const diffMs = now - target;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function budgetBarColor(percentUsed: number): { bar: string; text: string } {
  if (percentUsed >= 90) return { bar: "bg-red-500", text: "text-red-600" };
  if (percentUsed >= 75) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-emerald-500", text: "text-emerald-600" };
}

export default function DashboardPage() {
  const { activeCompany } = useCompany();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const result = await api<DashboardAnalytics>("/api/dashboard/analytics");
      setData(result);
    } catch {
      toast.error("Failed to load dashboard analytics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchAnalytics();
  }, [fetchAnalytics, activeCompany?.id]);

  useEffect(() => {
    const timer = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(timer);
  }, [fetchAnalytics]);

  const hoursDeltaPct = useMemo(() => {
    if (!data) return 0;
    return trendPercent(data.hoursThisWeek, data.hoursLastWeek);
  }, [data]);

  const maxTrendHours = useMemo(() => {
    if (!data || data.laborHoursTrend.length === 0) return 1;
    return Math.max(...data.laborHoursTrend.map((p) => p.totalHours), 1);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Welcome tour for new users */}
      <WelcomeTour />

      {/* Onboarding checklist for new users */}
      <OnboardingChecklist />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Real-time construction KPIs and activity.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnalytics}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{data?.activeProjects ?? 0}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatHours(data?.hoursThisWeek ?? 0)}</div>
                <p className={`text-xs ${hoursDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {hoursDeltaPct >= 0 ? "+" : ""}{hoursDeltaPct.toFixed(1)}% vs last week
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{data?.pendingApprovals ?? 0}</div>
                {(data?.pendingApprovals ?? 0) > 0 && <Badge className="mt-2 bg-amber-100 text-amber-800">Needs review</Badge>}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open RFIs</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{data?.openRFIs ?? 0}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Budget Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
            {!isLoading && data?.projectBudgetHealth.map((project) => (
              <div key={project.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate pr-4">{project.name}</span>
                  <span className="text-muted-foreground">{formatCurrency(project.spent)} / {formatCurrency(project.budget)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${budgetBarColor(project.percentUsed).bar}`}
                    style={{ width: `${Math.min(Math.max(project.percentUsed, 0), 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className={budgetBarColor(project.percentUsed).text}>{project.percentUsed.toFixed(1)}%</span> used
                </div>
              </div>
            ))}
            {!isLoading && (data?.projectBudgetHealth.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No active project budget data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Hours Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <div className="flex h-44 items-end gap-3">
                {data?.laborHoursTrend.map((point) => {
                  const height = Math.max((point.totalHours / maxTrendHours) * 100, 4);
                  return (
                    <div key={point.weekStart} className="flex flex-1 flex-col items-center gap-2">
                      <div className="w-full rounded-md bg-amber-500/20" style={{ height: `${height}%` }}>
                        <div className="h-full w-full rounded-md bg-amber-500" />
                      </div>
                      <div className="text-xs text-muted-foreground text-center">{formatWeekLabel(point.weekStart)}</div>
                      <div className="text-xs font-medium">{point.totalHours.toFixed(0)}h</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.upcomingDeadlines.map((deadline, index) => (
              <div key={`${deadline.projectName}-${deadline.milestone}-${index}`} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{deadline.projectName}</p>
                    <p className="text-xs text-muted-foreground truncate">{deadline.milestone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm">{formatDate(deadline.date)}</p>
                    <p className={`text-xs ${deadline.daysRemaining < 7 ? "text-red-600" : "text-muted-foreground"}`}>
                      {deadline.daysRemaining} day{deadline.daysRemaining === 1 ? "" : "s"} remaining
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {!isLoading && (data?.upcomingDeadlines.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No upcoming milestones or deadlines.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {!isLoading && data?.recentActivity.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="flex items-start gap-3 rounded-md border p-3">
                <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.user}</span> did <span className="font-medium">{item.action}</span> on <span className="font-medium">{item.entity}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{relativeTime(item.timestamp)}</p>
                </div>
              </div>
            ))}
            {!isLoading && (data?.recentActivity.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
