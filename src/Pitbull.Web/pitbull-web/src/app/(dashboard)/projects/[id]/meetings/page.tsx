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
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { Pencil, Trash2, Plus, X, AlertTriangle } from "lucide-react";

interface DataMap {
  [key: string]: unknown;
}

interface ActionItem {
  description: string;
  owner: string;
  dueDate: string;
  completed: boolean;
}

interface MeetingRow {
  id: string;
  title: string;
  meetingType: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  attendees: string;
  minutes: string;
  actionItems: ActionItem[];
  isRecurring: boolean;
  recurrencePattern: string;
  status: string;
}

interface MeetingFormState {
  id?: string;
  title: string;
  meetingType: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  attendees: string;
  minutes: string;
  actionItems: ActionItem[];
  isRecurring: boolean;
  recurrencePattern: string;
  status: string;
}

const MEETING_TYPES = ["OAC", "Progress", "Safety", "Coordination", "PreConstruction", "Closeout", "Special", "Other"];
const STATUSES = ["Scheduled", "InProgress", "Completed", "Cancelled", "Postponed"];

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  return false;
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function formatTime(time: string): string {
  if (!time) return "-";
  return time.slice(0, 5);
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Completed":
      return "default";
    case "InProgress":
      return "secondary";
    case "Cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

function parseActionItems(data: unknown): ActionItem[] {
  const raw = (data as DataMap)?.ActionItems ?? (data as DataMap)?.actionItems;
  if (!Array.isArray(raw)) return [];
  return raw.map((item: unknown) => {
    const d = item as Record<string, unknown>;
    return {
      description: asString(d.description ?? d.Description),
      owner: asString(d.owner ?? d.Owner),
      dueDate: asString(d.dueDate ?? d.DueDate),
      completed: d.completed === true || d.Completed === true,
    };
  });
}

function isActionItemOverdue(item: ActionItem): boolean {
  if (item.completed || !item.dueDate) return false;
  const due = new Date(item.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due < new Date();
}

function meetingTypeLabel(type: string): string {
  switch (type) {
    case "OAC":
      return "OAC";
    case "PreConstruction":
      return "Pre-Construction";
    default:
      return type;
  }
}

function MeetingsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({ searchInputRef });

  const [meetings, setMeetings] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MeetingFormState>({
    title: "",
    meetingType: "OAC",
    meetingDate: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    description: "",
    attendees: "",
    minutes: "",
    actionItems: [],
    isRecurring: false,
    recurrencePattern: "",
    status: "Scheduled",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeetingRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/meetings?page=1&pageSize=500`
      );
      setMeetings(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load meetings", {
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
    const mapped = meetings.map<MeetingRow>((meeting) => {
      const data = asDataMap(meeting.data);
      return {
        id: meeting.id,
        title: meeting.title || asString(data.Title ?? data.title) || "Untitled Meeting",
        meetingType: asString(data.MeetingType ?? data.meetingType) || "Other",
        meetingDate: asString(data.MeetingDate ?? data.meetingDate) || meeting.createdAt,
        startTime: asString(data.StartTime ?? data.startTime),
        endTime: asString(data.EndTime ?? data.endTime),
        location: asString(data.Location ?? data.location),
        description: asString(data.Description ?? data.description),
        attendees: asString(data.Attendees ?? data.attendees),
        minutes: asString(data.Minutes ?? data.minutes),
        actionItems: parseActionItems(data),
        isRecurring: asBool(data.IsRecurring ?? data.isRecurring),
        recurrencePattern: asString(data.RecurrencePattern ?? data.recurrencePattern),
        status: meeting.status || "Scheduled",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.meetingType.toLowerCase().includes(q)
      );
    });
  }, [meetings, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      meetingType: "OAC",
      meetingDate: new Date().toISOString().slice(0, 10),
      startTime: "09:00",
      endTime: "10:00",
      location: "",
      description: "",
      attendees: "",
      minutes: "",
      actionItems: [],
      isRecurring: false,
      recurrencePattern: "",
      status: "Scheduled",
    });
    setDialogOpen(true);
  }

  function openEdit(row: MeetingRow) {
    setEditing(true);
    setForm({
      id: row.id,
      title: row.title,
      meetingType: row.meetingType,
      meetingDate: row.meetingDate ? row.meetingDate.slice(0, 10) : "",
      startTime: row.startTime || "09:00",
      endTime: row.endTime || "10:00",
      location: row.location,
      description: row.description,
      attendees: row.attendees,
      minutes: row.minutes,
      actionItems: row.actionItems,
      isRecurring: row.isRecurring,
      recurrencePattern: row.recurrencePattern,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveMeeting() {
    if (!form.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!form.meetingDate) {
      toast.error("Meeting date is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      data: {
        MeetingType: form.meetingType,
        MeetingDate: form.meetingDate,
        StartTime: form.startTime || null,
        EndTime: form.endTime || null,
        Location: form.location || null,
        Description: form.description || null,
        Attendees: form.attendees || null,
        Minutes: form.minutes || null,
        ActionItems: form.actionItems.length > 0 ? form.actionItems : null,
        IsRecurring: form.isRecurring,
        RecurrencePattern: form.isRecurring ? (form.recurrencePattern || null) : null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/meetings/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Meeting updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/meetings`, {
          method: "POST",
          body: payload,
        });
        toast.success("Meeting created");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save meeting", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteMeeting() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/meetings/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Meeting deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Could not delete this meeting"
          : error instanceof Error
            ? error.message
            : "Unknown error";
      toast.error("Failed to delete meeting", { description: message });
    } finally {
      setSaving(false);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            Schedule and manage project meetings, track locations, and recurring patterns.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Meeting</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Schedule</CardTitle>
          <CardDescription>
            Create and manage meeting records for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, location, type, or description (press / to focus)"
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
              <div className="sm:hidden"><CardListSkeleton rows={4} /></div>
              <div className="hidden sm:block"><TableSkeleton headers={["Date", "Title", "Type", "Time", "Location", "Status", "Actions"]} rows={4} /></div>
            </>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No meetings yet. Create your first meeting.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Meeting</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-muted-foreground">
                            {formatDate(row.meetingDate)}
                          </span>
                          <Badge variant="secondary">{meetingTypeLabel(row.meetingType)}</Badge>
                        </div>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="font-medium">{row.title}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{formatTime(row.startTime)} - {formatTime(row.endTime)}</span>
                        {row.location && <span>{row.location}</span>}
                      </div>
                      {row.attendees && (
                        <p className="text-xs text-muted-foreground truncate">
                          Attendees: {row.attendees}
                        </p>
                      )}
                      {row.isRecurring && (
                        <p className="text-xs text-muted-foreground">
                          Recurring: {row.recurrencePattern || "Yes"}
                        </p>
                      )}
                      {row.minutes && (
                        <div className="text-sm">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Minutes</p>
                          <p className="text-sm line-clamp-3 whitespace-pre-wrap">{row.minutes}</p>
                        </div>
                      )}
                      {row.actionItems.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            Action Items ({row.actionItems.filter(ai => !ai.completed).length} open)
                            {row.actionItems.some(isActionItemOverdue) && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                          </p>
                          {row.actionItems.slice(0, 3).map((ai, idx) => (
                            <div
                              key={idx}
                              className={`text-xs rounded px-2 py-1 ${
                                isActionItemOverdue(ai) ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" :
                                ai.completed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 line-through" :
                                "bg-muted"
                              }`}
                            >
                              {ai.description} {ai.owner && `(${ai.owner})`} {ai.dueDate && `- ${formatDate(ai.dueDate)}`}
                            </div>
                          ))}
                          {row.actionItems.length > 3 && (
                            <p className="text-xs text-muted-foreground">+{row.actionItems.length - 3} more</p>
                          )}
                        </div>
                      )}
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
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Action Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No meetings yet. Create your first meeting.
                              </p>
                              <Button size="sm" onClick={openCreate}>Create Meeting</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">{formatDate(row.meetingDate)}</TableCell>
                            <TableCell>
                              <div>
                                <span className="font-medium">{row.title}</span>
                                {row.isRecurring && (
                                  <span className="ml-2 text-xs text-muted-foreground">(recurring)</span>
                                )}
                                {row.minutes && (
                                  <Badge variant="outline" className="ml-2 text-xs">Minutes</Badge>
                                )}
                              </div>
                              {row.attendees && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
                                  {row.attendees}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{meetingTypeLabel(row.meetingType)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatTime(row.startTime)} - {formatTime(row.endTime)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{row.location || "-"}</TableCell>
                            <TableCell>
                              {row.actionItems.length > 0 ? (
                                <div className="space-y-0.5">
                                  {row.actionItems.slice(0, 2).map((ai, idx) => (
                                    <div
                                      key={idx}
                                      className={`text-xs truncate max-w-[180px] ${
                                        isActionItemOverdue(ai) ? "text-red-600 font-medium" :
                                        ai.completed ? "text-muted-foreground line-through" : ""
                                      }`}
                                      title={`${ai.description} - ${ai.owner || "Unassigned"} (Due: ${formatDate(ai.dueDate)})`}
                                    >
                                      {isActionItemOverdue(ai) && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                      {ai.description}
                                      {ai.owner && <span className="text-muted-foreground ml-1">({ai.owner})</span>}
                                    </div>
                                  ))}
                                  {row.actionItems.length > 2 && (
                                    <span className="text-xs text-muted-foreground">+{row.actionItems.length - 2} more</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meeting" : "New Meeting"}</DialogTitle>
            <DialogDescription>
              Schedule a meeting with date, time, location, and recurrence details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">Title</Label>
              <Input
                id="meeting-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Weekly OAC Meeting"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={form.meetingDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting-start">Start Time</Label>
                <Input
                  id="meeting-start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting-end">End Time</Label>
                <Input
                  id="meeting-end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Meeting Type</Label>
                <Select
                  value={form.meetingType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, meetingType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {meetingTypeLabel(type)}
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
              <div className="space-y-2">
                <Label htmlFor="meeting-location">Location</Label>
                <Input
                  id="meeting-location"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="Jobsite trailer, Room 201, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-attendees">Attendees</Label>
              <Input
                id="meeting-attendees"
                value={form.attendees}
                onChange={(e) => setForm((prev) => ({ ...prev, attendees: e.target.value }))}
                placeholder="e.g. John Smith, Jane Doe, Bob Johnson"
              />
              <p className="text-xs text-muted-foreground">Comma-separated list of attendee names</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-desc">Agenda / Description</Label>
              <Textarea
                id="meeting-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Meeting agenda, purpose, and pre-meeting notes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-minutes">Meeting Minutes</Label>
              <Textarea
                id="meeting-minutes"
                value={form.minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, minutes: e.target.value }))}
                rows={4}
                placeholder="Post-meeting notes, decisions made, action items..."
              />
            </div>

            {/* Action Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Action Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      actionItems: [
                        ...prev.actionItems,
                        { description: "", owner: "", dueDate: "", completed: false },
                      ],
                    }))
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
              {form.actionItems.length > 0 && (
                <div className="space-y-2">
                  {form.actionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`grid gap-2 items-end rounded-lg border p-2 ${
                        isActionItemOverdue(item) ? "border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30" : ""
                      }`}
                      style={{ gridTemplateColumns: "1fr 120px 120px 32px" }}
                    >
                      <Input
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...form.actionItems];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setForm((prev) => ({ ...prev, actionItems: updated }));
                        }}
                        placeholder="Action item description"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={item.owner}
                        onChange={(e) => {
                          const updated = [...form.actionItems];
                          updated[idx] = { ...updated[idx], owner: e.target.value };
                          setForm((prev) => ({ ...prev, actionItems: updated }));
                        }}
                        placeholder="Owner"
                        className="h-8 text-sm"
                      />
                      <Input
                        type="date"
                        value={item.dueDate ? item.dueDate.slice(0, 10) : ""}
                        onChange={(e) => {
                          const updated = [...form.actionItems];
                          updated[idx] = { ...updated[idx], dueDate: e.target.value };
                          setForm((prev) => ({ ...prev, actionItems: updated }));
                        }}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          const updated = form.actionItems.filter((_, i) => i !== idx);
                          setForm((prev) => ({ ...prev, actionItems: updated }));
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 pt-2">
                <input
                  id="meeting-recurring"
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(e) => setForm((prev) => ({ ...prev, isRecurring: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="meeting-recurring" className="cursor-pointer">Recurring Meeting</Label>
              </div>
              {form.isRecurring && (
                <div className="space-y-2">
                  <Label htmlFor="meeting-recurrence">Recurrence Pattern</Label>
                  <Input
                    id="meeting-recurrence"
                    value={form.recurrencePattern}
                    onChange={(e) => setForm((prev) => ({ ...prev, recurrencePattern: e.target.value }))}
                    placeholder="Weekly, Biweekly, Monthly, etc."
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveMeeting}
              loading={saving}
              loadingText="Saving..."
            >
              {editing ? "Save Changes" : "Create Meeting"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this meeting"}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              onClick={deleteMeeting}
              loading={saving}
              loadingText="Deleting..."
            >
              Delete
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MeetingsPage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary section="Meetings">
      <MeetingsContent {...props} />
    </ErrorBoundary>
  );
}
