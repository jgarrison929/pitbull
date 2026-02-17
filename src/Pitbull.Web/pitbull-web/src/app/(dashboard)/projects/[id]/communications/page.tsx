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

interface CommunicationRow {
  id: string;
  type: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  status: string;
}

interface CommunicationFormState {
  id?: string;
  type: string;
  direction: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  status: string;
}

const TYPES = ["Email", "Letter", "Memo", "PhoneLog"];
const DIRECTIONS = ["Incoming", "Outgoing"];
const STATUSES = ["Open", "FollowUpRequired", "Closed"];

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

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Closed":
      return "default";
    case "FollowUpRequired":
      return "secondary";
    default:
      return "outline";
  }
}

export default function CommunicationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [communications, setCommunications] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CommunicationFormState>({
    type: "Email",
    direction: "Incoming",
    subject: "",
    from: "",
    to: "",
    date: new Date().toISOString().slice(0, 10),
    body: "",
    status: "Open",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CommunicationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/communications?page=1&pageSize=500`
      );
      setCommunications(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load communications", {
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
    const mapped = communications.map<CommunicationRow>((item) => {
      const data = asDataMap(item.data);
      const from = asString(data.FromName ?? data.fromName);
      const to = asString(data.ToName ?? data.toName);
      const communicationType = asString(data.CommunicationType ?? data.communicationType);
      const communicationDate =
        asString(data.CommunicationDate ?? data.communicationDate) ||
        asString(data.FollowUpDate ?? data.followUpDate) ||
        item.createdAt;

      return {
        id: item.id,
        type: communicationType || "Email",
        subject: asString(data.Subject ?? data.subject) || item.title || "Untitled communication",
        from: from || "-",
        to: to || "-",
        date: communicationDate,
        body: asString(data.Body ?? data.body),
        status: item.status || "Open",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!q) return true;

      return (
        row.subject.toLowerCase().includes(q) ||
        row.from.toLowerCase().includes(q) ||
        row.to.toLowerCase().includes(q) ||
        row.body.toLowerCase().includes(q)
      );
    });
  }, [communications, search, typeFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      type: "Email",
      direction: "Incoming",
      subject: "",
      from: "",
      to: "",
      date: new Date().toISOString().slice(0, 10),
      body: "",
      status: "Open",
    });
    setDialogOpen(true);
  }

  function openEdit(row: CommunicationRow) {
    setEditing(true);
    const source = communications.find((entry) => entry.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      type: row.type,
      direction: asString(data.Direction ?? data.direction) || "Incoming",
      subject: row.subject,
      from: row.from === "-" ? "" : row.from,
      to: row.to === "-" ? "" : row.to,
      date: row.date ? row.date.slice(0, 10) : "",
      body: row.body,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveCommunication() {
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.subject.trim(),
      status: form.status,
      data: {
        CommunicationType: form.type,
        Direction: form.direction,
        Subject: form.subject.trim(),
        Body: form.body || null,
        FromName: form.from || null,
        ToName: form.to || null,
        CommunicationDate: form.date || null,
        FollowUpDate: form.date || null,
        ReferenceType: "General",
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/communications/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Communication updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/communications`, {
          method: "POST",
          body: payload,
        });
        toast.success("Communication logged");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save communication", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommunication() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/communications/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Communication deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete endpoint is not available yet for communications"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete communication", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-muted-foreground">
            Track incoming and outgoing project communication records.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Communication</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Communication Log</CardTitle>
          <CardDescription>
            Search, create, edit, and manage project communication history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, from, to, or body"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading communications...</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No communications yet. Create your first communication record.
                        </p>
                        <Button size="sm" onClick={openCreate}>Create Communication</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-medium">{row.subject}</TableCell>
                      <TableCell>{row.from}</TableCell>
                      <TableCell>{row.to}</TableCell>
                      <TableCell className="font-mono text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{row.body || "-"}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Communication" : "New Communication"}</DialogTitle>
            <DialogDescription>
              Log communication metadata and message details for project records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, direction: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {direction}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="communication-date">Date</Label>
                <Input
                  id="communication-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="communication-subject">Subject</Label>
              <Input
                id="communication-subject"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Subject"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="communication-from">From</Label>
                <Input
                  id="communication-from"
                  value={form.from}
                  onChange={(e) => setForm((prev) => ({ ...prev, from: e.target.value }))}
                  placeholder="Sender name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="communication-to">To</Label>
                <Input
                  id="communication-to"
                  value={form.to}
                  onChange={(e) => setForm((prev) => ({ ...prev, to: e.target.value }))}
                  placeholder="Recipient name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="communication-body">Body</Label>
              <Textarea
                id="communication-body"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                rows={4}
                placeholder="Communication details"
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveCommunication} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Communication"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Communication</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.subject ?? "this communication"}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteCommunication} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
