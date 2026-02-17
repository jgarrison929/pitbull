"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import type { CostCode } from "@/lib/types";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { Pencil, Trash2 } from "lucide-react";

interface DataMap { [key: string]: unknown; }

interface JobCostRow {
  id: string; costCodeId: string; costCode: string; description: string;
  budget: number; actual: number; variance: number; percentComplete: number; createdAt: string;
}

interface BudgetFormState { id?: string; costCodeId: string; currentBudget: string; }

function asDataMap(v: unknown): DataMap { return v && typeof v === "object" ? (v as DataMap) : {}; }
function asNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim()) { const p = Number.parseFloat(v); return Number.isFinite(p) ? p : 0; }
  return 0;
}
function asString(v: unknown): string { return typeof v === "string" ? v : ""; }

function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function formatPercent(v: number): string { return `${v.toFixed(1)}%`; }

function JobCostContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useListPageShortcuts({ searchInputRef });

  const [budgets, setBudgets] = useState<PmEntityDto[]>([]);
  const [actuals, setActuals] = useState<PmEntityDto[]>([]);
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<BudgetFormState>({ costCodeId: "", currentBudget: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JobCostRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, actualRes, costCodeRes] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/job-cost/budgets?page=1&pageSize=500`),
        api<PmPagedResult>(`/api/projects/${projectId}/job-cost/actuals?page=1&pageSize=500`),
        api<{ items: CostCode[] }>("/api/cost-codes?page=1&pageSize=500"),
      ]);
      setBudgets(budgetRes.items ?? []);
      setActuals(actualRes.items ?? []);
      setCostCodes(costCodeRes.items ?? []);
    } catch (error) {
      toast.error("Failed to load job cost data", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => {
    if (!isProjectIdValid) {
      setLoading(false);
      return;
    }
    void load();
  }, [isProjectIdValid, load]);

  const rows = useMemo(() => {
    const codeMap = new Map(costCodes.map((code) => [code.id, code]));
    const actualByCostCode = new Map<string, number>();
    for (const actual of actuals) {
      const data = asDataMap(actual.data);
      const costCodeId = asString(data.CostCodeId);
      if (!costCodeId) continue;
      const totalActual = asNumber(data.TotalActualCost);
      actualByCostCode.set(costCodeId, (actualByCostCode.get(costCodeId) ?? 0) + totalActual);
    }
    const mapped = budgets.map<JobCostRow>((budget) => {
      const data = asDataMap(budget.data);
      const costCodeId = asString(data.CostCodeId);
      const code = codeMap.get(costCodeId);
      const originalBudget = asNumber(data.OriginalBudget);
      const currentBudget = asNumber(data.CurrentBudget);
      const approvedChanges = asNumber(data.ApprovedBudgetChanges);
      const budgetValue = currentBudget || originalBudget + approvedChanges;
      const actualValue = actualByCostCode.get(costCodeId) ?? 0;
      const variance = budgetValue - actualValue;
      const percentComplete = budgetValue > 0 ? (actualValue / budgetValue) * 100 : 0;
      return {
        id: budget.id, costCodeId,
        costCode: (code?.code ?? asString(data.CostCode)) || "Unassigned",
        description: (code?.description ?? asString(data.CostCodeDescription)) || "",
        budget: budgetValue, actual: actualValue, variance, percentComplete, createdAt: budget.createdAt,
      };
    });
    const q = search.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter((row) => row.costCode.toLowerCase().includes(q) || row.description.toLowerCase().includes(q));
  }, [budgets, actuals, costCodes, search]);

  const totals = useMemo(() => {
    const budgetTotal = rows.reduce((sum, row) => sum + row.budget, 0);
    const actualTotal = rows.reduce((sum, row) => sum + row.actual, 0);
    const varianceTotal = budgetTotal - actualTotal;
    const percent = budgetTotal > 0 ? (actualTotal / budgetTotal) * 100 : 0;
    return { budgetTotal, actualTotal, varianceTotal, percent };
  }, [rows]);

  function openCreate() {
    setEditing(false);
    setForm({ costCodeId: "", currentBudget: "" });
    setDialogOpen(true);
  }

  function openEdit(row: JobCostRow) {
    setEditing(true);
    setForm({ id: row.id, costCodeId: row.costCodeId, currentBudget: row.budget.toString() });
    setDialogOpen(true);
  }

  async function saveBudget() {
    if (!form.costCodeId) { toast.error("Select a cost code"); return; }
    const budgetValue = Number.parseFloat(form.currentBudget || "0");
    if (!Number.isFinite(budgetValue) || budgetValue < 0) { toast.error("Enter a valid budget amount"); return; }
    const payload: PmUpsertRequest = {
      name: costCodes.find((code) => code.id === form.costCodeId)?.code,
      data: { CostCodeId: form.costCodeId, OriginalBudget: budgetValue, CurrentBudget: budgetValue, ApprovedBudgetChanges: 0, LaborBurdenRate: 0 },
    };
    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/job-cost/budgets/${form.id}`, { method: "PUT", body: payload });
        toast.success("Budget updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/job-cost/budgets`, { method: "POST", body: payload });
        toast.success("Budget created");
      }
      setDialogOpen(false); await load();
    } catch (error) {
      toast.error("Failed to save budget", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await api<void>(`/api/projects/${projectId}/job-cost/budgets/${pendingDelete.id}`, { method: "DELETE" });
      toast.success("Budget deleted"); setDeleteOpen(false); setPendingDelete(null); await load();
    } catch (error) {
      const message = error instanceof ApiError && (error.status === 404 || error.status === 405)
        ? "Delete endpoint is not available yet for job cost budgets"
        : error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete budget", { description: message });
    } finally { setIsDeleting(false); }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Cost</h1>
          <p className="text-muted-foreground">Budget vs actual by cost code for project execution control.</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>+ Add Budget Line</Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total Budget</CardDescription><CardTitle className="text-lg">{formatCurrency(totals.budgetTotal)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Actual</CardDescription><CardTitle className="text-lg">{formatCurrency(totals.actualTotal)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Variance</CardDescription><CardTitle className={`text-lg ${totals.varianceTotal >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatCurrency(totals.varianceTotal)}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>% Complete</CardDescription><CardTitle className="text-lg">{formatPercent(totals.percent)}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Summary</CardTitle>
          <CardDescription>Track budget, actuals, and variance per cost code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input ref={searchInputRef} placeholder="Filter by cost code or description (press / to focus)" value={search} onChange={(e) => setSearch(e.target.value)} className="md:max-w-md" />

          {loading ? (
            <>
              <div className="sm:hidden"><CardListSkeleton rows={3} /></div>
              <div className="hidden sm:block"><TableSkeleton headers={["Cost Code", "Description", "Budget", "Actual", "Variance", "% Complete", "Actions"]} rows={5} /></div>
            </>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">No job cost rows yet. Add your first budget line.</p>
                    <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreate}>Add Budget Line</Button>
                  </div>
                ) : rows.map((row) => (
                  <div key={row.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{row.costCode}</span>
                      <Badge variant={row.variance >= 0 ? "default" : "destructive"}>{formatCurrency(row.variance)}</Badge>
                    </div>
                    {row.description && <p className="text-sm text-muted-foreground">{row.description}</p>}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-muted-foreground">Budget</p><p className="font-mono">{formatCurrency(row.budget)}</p></div>
                      <div><p className="text-muted-foreground">Actual</p><p className="font-mono">{formatCurrency(row.actual)}</p></div>
                      <div><p className="text-muted-foreground">Complete</p><p className="font-mono">{formatPercent(row.percentComplete)}</p></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px]" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive" onClick={() => { setPendingDelete(row); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost Code</TableHead><TableHead>Description</TableHead>
                        <TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Variance</TableHead><TableHead className="text-right">% Complete</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7}><div className="flex flex-col items-center gap-3 py-6 text-center"><p className="text-sm text-muted-foreground">No job cost rows yet. Add your first budget line.</p><Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>Add Budget Line</Button></div></TableCell></TableRow>
                      ) : rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.costCode}</TableCell>
                          <TableCell>{row.description || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.budget)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.actual)}</TableCell>
                          <TableCell className="text-right"><Badge variant={row.variance >= 0 ? "default" : "destructive"}>{formatCurrency(row.variance)}</Badge></TableCell>
                          <TableCell className="text-right">{formatPercent(row.percentComplete)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px]" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive" onClick={() => { setPendingDelete(row); setDeleteOpen(true); }}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Budget" : "Create Budget"}</DialogTitle>
            <DialogDescription>Maintain the budget line for a project cost code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cost-code">Cost Code <span className="text-destructive">*</span></Label>
              <Select value={form.costCodeId} onValueChange={(v) => setForm((prev) => ({ ...prev, costCodeId: v }))}>
                <SelectTrigger id="cost-code"><SelectValue placeholder="Select cost code" /></SelectTrigger>
                <SelectContent>{costCodes.map((code) => (<SelectItem key={code.id} value={code.id}>{code.code} - {code.description}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-budget">Current Budget <span className="text-destructive">*</span></Label>
              <Input id="current-budget" type="number" min="0" step="0.01" value={form.currentBudget} onChange={(e) => setForm((prev) => ({ ...prev, currentBudget: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <LoadingButton className="bg-amber-500 hover:bg-amber-600 text-white" onClick={saveBudget} loading={saving} loadingText="Saving...">{editing ? "Save Changes" : "Create"}</LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget Line</AlertDialogTitle>
            <AlertDialogDescription>Delete {pendingDelete?.costCode || "this budget line"}? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <LoadingButton variant="destructive" onClick={handleDelete} loading={isDeleting} loadingText="Deleting...">Delete</LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function JobCostPage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary section="Job Cost">
      <JobCostContent {...props} />
    </ErrorBoundary>
  );
}
