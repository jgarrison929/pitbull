"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Clock3, Inbox, MessageCircle, RefreshCw, Activity, AlertTriangle, Plus, ClipboardCheck, BarChart3 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
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
  resourceId?: string | null;
  description?: string | null;
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

const ACTION_LABELS: Record<string, string> = {
  Create: "created",
  Update: "updated",
  Delete: "deleted",
  Approval: "approved",
  Rejection: "rejected",
  StatusChange: "changed status of",
  Login: "logged in",
  Export: "exported",
  Import: "imported",
  Locked: "locked",
  Unlocked: "unlocked",
};

const ENTITY_LABELS: Record<string, string> = {
  Project: "a project",
  Bid: "a bid",
  TimeEntry: "a time entry",
  Rfi: "an RFI",
  Subcontract: "a contract",
  PaymentApplication: "a pay app",
  ChangeOrder: "a change order",
  Employee: "an employee",
  ScheduleOfValues: "a schedule of values",
  PayPeriod: "a pay period",
  CostCode: "a cost code",
};

const ENTITY_ROUTES: Record<string, string> = {
  Project: "/projects",
  Bid: "/bids",
  TimeEntry: "/time-tracking",
  Rfi: "/projects",
  Subcontract: "/contracts",
  PaymentApplication: "/payment-applications",
  ChangeOrder: "/change-orders",
  Employee: "/employees",
};

function activityLink(entity: string, resourceId?: string | null): string | null {
  const base = ENTITY_ROUTES[entity];
  if (!base) return null;
  if (resourceId && entity !== "TimeEntry") return `${base}/${resourceId}`;
  return base;
}

function budgetBarColor(percentUsed: number): { bar: string; text: string } {
  if (percentUsed >= 90) return { bar: "bg-red-500", text: "text-red-600" };
  if (percentUsed >= 75) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-emerald-500", text: "text-emerald-600" };
}

interface OnboardingStatus {
  hasCompany: boolean;
  isSetupComplete: boolean;
  isChecklistDismissed: boolean;
}

export default function DashboardPage() {
  const { activeCompany } = useCompany();
  const { hasAnyRole } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupIncomplete, setSetupIncomplete] = useState(false);

  // Gate: redirect to setup wizard if onboarding is not complete
  useEffect(() => {
    let cancelled = false;
    async function checkSetup() {
      try {
        const status = await api<OnboardingStatus>("/api/onboarding/status");
        if (!cancelled && !status.isSetupComplete) {
          router.replace("/settings/company/setup");
          setSetupIncomplete(true);
        }
      } catch {
        // If endpoint fails, don't block the dashboard
      }
    }
    checkSetup();
    return () => { cancelled = true; };
  }, [router]);

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

      {/* Setup incomplete banner */}
      {setupIncomplete && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Complete your company setup to get started
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Set up your company profile, choose modules, and configure defaults.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-300"
            onClick={() => router.push("/settings/company/setup")}
          >
            Go to Setup
          </Button>
        </div>
      )}

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

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/projects/new">
            <Plus className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">New Project</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/time-tracking/crew-entry">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Enter Time</span>
          </Link>
        </Button>
        {hasAnyRole(["Admin", "Manager", "Supervisor"]) && (
          <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px] relative">
            <Link href="/time-tracking/approval">
              <ClipboardCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Approve Time</span>
              {(data?.pendingApprovals ?? 0) > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] bg-amber-500 text-white">
                  {data!.pendingApprovals}
                </Badge>
              )}
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/reports">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Run Reports</span>
          </Link>
        </Button>
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
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {!isLoading && data?.recentActivity.map((item, index) => {
              const href = activityLink(item.entity, item.resourceId);
              const actionLabel = ACTION_LABELS[item.action] || item.action.toLowerCase();
              const entityLabel = ENTITY_LABELS[item.entity] || item.entity.toLowerCase();
              const content = (
                <>
                  <Activity className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{item.user}</span>{" "}
                      {actionLabel}{" "}
                      <span className="font-medium">{entityLabel}</span>
                    </p>
                    {item.description && (
                      <p className="text-xs text-foreground/70 truncate">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{relativeTime(item.timestamp)}</p>
                  </div>
                </>
              );
              return href ? (
                <Link
                  key={`${item.timestamp}-${index}`}
                  href={href}
                  className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <div key={`${item.timestamp}-${index}`} className="flex items-start gap-3 rounded-md border p-3">
                  {content}
                </div>
              );
            })}
            {!isLoading && (data?.recentActivity.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
