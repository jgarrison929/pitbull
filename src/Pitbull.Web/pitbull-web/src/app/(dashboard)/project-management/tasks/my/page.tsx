"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, ListTodo, RefreshCw, Search } from "lucide-react";
import api from "@/lib/api";
import type { PmEntityDto, PmPagedResult } from "@/lib/pm-types";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

interface TaskData {
  description?: string;
  dueDate?: string;
  priority?: string;
  assignedTo?: string;
  projectName?: string;
  projectNumber?: string;
  [key: string]: unknown;
}

function statusBadge(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "done" || s === "closed")
    return { label: status!, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (s === "inprogress" || s === "in_progress" || s === "in progress" || s === "active")
    return { label: status!, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
  if (s === "blocked" || s === "on hold" || s === "onhold")
    return { label: status!, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
  // Default: open/pending/new
  return { label: status || "Open", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" };
}

function statusIcon(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "done" || s === "closed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "inprogress" || s === "in_progress" || s === "in progress" || s === "active")
    return <Clock className="h-4 w-4 text-blue-500" />;
  return <Circle className="h-4 w-4 text-amber-500" />;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDate(value: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `${diffDays}d left`;
  return formatDate(value);
}

function dueDateColor(value: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "text-red-600";
  if (diffDays <= 3) return "text-amber-600";
  return "text-muted-foreground";
}

function getTaskData(task: PmEntityDto): TaskData {
  return (task.data as TaskData) ?? {};
}

const STATUS_FILTERS = [
  { value: "all", label: "All Tasks" },
  { value: "open", label: "Open" },
  { value: "inprogress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export default function MyTasksPage() {
  const { activeCompany } = useCompany();
  const [tasks, setTasks] = useState<PmEntityDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "50");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const result = await api<PmPagedResult>(
        `/api/project-management/tasks/my?${params.toString()}`
      );
      setTasks(result.items ?? []);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load tasks");
      setTasks([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, activeCompany?.id]);

  const openCount = useMemo(
    () => tasks.filter((t) => {
      const s = (t.status ?? "").toLowerCase();
      return s !== "completed" && s !== "done" && s !== "closed";
    }).length,
    [tasks]
  );

  const overdueCount = useMemo(
    () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return tasks.filter((t) => {
        const s = (t.status ?? "").toLowerCase();
        if (s === "completed" || s === "done" || s === "closed") return false;
        const data = getTaskData(t);
        if (!data.dueDate) return false;
        const due = new Date(data.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < now;
      }).length;
    },
    [tasks]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
          <p className="text-muted-foreground">
            Open tasks across all projects assigned to you.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTasks} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{totalCount}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Circle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{openCount}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">{overdueCount}</div>
                {overdueCount > 0 && (
                  <Badge className="mt-2 bg-red-100 text-red-800">Needs attention</Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task List</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && tasks.length === 0 && (
            <EmptyState
              icon={ListTodo}
              title="No tasks found"
              description={
                search || statusFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "You have no tasks assigned across any project. Tasks will appear here as they are created and assigned to you."
              }
            />
          )}

          {/* Task list */}
          {!isLoading && tasks.length > 0 && (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {tasks.map((task) => {
                  const data = getTaskData(task);
                  const badge = statusBadge(task.status);
                  return (
                    <div
                      key={task.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          {statusIcon(task.status)}
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight">
                              {task.title || task.name || "Untitled Task"}
                            </p>
                            {(data.projectName || data.projectNumber) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {[data.projectNumber, data.projectName].filter(Boolean).join(" — ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className={`${badge.className} text-xs shrink-0`}>
                          {badge.label}
                        </Badge>
                      </div>
                      {data.dueDate && (
                        <p className={`text-xs font-medium ${dueDateColor(data.dueDate)}`}>
                          {relativeDate(data.dueDate)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const data = getTaskData(task);
                      const badge = statusBadge(task.status);
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="w-[40px] pr-0">
                            {statusIcon(task.status)}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">
                              {task.title || task.name || "Untitled Task"}
                            </p>
                            {data.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {data.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {data.projectName
                              ? `${data.projectNumber ? data.projectNumber + " — " : ""}${data.projectName}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={badge.className}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {data.dueDate ? (
                              <span className={`text-sm font-medium ${dueDateColor(data.dueDate)}`}>
                                {relativeDate(data.dueDate)}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(task.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
