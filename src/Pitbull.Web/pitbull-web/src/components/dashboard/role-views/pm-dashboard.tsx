"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, MessageCircle, Inbox, Clock3, Plus, BarChart3 } from "lucide-react";
import Link from "next/link";

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

export function PmDashboard({ data, isLoading }: { data: DashboardAnalytics | null; isLoading: boolean }) {
  const hoursDelta = data ? trendPercent(data.hoursThisWeek, data.hoursLastWeek) : 0;

  return (
    <div className="space-y-6">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{data?.pendingApprovals ?? 0}</div>
                {(data?.pendingApprovals ?? 0) > 0 && <Badge className="mt-1 bg-amber-100 text-amber-800">Needs review</Badge>}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
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
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/projects/new"><Plus className="h-5 w-5 text-amber-600" /><span className="text-sm font-medium">New Project</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/time-tracking/crew-entry"><Clock3 className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">Enter Time</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/reports"><BarChart3 className="h-5 w-5 text-purple-600" /><span className="text-sm font-medium">Run Reports</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/projects"><MessageCircle className="h-5 w-5 text-green-600" /><span className="text-sm font-medium">View RFIs</span></Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Project Budget Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.projectBudgetHealth.slice(0, 8).map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div
                      className={`h-full ${p.percentUsed >= 90 ? "bg-red-500" : p.percentUsed >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(p.percentUsed, 100)}%` }}
                    />
                  </div>
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
            {!isLoading && data?.upcomingDeadlines.slice(0, 8).map((d, i) => (
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
