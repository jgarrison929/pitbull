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

interface MeetingRow {
  id: string;
  date: string;
  title: string;
  attendees: string;
  agendaItems: string;
  actionItems: string;
  status: string;
}

interface MeetingFormState {
  id?: string;
  date: string;
  title: string;
  meetingType: string;
  attendees: string;
  agendaItems: string;
  actionItems: string;
  minutes: string;
  status: string;
}

const MEETING_TYPES = ["Oac", "Subcontractor", "Safety", "Progress", "Other"];
const STATUSES = ["Scheduled", "InProgress", "Completed", "Canceled"];

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function itemCount(value: string): number {
  if (!value.trim()) return 0;
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Completed":
      return "default";
    case "InProgress":
      return "secondary";
    default:
      return "outline";
  }
}

export default function MeetingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [meetings, setMeetings] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MeetingFormState>({
    date: new Date().toISOString().slice(0, 10),
    title: "",
    meetingType: "Oac",
    attendees: "",
    agendaItems: "",
    actionItems: "",
    minutes: "",
    status: "Scheduled",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MeetingRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(`/api/projects/${projectId}/meetings?page=1&pageSize=500`);
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
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const mapped = meetings.map<MeetingRow>((meeting) => {
      const data = asDataMap(meeting.data);
      return {
        id: meeting.id,
        date: asString(data.ScheduledStart ?? data.scheduledStart) || meeting.createdAt,
        title: meeting.title || asString(data.Title ?? data.title) || "Untitled meeting",
        attendees:
          asString(data.Attendees ?? data.attendees) ||
          asString(data.Location ?? data.location) ||
          "-",
        agendaItems: asString(data.AgendaItems ?? data.agendaItems),
        actionItems: asString(data.ActionItems ?? data.actionItems),
        status: meeting.status || "Scheduled",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.attendees.toLowerCase().includes(q) ||
        row.agendaItems.toLowerCase().includes(q) ||
        row.actionItems.toLowerCase().includes(q)
      );
    });
  }, [meetings, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      title: "",
      meetingType: "Oac",
      attendees: "",
      agendaItems: "",
      actionItems: "",
      minutes: "",
      status: "Scheduled",
    });
    setDialogOpen(true);
  }

  function openEdit(row: MeetingRow) {
    setEditing(true);
    const source = meetings.find((entry) => entry.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      date: row.date ? row.date.slice(0, 10) : "",
      title: row.title,
      meetingType: asString(data.MeetingType ?? data.meetingType) || "Oac",
      attendees: row.attendees === "-" ? "" : row.attendees,
      agendaItems: row.agendaItems,
      actionItems: row.actionItems,
      minutes: asString(data.Minutes ?? data.minutes),
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveMeeting() {
    if (!form.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!form.date) {
      toast.error("Meeting date is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      data: {
        MeetingType: form.meetingType,
        ScheduledStart: `${form.date}T09:00:00`,
        Location: form.attendees || null,
        Attendees: form.attendees || null,
        AgendaItems: form.agendaItems || null,
        ActionItems: form.actionItems || null,
        Minutes: form.minutes || null,
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
          ? "Delete endpoint is not available yet for meetings"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete meeting", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            Capture meeting minutes, attendees, agenda topics, and action items.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Meeting</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Minutes Log</CardTitle>
          <CardDescription>
            Create and manage meeting records for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, attendees, agenda, or actions"
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
            <p className="text-sm text-muted-foreground">Loading meetings...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Attendees</TableHead>
                  <TableHead>Agenda Items</TableHead>
                  <TableHead>Action Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No meetings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.attendees}</TableCell>
                      <TableCell>{itemCount(row.agendaItems)}</TableCell>
                      <TableCell>{itemCount(row.actionItems)}</TableCell>
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
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meeting" : "New Meeting"}</DialogTitle>
            <DialogDescription>
              Record meeting details including attendees, agenda topics, action items, and notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
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
                        {type}
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

            <div className="space-y-2">
              <Label htmlFor="meeting-title">Title</Label>
              <Input
                id="meeting-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Weekly OAC Meeting"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-attendees">Attendees</Label>
              <Textarea
                id="meeting-attendees"
                value={form.attendees}
                onChange={(e) => setForm((prev) => ({ ...prev, attendees: e.target.value }))}
                rows={2}
                placeholder="Comma-separated attendee names"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meeting-agenda">Agenda Items (one per line)</Label>
                <Textarea
                  id="meeting-agenda"
                  value={form.agendaItems}
                  onChange={(e) => setForm((prev) => ({ ...prev, agendaItems: e.target.value }))}
                  rows={5}
                  placeholder="Safety updates"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting-actions">Action Items (one per line)</Label>
                <Textarea
                  id="meeting-actions"
                  value={form.actionItems}
                  onChange={(e) => setForm((prev) => ({ ...prev, actionItems: e.target.value }))}
                  rows={5}
                  placeholder="Update schedule look-ahead - Superintendent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-minutes">Minutes Notes</Label>
              <Textarea
                id="meeting-minutes"
                value={form.minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, minutes: e.target.value }))}
                rows={3}
                placeholder="Summary of discussion and decisions"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveMeeting} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="destructive" onClick={deleteMeeting} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
