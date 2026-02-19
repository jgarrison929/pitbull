"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Input } from "@/components/ui/input";
import { FileText, Receipt, AlertCircle, Wallet, HandCoins, Landmark, Scale, ClipboardList, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import type { Subcontract, ChangeOrder, PaymentApplication, PagedResult } from "@/lib/types";
import {
  subcontractStatusBadgeClass,
  subcontractStatusLabel,
  changeOrderStatusBadgeClass,
  changeOrderStatusLabel,
  paymentApplicationStatusBadgeClass,
  paymentApplicationStatusLabel,
  formatCurrency,
  formatPercent,
} from "@/lib/contracts";
import {
  type ContractMilestone,
  type ContractWorkflowData,
  calculateMilestoneBillableAmount,
  calculateMilestoneEarnedAmount,
  parseContractWorkflowNotes,
  serializeContractWorkflowNotes,
} from "@/lib/contract-workflow";
import { toast } from "sonner";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function createMilestoneSeed(): ContractMilestone {
  const seed = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;

  return {
    id: seed,
    title: "",
    dueDate: new Date().toISOString().slice(0, 10),
    amount: 0,
    completionPercent: 0,
    generatedAmount: 0,
  };
}

export default function SubcontractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [milestones, setMilestones] = useState<ContractMilestone[]>([]);
  const [plainNotes, setPlainNotes] = useState<string | null>(null);
  const [retentionPercentInput, setRetentionPercentInput] = useState("10");

  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [isGeneratingByMilestoneId, setIsGeneratingByMilestoneId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subRes, coRes, paRes] = await Promise.all([
        api<Subcontract>(`/api/subcontracts/${id}`),
        api<PagedResult<ChangeOrder>>(`/api/changeorders?subcontractId=${id}`),
        api<PagedResult<PaymentApplication>>(`/api/paymentapplications?subcontractId=${id}`),
      ]);
      setSubcontract(subRes);
      setChangeOrders(coRes.items);
      setPayApps(paRes.items);

      const parsed = parseContractWorkflowNotes(subRes.notes);
      setMilestones(parsed.workflow.milestones);
      setPlainNotes(parsed.plainNotes);
      setRetentionPercentInput(String(subRes.retainagePercent));
    } catch {
      toast.error("Failed to load subcontract details");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo(() => {
    const totalCommitted = subcontract?.currentValue ?? 0;
    const paidToDate = subcontract?.paidToDate ?? 0;
    const retentionHeld = subcontract?.retainageHeld ?? 0;
    const remaining = Math.max(0, totalCommitted - paidToDate);

    return {
      totalCommitted,
      paidToDate,
      retentionHeld,
      remaining,
    };
  }, [subcontract]);

  const milestoneTotals = useMemo(() => {
    const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
    const totalEarned = milestones.reduce((sum, m) => sum + calculateMilestoneEarnedAmount(m), 0);
    const totalGenerated = milestones.reduce((sum, m) => sum + m.generatedAmount, 0);
    const weightedCompletion = totalAmount > 0 ? (totalEarned / totalAmount) * 100 : 0;
    const projectedRetentionHeld = totalEarned * ((subcontract?.retainagePercent ?? 0) / 100);

    return {
      totalAmount,
      totalEarned,
      totalGenerated,
      weightedCompletion,
      projectedRetentionHeld,
    };
  }, [milestones, subcontract?.retainagePercent]);

  if (isLoading) {
    return <SubcontractDetailSkeleton />;
  }

  if (!subcontract) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Contracts", href: "/contracts" },
            { label: "Not Found" },
          ]}
        />
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">Subcontract not found</h2>
            <p className="text-muted-foreground">
              The subcontract you&apos;re looking for doesn&apos;t exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const billedPercent = subcontract.currentValue > 0
    ? (subcontract.billedToDate / subcontract.currentValue) * 100
    : 0;

  async function handleDelete() {
    const confirmed = window.confirm(
      "Delete this subcontract? Only draft subcontracts can be deleted."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await api(`/api/subcontracts/${id}`, { method: "DELETE" });
      toast.success("Subcontract deleted");
      router.push("/contracts");
    } catch (err) {
      toast.error("Failed to delete subcontract", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDeleting(false);
    }
  }

  function toUpdatePayload(override: { notes?: string | null; retainagePercent?: number } = {}) {
    if (!subcontract) throw new Error("Subcontract not loaded");
    const sc = subcontract;
    return {
      id: sc.id,
      subcontractNumber: sc.subcontractNumber,
      subcontractorName: sc.subcontractorName,
      subcontractorContact: sc.subcontractorContact ?? null,
      subcontractorEmail: sc.subcontractorEmail ?? null,
      subcontractorPhone: sc.subcontractorPhone ?? null,
      subcontractorAddress: sc.subcontractorAddress ?? null,
      scopeOfWork: sc.scopeOfWork,
      tradeCode: sc.tradeCode ?? null,
      originalValue: sc.originalValue,
      retainagePercent: override.retainagePercent ?? sc.retainagePercent,
      executionDate: sc.executionDate ?? null,
      startDate: sc.startDate ?? null,
      completionDate: sc.completionDate ?? null,
      status: sc.status,
      insuranceExpirationDate: sc.insuranceExpirationDate ?? null,
      insuranceCurrent: sc.insuranceCurrent,
      licenseNumber: sc.licenseNumber ?? null,
      notes: override.notes === undefined ? sc.notes ?? null : override.notes,
    };
  }

  async function persistWorkflow(nextWorkflow: ContractWorkflowData) {
    const nextNotes = serializeContractWorkflowNotes(nextWorkflow, plainNotes);
    const updated = await api<Subcontract>(`/api/subcontracts/${id}`, {
      method: "PUT",
      body: toUpdatePayload({ notes: nextNotes }),
    });

    const parsed = parseContractWorkflowNotes(updated.notes);
    setSubcontract(updated);
    setMilestones(parsed.workflow.milestones);
    setPlainNotes(parsed.plainNotes);
  }

  async function saveMilestones() {
    const invalid = milestones.find(
      (m) => !m.title.trim() || !m.dueDate || !Number.isFinite(m.amount) || m.amount < 0
    );
    if (invalid) {
      toast.error("Each milestone needs title, date, and non-negative amount");
      return;
    }

    setIsSavingMilestones(true);
    try {
      await persistWorkflow({ milestones });
      toast.success("Milestones saved");
    } catch (err) {
      toast.error("Failed to save milestones", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingMilestones(false);
    }
  }

  async function saveRetentionPercent() {
    const nextPercent = Number(retentionPercentInput);
    if (!Number.isFinite(nextPercent) || nextPercent < 0 || nextPercent > 100) {
      toast.error("Retention % must be between 0 and 100");
      return;
    }

    setIsSavingRetention(true);
    try {
      const updated = await api<Subcontract>(`/api/subcontracts/${id}`, {
        method: "PUT",
        body: toUpdatePayload({ retainagePercent: nextPercent }),
      });
      setSubcontract(updated);
      setRetentionPercentInput(String(updated.retainagePercent));
      toast.success("Retention updated");
    } catch (err) {
      toast.error("Failed to update retention", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingRetention(false);
    }
  }

  async function generatePayAppFromMilestone(milestone: ContractMilestone) {
    if (!subcontract) return;
    const billableAmount = calculateMilestoneBillableAmount(milestone);
    if (billableAmount <= 0) {
      toast.error("No billable amount remaining for this milestone");
      return;
    }

    setIsGeneratingByMilestoneId(milestone.id);
    try {
      await api<PaymentApplication>("/api/paymentapplications", {
        method: "POST",
        body: {
          subcontractId: subcontract.id,
          periodStart: milestone.dueDate,
          periodEnd: milestone.dueDate,
          workCompletedThisPeriod: billableAmount,
          storedMaterials: 0,
          invoiceNumber: null,
          notes: `Generated from milestone: ${milestone.title}`,
        },
      });

      const nextMilestones = milestones.map((m) =>
        m.id === milestone.id
          ? {
              ...m,
              generatedAmount: m.generatedAmount + billableAmount,
            }
          : m
      );

      await persistWorkflow({ milestones: nextMilestones });
      await fetchData();
      toast.success("Payment application generated from milestone");
    } catch (err) {
      toast.error("Failed to generate payment application", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsGeneratingByMilestoneId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Contracts", href: "/contracts" },
          { label: subcontract.subcontractorName },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {subcontract.subcontractorName}
            </h1>
            <Badge
              variant="secondary"
              className={subcontractStatusBadgeClass(subcontract.status)}
            >
              {subcontractStatusLabel(subcontract.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">
            {subcontract.subcontractNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-h-[44px] shrink-0">
            <Link href={`/contracts/${subcontract.id}/sov`}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Schedule of Values
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-[44px] shrink-0">
            <Link href={`/contracts/${subcontract.id}/edit`}>Edit Subcontract</Link>
          </Button>
          <Button
            variant="destructive"
            className="min-h-[44px] shrink-0"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalCommitted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid To Date</CardTitle>
            <HandCoins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.paidToDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retention Held</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.retentionHeld)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.remaining)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Billing Progress */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Billing Progress
            </div>
            <span className="text-sm text-muted-foreground">
              {formatPercent(billedPercent)} billed
            </span>
          </div>
          <Progress value={Math.min(billedPercent, 100)} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Billed: {formatCurrency(subcontract.billedToDate)}</span>
            <span>Contract: {formatCurrency(subcontract.currentValue)}</span>
          </div>
          {subcontract.originalValue !== subcontract.currentValue && (
            <p className="text-xs text-muted-foreground">
              Original: {formatCurrency(subcontract.originalValue)} &rarr; Current: {formatCurrency(subcontract.currentValue)}{" "}
              <span className={subcontract.currentValue > subcontract.originalValue ? "text-amber-600" : "text-green-600"}>
                ({subcontract.currentValue > subcontract.originalValue ? "+" : ""}{formatCurrency(subcontract.currentValue - subcontract.originalValue)} from change orders)
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trade</span>
              <span className="font-medium">{subcontract.tradeCode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original Value</span>
              <span className="font-mono">{formatCurrency(subcontract.originalValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Value</span>
              <span className="font-mono font-medium">{formatCurrency(subcontract.currentValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Billed to Date</span>
              <span className="font-mono">{formatCurrency(subcontract.billedToDate)} ({formatPercent(billedPercent)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid to Date</span>
              <span className="font-mono">{formatCurrency(subcontract.paidToDate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Retention %</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={retentionPercentInput}
                  onChange={(e) => setRetentionPercentInput(e.target.value)}
                  className="h-8 w-24 text-right"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveRetentionPercent}
                  disabled={isSavingRetention}
                >
                  {isSavingRetention ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retainage Held</span>
              <span className="font-mono">{formatCurrency(subcontract.retainageHeld)} ({formatPercent(subcontract.retainagePercent)})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projected Retainage (Milestones)</span>
              <span className="font-mono">{formatCurrency(milestoneTotals.projectedRetentionHeld)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subcontractor Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact</span>
              <span className="font-medium">{subcontract.subcontractorContact || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{subcontract.subcontractorEmail || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{subcontract.subcontractorPhone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">License</span>
              <span className="font-mono text-xs">{subcontract.licenseNumber || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Insurance</span>
              <span>
                {subcontract.insuranceCurrent ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Expired</Badge>
                )}
                {subcontract.insuranceExpirationDate && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (exp. {formatDate(subcontract.insuranceExpirationDate)})
                  </span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract Milestones</CardTitle>
          <CardDescription>
            Track milestone amounts, dates, completion %, and generate pay applications from each milestone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Milestone Budget</p>
              <p className="text-xl font-semibold font-mono">{formatCurrency(milestoneTotals.totalAmount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Earned By Completion %</p>
              <p className="text-xl font-semibold font-mono">{formatCurrency(milestoneTotals.totalEarned)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Generated To Pay Apps</p>
              <p className="text-xl font-semibold font-mono">{formatCurrency(milestoneTotals.totalGenerated)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Weighted Completion</p>
              <p className="text-xl font-semibold">{formatPercent(milestoneTotals.weightedCompletion)}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Milestone</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Complete %</TableHead>
                <TableHead className="text-right">Generated</TableHead>
                <TableHead className="text-right">Billable</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No milestones yet.
                  </TableCell>
                </TableRow>
              ) : (
                milestones.map((milestone) => {
                  const billable = calculateMilestoneBillableAmount(milestone);
                  return (
                    <TableRow key={milestone.id}>
                      <TableCell>
                        <Input
                          value={milestone.title}
                          onChange={(e) =>
                            setMilestones((prev) =>
                              prev.map((m) =>
                                m.id === milestone.id ? { ...m, title: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Milestone title"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={milestone.dueDate}
                          onChange={(e) =>
                            setMilestones((prev) =>
                              prev.map((m) =>
                                m.id === milestone.id ? { ...m, dueDate: e.target.value } : m
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={milestone.amount}
                          onChange={(e) =>
                            setMilestones((prev) =>
                              prev.map((m) =>
                                m.id === milestone.id
                                  ? { ...m, amount: Number(e.target.value || 0) }
                                  : m
                              )
                            )
                          }
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={milestone.completionPercent}
                          onChange={(e) =>
                            setMilestones((prev) =>
                              prev.map((m) =>
                                m.id === milestone.id
                                  ? { ...m, completionPercent: Number(e.target.value || 0) }
                                  : m
                              )
                            )
                          }
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(milestone.generatedAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(billable)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={billable <= 0 || isGeneratingByMilestoneId === milestone.id}
                            onClick={() => generatePayAppFromMilestone(milestone)}
                          >
                            {isGeneratingByMilestoneId === milestone.id ? "Generating..." : "Generate Pay App"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setMilestones((prev) => prev.filter((m) => m.id !== milestone.id))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setMilestones((prev) => [...prev, createMilestoneSeed()])}
            >
              + Add Milestone
            </Button>
            <Button
              onClick={saveMilestones}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={isSavingMilestones}
            >
              {isSavingMilestones ? "Saving..." : "Save Milestones"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {subcontract.scopeOfWork && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {subcontract.scopeOfWork}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Change Orders
            </CardTitle>
            <CardDescription>
              {changeOrders.length} change order{changeOrders.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/contracts/${id}/change-orders`}>Manage COs</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {changeOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No change orders yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeOrders.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="font-mono text-sm">
                      {co.number || co.changeOrderNumber}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {co.title}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
                    </TableCell>
                    <TableCell>
                      {co.scheduleImpactDays ?? co.daysExtension ? `+${co.scheduleImpactDays ?? co.daysExtension}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={changeOrderStatusBadgeClass(co.status)}
                      >
                        {changeOrderStatusLabel(co.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Payment Applications
            </CardTitle>
            <CardDescription>
              {payApps.length} pay app{payApps.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/contracts/${id}/payment-applications`}>
              Manage Pay Apps
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {payApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No payment applications yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Work This Period</TableHead>
                  <TableHead className="text-right">Payment Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payApps.map((pa) => (
                  <TableRow key={pa.id}>
                    <TableCell className="font-mono text-sm">
                      {pa.applicationNumber}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(pa.periodStart)} - {formatDate(pa.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(pa.workCompletedThisPeriod)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(pa.currentPaymentDue)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={paymentApplicationStatusBadgeClass(pa.status)}
                      >
                        {paymentApplicationStatusLabel(pa.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubcontractDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
