"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { Plus, Pencil, Trash2, Mail, MessageSquare } from "lucide-react";

interface DataMap {
  [key: string]: unknown;
}

interface CommunicationRow {
  id: string;
  type: string;
  direction: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  followUpDate: string;
  body: string;
  status: string;
}

interface CommunicationFormState {
  id?: string;
  type: string;
  direction: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  followUpDate: string;
  body: string;
  status: string;
}

const TYPES = ["Letter", "Email", "Memo", "PhoneLog"];
const TYPE_LABELS: Record<string, string> = {
  Letter: "Letter",
  Email: "Email",
  Memo: "Memo",
  PhoneLog: "Phone Log",
};
const DIRECTIONS = ["Incoming", "Outgoing"];
const STATUSES = ["Open", "FollowUpRequired", "Closed"];
const STATUS_LABELS: Record<string, string> = {
  Open: "Open",
  FollowUpRequired: "Follow-Up Required",
  Closed: "Closed",
};

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

  const searchInputRef = useRef<HTMLInputElement>(null);
  useListPageShortcuts({ searchInputRef });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CommunicationFormState>({
    type: "Email",
    direction: "Incoming",
    subject: "",
    fromName: "",
    fromEmail: "",
    toName: "",
    toEmail: "",
    followUpDate: "",
    body: "",
    status: "Open",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CommunicationRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      return {
        id: item.id,
        type: asString(data.CommunicationType ?? data.communicationType) || "Email",
        direction: asString(data.Direction ?? data.direction) || "Incoming",
        subject: asString(data.Subject ?? data.subject) || item.title || "Untitled communication",
        fromName: asString(data.FromName ?? data.fromName),
        fromEmail: asString(data.FromEmail ?? data.fromEmail),
        toName: asString(data.ToName ?? data.toName),
        toEmail: asString(data.ToEmail ?? data.toEmail),
        followUpDate: asString(data.FollowUpDate ?? data.followUpDate),
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
        row.fromName.toLowerCase().includes(q) ||
        row.toName.toLowerCase().includes(q) ||
        row.body.toLowerCase().includes(q)
      );
    });
  }, [communications, search, typeFilter]);

  const openCount = rows.filter((r) => r.status === "Open").length;
  const followUpCount = rows.filter((r) => r.status === "FollowUpRequired").length;

  function openCreate() {
    setEditing(false);
    setForm({
      type: "Email",
      direction: "Incoming",
      subject: "",
      fromName: "",
      fromEmail: "",
      toName: "",
      toEmail: "",
      followUpDate: "",
      body: "",
      status: "Open",
    });
    setDialogOpen(true);
  }

  function openEdit(row: CommunicationRow) {
    setEditing(true);
    setForm({
      id: row.id,
      type: row.type,
      direction: row.direction,
      subject: row.subject,
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      toName: row.toName,
      toEmail: row.toEmail,
      followUpDate: row.followUpDate ? row.followUpDate.slice(0, 10) : "",
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
        FromName: form.fromName || null,
        FromEmail: form.fromEmail || null,
        ToName: form.toName || null,
        ToEmail: form.toEmail || null,
        FollowUpDate: form.followUpDate || null,
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

    setIsDeleting(true);
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
      setIsDeleting(false);
    }
  }

  return (
    <ErrorBoundary label="communications">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
            <p className="text-muted-foreground">
              Track incoming and outgoing project communication records.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Communication
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <MessageSquare className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
              <Mail className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openCount}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Follow-Up</CardTitle>
              <Mail className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{followUpCount}</div>
            </CardContent>
          </Card>
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
                ref={searchInputRef}
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
                      {TYPE_LABELS[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <>
                <div className="hidden sm:block">
                  <TableSkeleton headers={["Type", "Direction", "Subject", "From", "To", "Follow-Up", "Status", ""]} rows={5} />
                </div>
                <div className="sm:hidden">
                  <CardListSkeleton rows={4} />
                </div>
              </>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-3 sm:hidden">
                  {rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No communications yet. Create your first communication record.
                      </p>
                      <Button
                        className="mt-3 bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                        size="sm"
                        onClick={openCreate}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Communication
                      </Button>
                    </div>
                  ) : (
                    rows.map((row) => (
                      <div key={row.id} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{row.subject}</span>
                          <Badge variant={statusBadgeVariant(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{TYPE_LABELS[row.type] ?? row.type}</Badge>
                          <Badge variant="outline">{row.direction}</Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{row.fromName || "-"} &rarr; {row.toName || "-"}</span>
                          {row.followUpDate && <span>Follow-up: {formatDate(row.followUpDate)}</span>}
                        </div>
                        {row.body && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{row.body}</p>
                        )}
                        <div className="flex gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(row)}
                            title="Edit communication"
                            aria-label="Edit communication"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPendingDelete(row);
                              setDeleteOpen(true);
                            }}
                            title="Delete communication"
                            aria-label="Delete communication"
                            className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
                        <TableHead>Type</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Follow-Up</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
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
                              <Button
                                size="sm"
                                onClick={openCreate}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create Communication
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{TYPE_LABELS[row.type] ?? row.type}</TableCell>
                            <TableCell>{row.direction}</TableCell>
                            <TableCell className="font-medium">{row.subject}</TableCell>
                            <TableCell>{row.fromName || "-"}</TableCell>
                            <TableCell>{row.toName || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{formatDate(row.followUpDate)}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(row.status)}>{STATUS_LABELS[row.status] ?? row.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(row)}
                                  title="Edit communication"
                                  aria-label="Edit communication"
                                  className="min-h-[44px] min-w-[44px]"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setPendingDelete(row);
                                    setDeleteOpen(true);
                                  }}
                                  title="Delete communication"
                                  aria-label="Delete communication"
                                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
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
                          {TYPE_LABELS[type] ?? type}
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
                  <Label htmlFor="communication-follow-up-date">Follow-Up Date</Label>
                  <Input
                    id="communication-follow-up-date"
                    type="date"
                    value={form.followUpDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, followUpDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="communication-subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="communication-subject"
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Subject"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="communication-from-name">From Name</Label>
                  <Input
                    id="communication-from-name"
                    value={form.fromName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fromName: e.target.value }))}
                    placeholder="Sender name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="communication-from-email">From Email</Label>
                  <Input
                    id="communication-from-email"
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, fromEmail: e.target.value }))}
                    placeholder="sender@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="communication-to-name">To Name</Label>
                  <Input
                    id="communication-to-name"
                    value={form.toName}
                    onChange={(e) => setForm((prev) => ({ ...prev, toName: e.target.value }))}
                    placeholder="Recipient name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="communication-to-email">To Email</Label>
                  <Input
                    id="communication-to-email"
                    type="email"
                    value={form.toEmail}
                    onChange={(e) => setForm((prev) => ({ ...prev, toEmail: e.target.value }))}
                    placeholder="recipient@example.com"
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
                        {STATUS_LABELS[status] ?? status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <LoadingButton
                onClick={saveCommunication}
                loading={saving}
                loadingText="Saving..."
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {editing ? "Save Changes" : "Create Communication"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Communication</DialogTitle>
              <DialogDescription>
                Delete &quot;{pendingDelete?.subject ?? "this communication"}&quot;? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <LoadingButton
                variant="destructive"
                onClick={deleteCommunication}
                loading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
