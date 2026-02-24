"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Users, DollarSign, TrendingUp, BarChart3, AlertTriangle } from "lucide-react";
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

export function ExecutiveDashboard({ data, isLoading }: { data: DashboardAnalytics | null; isLoading: boolean }) {
  const totalBudget = data?.projectBudgetHealth.reduce((sum, p) => sum + p.budget, 0) ?? 0;
  const totalSpent = data?.projectBudgetHealth.reduce((sum, p) => sum + p.spent, 0) ?? 0;
  const alertCount = data?.projectBudgetHealth.filter((p) => p.percentUsed >= 75).length ?? 0;
  const avgHoursPerEmployee = data && data.totalEmployees > 0 ? (data.hoursThisWeek / data.totalEmployees).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/projects?status=active" className="group">
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
        <Link href="/employees" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{data?.totalEmployees ?? 0}</div>}
            </CardContent>
          </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <Badge variant="outline" className="mt-1 text-xs">Coming soon</Badge>
          </CardContent>
        </Card>
        <Link href="/contracts?status=active" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Backlog</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(totalBudget - totalSpent)}</div>
                  <p className="text-xs text-muted-foreground">Remaining contract value</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/reports"><BarChart3 className="h-5 w-5 text-purple-600" /><span className="text-sm font-medium">Reports</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/projects"><FolderOpen className="h-5 w-5 text-amber-600" /><span className="text-sm font-medium">All Projects</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/employees"><Users className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">Employees</span></Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Project Portfolio</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.projectBudgetHealth.slice(0, 8).map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
                    <div className={`h-full ${p.percentUsed >= 90 ? "bg-red-500" : p.percentUsed >= 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(p.percentUsed, 100)}%` }} />
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-sm font-medium">{formatCurrency(p.budget)}</p>
                  <p className="text-xs text-muted-foreground">{p.percentUsed.toFixed(0)}% spent</p>
                </div>
              </div>
            ))}
            {!isLoading && (data?.projectBudgetHealth.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No active projects.</p>}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Alerts & Exceptions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? <Skeleton className="h-20 w-full" /> : (
                <>
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <AlertTriangle className={`h-5 w-5 ${alertCount > 0 ? "text-amber-500" : "text-emerald-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{alertCount} project{alertCount !== 1 ? "s" : ""} over 75% budget</p>
                      <p className="text-xs text-muted-foreground">{alertCount > 0 ? "Review cost projections" : "All projects within threshold"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <AlertTriangle className={`h-5 w-5 ${(data?.openRFIs ?? 0) > 5 ? "text-amber-500" : "text-emerald-500"}`} />
                    <div>
                      <p className="text-sm font-medium">{data?.openRFIs ?? 0} open RFIs</p>
                      <p className="text-xs text-muted-foreground">{(data?.openRFIs ?? 0) > 5 ? "May impact schedule" : "Within normal range"}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Headcount Summary</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{data?.totalEmployees ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(data?.hoursThisWeek ?? 0).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Hours/Week</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgHoursPerEmployee}</p>
                    <p className="text-xs text-muted-foreground">Avg Hrs/Person</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
