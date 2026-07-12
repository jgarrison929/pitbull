"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Clock3, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { buildFieldReportHref } from "@/lib/projects";
import { useRecentProjects } from "@/hooks/use-recent-projects";

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

function trendPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

/** Field home: last job + crew time + field report — not company ERP chrome. */
export function FieldDashboard({ data, isLoading }: { data: DashboardAnalytics | null; isLoading: boolean }) {
  const hoursDelta = data ? trendPercent(data.hoursThisWeek, data.hoursLastWeek) : 0;
  const { recentProjects } = useRecentProjects();
  const lastJob = recentProjects[0] ?? null;

  return (
    <div className="space-y-6">
      {lastJob ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              Last job
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold">{lastJob.name}</p>
              <p className="text-sm text-muted-foreground">{lastJob.number}</p>
            </div>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
              <Button asChild size="lg" className="min-h-[48px] bg-amber-600 hover:bg-amber-700">
                <Link href="/time-tracking/crew-entry">Crew time</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-[48px]" data-testid="field-home-daily-report">
                <Link href={buildFieldReportHref(lastJob.id)}>Field report</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-[48px]">
                <Link href={`/projects/${lastJob.id}/site-walk`}>Site walk</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
            <FolderOpen className="h-12 w-12 text-amber-600" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Pick a job</h3>
              <p className="text-sm text-muted-foreground">
                Open a project once — we&apos;ll pin it here for crew time and reports.
              </p>
            </div>
            <Button asChild size="lg" className="min-h-[52px] min-w-[200px] text-base bg-amber-600 hover:bg-amber-700">
              <Link href="/projects">Browse jobs</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2">
        <Link
          href="/time-tracking?view=entries&period=thisWeek"
          className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md group-active:bg-muted/40 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold tabular-nums">
                    {(data?.hoursThisWeek ?? 0).toFixed(1)}
                  </div>
                  <p className={`text-xs ${hoursDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {hoursDelta >= 0 ? "+" : ""}
                    {hoursDelta.toFixed(1)}% vs last week
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link
          href="/projects?excludeCompleted=true"
          className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <Card className="h-full min-h-[5.5rem] transition-colors touch-manipulation group-hover:border-amber-500/50 group-hover:shadow-md group-active:bg-muted/40 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Open jobs</CardTitle>
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold tabular-nums">
                  {data?.activeProjects ?? 0}
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[52px]">
          <Link href="/time-tracking/crew-entry">
            <Clock3 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium">Crew time</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[52px]" data-testid="field-home-daily-report-secondary">
          <Link href={buildFieldReportHref(lastJob?.id)}>
            <FileText className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium">Field report</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 min-h-[52px]">
          <Link href="/projects">
            <FolderOpen className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium">All jobs</span>
          </Link>
        </Button>
      </div>

      {recentProjects.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentProjects.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.number}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">Open</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Upcoming Deadlines</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          {!isLoading && data?.upcomingDeadlines.slice(0, 5).map((d, i) => (
            <div key={`${d.projectName}-${i}`} className="flex items-center justify-between rounded-md border p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{d.projectName}</p>
                <p className="text-xs text-muted-foreground truncate">{d.milestone}</p>
              </div>
              <Badge className={d.daysRemaining < 7 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}>
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
  );
}
