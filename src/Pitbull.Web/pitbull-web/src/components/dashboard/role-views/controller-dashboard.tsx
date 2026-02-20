"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, AlertTriangle, BookOpen, FileText, BarChart3 } from "lucide-react";
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

export function ControllerDashboard({ data, isLoading }: { data: DashboardAnalytics | null; isLoading: boolean }) {
  const totalBudget = data?.projectBudgetHealth.reduce((sum, p) => sum + p.budget, 0) ?? 0;
  const totalSpent = data?.projectBudgetHealth.reduce((sum, p) => sum + p.spent, 0) ?? 0;
  const budgetAlerts = data?.projectBudgetHealth.filter((p) => p.percentUsed >= 90).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total AR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totalBudget - totalSpent)}</div>
                <Badge variant="secondary" className="mt-1 text-xs">Remaining contract value</Badge>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total AP</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
                <Badge variant="secondary" className="mt-1 text-xs">Costs to date</Badge>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <Badge variant="outline" className="mt-1 text-xs">Coming soon</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{budgetAlerts}</div>
                {budgetAlerts > 0 && <Badge className="mt-1 bg-red-100 text-red-800">Projects over 90%</Badge>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/accounting/journal-entries"><BookOpen className="h-5 w-5 text-blue-600" /><span className="text-sm font-medium">Journal Entry</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/accounting/wip"><TrendingUp className="h-5 w-5 text-green-600" /><span className="text-sm font-medium">Run WIP</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/billing/aging"><BarChart3 className="h-5 w-5 text-purple-600" /><span className="text-sm font-medium">Aging Report</span></Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/payment-applications"><FileText className="h-5 w-5 text-amber-600" /><span className="text-sm font-medium">Pay Apps</span></Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Aging Snapshot</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Current", "30 Days", "60 Days", "90+ Days"].map((bucket) => (
                <div key={bucket} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm font-medium">{bucket}</span>
                  <span className="text-sm text-muted-foreground">--</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center pt-2">AR aging data coming soon</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Budget Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            {!isLoading && data?.projectBudgetHealth.filter((p) => p.percentUsed >= 75).map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(p.spent)} of {formatCurrency(p.budget)}</p>
                </div>
                <Badge className={p.percentUsed >= 90 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                  {p.percentUsed.toFixed(0)}%
                </Badge>
              </div>
            ))}
            {!isLoading && (data?.projectBudgetHealth.filter((p) => p.percentUsed >= 75).length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No budget alerts. All projects within threshold.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
