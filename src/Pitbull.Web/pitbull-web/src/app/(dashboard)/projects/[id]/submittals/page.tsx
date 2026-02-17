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

interface SubmittalRow {
  id: string;
  number: string;
  title: string;
  specSection: string;
  type: string;
  subcontractor: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface SubmittalFormState {
  id?: string;
  title: string;
  number: string;
  specSection: string;
  type: string;
  subcontractor: string;
  description: string;
  dueDate: string;
  status: string;
}

const STATUSES = [
  "Open",
  "Submitted",
  "Under Review",
  "Approved",
  "Approved as Noted",
  "Rejected",
  "Revise & Resubmit",
  "Closed",
];

const SUBMITTAL_TYPES = [
  "Shop Drawing",
  "Product Data",
  "Sample",
  "Design Data",
  "Test Report",
  "Certificate",
  "O&M Manual",
  "Closeout",
  "Other",
];

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

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Approved":
    case "Approved as Noted":
      return "default";
    case "Submitted":
    case "Under Review":
      return "secondary";
    case "Rejected":
    case "Revise & Resubmit":
      return "destructive";
    default:
      return "outline";
  }
}

export default function SubmittalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [submittals, setSubmittals] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SubmittalFormState>({
    title: "",
    number: "",
    specSection: "",
    type: "Shop Drawing",
    subcontractor: "",
    description: "",
    dueDate: "",
    status: "Open",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubmittalRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/submittals?page=1&pageSize=500`
      );
      setSubmittals(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load submittals", {
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
    const mapped = submittals.map<SubmittalRow>((sub) => {
      const data = asDataMap(sub.data);
      return {
        id: sub.id,
        number: sub.name || asString(data.Number ?? data.number) || "-",
        title: sub.title || "Untitled submittal",
        specSection: asString(data.SpecSection ?? data.specSection),
        type: asString(data.Type ?? data.type) || "Other",
        subcontractor: asString(data.SubcontractorName ?? data.subcontractorName),
        status: sub.status || "Open",
        dueDate: asString(data.DueDate ?? data.dueDate) || null,
        createdAt: sub.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.number.toLowerCase().includes(q) ||
        row.specSection.toLowerCase().includes(q) ||
        row.subcontractor.toLowerCase().includes(q)
      );
    });
  }, [submittals, search, statusFilter, typeFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      number: "",
      specSection: "",
      type: "Shop Drawing",
      subcontractor: "",
      description: "",
      dueDate: "",
      status: "Open",
    });
    setDialogOpen(true);
  }

  function openEdit(row: SubmittalRow) {
    setEditing(true);
    const source = submittals.find((s) => s.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      title: row.title,
      number: row.number !== "-" ? row.number : "",
      specSection: row.specSection,
      type: row.type,
      subcontractor: row.subcontractor,
      description: asString(data.Description ?? data.description),
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : "",
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveSubmittal() {
    if (!form.title.trim()) {
      toast.error("Submittal title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      name: form.number.trim() || undefined,
      status: form.status,
      dueDate: form.dueDate || undefined,
      data: {
        SpecSection: form.specSection || null,
        Type: form.type,
        SubcontractorName: form.subcontractor || null,
        Description: form.description || null,
        DueDate: form.dueDate || null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/submittals/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Submittal updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/submittals`, {
          method: "POST",
          body: payload,
        });
        toast.success("Submittal created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save submittal", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubmittal() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/submittals/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Submittal deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        const payload: PmUpsertRequest = {
          title: pendingDelete.title,
          status: "Closed",
          data: {
            SpecSection: pendingDelete.specSection || null,
            Type: pendingDelete.type,
            SubcontractorName: pendingDelete.subcontractor || null,
          },
        };

        await api<PmEntityDto>(`/api/projects/${projectId}/submittals/${pendingDelete.id}`, {
          method: "PUT",
          body: payload,
        });

        toast.success("Submittal marked closed (delete endpoint unavailable)");
        setDeleteOpen(false);
        setPendingDelete(null);
        await load();
      } else {
        toast.error("Failed to delete submittal", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submittals</h1>
          <p className="text-muted-foreground">
            Submittal register, review workflow, and tracking.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Submittal</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submittal Register</CardTitle>
          <CardDescription>
            Track submittals from creation through review and approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, title, spec, or subcontractor"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SUBMITTAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading submittals...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submittals found.</p>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{row.number}</span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="font-medium">{row.title}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {row.specSection && <span>Spec: {row.specSection}</span>}
                        <span>{row.type}</span>
                        {row.subcontractor && <span>{row.subcontractor}</span>}
                      </div>
                      {row.dueDate && (
                        <p className="text-sm text-muted-foreground">
                          Due: {formatDate(row.dueDate)}
                        </p>
                      )}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No.</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Spec Section</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subcontractor</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground">
                          No submittals found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-sm">{row.number}</TableCell>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell>{row.specSection || "-"}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell>{row.subcontractor || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(row.dueDate)}
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
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Submittal" : "New Submittal"}</DialogTitle>
            <DialogDescription>
              Define submittal details, spec section, type, and responsible subcontractor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub-number">Submittal Number</Label>
                <Input
                  id="sub-number"
                  value={form.number}
                  onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
                  placeholder="e.g. SUB-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-spec">Spec Section</Label>
                <Input
                  id="sub-spec"
                  value={form.specSection}
                  onChange={(e) => setForm((prev) => ({ ...prev, specSection: e.target.value }))}
                  placeholder="e.g. 03 30 00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-title">Title</Label>
              <Input
                id="sub-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Submittal title"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                    {SUBMITTAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-contractor">Subcontractor</Label>
                <Input
                  id="sub-contractor"
                  value={form.subcontractor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subcontractor: e.target.value }))
                  }
                  placeholder="Responsible subcontractor"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-desc">Description</Label>
              <Textarea
                id="sub-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description or notes"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub-due">Due Date</Label>
                <Input
                  id="sub-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
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
            <Button onClick={saveSubmittal} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Submittal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Submittal</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this submittal"}&quot;? If delete is
              unavailable, it will be marked Closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteSubmittal} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
