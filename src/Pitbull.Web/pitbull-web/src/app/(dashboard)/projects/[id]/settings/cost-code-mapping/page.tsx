"use client";

import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TableSkeleton } from "@/components/skeletons";
import api from "@/lib/api";
import type { CostCode, ListCostCodesResult } from "@/lib/types";
import type { PmEntityDto, PmPagedResult } from "@/lib/pm-types";
import {
  listCostCodeMappings,
  createCostCodeMapping,
  updateCostCodeMapping,
  deleteCostCodeMapping,
} from "@/lib/progress-api";

// ─── helpers ─────────────────────────────────────────────────────────────────

function d(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isNaN(n) ? 0 : n; }
  return 0;
}

// Lightweight schedule activity type from /api/projects/{id}/schedules/{sid}/activities
interface ScheduleActivity {
  id: string;
  name?: string | null;
  title?: string | null;
  data?: unknown;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function CostCodeMappingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [projectName, setProjectName] = useState("Project");
  const [mappings, setMappings] = useState<PmEntityDto[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: undefined as string | undefined,
    costCodeId: "",
    scheduleActivityId: "",
    weightFactor: "1.0",
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMappings = useCallback(async () => {
    try {
      const result = await listCostCodeMappings(id, { pageSize: 200 });
      setMappings(result.items);
    } catch {
      toast.error("Failed to load mappings");
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        // Load project, cost codes, and schedule activities in parallel
        const [projectData, costCodeData, schedulesData] = await Promise.all([
          api<{ name: string }>(`/api/projects/${id}`).catch(() => ({ name: "Project" })),
          api<ListCostCodesResult>(`/api/cost-codes?pageSize=200`).catch(
            () => ({ items: [] as CostCode[], totalCount: 0, page: 1, pageSize: 200, totalPages: 0 })
          ),
          api<PmPagedResult>(`/api/projects/${id}/schedules?pageSize=5`).catch(
            () => ({ items: [], totalCount: 0, page: 1, pageSize: 5, totalPages: 0, hasPreviousPage: false, hasNextPage: false })
          ),
        ]);
        if (cancelled) return;
        setProjectName(projectData.name);
        setCostCodes(costCodeData.items);

        // Load activities from first schedule if available
        if (schedulesData.items.length > 0) {
          const firstScheduleId = schedulesData.items[0].id;
          try {
            const actResult = await api<PmPagedResult>(
              `/api/projects/${id}/schedules/${firstScheduleId}/activities?pageSize=200`
            );
            setActivities(actResult.items.map((a) => ({
              id: a.id,
              name: a.name,
              title: a.title,
              data: a.data,
            })));
          } catch {
            // No activities yet — that's fine
          }
        }

        await loadMappings();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [id, loadMappings]);

  function openCreate() {
    setForm({ id: undefined, costCodeId: "", scheduleActivityId: "", weightFactor: "1.0" });
    setDialogOpen(true);
  }

  function openEdit(mapping: PmEntityDto) {
    const data = d(mapping.data);
    setForm({
      id: mapping.id,
      costCodeId: asStr(data.CostCodeId),
      scheduleActivityId: asStr(data.ScheduleActivityId),
      weightFactor: String(asNum(data.WeightFactor) || 1.0),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.costCodeId) { toast.error("Select a cost code"); return; }
    if (!form.scheduleActivityId) { toast.error("Select a schedule activity"); return; }
    const wf = parseFloat(form.weightFactor);
    if (isNaN(wf) || wf <= 0 || wf > 1) {
      toast.error("Weight factor must be between 0 and 1"); return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await updateCostCodeMapping(id, form.id, { WeightFactor: wf });
        toast.success("Mapping updated");
      } else {
        await createCostCodeMapping(id, {
          CostCodeId: form.costCodeId,
          ScheduleActivityId: form.scheduleActivityId,
          WeightFactor: wf,
        });
        toast.success("Mapping created");
      }
      setDialogOpen(false);
      await loadMappings();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message : "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteCostCodeMapping(id, deleteId);
      toast.success("Mapping deleted");
      setDeleteId(null);
      await loadMappings();
    } catch {
      toast.error("Failed to delete mapping");
    } finally {
      setDeleting(false);
    }
  }

  function getCostCodeLabel(costCodeId: unknown): string {
    const ccId = asStr(costCodeId);
    const cc = costCodes.find((c) => c.id === ccId);
    return cc ? `${cc.code} — ${cc.description}` : ccId.slice(0, 8) + "…";
  }

  function getActivityLabel(activityId: unknown): string {
    const actId = asStr(activityId);
    const act = activities.find((a) => a.id === actId);
    if (act) return act.name || act.title || actId.slice(0, 8) + "…";
    return actId.slice(0, 8) + "…";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: "Projects", href: "/projects" },
          { label: projectName, href: `/projects/${id}` },
          { label: "Cost Code Mapping" },
        ]} />
        <TableSkeleton headers={["Cost Code", "Mapped Activity", "Weight Factor", ""]} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Projects", href: "/projects" },
        { label: projectName, href: `/projects/${id}` },
        { label: "Cost Code Mapping" },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Code Activity Mapping</h1>
          <p className="text-sm text-muted-foreground">
            Link cost codes to schedule activities. When field progress is logged against a cost
            code, the mapped activity&apos;s percent complete updates automatically.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600 text-white"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Mapping
        </Button>
      </div>

      {activities.length === 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>No schedule activities found.</strong> Create a schedule for this project
              first, then return here to map cost codes to activities.
            </p>
          </CardContent>
        </Card>
      )}

      {mappings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No mappings configured</p>
            <p className="text-sm text-muted-foreground mb-4">
              Configure cost code ↔ activity mappings so that field progress entries automatically
              update schedule percent complete.
            </p>
            <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add First Mapping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mappings ({mappings.length})</CardTitle>
            <CardDescription>
              Weight factor: sum of all weights for a single activity should equal 1.0 when multiple
              cost codes contribute to one activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Code</TableHead>
                    <TableHead>Mapped Activity</TableHead>
                    <TableHead className="text-right">Weight Factor</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => {
                    const data = d(mapping.data);
                    return (
                      <TableRow key={mapping.id}>
                        <TableCell className="text-sm">
                          {getCostCodeLabel(data.CostCodeId)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {activities.length > 0
                            ? getActivityLabel(data.ScheduleActivityId)
                            : asStr(data.ScheduleActivityId).slice(0, 8) + "…"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {asNum(data.WeightFactor).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(mapping)}
                              title="Edit weight factor"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(mapping.id)}
                              title="Delete mapping"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Mapping" : "Add Cost Code Mapping"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Update the weight factor for this mapping."
                : "Link a cost code to a schedule activity. Progress logged against the cost code will update the activity."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="map-costcode">Cost Code</Label>
              <Select
                value={form.costCodeId}
                onValueChange={(v) => setForm((f) => ({ ...f, costCodeId: v }))}
                disabled={!!form.id}
              >
                <SelectTrigger id="map-costcode">
                  <SelectValue placeholder="Select cost code…" />
                </SelectTrigger>
                <SelectContent>
                  {costCodes.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} — {cc.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-activity">Schedule Activity</Label>
              <Select
                value={form.scheduleActivityId}
                onValueChange={(v) => setForm((f) => ({ ...f, scheduleActivityId: v }))}
                disabled={!!form.id}
              >
                <SelectTrigger id="map-activity">
                  <SelectValue placeholder={activities.length === 0 ? "No activities — create a schedule first" : "Select activity…"} />
                </SelectTrigger>
                <SelectContent>
                  {activities.length === 0 && (
                    <SelectItem value="_none" disabled>No activities available</SelectItem>
                  )}
                  {activities.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      {act.name || act.title || act.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-weight">
                Weight Factor
                <span className="ml-2 text-xs text-muted-foreground">(0.0–1.0)</span>
              </Label>
              <Input
                id="map-weight"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={form.weightFactor}
                onChange={(e) => setForm((f) => ({ ...f, weightFactor: e.target.value }))}
                placeholder="1.0"
              />
              <p className="text-xs text-muted-foreground">
                Use 1.0 when one cost code fully drives one activity. Split weight across multiple
                cost codes when needed (e.g., 0.6 + 0.4 = 1.0).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {saving ? "Saving…" : form.id ? "Save Changes" : "Add Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the link between the cost code and schedule activity. Future progress
              entries will no longer auto-update this activity. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
