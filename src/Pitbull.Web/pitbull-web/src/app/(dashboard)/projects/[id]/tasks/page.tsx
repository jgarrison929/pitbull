"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api, { ApiError } from "@/lib/api";
import type { Employee } from "@/lib/types";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface DataMap {
  [key: string]: unknown;
}

interface TaskRow {
  id: string;
  title: string;
  assigneeName: string;
  dueDate: string | null;
  priority: string;
  status: string;
  createdAt: string;
}

interface TaskFormState {
  id?: string;
  title: string;
  description: string;
  assigneeUserId: string;
  dueDate: string;
  priority: string;
  status: string;
}

const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const STATUSES = ["Open", "InProgress", "Blocked", "Complete", "Canceled"];

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [tasks, setTasks] = useState<PmEntityDto[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaskFormState>({
    title: "",
    description: "",
    assigneeUserId: "",
    dueDate: "",
    priority: "Normal",
    status: "Open",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaskRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, employeeRes] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/tasks?page=1&pageSize=500`),
        api<{ items: Employee[] }>("/api/employees?isActive=true&page=1&pageSize=200"),
      ]);

      setTasks(taskRes.items ?? []);
      setEmployees(employeeRes.items ?? []);
    } catch (error) {
      toast.error("Failed to load tasks", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const mapped = tasks.map<TaskRow>((task) => {
      const data = asDataMap(task.data);
      return {
        id: task.id,
        title: task.title || "Untitled task",
        assigneeName: asString(data.AssignedToName ?? data.assignedToName) || "Unassigned",
        dueDate: asString(data.DueDate ?? data.dueDate) || null,
        priority: asString(data.Priority ?? data.priority) || "Normal",
        status: task.status || "Open",
        createdAt: task.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (!q) return true;

      return (
        task.title.toLowerCase().includes(q) ||
        task.assigneeName.toLowerCase().includes(q) ||
        task.priority.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      description: "",
      assigneeUserId: "",
      dueDate: "",
      priority: "Normal",
      status: "Open",
    });
    setDialogOpen(true);
  }

  function openEdit(row: TaskRow) {
    setEditing(true);

    const source = tasks.find((task) => task.id === row.id);
    const data = asDataMap(source?.data);
    const assigneeUserId = asString(data.AssignedToUserId ?? data.assignedToUserId);

    setForm({
      id: row.id,
      title: row.title,
      description: asString(data.Description ?? data.description),
      assigneeUserId,
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : "",
      priority: row.priority,
      status: row.status,
    });

    setDialogOpen(true);
  }

  async function saveTask() {
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    const assignee = employees.find((emp) => emp.id === form.assigneeUserId);

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      dueDate: toIsoDate(form.dueDate) ?? undefined,
      data: {
        Description: form.description || null,
        Priority: form.priority,
        AssignedToUserId: form.assigneeUserId || null,
        AssignedToName:
          assignee && form.assigneeUserId
            ? `${assignee.firstName} ${assignee.lastName}`.trim()
            : null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/tasks/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Task updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          body: payload,
        });
        toast.success("Task created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save task", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/tasks/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Task deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete endpoint is not available yet for tasks"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete task", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage project task assignments, dates, and status.</p>
        </div>
        <Button onClick={openCreate}>+ New Task</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>Create, update, filter, and track project tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, assignee, or priority"
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
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.assigneeName}</TableCell>
                      <TableCell>{formatDate(task.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{task.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(task)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPendingDelete(task);
                              setDeleteOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "Create Task"}</DialogTitle>
            <DialogDescription>
              Set title, assignee, due date, priority, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Input
                id="task-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={form.assigneeUserId || "unassigned"}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      assigneeUserId: value === "unassigned" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
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
            <Button onClick={saveTask} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Delete “{pendingDelete?.title ?? "this task"}”? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteTask} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
