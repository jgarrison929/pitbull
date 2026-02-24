"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Clock3, Inbox, MessageCircle } from "lucide-react";

interface DashboardAnalytics {
  activeProjects: number;
  hoursThisWeek: number;
  hoursLastWeek: number;
  pendingApprovals: number;
  openRFIs: number;
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function KpiCardsWidget({
  data,
  isLoading,
}: {
  data: DashboardAnalytics | null;
  isLoading: boolean;
}) {
  const hoursDelta = data ? trendPercent(data.hoursThisWeek, data.hoursLastWeek) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/projects?status=active" className="group">
        <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{data?.activeProjects ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/time-tracking" className="group">
        <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(data?.hoursThisWeek ?? 0).toFixed(1)}
                </div>
                <p
                  className={`text-xs ${hoursDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}
                >
                  {hoursDelta >= 0 ? "+" : ""}
                  {hoursDelta.toFixed(1)}% vs last week
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/time-tracking/approval?status=pending" className="group">
        <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
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
                {(data?.pendingApprovals ?? 0) > 0 && (
                  <Badge className="mt-2 bg-amber-100 text-amber-800">Needs review</Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/rfis?status=open" className="group">
        <Card className="transition-colors group-hover:border-amber-500/50 group-hover:shadow-md cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open RFIs</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{data?.openRFIs ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
