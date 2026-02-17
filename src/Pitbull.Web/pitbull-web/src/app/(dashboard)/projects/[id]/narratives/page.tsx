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

interface NarrativeRow {
  id: string;
  title: string;
  period: string;
  author: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

interface NarrativeFormState {
  id?: string;
  title: string;
  period: string;
  author: string;
  content: string;
  status: string;
}

const STATUSES = ["Draft", "Submitted", "Published"];

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
    case "Published":
      return "default";
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

export default function NarrativesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [narratives, setNarratives] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<NarrativeFormState>({
    title: "",
    period: "",
    author: "",
    content: "",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<NarrativeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/narratives?page=1&pageSize=500`
      );
      setNarratives(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load narratives", {
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
    const mapped = narratives.map<NarrativeRow>((n) => {
      const data = asDataMap(n.data);
      return {
        id: n.id,
        title: n.title || "Untitled narrative",
        period: asString(data.Period ?? data.period),
        author: asString(data.Author ?? data.author),
        status: n.status || "Draft",
        createdAt: n.createdAt,
        updatedAt: n.updatedAt ?? null,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.period.toLowerCase().includes(q) ||
        row.author.toLowerCase().includes(q)
      );
    });
  }, [narratives, search, statusFilter]);

  function openCreate() {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setEditing(false);
    setForm({
      title: "",
      period: defaultPeriod,
      author: "",
      content: "",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: NarrativeRow) {
    setEditing(true);
    const source = narratives.find((n) => n.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      title: row.title,
      period: row.period,
      author: row.author,
      content: asString(data.Content ?? data.content),
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveNarrative() {
    if (!form.title.trim()) {
      toast.error("Narrative title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      description: form.content || undefined,
      data: {
        Period: form.period || null,
        Author: form.author || null,
        Content: form.content || null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/narratives/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Narrative updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/narratives`, {
          method: "POST",
          body: payload,
        });
        toast.success("Narrative created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save narrative", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function submitNarrative(id: string) {
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/narratives/${id}/submit`, {
        method: "POST",
      });
      toast.success("Narrative submitted for review");
      await load();
    } catch (error) {
      toast.error("Failed to submit narrative", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async function publishNarrative(id: string) {
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/narratives/${id}/publish`, {
        method: "POST",
      });
      toast.success("Narrative published");
      await load();
    } catch (error) {
      toast.error("Failed to publish narrative", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async function deleteNarrative() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/narratives/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Narrative deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete endpoint is not available yet for narratives"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete narrative", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Narratives</h1>
          <p className="text-muted-foreground">
            Monthly project narratives and revision history.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Narrative</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Narrative Log</CardTitle>
          <CardDescription>
            Create, edit, submit, and publish monthly project narratives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, period, or author"
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
            <p className="text-sm text-muted-foreground">Loading narratives...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No narratives yet. Create your first narrative for this project.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Narrative</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{row.title}</span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {row.period && <span>{row.period}</span>}
                        {row.author && <span>{row.author}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Updated: {formatDate(row.updatedAt || row.createdAt)}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        {row.status === "Draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => submitNarrative(row.id)}
                          >
                            Submit
                          </Button>
                        )}
                        {row.status === "Submitted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => publishNarrative(row.id)}
                          >
                            Publish
                          </Button>
                        )}
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
                      <TableHead>Period</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[260px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              No narratives yet. Create your first narrative for this project.
                            </p>
                            <Button size="sm" onClick={openCreate}>Create Narrative</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell className="font-mono text-sm">{row.period || "-"}</TableCell>
                          <TableCell>{row.author || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(row.updatedAt || row.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(row)}
                              >
                                Edit
                              </Button>
                              {row.status === "Draft" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => submitNarrative(row.id)}
                                >
                                  Submit
                                </Button>
                              )}
                              {row.status === "Submitted" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => publishNarrative(row.id)}
                                >
                                  Publish
                                </Button>
                              )}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Narrative" : "New Narrative"}</DialogTitle>
            <DialogDescription>
              Write a monthly project narrative summarizing progress, issues, and outlook.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="narrative-title">Title</Label>
              <Input
                id="narrative-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. January 2026 Monthly Narrative"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="narrative-period">Period</Label>
                <Input
                  id="narrative-period"
                  type="month"
                  value={form.period}
                  onChange={(e) => setForm((prev) => ({ ...prev, period: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="narrative-author">Author</Label>
                <Input
                  id="narrative-author"
                  value={form.author}
                  onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
                  placeholder="Author name"
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

            <div className="space-y-2">
              <Label htmlFor="narrative-content">Narrative Content</Label>
              <Textarea
                id="narrative-content"
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Project narrative - describe progress, challenges, upcoming milestones, and outlook"
                rows={8}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveNarrative} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Narrative"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Narrative</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this narrative"}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteNarrative} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
