"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Calendar,
  Clock,
  ClipboardList,
  FileQuestion,
  Users,
  FileText,
  FolderOpen,
  BarChart3,
  CheckSquare,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DetailPageSkeleton } from "@/components/skeletons";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import { useRecentProjects } from "@/hooks/use-recent-projects";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { CostForecastCard } from "@/components/dashboard/cost-forecast-card";
import {
  projectStatusBadgeClass,
  projectStatusLabel,
} from "@/lib/projects";
import type {
  ListTimeEntriesResult,
  PagedResult,
  Project,
  Rfi,
  RfiCostSummary,
  Subcontract,
  ChangeOrder,
  TimeEntry,
} from "@/lib/types";
import type { PmPagedResult } from "@/lib/pm-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProjectStats {
  projectId: string;
  projectName: string;
  projectNumber: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalLaborCost: number;
  timeEntryCount: number;
  approvedEntryCount: number;
  pendingEntryCount: number;
  assignedEmployeeCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

interface ProjectAssignmentSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  roleDescription: string;
  isActive: boolean;
}

interface DashboardActivityItem {
  id: string;
  type: "timeentry" | "rfi" | "submittal";
  title: string;
  detail: string;
  timestamp: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function computeScheduleProgress(project: Project): number {
  if (project.actualCompletionDate) return 100;

  if (!project.startDate || !project.estimatedCompletionDate) {
    switch (project.status) {
      case 0:
      case 1:
        return 15;
      case 2:
        return 50;
      case 3:
      case 4:
        return 100;
      default:
        return 0;
    }
  }

  const start = new Date(project.startDate).getTime();
  const end = new Date(project.estimatedCompletionDate).getTime();
  const now = Date.now();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const progress = ((now - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, progress));
}

function computeBudgetConsumed(contractAmount: number, laborCost: number): number {
  if (contractAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (laborCost / contractAmount) * 100));
}

function getSubmittalStatus(row: { status?: string | null; data?: unknown }): string {
  if (row.status) return row.status;
  const data = row.data as Record<string, unknown> | undefined;
  const fromData = data?.Status || data?.status;
  return typeof fromData === "string" ? fromData : "Unknown";
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [rfiSummary, setRfiSummary] = useState<RfiCostSummary | null>(null);
  const [team, setTeam] = useState<ProjectAssignmentSummary[]>([]);
  const [activities, setActivities] = useState<DashboardActivityItem[]>([]);
  const [pendingSubmittals, setPendingSubmittals] = useState(0);
  const [openChangeOrders, setOpenChangeOrders] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addRecentProject } = useRecentProjects();
  const { addRecentItem } = useRecentlyViewed();

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const projectRequest = api<Project>(`/api/projects/${id}`);

        const [projectData, statsData, rfiCostData, assignmentsData, timeEntriesData, rfisData, submittalsData, subcontractsData] =
          await Promise.all([
            projectRequest,
            api<ProjectStats>(`/api/projects/${id}/stats`).catch(() => null),
            api<RfiCostSummary>(`/api/projects/${id}/rfi-cost-summary`).catch(() => null),
            api<ProjectAssignmentSummary[]>(`/api/project-assignments/by-project/${id}?activeOnly=true`).catch(
              () => []
            ),
            api<ListTimeEntriesResult>(`/api/time-entries?projectId=${id}&pageSize=8`).catch(() => ({ items: [], totalCount: 0, page: 1, pageSize: 8, totalPages: 0 })),
            api<{ items: Rfi[] }>(`/api/projects/${id}/rfis?page=1&pageSize=8`).catch(() => ({ items: [] })),
            api<PmPagedResult>(`/api/projects/${id}/submittals?page=1&pageSize=200`).catch(
              () => ({ items: [], totalCount: 0, page: 1, pageSize: 200, totalPages: 0, hasPreviousPage: false, hasNextPage: false })
            ),
            api<PagedResult<Subcontract>>(`/api/subcontracts?projectId=${id}&pageSize=50`).catch(
              () => ({ items: [] as Subcontract[], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 })
            ),
          ]);

        if (cancelled) return;

        setProject(projectData);
        setStats(statsData);
        setRfiSummary(rfiCostData);
        setTeam(assignmentsData.filter((entry) => entry.isActive));

        const pendingStatuses = new Set([
          "Draft",
          "Submitted",
          "InReview",
          "ReviseAndResubmit",
          "Waiting",
        ]);

        const pendingCount = submittalsData.items.filter((row) =>
          pendingStatuses.has(getSubmittalStatus(row))
        ).length;
        setPendingSubmittals(pendingCount);

        // Fetch change orders across all project subcontracts
        let openCOs = 0;
        if (subcontractsData.items.length > 0) {
          try {
            const coResults = await Promise.all(
              subcontractsData.items.slice(0, 10).map((sc) =>
                api<PagedResult<ChangeOrder>>(`/api/changeorders?subcontractId=${sc.id}&pageSize=50`).catch(() => ({ items: [] as ChangeOrder[], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 }))
              )
            );
            openCOs = coResults.reduce((sum, r) => {
              // Status 0=Pending, 1=Under Review are "open"
              return sum + r.items.filter((co) => co.status === 0 || co.status === 1).length;
            }, 0);
          } catch {
            // Non-critical — leave at 0
          }
        }
        setOpenChangeOrders(openCOs);

        const timeActivity: DashboardActivityItem[] = (timeEntriesData.items || []).map((entry: TimeEntry) => ({
          id: `time-${entry.id}`,
          type: "timeentry",
          title: `Time entry: ${entry.employeeName}`,
          detail: `${entry.totalHours.toFixed(1)}h on ${entry.costCodeDescription || "cost code"}`,
          timestamp: entry.createdAt || entry.date,
        }));

        const rfiActivity: DashboardActivityItem[] = (rfisData.items || []).map((rfi) => ({
          id: `rfi-${rfi.id}`,
          type: "rfi",
          title: `RFI #${rfi.number}: ${rfi.subject}`,
          detail: `Status: ${rfi.status}`,
          timestamp: rfi.createdAt,
        }));

        const submittalActivity: DashboardActivityItem[] = (submittalsData.items || []).map((submittal) => ({
          id: `submittal-${submittal.id}`,
          type: "submittal",
          title: `Submittal: ${submittal.title || submittal.name || "Untitled"}`,
          detail: `Status: ${getSubmittalStatus(submittal)}`,
          timestamp: submittal.updatedAt || submittal.createdAt,
        }));

        const merged = [...timeActivity, ...rfiActivity, ...submittalActivity]
          .filter((item) => Boolean(item.timestamp))
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() -
              new Date(a.timestamp).getTime()
          )
          .slice(0, 10);

        setActivities(merged);

        addRecentProject({ id: projectData.id, name: projectData.name, number: projectData.number });
        addRecentItem({
          id: projectData.id,
          type: "project",
          name: projectData.name,
          identifier: projectData.number,
        });
      } catch {
        if (!cancelled) {
          setError("Failed to load project dashboard");
          toast.error("Failed to load project dashboard");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [id, addRecentProject, addRecentItem]);

  const scheduleProgress = useMemo(
    () => (project ? computeScheduleProgress(project) : 0),
    [project]
  );

  const budgetConsumedPercent = useMemo(
    () =>
      project && stats
        ? computeBudgetConsumed(project.contractAmount, stats.totalLaborCost)
        : 0,
    [project, stats]
  );

  if (isLoading) return <DetailPageSkeleton />;

  if (error || !project) {
    return (
      <div className="space-y-6">
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{error || "Project not found"}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <Badge className={projectStatusBadgeClass(project.status)}>
                  {projectStatusLabel(project.status)}
                </Badge>
              </div>
              <p className="font-mono text-sm text-muted-foreground mt-1">{project.number}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              Budget: <span className="font-semibold text-foreground">{formatCurrency(project.contractAmount)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated Completion</p>
              <p className="font-medium">{formatDate(project.estimatedCompletionDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual Completion</p>
              <p className="font-medium">{formatDate(project.actualCompletionDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="font-medium">{project.clientName || "—"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Schedule Progress</span>
              <span className="text-muted-foreground">{scheduleProgress.toFixed(0)}%</span>
            </div>
            <Progress value={scheduleProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { label: "Overview", href: `/projects/${id}`, icon: BarChart3, active: true },
          { label: "RFIs", href: `/projects/${id}/rfis`, icon: FileQuestion },
          { label: "Submittals", href: `/projects/${id}/submittals`, icon: ClipboardList },
          { label: "Documents", href: `/projects/${id}/documents`, icon: FolderOpen },
          { label: "Schedule", href: `/projects/${id}/schedule`, icon: Calendar },
          { label: "Daily Reports", href: `/projects/${id}/daily-reports`, icon: FileText },
          { label: "Tasks", href: `/projects/${id}/tasks`, icon: CheckSquare },
          { label: "Job Cost", href: `/projects/${id}/job-cost`, icon: Briefcase },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              tab.active
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Cost Forecast */}
      <CostForecastCard projectId={id} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Hours Logged
            </div>
            <p className="mt-2 text-2xl font-bold">{(stats?.totalHours || 0).toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats?.totalLaborCost || 0)} labor cost
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Budget Consumed
            </div>
            <p className="mt-2 text-2xl font-bold">{budgetConsumedPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(project.contractAmount)} budget
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileQuestion className="h-4 w-4" />
              Open RFIs
            </div>
            <p className="mt-2 text-2xl font-bold">{rfiSummary?.openRfis ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingSubmittals} pending submittal{pendingSubmittals !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Open Change Orders
            </div>
            <p className="mt-2 text-2xl font-bold">{openChangeOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">
              pending or under review
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No activity yet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Activity will appear here as time entries, RFIs, and submittals are created.
                </p>
                <div className="flex justify-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/time-tracking/new?projectId=${id}`}>Log Time</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${id}/rfis`}>Create RFI</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(item.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members Assigned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No team assigned</p>
                <p className="text-xs text-muted-foreground">
                  Assign employees to this project from the employee management page.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {team.map((member) => (
                  <div key={member.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{member.employeeName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{member.employeeNumber}</p>
                    <p className="text-xs text-muted-foreground mt-1">{member.roleDescription}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
              <Link href={`/time-tracking/new?projectId=${id}`}>
                <Clock className="mr-2 h-4 w-4" />
                Add Time Entry
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/rfis`}>
                <FileQuestion className="mr-2 h-4 w-4" />
                Create RFI
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/schedule`}>
                <Calendar className="mr-2 h-4 w-4" />
                View Schedule
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/submittals`}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Open Submittals
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
