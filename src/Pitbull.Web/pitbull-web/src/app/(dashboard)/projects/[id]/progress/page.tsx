"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CloudSun, BarChart2, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { TableSkeleton } from "@/components/skeletons";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { CostCode, ListCostCodesResult } from "@/lib/types";
import type { PmEntityDto } from "@/lib/pm-types";
import {
  listFieldProgress,
  createFieldProgressEntry,
  updateFieldProgressEntry,
  deleteFieldProgressEntry,
} from "@/lib/progress-api";
import { cn } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function d(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function asNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = Number(v); return isNaN(n) ? 0 : n; }
  return 0;
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const [y, mo, day] = s.split("-").map(Number);
  return new Date(y, mo - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function fmtPct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}
function pctBadgeClass(pct: number): string {
  if (pct >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (pct >= 0.5) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

const WEATHER_OPTIONS = ["Clear", "Cloudy", "Rain", "Snow", "Wind", "Extreme"];
const WEATHER_LABELS: Record<string, string> = {
  Clear: "☀️ Clear", Cloudy: "☁️ Cloudy", Rain: "🌧️ Rain",
  Snow: "❄️ Snow", Wind: "💨 Wind", Extreme: "⚠️ Extreme",
};

// ─── form state ──────────────────────────────────────────────────────────────

interface ProgressForm {
  id?: string;
  date: string;
  costCodeId: string;
  quantityInstalled: string;
  totalBudgetedQuantity: string;
  unitOfMeasure: string;
  crewSize: string;
  hoursWorked: string;
  weatherCondition: string;
  notes: string;
}

function emptyForm(): ProgressForm {
  return {
    date: new Date().toISOString().slice(0, 10),
    costCodeId: "",
    quantityInstalled: "",
    totalBudgetedQuantity: "",
    unitOfMeasure: "EA",
    crewSize: "",
    hoursWorked: "",
    weatherCondition: "Clear",
    notes: "",
  };
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [entries, setEntries] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [projectName, setProjectName] = useState("Project");
  const [avgComplete, setAvgComplete] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProgressForm>(emptyForm());

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    try {
      const result = await listFieldProgress(id, { pageSize: 200 });
      setEntries(result.items);
      if (result.items.length > 0) {
        const pcts = result.items.map((e) => asNum(d(e.data).PercentComplete));
        setAvgComplete(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      } else {
        setAvgComplete(0);
      }
    } catch {
      toast.error("Failed to load progress entries");
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const [projectData, costCodeData] = await Promise.all([
          api<{ name: string }>(`/api/projects/${id}`).catch(() => ({ name: "Project" })),
          api<ListCostCodesResult>(`/api/cost-codes?pageSize=200`).catch(
            () => ({ items: [] as CostCode[], totalCount: 0, page: 1, pageSize: 200, totalPages: 0 })
          ),
        ]);
        if (cancelled) return;
        setProjectName(projectData.name);
        setCostCodes(costCodeData.items);
        await loadEntries();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [id, loadEntries]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "n" && !dialogOpen && !deleteId &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        openCreate();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, deleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setForm(emptyForm());
    setDialogOpen(true);
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }

  function openEdit(entry: PmEntityDto) {
    const data = d(entry.data);
    setForm({
      id: entry.id,
      date: asStr(data.Date).slice(0, 10) || new Date().toISOString().slice(0, 10),
      costCodeId: asStr(data.CostCodeId),
      quantityInstalled: String(asNum(data.QuantityInstalled)),
      totalBudgetedQuantity: String(asNum(data.TotalBudgetedQuantity)),
      unitOfMeasure: asStr(data.UnitOfMeasure) || "EA",
      crewSize: asNum(data.CrewSize) > 0 ? String(asNum(data.CrewSize)) : "",
      hoursWorked: asNum(data.HoursWorked) > 0 ? String(asNum(data.HoursWorked)) : "",
      weatherCondition: asStr(data.WeatherCondition) || "Clear",
      notes: asStr(data.Notes),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.costCodeId) { toast.error("Select a cost code"); return; }
    if (!form.quantityInstalled || isNaN(parseFloat(form.quantityInstalled))) {
      toast.error("Enter quantity installed"); return;
    }
    if (!form.totalBudgetedQuantity || isNaN(parseFloat(form.totalBudgetedQuantity))) {
      toast.error("Enter total budgeted quantity"); return;
    }
    setSaving(true);
    try {
      const payload = {
        CostCodeId: form.costCodeId,
        QuantityInstalled: parseFloat(form.quantityInstalled),
        TotalBudgetedQuantity: parseFloat(form.totalBudgetedQuantity),
        Date: form.date,
        UnitOfMeasure: form.unitOfMeasure || "EA",
        CrewSize: form.crewSize ? parseInt(form.crewSize, 10) : 0,
        HoursWorked: form.hoursWorked ? parseFloat(form.hoursWorked) : 0,
        WeatherCondition: form.weatherCondition,
        Notes: form.notes || undefined,
      };
      if (form.id) {
        await updateFieldProgressEntry(id, form.id, payload);
        toast.success("Progress entry updated");
      } else {
        await createFieldProgressEntry(id, payload);
        toast.success("Progress entry logged");
      }
      setDialogOpen(false);
      await loadEntries();
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
      await deleteFieldProgressEntry(id, deleteId);
      toast.success("Entry deleted");
      setDeleteId(null);
      await loadEntries();
    } catch {
      toast.error("Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  }

  function getCostCodeLabel(costCodeId: unknown): string {
    const ccId = asStr(costCodeId);
    const cc = costCodes.find((c) => c.id === ccId);
    return cc ? `${cc.code} — ${cc.description}` : ccId.slice(0, 8) + "…";
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: "Projects", href: "/projects" },
          { label: projectName, href: `/projects/${id}` },
          { label: "Progress" },
        ]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <TableSkeleton headers={["Date", "Cost Code", "Qty", "%", "Crew", "Hours", "Weather", ""]} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: "Projects", href: "/projects" },
        { label: projectName, href: `/projects/${id}` },
        { label: "Progress" },
      ]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Field Progress</h1>
          <p className="text-sm text-muted-foreground">
            Log daily quantities — entries auto-update schedule percent complete.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${id}/earned-value`}>
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Earned Value
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${id}/settings/cost-code-mapping`}>
              Configure Mapping
            </Link>
          </Button>
          <Button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Log Entry
            <kbd className="ml-2 text-[10px] opacity-60 border rounded px-1">N</kbd>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart2 className="h-4 w-4" />
              Total Entries
            </div>
            <p className="text-2xl font-bold">{entries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart2 className="h-4 w-4" />
              Avg % Complete
            </div>
            <p className={cn("text-2xl font-bold",
              avgComplete >= 0.9 ? "text-green-600" :
              avgComplete >= 0.5 ? "text-amber-600" : "text-foreground"
            )}>
              {fmtPct(avgComplete)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-2">Cost Codes Tracked</div>
            <p className="text-2xl font-bold">
              {new Set(entries.map((e) => asStr(d(e.data).CostCodeId))).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-2">Earned Value</div>
            <Button asChild variant="link" className="p-0 h-auto text-amber-600 font-semibold">
              <Link href={`/projects/${id}/earned-value`}>View Dashboard →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CloudSun className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium mb-1">No progress entries yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Log your first field progress entry to start tracking schedule completion and earned
              value.
            </p>
            <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Log First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress Entries ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cost Code</TableHead>
                    <TableHead className="text-right">Qty Installed</TableHead>
                    <TableHead className="text-right">Cumulative %</TableHead>
                    <TableHead className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" />Crew
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3 w-3" />Hours
                      </span>
                    </TableHead>
                    <TableHead>Weather</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const data = d(entry.data);
                    const pct = asNum(data.PercentComplete);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap font-mono text-sm">
                          {fmtDate(asStr(data.Date) || entry.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-[200px] text-sm">
                          <span className="truncate block">
                            {getCostCodeLabel(data.CostCodeId)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono">
                          {asNum(data.QuantityInstalled).toLocaleString()}{" "}
                          <span className="text-muted-foreground">{asStr(data.UnitOfMeasure)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn("text-xs font-mono", pctBadgeClass(pct))}>
                            {fmtPct(pct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {asNum(data.CrewSize) || "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm font-mono">
                          {asNum(data.HoursWorked) > 0
                            ? asNum(data.HoursWorked).toFixed(1)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {WEATHER_LABELS[asStr(data.WeatherCondition)] ||
                            asStr(data.WeatherCondition) || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(entry)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteId(entry.id)}
                              title="Delete"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Progress Entry" : "Log Field Progress"}
            </DialogTitle>
            <DialogDescription>
              {form.id
                ? "Update this progress entry."
                : "Record what was installed today. Qty / budgeted qty = % complete."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  ref={firstFieldRef}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-weather">Weather</Label>
                <Select
                  value={form.weatherCondition}
                  onValueChange={(v) => setForm((f) => ({ ...f, weatherCondition: v }))}
                >
                  <SelectTrigger id="entry-weather">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_OPTIONS.map((w) => (
                      <SelectItem key={w} value={w}>{WEATHER_LABELS[w]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-costcode">Cost Code</Label>
              <Select
                value={form.costCodeId}
                onValueChange={(v) => setForm((f) => ({ ...f, costCodeId: v }))}
              >
                <SelectTrigger id="entry-costcode">
                  <SelectValue placeholder="Select cost code…" />
                </SelectTrigger>
                <SelectContent>
                  {costCodes.length === 0 && (
                    <SelectItem value="_none" disabled>No cost codes found</SelectItem>
                  )}
                  {costCodes.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} — {cc.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="entry-qty">Qty Installed</Label>
                <Input
                  id="entry-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantityInstalled}
                  onChange={(e) => setForm((f) => ({ ...f, quantityInstalled: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-budget">Total Budgeted</Label>
                <Input
                  id="entry-budget"
                  type="number"
                  min="0"
                  step="any"
                  value={form.totalBudgetedQuantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, totalBudgetedQuantity: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-uom">Unit</Label>
                <Input
                  id="entry-uom"
                  value={form.unitOfMeasure}
                  onChange={(e) => setForm((f) => ({ ...f, unitOfMeasure: e.target.value }))}
                  placeholder="EA"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="entry-crew">Crew Size</Label>
                <Input
                  id="entry-crew"
                  type="number"
                  min="0"
                  value={form.crewSize}
                  onChange={(e) => setForm((f) => ({ ...f, crewSize: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-hours">Hours Worked</Label>
                <Input
                  id="entry-hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.hoursWorked}
                  onChange={(e) => setForm((f) => ({ ...f, hoursWorked: e.target.value }))}
                  placeholder="0.0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-notes">Notes</Label>
              <Textarea
                id="entry-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional field notes…"
                className="h-20 resize-none"
              />
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
              {saving ? "Saving…" : form.id ? "Save Changes" : "Log Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete progress entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this entry will recalculate the activity percent complete. This cannot be
              undone.
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
