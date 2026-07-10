"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, FolderOpen, Tags, PlusCircle, BarChart3 } from "lucide-react";
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

/**
 * Preconstruction-focused home. Bid pipeline metrics come from morning briefing;
 * this view emphasizes navigation into bids/cost history.
 */
export function EstimatorDashboard({
  data,
  isLoading,
}: {
  data: DashboardAnalytics | null;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link href="/bids" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bid Pipeline</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track invitations through award. Open bids and due dates appear in your morning briefing.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/projects" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{data?.activeProjects ?? 0}</div>
                  <p className="text-xs text-muted-foreground">Cost history reference</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/cost-codes" className="group">
          <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cost Codes</CardTitle>
              <Tags className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                CSI MasterFormat library for estimates and job cost alignment.
              </p>
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
          <Link href="/bids">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">All Bids</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[44px]">
          <Link href="/reports">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium">Reports</span>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          {!isLoading &&
            data?.recentActivity.slice(0, 6).map((a, i) => (
              <div key={i} className="flex justify-between gap-2 rounded-md border p-2 text-sm">
                <span className="truncate">
                  <span className="font-medium">{a.user}</span> {a.action} {a.entity}
                </span>
              </div>
            ))}
          {!isLoading && (data?.recentActivity.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
