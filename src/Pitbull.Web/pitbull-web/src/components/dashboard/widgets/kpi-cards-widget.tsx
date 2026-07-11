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

  const cardClass =
    "h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md group-active:bg-muted/40 cursor-pointer";

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Link
        href="/projects?excludeCompleted=true"
        className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
              Active Projects
            </CardTitle>
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-xl font-bold tabular-nums sm:text-2xl">
                {data?.activeProjects ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link
        href="/time-tracking?view=entries&period=thisWeek"
        className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
              Hours This Week
            </CardTitle>
            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
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

      <Link
        href="/time-tracking/approval?status=pending"
        className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
              Pending Approvals
            </CardTitle>
            <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-xl font-bold tabular-nums sm:text-2xl">
                  {data?.pendingApprovals ?? 0}
                </div>
                {(data?.pendingApprovals ?? 0) > 0 && (
                  <Badge className="mt-2 bg-amber-100 text-amber-800">Needs review</Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link
        href="/rfis?status=notClosed"
        className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      >
        <Card className={cardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium leading-snug sm:text-sm">
              Open RFIs
            </CardTitle>
            <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-xl font-bold tabular-nums sm:text-2xl">
                {data?.openRFIs ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
