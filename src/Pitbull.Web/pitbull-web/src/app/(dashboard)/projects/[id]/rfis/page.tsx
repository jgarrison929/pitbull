"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import api, { ApiError, uploadFiles } from "@/lib/api";
import { isValidGuid, cn } from "@/lib/utils";
import {
  getVirtualWindow,
  sliceVirtualItems,
} from "@/lib/list-virtualization";
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
import { FileDropZone } from "@/components/ui/file-drop-zone";

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

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

function statusBadgeClass(status: RfiStatus): string {
  switch (status) {
    case 0:
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case 1:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case 2:
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    default:
      return "";
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

function priorityBadgeClass(priority: RfiPriority): string {
  switch (priority) {
    case 0:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case 1:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case 2:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case 3:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "";
  }
}

function daysOpen(createdAt: string): number {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(rfi: Rfi): boolean {
  return rfi.status === 0 && daysOpen(rfi.createdAt) > 14;
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
  /** Mobile list windowing (2.13.0) — server pageSize unchanged. */
  const [mobileScrollTop, setMobileScrollTop] = useState(0);
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const MOBILE_RFI_ROW_PX = 168;
  const MOBILE_RFI_VIEWPORT_PX = 420;
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

  const [attachments, setAttachments] = useState<FileItem[]>([]);

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

  const mobileWindow = useMemo(
    () =>
      getVirtualWindow(
        filtered.length,
        MOBILE_RFI_ROW_PX,
        mobileScrollTop,
        MOBILE_RFI_VIEWPORT_PX,
        3
      ),
    [filtered.length, mobileScrollTop]
  );
  const mobileVisibleRfis = useMemo(
    () => sliceVirtualItems(filtered, mobileWindow),
    [filtered, mobileWindow]
  );

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
    setAttachments([]);
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
    setAttachments([]);
    setDialogOpen(true);
  }

  async function saveRfi() {
    if (!form.subject.trim() || !form.question.trim()) {
      toast.error("Subject and question are required");
      return;
    }

    setSaving(true);
    try {
      let savedRfiId: string;

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
        savedRfiId = form.id;
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

        const created = await api<Rfi>(`/api/projects/${projectId}/rfis`, {
          method: "POST",
          body: payload,
        });
        savedRfiId = created.id;
        toast.success("RFI created");
      }

      // Upload pending attachments
      const realFiles = attachments.map((f) => f.file).filter((f): f is File => f !== undefined);
      if (realFiles.length > 0) {
        try {
          const endpoint = realFiles.length === 1 ? "/api/files/upload" : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "Rfi",
            relatedEntityId: savedRfiId,
          });
          toast.success(`${realFiles.length} attachment(s) uploaded`);
        } catch {
          toast.error("RFI saved but file upload failed");
        }
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
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      toast.error("Failed to delete RFI", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
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
              {/* Mobile card layout — virtualized window (2.13.0); API pageSize unchanged */}
              <div className="space-y-3 sm:hidden">
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No RFIs yet. Create your first request for information.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create RFI</Button>
                  </div>
                ) : (
                  <div
                    ref={mobileListRef}
                    data-testid="project-rfis-mobile-virtual-list"
                    className="overflow-y-auto overscroll-contain"
                    style={{ maxHeight: MOBILE_RFI_VIEWPORT_PX }}
                    onScroll={(e) => setMobileScrollTop(e.currentTarget.scrollTop)}
                  >
                    <div style={{ height: mobileWindow.totalHeight, position: "relative" }}>
                      <div style={{ height: mobileWindow.paddingTop }} />
                      <div className="space-y-3">
                        {mobileVisibleRfis.map((rfi) => (
                          <div
                            key={rfi.id}
                            className={cn(
                              "rounded-lg border p-4 space-y-2",
                              isOverdue(rfi) && "border-red-300 dark:border-red-800"
                            )}
                            style={{ minHeight: MOBILE_RFI_ROW_PX - 12 }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                RFI-{String(rfi.number).padStart(3, "0")}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isOverdue(rfi) && (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                                    Overdue
                                  </Badge>
                                )}
                                <Badge className={statusBadgeClass(rfi.status)}>
                                  {statusLabel(rfi.status)}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm">{rfi.subject}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <Badge className={priorityBadgeClass(rfi.priority) + " text-xs"}>
                                {priorityLabel(rfi.priority)}
                              </Badge>
                              {rfi.status === 0 && (
                                <span
                                  className={
                                    daysOpen(rfi.createdAt) > 14
                                      ? "text-red-600 font-medium"
                                      : ""
                                  }
                                >
                                  {daysOpen(rfi.createdAt)}d open
                                </span>
                              )}
                              {rfi.ballInCourtName && (
                                <span>Ball in Court: {rfi.ballInCourtName}</span>
                              )}
                              <span>Due: {formatDate(rfi.dueDate)}</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/rfis/${rfi.id}?projectId=${projectId}`}>
                                  View
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(rfi)}
                              >
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
                        ))}
                      </div>
                      <div style={{ height: mobileWindow.paddingBottom }} />
                    </div>
                  </div>
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
                      <TableHead>Days Open</TableHead>
                      <TableHead>Ball in Court</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
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
                        <TableRow key={rfi.id} className={isOverdue(rfi) ? "bg-red-50/50 dark:bg-red-950/20" : undefined}>
                          <TableCell className="font-medium">RFI-{String(rfi.number).padStart(3, "0")}</TableCell>
                          <TableCell>{rfi.subject}</TableCell>
                          <TableCell>
                            <Badge className={priorityBadgeClass(rfi.priority) + " text-xs"}>{priorityLabel(rfi.priority)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {rfi.status === 0 ? (
                              <div className="flex items-center gap-1.5">
                                <span className={daysOpen(rfi.createdAt) > 14 ? "text-red-600 font-medium" : ""}>
                                  {daysOpen(rfi.createdAt)}d
                                </span>
                                {isOverdue(rfi) && (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">Overdue</Badge>
                                )}
                              </div>
                            ) : rfi.status === 2 ? (
                              <span className="text-muted-foreground">Closed</span>
                            ) : (
                              <span className="text-muted-foreground">Answered</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {rfi.ballInCourtName ? (
                              <Badge variant="secondary" className="text-xs">{rfi.ballInCourtName}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(rfi.status)}>{statusLabel(rfi.status)}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatDate(rfi.dueDate)}</TableCell>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-2">
              <Label>Attachments</Label>
              <FileDropZone
                files={attachments}
                onFilesChange={setAttachments}
                maxSizeMB={10}
                maxFiles={10}
                disabled={saving}
                placeholder="Drop files here (photos, PDFs, drawings)"
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
