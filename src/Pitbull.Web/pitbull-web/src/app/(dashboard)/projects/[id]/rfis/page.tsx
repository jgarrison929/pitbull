"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api, { ApiError } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import type {
  CreateRfiCommand,
  Rfi,
  RfiPriority,
  RfiStatus,
  UpdateRfiCommand,
  PagedResult,
} from "@/lib/types";
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

interface RfiFormState {
  id?: string;
  subject: string;
  question: string;
  answer: string;
  status: RfiStatus;
  priority: RfiPriority;
  dueDate: string;
  assignedToName: string;
  ballInCourtName: string;
}

function statusLabel(status: RfiStatus): string {
  switch (status) {
    case 0:
      return "Open";
    case 1:
      return "Answered";
    case 2:
      return "Closed";
    default:
      return "Unknown";
  }
}

function priorityLabel(priority: RfiPriority): string {
  switch (priority) {
    case 0:
      return "Low";
    case 1:
      return "Normal";
    case 2:
      return "High";
    case 3:
      return "Urgent";
    default:
      return "Unknown";
  }
}

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export default function ProjectRfisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);

  const [rfis, setRfis] = useState<Rfi[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RfiFormState>({
    subject: "",
    question: "",
    answer: "",
    status: 0,
    priority: 1,
    dueDate: "",
    assignedToName: "",
    ballInCourtName: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Rfi | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PagedResult<Rfi>>(
        `/api/projects/${projectId}/rfis?page=1&pageSize=200`
      );
      setRfis(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load RFIs", {
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rfis.filter((rfi) => {
      if (statusFilter !== "all" && String(rfi.status) !== statusFilter) return false;
      if (priorityFilter !== "all" && String(rfi.priority) !== priorityFilter) return false;

      if (!q) return true;
      return (
        rfi.subject.toLowerCase().includes(q) ||
        rfi.question.toLowerCase().includes(q) ||
        String(rfi.number).includes(q)
      );
    });
  }, [rfis, search, statusFilter, priorityFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      subject: "",
      question: "",
      answer: "",
      status: 0,
      priority: 1,
      dueDate: "",
      assignedToName: "",
      ballInCourtName: "",
    });
    setDialogOpen(true);
  }

  function openEdit(rfi: Rfi) {
    setEditing(true);
    setForm({
      id: rfi.id,
      subject: rfi.subject,
      question: rfi.question,
      answer: rfi.answer ?? "",
      status: rfi.status,
      priority: rfi.priority,
      dueDate: toDateInput(rfi.dueDate),
      assignedToName: rfi.assignedToName ?? "",
      ballInCourtName: rfi.ballInCourtName ?? "",
    });
    setDialogOpen(true);
  }

  async function saveRfi() {
    if (!form.subject.trim() || !form.question.trim()) {
      toast.error("Subject and question are required");
      return;
    }

    setSaving(true);
    try {
      if (editing && form.id) {
        const payload: UpdateRfiCommand = {
          subject: form.subject.trim(),
          question: form.question.trim(),
          answer: form.answer.trim() || null,
          status: form.status,
          priority: form.priority,
          dueDate: form.dueDate || null,
          assignedToName: form.assignedToName.trim() || null,
          ballInCourtName: form.ballInCourtName.trim() || null,
        };

        await api<Rfi>(`/api/projects/${projectId}/rfis/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("RFI updated");
      } else {
        const payload: CreateRfiCommand = {
          subject: form.subject.trim(),
          question: form.question.trim(),
          priority: form.priority,
          dueDate: form.dueDate || undefined,
          assignedToName: form.assignedToName.trim() || undefined,
          ballInCourtName: form.ballInCourtName.trim() || undefined,
          createdByName: "Project Team",
        };

        await api<Rfi>(`/api/projects/${projectId}/rfis`, {
          method: "POST",
          body: payload,
        });
        toast.success("RFI created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save RFI", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRfi() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/rfis/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("RFI deleted");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        const fallback: UpdateRfiCommand = {
          subject: pendingDelete.subject,
          question: pendingDelete.question,
          answer: pendingDelete.answer ?? null,
          status: 2,
          priority: pendingDelete.priority,
          dueDate: pendingDelete.dueDate ?? null,
          assignedToName: pendingDelete.assignedToName ?? null,
          ballInCourtName: pendingDelete.ballInCourtName ?? null,
        };

        await api<Rfi>(`/api/projects/${projectId}/rfis/${pendingDelete.id}`, {
          method: "PUT",
          body: fallback,
        });

        toast.success("RFI marked closed (delete endpoint unavailable)");
      } else {
        throw error;
      }
    }

    try {
      await load();
    } finally {
      setSaving(false);
      setDeleteOpen(false);
      setPendingDelete(null);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFIs</h1>
          <p className="text-muted-foreground">Manage project RFIs and status transitions.</p>
        </div>
        <Button onClick={openCreate}>+ New RFI</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RFI Register</CardTitle>
          <CardDescription>Filter, create, edit, and remove RFIs scoped to this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, subject, or question"
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="0">Open</SelectItem>
                <SelectItem value="1">Answered</SelectItem>
                <SelectItem value="2">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="0">Low</SelectItem>
                <SelectItem value="1">Normal</SelectItem>
                <SelectItem value="2">High</SelectItem>
                <SelectItem value="3">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading RFIs...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No RFIs yet. Create your first request for information.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create RFI</Button>
                  </div>
                ) : (
                  filtered.map((rfi) => (
                    <div key={rfi.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">RFI-{String(rfi.number).padStart(3, "0")}</span>
                        <Badge>{statusLabel(rfi.status)}</Badge>
                      </div>
                      <p className="text-sm">{rfi.subject}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <Badge variant="outline">{priorityLabel(rfi.priority)}</Badge>
                        <span>{formatDate(rfi.dueDate)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/rfis/${rfi.id}?projectId=${projectId}`}>View</Link>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(rfi)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingDelete(rfi);
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
                      <TableHead>RFI #</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              No RFIs yet. Create your first request for information.
                            </p>
                            <Button size="sm" onClick={openCreate}>Create RFI</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((rfi) => (
                        <TableRow key={rfi.id}>
                          <TableCell className="font-medium">RFI-{String(rfi.number).padStart(3, "0")}</TableCell>
                          <TableCell>{rfi.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{priorityLabel(rfi.priority)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge>{statusLabel(rfi.status)}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(rfi.dueDate)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/rfis/${rfi.id}?projectId=${projectId}`}>View</Link>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openEdit(rfi)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPendingDelete(rfi);
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit RFI" : "Create RFI"}</DialogTitle>
            <DialogDescription>
              Maintain subject, assignment, due date, priority, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rfi-subject">Subject</Label>
              <Input
                id="rfi-subject"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Brief RFI subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfi-question">Question</Label>
              <Input
                id="rfi-question"
                value={form.question}
                onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Detailed question"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfi-answer">Answer</Label>
              <Input
                id="rfi-answer"
                value={form.answer}
                onChange={(e) => setForm((prev) => ({ ...prev, answer: e.target.value }))}
                placeholder="Answer (optional)"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={String(form.status)}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: Number.parseInt(value, 10) as RfiStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Open</SelectItem>
                    <SelectItem value="1">Answered</SelectItem>
                    <SelectItem value="2">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={String(form.priority)}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, priority: Number.parseInt(value, 10) as RfiPriority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Low</SelectItem>
                    <SelectItem value="1">Normal</SelectItem>
                    <SelectItem value="2">High</SelectItem>
                    <SelectItem value="3">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rfi-assigned">Assigned To</Label>
                <Input
                  id="rfi-assigned"
                  value={form.assignedToName}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedToName: e.target.value }))}
                  placeholder="Assignee name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfi-ball">Ball In Court</Label>
                <Input
                  id="rfi-ball"
                  value={form.ballInCourtName}
                  onChange={(e) => setForm((prev) => ({ ...prev, ballInCourtName: e.target.value }))}
                  placeholder="Current owner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfi-due-date">Due Date</Label>
              <Input
                id="rfi-due-date"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRfi} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create RFI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete RFI</DialogTitle>
            <DialogDescription>
              Delete “{pendingDelete?.subject ?? "this RFI"}”? If delete is unavailable, it will be marked Closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteRfi} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
