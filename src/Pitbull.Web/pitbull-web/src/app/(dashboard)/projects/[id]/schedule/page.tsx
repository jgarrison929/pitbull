"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { GanttChart, type GanttActivity, type GanttDependency } from "@/components/schedule/gantt-chart";
import { filterLookAheadTasks, type ScheduleLookAheadTask } from "@/lib/site-walk";
import { buildProgressDraftHref } from "@/lib/progress-deep-link";
import Link from "next/link";
import { Pencil, Trash2, CalendarDays } from "lucide-react";

interface DataMap {
  [key: string]: unknown;
}

interface ScheduleRow {
  id: string;
  name: string;
  description: string;
  dataDate: string | null;
  calendarType: string;
  importedFrom: string;
  status: string;
  createdAt: string;
}

interface ScheduleFormState {
  id?: string;
  name: string;
  description: string;
  dataDate: string;
  calendarType: string;
  importedFrom: string;
  status: string;
}

// ScheduleStatus enum: Draft, Active, Baselined, Archived
const STATUSES = ["Draft", "Active", "Baselined", "Archived"];

// ScheduleCalendarType enum: Standard5x8, Standard6x10, Custom
const CALENDAR_TYPES = ["Standard5x8", "Standard6x10", "Custom"];
const CALENDAR_LABELS: Record<string, string> = {
  Standard5x8: "Standard 5x8",
  Standard6x10: "Standard 6x10",
  Custom: "Custom",
};

// ScheduleImportSource enum: Csv, P6Xml, MsProject
const IMPORT_SOURCES = ["Csv", "P6Xml", "MsProject"];
const IMPORT_LABELS: Record<string, string> = {
  Csv: "CSV",
  P6Xml: "P6 XML",
  MsProject: "MS Project",
};

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Active":
      return "default";
    case "Baselined":
      return "secondary";
    default:
      return "outline";
  }
}

function ScheduleContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({ searchInputRef });

  const [schedules, setSchedules] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ScheduleFormState>({
    name: "",
    description: "",
    dataDate: "",
    calendarType: "Standard5x8",
    importedFrom: "Csv",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScheduleRow | null>(null);

  // Gantt tab state
  const [activeTab, setActiveTab] = useState("list");
  const [ganttScheduleId, setGanttScheduleId] = useState<string | null>(null);
  const [ganttActivities, setGanttActivities] = useState<GanttActivity[]>([]);
  const [ganttDependencies, setGanttDependencies] = useState<GanttDependency[]>([]);
  const [ganttLoading, setGanttLoading] = useState(false);

  const loadGanttData = useCallback(async (scheduleId: string) => {
    setGanttLoading(true);
    try {
      const [actResult, depResult] = await Promise.all([
        api<PmPagedResult>(
          `/api/projects/${projectId}/schedules/${scheduleId}/activities?page=1&pageSize=1000`
        ).catch(() => ({ items: [] as PmEntityDto[], totalCount: 0, page: 1, pageSize: 1000 })),
        api<PmPagedResult>(
          `/api/projects/${projectId}/schedules/${scheduleId}/dependencies?page=1&pageSize=1000`
        ).catch(() => ({ items: [] as PmEntityDto[], totalCount: 0, page: 1, pageSize: 1000 })),
      ]);

      const activities: GanttActivity[] = (actResult.items ?? []).map((item) => {
        const data = asDataMap(item.data);
        return {
          id: item.id,
          name: item.name || asString(data.Name) || "Untitled",
          wbsCode: asString(data.WbsCode),
          activityType: (asString(data.ActivityType) || "Task") as GanttActivity["activityType"],
          status: (item.status || asString(data.Status) || "NotStarted") as GanttActivity["status"],
          plannedStart: asString(data.PlannedStart) || null,
          plannedFinish: asString(data.PlannedFinish) || null,
          actualStart: asString(data.ActualStart) || null,
          actualFinish: asString(data.ActualFinish) || null,
          percentComplete: asNumber(data.PercentComplete),
          isCritical: asBool(data.IsCritical),
          totalFloatDays: data.TotalFloatDays != null ? asNumber(data.TotalFloatDays) : null,
          parentActivityId: asString(data.ParentActivityId) || null,
          sortOrder: asNumber(data.SortOrder),
        };
      });

      const dependencies: GanttDependency[] = (depResult.items ?? []).map((item) => {
        const data = asDataMap(item.data);
        return {
          id: item.id,
          predecessorActivityId: asString(data.PredecessorActivityId),
          successorActivityId: asString(data.SuccessorActivityId),
          dependencyType: (asString(data.DependencyType) || "FS") as GanttDependency["dependencyType"],
          lagDays: asNumber(data.LagDays),
        };
      });

      setGanttActivities(activities);
      setGanttDependencies(dependencies);
    } catch (error) {
      toast.error("Failed to load Gantt data", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setGanttLoading(false);
    }
  }, [projectId]);

  // Load gantt data when schedule selection changes
  useEffect(() => {
    if (ganttScheduleId) {
      void loadGanttData(ganttScheduleId);
    } else {
      setGanttActivities([]);
      setGanttDependencies([]);
    }
  }, [ganttScheduleId, loadGanttData]);

  // Auto-select first active schedule for gantt when switching to gantt tab
  useEffect(() => {
    if (activeTab === "gantt" && !ganttScheduleId && schedules.length > 0) {
      const active = schedules.find((s) => s.status === "Active");
      setGanttScheduleId(active?.id ?? schedules[0].id);
    }
  }, [activeTab, ganttScheduleId, schedules]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/schedules?page=1&pageSize=500`
      );
      setSchedules(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load schedules", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isProjectIdValid) {
      setLoading(false);
      return;
    }
    void load();
  }, [isProjectIdValid, load]);

  const rows = useMemo(() => {
    const mapped = schedules.map<ScheduleRow>((schedule) => {
      const data = asDataMap(schedule.data);
      return {
        id: schedule.id,
        name: schedule.name || asString(data.Name) || "Untitled schedule",
        description: asString(data.Description),
        dataDate: asString(data.DataDate) || null,
        calendarType: asString(data.CalendarType) || "Standard5x8",
        importedFrom: asString(data.ImportedFrom) || "Csv",
        status: schedule.status || "Draft",
        createdAt: schedule.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  }, [schedules, search, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = schedules.length;
    const active = schedules.filter((s) => s.status === "Active").length;
    const baselined = schedules.filter((s) => s.status === "Baselined").length;
    const draft = schedules.filter((s) => s.status === "Draft").length;
    return { total, active, baselined, draft };
  }, [schedules]);

  const lookAheadCards = useMemo((): ScheduleLookAheadTask[] => {
    const tasks: ScheduleLookAheadTask[] = ganttActivities.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      plannedStart: a.plannedStart,
      plannedFinish: a.plannedFinish,
      percentComplete: a.percentComplete,
      isCritical: a.isCritical,
      wbsCode: a.wbsCode || undefined,
    }));
    return filterLookAheadTasks(tasks, new Date(), 7);
  }, [ganttActivities]);

  function openCreate() {
    setEditing(false);
    setForm({
      name: "",
      description: "",
      dataDate: "",
      calendarType: "Standard5x8",
      importedFrom: "Csv",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: ScheduleRow) {
    setEditing(true);
    setForm({
      id: row.id,
      name: row.name,
      description: row.description,
      dataDate: row.dataDate ? row.dataDate.slice(0, 10) : "",
      calendarType: row.calendarType,
      importedFrom: row.importedFrom,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveSchedule() {
    if (!form.name.trim()) {
      toast.error("Schedule name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.name.trim(),
      status: form.status,
      data: {
        Description: form.description || null,
        DataDate: form.dataDate || null,
        CalendarType: form.calendarType,
        ImportedFrom: form.importedFrom,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/schedules/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Schedule updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/schedules`, {
          method: "POST",
          body: payload,
        });
        toast.success("Schedule created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save schedule", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule() {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await api<void>(`/api/projects/${projectId}/schedules/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Schedule deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Could not delete this schedule"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete schedule", { description: message });
    } finally {
      setIsDeleting(false);
    }
  }

  // Auto-load look-ahead activities when schedules available (must run before any early return)
  useEffect(() => {
    if (!isProjectIdValid) return;
    if (schedules.length === 0) return;
    if (ganttScheduleId) return;
    const active = schedules.find((s) => s.status === "Active");
    setGanttScheduleId(active?.id ?? schedules[0]!.id);
  }, [isProjectIdValid, schedules, ganttScheduleId]);

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Project schedules, timelines, and calendar management.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-[44px]" asChild>
            <Link href={`/projects/${projectId}/site-walk`}>Site walk</Link>
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
            + New Schedule
          </Button>
        </div>
      </div>

      {/* Mobile look-ahead cards — primary site-walk surface */}
      <Card className="lg:hidden border-amber-200" data-testid="schedule-look-ahead">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-500" />
            Look-ahead (7 days)
          </CardTitle>
          <CardDescription>
            Near-term tasks for walking the job — critical path first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ganttLoading ? (
            <CardListSkeleton rows={3} />
          ) : lookAheadCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No near-term activities. Activate a schedule with activities to see the look-ahead.
            </p>
          ) : (
            lookAheadCards.slice(0, 15).map((task) => (
              <Link
                key={task.id}
                href={buildProgressDraftHref(projectId, {
                  activityId: task.id,
                  activityName: task.name,
                })}
                className="block rounded-lg border p-3 space-y-1 touch-manipulation hover:border-amber-400"
                data-testid="schedule-look-ahead-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{task.name}</p>
                  {task.isCritical && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      Critical
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{task.status}</span>
                  <span>{task.percentComplete}%</span>
                  {task.plannedFinish && (
                    <span>Finish {task.plannedFinish.slice(0, 10)}</span>
                  )}
                  <span className="text-amber-700">Tap for progress draft</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Schedules</CardDescription>
            <CardTitle className="text-lg">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-lg text-emerald-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Baselined</CardDescription>
            <CardTitle className="text-lg">{stats.baselined}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-lg text-muted-foreground">{stats.draft}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="gantt">Gantt Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Schedule List</CardTitle>
          <CardDescription>
            Create, edit, and manage project schedules and milestones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or description (press / to focus)"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={3} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton headers={["Name", "Data Date", "Calendar", "Import Source", "Status", "Actions"]} rows={5} />
              </div>
            </>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No schedules yet. Create your first schedule to start tracking milestones.
                    </p>
                    <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreate}>
                      Create Schedule
                    </Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      {row.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{row.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Data Date: {formatDate(row.dataDate)}</span>
                        <span>{CALENDAR_LABELS[row.calendarType] || row.calendarType}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px]"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                          onClick={() => {
                            setPendingDelete(row);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Data Date</TableHead>
                        <TableHead>Calendar</TableHead>
                        <TableHead>Import Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No schedules yet. Create your first schedule to start tracking milestones.
                              </p>
                              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
                                Create Schedule
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatDate(row.dataDate)}
                            </TableCell>
                            <TableCell>{CALENDAR_LABELS[row.calendarType] || row.calendarType}</TableCell>
                            <TableCell>{IMPORT_LABELS[row.importedFrom] || row.importedFrom}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                  onClick={() => openEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setPendingDelete(row);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Gantt Chart</CardTitle>
                  <CardDescription>
                    Visual timeline of schedule activities, dependencies, and critical path.
                  </CardDescription>
                </div>
                {rows.length > 0 && (
                  <Select
                    value={ganttScheduleId ?? ""}
                    onValueChange={(value) => setGanttScheduleId(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[240px]">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading || ganttLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-muted-foreground">Loading schedule data...</div>
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No schedules yet. Create a schedule in the List tab first.
                  </p>
                </div>
              ) : (
                <GanttChart
                  activities={ganttActivities}
                  dependencies={ganttDependencies}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Schedule" : "New Schedule"}</DialogTitle>
            <DialogDescription>
              Define schedule name, data date, calendar type, and import source.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Master Schedule, Phase 2 Schedule"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-desc">Description</Label>
              <Textarea
                id="schedule-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-data-date">Data Date</Label>
                <Input
                  id="schedule-data-date"
                  type="date"
                  value={form.dataDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dataDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Calendar Type</Label>
                <Select
                  value={form.calendarType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, calendarType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CALENDAR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Import Source</Label>
                <Select
                  value={form.importedFrom}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, importedFrom: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPORT_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {IMPORT_LABELS[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveSchedule}
              loading={saving}
              loadingText="Saving..."
            >
              {editing ? "Save Changes" : "Create Schedule"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{pendingDelete?.name ?? "this schedule"}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <LoadingButton
              variant="destructive"
              onClick={deleteSchedule}
              loading={isDeleting}
              loadingText="Deleting..."
            >
              Delete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SchedulePage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary label="Schedule">
      <ScheduleContent {...props} />
    </ErrorBoundary>
  );
}
