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

interface NarrativeRow {
  id: string;
  title: string;
  narrativeMonth: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

interface NarrativeFormState {
  id?: string;
  title: string;
  narrativeMonth: string;
  executiveSummary: string;
  keyAccomplishments: string;
  upcomingMilestones: string;
  risksAndConcerns: string;
  financialSummary: string;
  scheduleSummary: string;
  status: string;
}

const STATUSES = ["Draft", "Submitted", "Approved", "Published"];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asDataMap(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function formatMonth(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Published":
      return "default";
    case "Approved":
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
    narrativeMonth: new Date().toISOString().slice(0, 10),
    executiveSummary: "",
    keyAccomplishments: "",
    upcomingMilestones: "",
    risksAndConcerns: "",
    financialSummary: "",
    scheduleSummary: "",
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
        narrativeMonth: asString(data.NarrativeMonth ?? data.narrativeMonth),
        status: n.status || "Draft",
        createdAt: n.createdAt,
        updatedAt: n.updatedAt ?? null,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return row.title.toLowerCase().includes(q);
    });
  }, [narratives, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      narrativeMonth: new Date().toISOString().slice(0, 10),
      executiveSummary: "",
      keyAccomplishments: "",
      upcomingMilestones: "",
      risksAndConcerns: "",
      financialSummary: "",
      scheduleSummary: "",
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
      narrativeMonth: row.narrativeMonth ? row.narrativeMonth.slice(0, 10) : "",
      executiveSummary: asString(data.ExecutiveSummary ?? data.executiveSummary),
      keyAccomplishments: asString(data.KeyAccomplishments ?? data.keyAccomplishments),
      upcomingMilestones: asString(data.UpcomingMilestones ?? data.upcomingMilestones),
      risksAndConcerns: asString(data.RisksAndConcerns ?? data.risksAndConcerns),
      financialSummary: asString(data.FinancialSummary ?? data.financialSummary),
      scheduleSummary: asString(data.ScheduleSummary ?? data.scheduleSummary),
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
      data: {
        NarrativeMonth: form.narrativeMonth || null,
        ExecutiveSummary: form.executiveSummary || null,
        KeyAccomplishments: form.keyAccomplishments || null,
        UpcomingMilestones: form.upcomingMilestones || null,
        RisksAndConcerns: form.risksAndConcerns || null,
        FinancialSummary: form.financialSummary || null,
        ScheduleSummary: form.scheduleSummary || null,
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
              placeholder="Search title"
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
                      <div className="text-sm text-muted-foreground">
                        <span>{formatMonth(row.narrativeMonth)}</span>
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
                        {row.status === "Approved" && (
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
                      <TableHead>Month</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[260px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
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
                          <TableCell className="font-mono text-sm">
                            {formatMonth(row.narrativeMonth)}
                          </TableCell>
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
                              {row.status === "Approved" && (
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Narrative" : "New Narrative"}</DialogTitle>
            <DialogDescription>
              Write a monthly project narrative summarizing progress, issues, and outlook.
              Executive Summary is required before submitting.
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="narrative-month">Narrative Month</Label>
                <Input
                  id="narrative-month"
                  type="date"
                  value={form.narrativeMonth}
                  onChange={(e) => setForm((prev) => ({ ...prev, narrativeMonth: e.target.value }))}
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
              <Label htmlFor="narrative-executive-summary">Executive Summary</Label>
              <Textarea
                id="narrative-executive-summary"
                value={form.executiveSummary}
                onChange={(e) => setForm((prev) => ({ ...prev, executiveSummary: e.target.value }))}
                placeholder="High-level summary of the project status this month"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="narrative-accomplishments">Key Accomplishments</Label>
              <Textarea
                id="narrative-accomplishments"
                value={form.keyAccomplishments}
                onChange={(e) => setForm((prev) => ({ ...prev, keyAccomplishments: e.target.value }))}
                placeholder="Major accomplishments and milestones reached"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="narrative-milestones">Upcoming Milestones</Label>
              <Textarea
                id="narrative-milestones"
                value={form.upcomingMilestones}
                onChange={(e) => setForm((prev) => ({ ...prev, upcomingMilestones: e.target.value }))}
                placeholder="Key milestones and targets for the upcoming period"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="narrative-risks">Risks and Concerns</Label>
              <Textarea
                id="narrative-risks"
                value={form.risksAndConcerns}
                onChange={(e) => setForm((prev) => ({ ...prev, risksAndConcerns: e.target.value }))}
                placeholder="Active risks, concerns, and mitigation strategies"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="narrative-financial">Financial Summary</Label>
                <Textarea
                  id="narrative-financial"
                  value={form.financialSummary}
                  onChange={(e) => setForm((prev) => ({ ...prev, financialSummary: e.target.value }))}
                  placeholder="Budget status, cost variances, billing summary"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="narrative-schedule">Schedule Summary</Label>
                <Textarea
                  id="narrative-schedule"
                  value={form.scheduleSummary}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduleSummary: e.target.value }))}
                  placeholder="Schedule status, critical path, milestone dates"
                  rows={3}
                />
              </div>
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
