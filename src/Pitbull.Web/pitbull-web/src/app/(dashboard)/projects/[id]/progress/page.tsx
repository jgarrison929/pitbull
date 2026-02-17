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

interface ProgressRow {
  id: string;
  entryDate: string;
  name: string;
  percentComplete: number;
  plannedPercent: number;
  earnedValue: number;
  measurementMethod: string;
  quantity: number;
  unit: string;
  description: string;
  status: string;
}

interface ProgressFormState {
  id?: string;
  name: string;
  entryDate: string;
  percentComplete: string;
  plannedPercent: string;
  earnedValue: string;
  measurementMethod: string;
  quantity: string;
  unit: string;
  description: string;
  status: string;
}

const STATUSES = ["Draft", "Submitted", "Approved"];
const MEASUREMENT_METHODS = ["Percentage", "Units", "Milestones", "LevelOfEffort", "WeightedSteps"];

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
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
    case "Approved":
      return "default";
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [entries, setEntries] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProgressFormState>({
    name: "",
    entryDate: new Date().toISOString().slice(0, 10),
    percentComplete: "0",
    plannedPercent: "0",
    earnedValue: "0",
    measurementMethod: "Percentage",
    quantity: "0",
    unit: "",
    description: "",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProgressRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/progress-entries?page=1&pageSize=500`
      );
      setEntries(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load progress entries", {
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
    const mapped = entries.map<ProgressRow>((entry) => {
      const data = asDataMap(entry.data);
      return {
        id: entry.id,
        entryDate: asString(data.EntryDate ?? data.entryDate) || entry.createdAt,
        name: entry.name || entry.title || "Untitled",
        percentComplete: asNumber(data.PercentComplete ?? data.percentComplete),
        plannedPercent: asNumber(data.PlannedPercent ?? data.plannedPercent),
        earnedValue: asNumber(data.EarnedValue ?? data.earnedValue),
        measurementMethod: asString(data.MeasurementMethod ?? data.measurementMethod) || "Percentage",
        quantity: asNumber(data.Quantity ?? data.quantity),
        unit: asString(data.Unit ?? data.unit),
        description: asString(data.Description ?? data.description),
        status: entry.status || "Draft",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.measurementMethod.toLowerCase().includes(q)
      );
    });
  }, [entries, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      name: "",
      entryDate: new Date().toISOString().slice(0, 10),
      percentComplete: "0",
      plannedPercent: "0",
      earnedValue: "0",
      measurementMethod: "Percentage",
      quantity: "0",
      unit: "",
      description: "",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: ProgressRow) {
    setEditing(true);
    setForm({
      id: row.id,
      name: row.name,
      entryDate: row.entryDate ? row.entryDate.slice(0, 10) : "",
      percentComplete: row.percentComplete.toString(),
      plannedPercent: row.plannedPercent.toString(),
      earnedValue: row.earnedValue.toString(),
      measurementMethod: row.measurementMethod,
      quantity: row.quantity.toString(),
      unit: row.unit,
      description: row.description,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveEntry() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.name.trim(),
      status: form.status,
      data: {
        EntryDate: form.entryDate || null,
        PercentComplete: parseFloat(form.percentComplete) || 0,
        PlannedPercent: parseFloat(form.plannedPercent) || 0,
        EarnedValue: parseFloat(form.earnedValue) || 0,
        MeasurementMethod: form.measurementMethod,
        Quantity: parseFloat(form.quantity) || 0,
        Unit: form.unit || null,
        Description: form.description || null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/progress-entries/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Progress entry updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/progress-entries`, {
          method: "POST",
          body: payload,
        });
        toast.success("Progress entry created");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save progress entry", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function approveEntry(id: string) {
    setSaving(true);
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/progress-entries/${id}/approve`, {
        method: "POST",
      });
      toast.success("Progress entry approved");
      await load();
    } catch (error) {
      toast.error("Failed to approve", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/progress-entries/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Progress entry deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete is not available yet for progress entries"
          : error instanceof Error
            ? error.message
            : "Unknown error";
      toast.error("Failed to delete", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress Tracking</h1>
          <p className="text-muted-foreground">
            Track project progress with percent complete, earned value, and measurement data.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Entry</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress Entries</CardTitle>
          <CardDescription>
            Record and monitor progress measurements for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or method"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading progress entries...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No progress entries yet. Create your first entry.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Entry</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatDate(row.entryDate)}
                        </span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="font-medium">{row.name}</p>
                      <div className="flex gap-4 text-sm">
                        <span>Actual: {row.percentComplete}%</span>
                        <span>Planned: {row.plannedPercent}%</span>
                      </div>
                      {row.description && (
                        <p className="text-sm text-muted-foreground truncate">{row.description}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        {row.status === "Submitted" && (
                          <Button variant="outline" size="sm" onClick={() => approveEntry(row.id)} disabled={saving}>
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setPendingDelete(row); setDeleteOpen(true); }}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Actual %</TableHead>
                        <TableHead className="text-right">Planned %</TableHead>
                        <TableHead className="text-right">Earned Value</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No progress entries yet.
                              </p>
                              <Button size="sm" onClick={openCreate}>Create Entry</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">{formatDate(row.entryDate)}</TableCell>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right font-mono">{row.percentComplete}%</TableCell>
                            <TableCell className="text-right font-mono">{row.plannedPercent}%</TableCell>
                            <TableCell className="text-right font-mono">
                              ${row.earnedValue.toLocaleString()}
                            </TableCell>
                            <TableCell>{row.measurementMethod}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                  Edit
                                </Button>
                                {row.status === "Submitted" && (
                                  <Button variant="outline" size="sm" onClick={() => approveEntry(row.id)} disabled={saving}>
                                    Approve
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setPendingDelete(row); setDeleteOpen(true); }}
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
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Progress Entry" : "New Progress Entry"}</DialogTitle>
            <DialogDescription>
              Record progress measurement data for this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="progress-name">Name</Label>
                <Input
                  id="progress-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Foundation Phase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress-date">Entry Date</Label>
                <Input
                  id="progress-date"
                  type="date"
                  value={form.entryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, entryDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="progress-percent">Percent Complete (%)</Label>
                <Input
                  id="progress-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.percentComplete}
                  onChange={(e) => setForm((prev) => ({ ...prev, percentComplete: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress-planned">Planned Percent (%)</Label>
                <Input
                  id="progress-planned"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.plannedPercent}
                  onChange={(e) => setForm((prev) => ({ ...prev, plannedPercent: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress-ev">Earned Value ($)</Label>
                <Input
                  id="progress-ev"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.earnedValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, earnedValue: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Measurement Method</Label>
                <Select
                  value={form.measurementMethod}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, measurementMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress-qty">Quantity</Label>
                <Input
                  id="progress-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progress-unit">Unit</Label>
                <Input
                  id="progress-unit"
                  value={form.unit}
                  onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="CY, SF, LF, etc."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="progress-desc">Description</Label>
              <Textarea
                id="progress-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Notes about this progress measurement"
              />
            </div>

            <div className="w-48">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Progress Entry</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.name ?? "this entry"}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteEntry} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
