"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api, { ApiError } from "@/lib/api";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

interface ScheduleRow {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  percentComplete: number;
  status: string;
  description: string;
  createdAt: string;
}

interface ScheduleFormState {
  id?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  percentComplete: string;
  status: string;
}

const STATUSES = ["Draft", "Active", "Baseline", "Superseded", "Closed"];

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
    case "Baseline":
      return "secondary";
    default:
      return "outline";
  }
}

export default function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [schedules, setSchedules] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ScheduleFormState>({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    percentComplete: "0",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScheduleRow | null>(null);

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
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const mapped = schedules.map<ScheduleRow>((schedule) => {
      const data = asDataMap(schedule.data);
      return {
        id: schedule.id,
        title: schedule.title || schedule.name || "Untitled schedule",
        startDate: asString(data.StartDate ?? data.startDate) || null,
        endDate: asString(data.EndDate ?? data.endDate) || null,
        percentComplete: asNumber(data.PercentComplete ?? data.percentComplete),
        description: asString(data.Description ?? data.description),
        status: schedule.status || "Draft",
        createdAt: schedule.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  }, [schedules, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      description: "",
      startDate: "",
      endDate: "",
      percentComplete: "0",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: ScheduleRow) {
    setEditing(true);
    setForm({
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.startDate ? row.startDate.slice(0, 10) : "",
      endDate: row.endDate ? row.endDate.slice(0, 10) : "",
      percentComplete: String(row.percentComplete),
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveSchedule() {
    if (!form.title.trim()) {
      toast.error("Schedule title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      data: {
        Description: form.description || null,
        StartDate: form.startDate || null,
        EndDate: form.endDate || null,
        PercentComplete: form.percentComplete
          ? Number.parseFloat(form.percentComplete)
          : 0,
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

    setSaving(true);
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
          ? "Delete endpoint is not available yet for schedules"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete schedule", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Project schedules, timelines, and completion tracking.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Schedule</Button>
      </div>

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description"
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
            <p className="text-sm text-muted-foreground">Loading schedules...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No schedules yet. Create your first schedule to start tracking milestones.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Schedule</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.title}</span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(row.startDate)} - {formatDate(row.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{ width: `${Math.min(row.percentComplete, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono">{row.percentComplete}%</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingDelete(row);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
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
                            <Button size="sm" onClick={openCreate}>Create Schedule</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(row.startDate)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(row.endDate)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-amber-500"
                                  style={{ width: `${Math.min(row.percentComplete, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-mono">{row.percentComplete}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPendingDelete(row);
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
                </Table></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Schedule" : "New Schedule"}</DialogTitle>
            <DialogDescription>
              Define schedule name, date range, and completion percentage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="schedule-title">Title</Label>
              <Input
                id="schedule-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
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
                <Label htmlFor="schedule-start">Start Date</Label>
                <Input
                  id="schedule-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-end">End Date</Label>
                <Input
                  id="schedule-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-pct">% Complete</Label>
                <Input
                  id="schedule-pct"
                  type="number"
                  min="0"
                  max="100"
                  value={form.percentComplete}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, percentComplete: e.target.value }))
                  }
                />
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
            <Button onClick={saveSchedule} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this schedule"}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSchedule} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
