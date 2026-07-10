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

interface DataMap {
  [key: string]: unknown;
}

interface ProjectionRow {
  id: string;
  name: string;
  projectionDate: string;
  projectedCompletionDate: string;
  projectedFinalCost: number;
  originalBudget: number;
  approvedChanges: number;
  pendingChanges: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  description: string;
  assumptions: string;
  status: string;
}

interface ProjectionFormState {
  id?: string;
  name: string;
  projectionDate: string;
  projectedCompletionDate: string;
  projectedFinalCost: string;
  originalBudget: string;
  approvedChanges: string;
  pendingChanges: string;
  estimateAtCompletion: string;
  estimateToComplete: string;
  varianceAtCompletion: string;
  description: string;
  assumptions: string;
  status: string;
}

const STATUSES = ["Draft", "Submitted", "Approved", "Superseded"];

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
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

export default function CostProjectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);

  const [projections, setProjections] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProjectionFormState>({
    name: "",
    projectionDate: new Date().toISOString().slice(0, 10),
    projectedCompletionDate: "",
    projectedFinalCost: "0",
    originalBudget: "0",
    approvedChanges: "0",
    pendingChanges: "0",
    estimateAtCompletion: "0",
    estimateToComplete: "0",
    varianceAtCompletion: "0",
    description: "",
    assumptions: "",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectionRow | null>(null);

  // Inline-edit state for grid-first UX
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/monthly-projections?page=1&pageSize=500`
      );
      setProjections(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load cost projections", {
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
    const mapped = projections.map<ProjectionRow>((proj) => {
      const data = asDataMap(proj.data);
      return {
        id: proj.id,
        name: proj.name || proj.title || "Untitled",
        projectionDate: asString(data.ProjectionDate ?? data.projectionDate) || proj.createdAt,
        projectedCompletionDate: asString(data.ProjectedCompletionDate ?? data.projectedCompletionDate),
        projectedFinalCost: asNumber(data.ProjectedFinalCost ?? data.projectedFinalCost),
        originalBudget: asNumber(data.OriginalBudget ?? data.originalBudget),
        approvedChanges: asNumber(data.ApprovedChanges ?? data.approvedChanges),
        pendingChanges: asNumber(data.PendingChanges ?? data.pendingChanges),
        estimateAtCompletion: asNumber(data.EstimateAtCompletion ?? data.estimateAtCompletion),
        estimateToComplete: asNumber(data.EstimateToComplete ?? data.estimateToComplete),
        varianceAtCompletion: asNumber(data.VarianceAtCompletion ?? data.varianceAtCompletion),
        description: asString(data.Description ?? data.description),
        assumptions: asString(data.Assumptions ?? data.assumptions),
        status: proj.status || "Draft",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        row.assumptions.toLowerCase().includes(q)
      );
    });
  }, [projections, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      name: "",
      projectionDate: new Date().toISOString().slice(0, 10),
      projectedCompletionDate: "",
      projectedFinalCost: "0",
      originalBudget: "0",
      approvedChanges: "0",
      pendingChanges: "0",
      estimateAtCompletion: "0",
      estimateToComplete: "0",
      varianceAtCompletion: "0",
      description: "",
      assumptions: "",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: ProjectionRow) {
    setEditing(true);
    setForm({
      id: row.id,
      name: row.name,
      projectionDate: row.projectionDate ? row.projectionDate.slice(0, 10) : "",
      projectedCompletionDate: row.projectedCompletionDate ? row.projectedCompletionDate.slice(0, 10) : "",
      projectedFinalCost: row.projectedFinalCost.toString(),
      originalBudget: row.originalBudget.toString(),
      approvedChanges: row.approvedChanges.toString(),
      pendingChanges: row.pendingChanges.toString(),
      estimateAtCompletion: row.estimateAtCompletion.toString(),
      estimateToComplete: row.estimateToComplete.toString(),
      varianceAtCompletion: row.varianceAtCompletion.toString(),
      description: row.description,
      assumptions: row.assumptions,
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveProjection() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.name.trim(),
      status: form.status,
      data: {
        ProjectionDate: form.projectionDate || null,
        ProjectedCompletionDate: form.projectedCompletionDate || null,
        ProjectedFinalCost: parseFloat(form.projectedFinalCost) || 0,
        OriginalBudget: parseFloat(form.originalBudget) || 0,
        ApprovedChanges: parseFloat(form.approvedChanges) || 0,
        PendingChanges: parseFloat(form.pendingChanges) || 0,
        EstimateAtCompletion: parseFloat(form.estimateAtCompletion) || 0,
        EstimateToComplete: parseFloat(form.estimateToComplete) || 0,
        VarianceAtCompletion: parseFloat(form.varianceAtCompletion) || 0,
        Description: form.description || null,
        Assumptions: form.assumptions || null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/monthly-projections/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Cost projection updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/monthly-projections`, {
          method: "POST",
          body: payload,
        });
        toast.success("Cost projection created");
      }
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save cost projection", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function submitProjection(id: string) {
    setSaving(true);
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/monthly-projections/${id}/submit`, {
        method: "POST",
      });
      toast.success("Cost projection submitted");
      await load();
    } catch (error) {
      toast.error("Failed to submit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function approveProjection(id: string) {
    setSaving(true);
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/monthly-projections/${id}/approve`, {
        method: "POST",
      });
      toast.success("Cost projection approved");
      await load();
    } catch (error) {
      toast.error("Failed to approve", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteProjection() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/monthly-projections/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Cost projection deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Could not delete this projection"
          : error instanceof Error
            ? error.message
            : "Unknown error";
      toast.error("Failed to delete", { description: message });
    } finally {
      setSaving(false);
    }
  }

  type InlineField = "originalBudget" | "estimateAtCompletion" | "estimateToComplete" | "varianceAtCompletion";

  function startInlineEdit(rowId: string, field: InlineField, currentValue: number) {
    setEditingCell({ rowId, field });
    setEditingValue(String(currentValue));
  }

  const inlineSavingRef = useRef(false);
  async function commitInlineEdit(row: ProjectionRow) {
    if (!editingCell || inlineSavingRef.current) return;
    inlineSavingRef.current = true;
    const field = editingCell.field as InlineField;
    const newValue = parseFloat(editingValue) || 0;

    // If value unchanged, just cancel
    if (newValue === row[field]) {
      setEditingCell(null);
      inlineSavingRef.current = false;
      return;
    }

    const updatedRow = { ...row, [field]: newValue };

    const payload: PmUpsertRequest = {
      name: updatedRow.name,
      status: updatedRow.status,
      data: {
        ProjectionDate: updatedRow.projectionDate || null,
        ProjectedCompletionDate: updatedRow.projectedCompletionDate || null,
        ProjectedFinalCost: updatedRow.projectedFinalCost,
        OriginalBudget: updatedRow.originalBudget,
        ApprovedChanges: updatedRow.approvedChanges,
        PendingChanges: updatedRow.pendingChanges,
        EstimateAtCompletion: updatedRow.estimateAtCompletion,
        EstimateToComplete: updatedRow.estimateToComplete,
        VarianceAtCompletion: updatedRow.varianceAtCompletion,
        Description: updatedRow.description || null,
        Assumptions: updatedRow.assumptions || null,
      },
    };

    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/monthly-projections/${row.id}`, {
        method: "PUT",
        body: payload,
      });
      toast.success("Value saved");
      setEditingCell(null);
      await load();
    } catch {
      toast.error("Failed to save");
    } finally {
      inlineSavingRef.current = false;
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Cost Projections</h1>
          <p className="text-muted-foreground">
            Track cost projections, budgets, and estimates for this project.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Cost Projection</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Projections</CardTitle>
          <CardDescription>
            Create and manage monthly cost projections. Click a value to edit inline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or assumptions"
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
            <p className="text-sm text-muted-foreground">Loading cost projections...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No cost projections yet. Create your first cost projection.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Cost Projection</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatDate(row.projectionDate)}
                        </span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="font-medium">{row.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Budget: </span>
                          <span className="font-mono">{formatCurrency(row.originalBudget)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">EAC: </span>
                          <span className="font-mono">{formatCurrency(row.estimateAtCompletion)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ETC: </span>
                          <span className="font-mono">{formatCurrency(row.estimateToComplete)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">VAC: </span>
                          <span className={`font-mono ${row.varianceAtCompletion < 0 ? "text-red-600" : ""}`}>
                            {formatCurrency(row.varianceAtCompletion)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        {row.status === "Draft" && (
                          <Button variant="outline" size="sm" onClick={() => submitProjection(row.id)} disabled={saving}>
                            Submit
                          </Button>
                        )}
                        {row.status === "Submitted" && (
                          <Button variant="outline" size="sm" onClick={() => approveProjection(row.id)} disabled={saving}>
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

              {/* Desktop table — grid-first with inline editing */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="text-right font-semibold">Budget</TableHead>
                        <TableHead className="text-right font-semibold">EAC</TableHead>
                        <TableHead className="text-right font-semibold">ETC</TableHead>
                        <TableHead className="text-right font-semibold">VAC</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="w-[220px] font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No cost projections yet.
                              </p>
                              <Button size="sm" onClick={openCreate}>Create Cost Projection</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => {
                          function renderEditableCell(field: InlineField, value: number, extraClass?: string) {
                            const isEditing = editingCell?.rowId === row.id && editingCell?.field === field;
                            if (isEditing) {
                              return (
                                <TableCell className="text-right p-1">
                                  <Input
                                    type="number"
                                    className="h-7 text-right font-mono text-sm w-28 ml-auto"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={() => commitInlineEdit(row)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        (e.target as HTMLInputElement).blur();
                                      }
                                      if (e.key === "Escape") setEditingCell(null);
                                    }}
                                    autoFocus
                                  />
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell
                                className={`text-right font-mono cursor-pointer hover:bg-muted/50 transition-colors ${extraClass || ""}`}
                                onClick={() => startInlineEdit(row.id, field, value)}
                                title="Click to edit"
                              >
                                {formatCurrency(value)}
                              </TableCell>
                            );
                          }

                          return (
                            <TableRow key={row.id} className="hover:bg-muted/30">
                              <TableCell className="font-mono text-sm">{formatDate(row.projectionDate)}</TableCell>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              {renderEditableCell("originalBudget", row.originalBudget)}
                              {renderEditableCell("estimateAtCompletion", row.estimateAtCompletion)}
                              {renderEditableCell("estimateToComplete", row.estimateToComplete)}
                              {renderEditableCell("varianceAtCompletion", row.varianceAtCompletion, row.varianceAtCompletion < 0 ? "text-red-600" : "")}
                              <TableCell>
                                <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                    Edit
                                  </Button>
                                  {row.status === "Draft" && (
                                    <Button variant="outline" size="sm" onClick={() => submitProjection(row.id)} disabled={saving}>
                                      Submit
                                    </Button>
                                  )}
                                  {row.status === "Submitted" && (
                                    <Button variant="outline" size="sm" onClick={() => approveProjection(row.id)} disabled={saving}>
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
                          );
                        })
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Cost Projection" : "New Cost Projection"}</DialogTitle>
            <DialogDescription>
              Enter cost projection data for this project period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="proj-name">Name</Label>
                <Input
                  id="proj-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="February 2026 Projection"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-date">Projection Date</Label>
                <Input
                  id="proj-date"
                  type="date"
                  value={form.projectionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectionDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-completion">Projected Completion</Label>
                <Input
                  id="proj-completion"
                  type="date"
                  value={form.projectedCompletionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectedCompletionDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="proj-budget">Original Budget ($)</Label>
                <Input
                  id="proj-budget"
                  type="number"
                  min="0"
                  step="1"
                  value={form.originalBudget}
                  onChange={(e) => setForm((prev) => ({ ...prev, originalBudget: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-approved">Approved Changes ($)</Label>
                <Input
                  id="proj-approved"
                  type="number"
                  step="1"
                  value={form.approvedChanges}
                  onChange={(e) => setForm((prev) => ({ ...prev, approvedChanges: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-pending">Pending Changes ($)</Label>
                <Input
                  id="proj-pending"
                  type="number"
                  step="1"
                  value={form.pendingChanges}
                  onChange={(e) => setForm((prev) => ({ ...prev, pendingChanges: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="proj-final-cost">Projected Final Cost ($)</Label>
                <Input
                  id="proj-final-cost"
                  type="number"
                  min="0"
                  step="1"
                  value={form.projectedFinalCost}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectedFinalCost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-eac">Estimate at Completion ($)</Label>
                <Input
                  id="proj-eac"
                  type="number"
                  min="0"
                  step="1"
                  value={form.estimateAtCompletion}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimateAtCompletion: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="proj-etc">Estimate to Complete ($)</Label>
                <Input
                  id="proj-etc"
                  type="number"
                  min="0"
                  step="1"
                  value={form.estimateToComplete}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimateToComplete: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-vac">Variance at Completion ($)</Label>
                <Input
                  id="proj-vac"
                  type="number"
                  step="1"
                  value={form.varianceAtCompletion}
                  onChange={(e) => setForm((prev) => ({ ...prev, varianceAtCompletion: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-desc">Description</Label>
              <Textarea
                id="proj-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
                placeholder="Summary of this projection period"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proj-assumptions">Assumptions</Label>
              <Textarea
                id="proj-assumptions"
                value={form.assumptions}
                onChange={(e) => setForm((prev) => ({ ...prev, assumptions: e.target.value }))}
                rows={2}
                placeholder="Key assumptions underlying this projection"
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
            <Button onClick={saveProjection} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Cost Projection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Cost Projection</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.name ?? "this cost projection"}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteProjection} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
