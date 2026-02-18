"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  Save,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PaymentApplicationStatus } from "@/lib/types";
import type {
  PaymentApplicationDetail,
  PaymentApplicationLineItemInput,
} from "@/lib/types";
import {
  paymentApplicationStatusBadgeClass,
  paymentApplicationStatusLabel,
  formatCurrency,
  formatPercent,
} from "@/lib/contracts";

// ─── Helpers ───────────────────────────────────────────────

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Status transitions allowed from each status */
const ALLOWED_ACTIONS: Record<number, string[]> = {
  [PaymentApplicationStatus.Draft]: ["submit"],
  [PaymentApplicationStatus.Submitted]: ["review"],
  [PaymentApplicationStatus.Reviewed]: ["approve", "reject"],
  [PaymentApplicationStatus.Approved]: ["mark-paid"],
  [PaymentApplicationStatus.Rejected]: [],
  [PaymentApplicationStatus.Paid]: [],
  [PaymentApplicationStatus.Void]: [],
};

// ─── Main Component ────────────────────────────────────────

export default function PaymentApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<PaymentApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable line item state (work this period + materials stored this period)
  const [editedItems, setEditedItems] = useState<
    Map<string, { workThisPeriod: string; materialsThisPeriod: string }>
  >(new Map());
  const [hasLineItemChanges, setHasLineItemChanges] = useState(false);

  // Status action dialogs
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form fields for approve/review/paid dialogs
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [paidReference, setPaidReference] = useState("");
  const [paidCheckNumber, setPaidCheckNumber] = useState("");

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<PaymentApplicationDetail>(
        `/api/paymentapplications/${id}/detail`
      );
      setDetail(data);

      // Initialize editable line items
      const map = new Map<string, { workThisPeriod: string; materialsThisPeriod: string }>();
      for (const li of data.g703LineItems) {
        map.set(li.sovLineItemId, {
          workThisPeriod: li.workCompletedThisPeriod.toString(),
          materialsThisPeriod: li.materialsStoredThisPeriod.toString(),
        });
      }
      setEditedItems(map);
      setHasLineItemChanges(false);
    } catch {
      toast.error("Failed to load payment application");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const isDraft = detail?.status === PaymentApplicationStatus.Draft;
  const actions = detail ? ALLOWED_ACTIONS[detail.status] || [] : [];

  const updateLineItem = (sovLineItemId: string, field: "workThisPeriod" | "materialsThisPeriod", value: string) => {
    setEditedItems((prev) => {
      const next = new Map(prev);
      const current = next.get(sovLineItemId) || { workThisPeriod: "0", materialsThisPeriod: "0" };
      next.set(sovLineItemId, { ...current, [field]: value });
      return next;
    });
    setHasLineItemChanges(true);
  };

  const handleSaveLineItems = async () => {
    if (!detail) return;
    setIsSaving(true);
    try {
      const items: PaymentApplicationLineItemInput[] = [];
      for (const [sovLineItemId, vals] of editedItems) {
        items.push({
          sovLineItemId,
          workCompletedThisPeriod: parseFloat(vals.workThisPeriod) || 0,
          materialsStoredThisPeriod: parseFloat(vals.materialsThisPeriod) || 0,
        });
      }
      await api(`/api/paymentapplications/${id}/line-items`, {
        method: "PUT",
        body: { items, recalculateTotals: true },
      });
      toast.success("Line items saved and totals recalculated");
      await loadDetail();
    } catch {
      toast.error("Failed to save line items");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Status Actions ────────────────────────────────────────

  const handleSubmit = async () => {
    setActionLoading(true);
    try {
      await api(`/api/paymentapplications/${id}/submit`, { method: "POST", body: {} });
      toast.success("Payment application submitted for review");
      setShowSubmitConfirm(false);
      await loadDetail();
    } catch {
      toast.error("Failed to submit");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewedBy.trim()) { toast.error("Reviewer name is required"); return; }
    setActionLoading(true);
    try {
      await api(`/api/paymentapplications/${id}/review`, {
        method: "POST",
        body: { reviewedBy: reviewedBy.trim(), notes: reviewNotes.trim() || null },
      });
      toast.success("Payment application marked as reviewed");
      setShowReviewDialog(false);
      await loadDetail();
    } catch {
      toast.error("Failed to review");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvedBy.trim()) { toast.error("Approver name is required"); return; }
    setActionLoading(true);
    try {
      await api(`/api/paymentapplications/${id}/approve`, {
        method: "POST",
        body: {
          approvedBy: approvedBy.trim(),
          approvedAmount: approvedAmount ? parseFloat(approvedAmount) : null,
          notes: approveNotes.trim() || null,
        },
      });
      toast.success("Payment application approved");
      setShowApproveDialog(false);
      await loadDetail();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error("Rejection reason is required"); return; }
    setActionLoading(true);
    try {
      await api(`/api/paymentapplications/${id}/reject`, {
        method: "POST",
        body: {
          rejectedBy: "Current User",
          reason: rejectReason.trim(),
        },
      });
      toast.success("Payment application rejected");
      setShowRejectConfirm(false);
      setRejectReason("");
      await loadDetail();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paidAmount || !paidDate || !paidReference) {
      toast.error("Amount, date, and reference are required");
      return;
    }
    setActionLoading(true);
    try {
      await api(`/api/paymentapplications/${id}/mark-paid`, {
        method: "POST",
        body: {
          paidAmount: parseFloat(paidAmount),
          paidDate,
          paymentReference: paidReference.trim(),
          checkNumber: paidCheckNumber.trim() || null,
        },
      });
      toast.success("Payment application marked as paid");
      setShowMarkPaidDialog(false);
      await loadDetail();
    } catch {
      toast.error("Failed to mark as paid");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Computed G703 totals ─────────────────────────────────

  const g703Totals = useMemo(() => {
    if (!detail) return null;
    const items = detail.g703LineItems;
    return {
      scheduledValue: items.reduce((s, li) => s + li.scheduledValue, 0),
      workPrevious: items.reduce((s, li) => s + li.workCompletedPrevious, 0),
      workThisPeriod: items.reduce((s, li) => s + li.workCompletedThisPeriod, 0),
      matPrevious: items.reduce((s, li) => s + li.materialsStoredPrevious, 0),
      matThisPeriod: items.reduce((s, li) => s + li.materialsStoredThisPeriod, 0),
      totalCompleted: items.reduce((s, li) => s + li.totalCompletedAndStoredToDate, 0),
      balanceToFinish: items.reduce((s, li) => s + li.balanceToFinish, 0),
      retainage: items.reduce((s, li) => s + li.retainageAmount, 0),
    };
  }, [detail]);

  // ─── Loading State ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-4 w-60" />
        <Skeleton className="h-8 w-80" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4 text-center py-12">
        <p className="text-muted-foreground">Payment application not found.</p>
        <Button asChild variant="outline">
          <Link href="/payment-applications">Back to List</Link>
        </Button>
      </div>
    );
  }

  const g702 = detail.g702;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/payment-applications" className="hover:text-foreground transition-colors">
          Payment Applications
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">App #{detail.applicationNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              Pay App #{detail.applicationNumber}
            </h1>
            <Badge
              variant="secondary"
              className={paymentApplicationStatusBadgeClass(detail.status)}
            >
              {paymentApplicationStatusLabel(detail.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Period: {formatDate(detail.periodStart)} - {formatDate(detail.periodEnd)}
            {detail.invoiceNumber && <> | Invoice: {detail.invoiceNumber}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild className="min-h-[44px]">
            <Link href="/payment-applications">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Link>
          </Button>
          {isDraft && hasLineItemChanges && (
            <LoadingButton
              size="sm"
              onClick={handleSaveLineItems}
              loading={isSaving}
              loadingText="Saving..."
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save Line Items
            </LoadingButton>
          )}
          {actions.includes("submit") && (
            <Button
              size="sm"
              onClick={() => setShowSubmitConfirm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white min-h-[44px]"
            >
              <Send className="h-4 w-4 mr-1.5" />
              Submit
            </Button>
          )}
          {actions.includes("review") && (
            <Button
              size="sm"
              onClick={() => setShowReviewDialog(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Review
            </Button>
          )}
          {actions.includes("approve") && (
            <Button
              size="sm"
              onClick={() => {
                setApprovedAmount(detail.currentPaymentDue.toString());
                setShowApproveDialog(true);
              }}
              className="bg-green-500 hover:bg-green-600 text-white min-h-[44px]"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
          )}
          {actions.includes("approve") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowRejectConfirm(true)}
              className="min-h-[44px]"
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
          )}
          {actions.includes("mark-paid") && (
            <Button
              size="sm"
              onClick={() => {
                setPaidAmount(detail.currentPaymentDue.toString());
                setShowMarkPaidDialog(true);
              }}
              className="bg-teal-500 hover:bg-teal-600 text-white min-h-[44px]"
            >
              <DollarSign className="h-4 w-4 mr-1.5" />
              Mark Paid
            </Button>
          )}
        </div>
      </div>

      {/* G702 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Contract Sum to Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold font-mono">{formatCurrency(g702.contractSumToDate)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Original: {formatCurrency(g702.originalContractSum)} | COs: {formatCurrency(g702.netChangeByChangeOrders)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Completed & Stored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold font-mono">{formatCurrency(g702.totalCompletedAndStoredToDate)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {g702.contractSumToDate > 0
                ? formatPercent((g702.totalCompletedAndStoredToDate / g702.contractSumToDate) * 100)
                : "0.0%"}{" "}
              of contract
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Current Payment Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold font-mono text-green-700 dark:text-green-400">
              {formatCurrency(g702.currentPaymentDue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Retainage: {formatCurrency(g702.retainageToDate)} ({formatPercent(detail.retainagePercent)})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Balance to Finish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold font-mono">{formatCurrency(g702.balanceToFinish)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Less prev certificates: {formatCurrency(g702.lessPreviousCertificates)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* G703 Line Items (Continuation Sheet) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">G703 Continuation Sheet</CardTitle>
              <CardDescription>
                {detail.g703LineItems.length} line items
                {isDraft && " \u2014 Edit Work This Period and Materials Stored"}
              </CardDescription>
            </div>
            {isDraft && hasLineItemChanges && (
              <LoadingButton
                size="sm"
                onClick={handleSaveLineItems}
                loading={isSaving}
                loadingText="Saving..."
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Save
              </LoadingButton>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-3">
            {detail.g703LineItems.map((li) => {
              const edited = editedItems.get(li.sovLineItemId);
              return (
                <div key={li.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{li.itemNumber}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatPercent(li.percentComplete)}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{li.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Scheduled</span>
                      <p className="font-mono font-medium">{formatCurrency(li.scheduledValue)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Work Previous</span>
                      <p className="font-mono">{formatCurrency(li.workCompletedPrevious)}</p>
                    </div>
                  </div>
                  {isDraft && edited ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Work This Period</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edited.workThisPeriod}
                          onChange={(e) => updateLineItem(li.sovLineItemId, "workThisPeriod", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Materials Stored</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={edited.materialsThisPeriod}
                          onChange={(e) => updateLineItem(li.sovLineItemId, "materialsThisPeriod", e.target.value)}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Work This Period</span>
                        <p className="font-mono font-medium">{formatCurrency(li.workCompletedThisPeriod)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Materials Stored</span>
                        <p className="font-mono">{formatCurrency(li.materialsStoredThisPeriod)}</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Total to Date</span>
                      <p className="font-mono font-medium">{formatCurrency(li.totalCompletedAndStoredToDate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Retainage</span>
                      <p className="font-mono">{formatCurrency(li.retainageAmount)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Scheduled Value</TableHead>
                  <TableHead className="text-right">Work Previous</TableHead>
                  <TableHead className="text-right w-32">
                    {isDraft ? "Work This Period *" : "Work This Period"}
                  </TableHead>
                  <TableHead className="text-right w-32">
                    {isDraft ? "Materials Stored *" : "Materials Stored"}
                  </TableHead>
                  <TableHead className="text-right">Total to Date</TableHead>
                  <TableHead className="text-right w-16">%</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Retainage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.g703LineItems.map((li) => {
                  const edited = editedItems.get(li.sovLineItemId);
                  return (
                    <TableRow key={li.id}>
                      <TableCell className="font-mono text-xs">{li.itemNumber}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{li.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(li.scheduledValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatCurrency(li.workCompletedPrevious)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDraft && edited ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={edited.workThisPeriod}
                            onChange={(e) => updateLineItem(li.sovLineItemId, "workThisPeriod", e.target.value)}
                            className="h-7 text-right font-mono text-sm w-28 ml-auto"
                          />
                        ) : (
                          <span className="font-mono text-sm">
                            {formatCurrency(li.workCompletedThisPeriod)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDraft && edited ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={edited.materialsThisPeriod}
                            onChange={(e) => updateLineItem(li.sovLineItemId, "materialsThisPeriod", e.target.value)}
                            className="h-7 text-right font-mono text-sm w-28 ml-auto"
                          />
                        ) : (
                          <span className="font-mono text-sm">
                            {formatCurrency(li.materialsStoredThisPeriod)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(li.totalCompletedAndStoredToDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatPercent(li.percentComplete)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(li.balanceToFinish)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatCurrency(li.retainageAmount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals row */}
                {g703Totals && (
                  <TableRow className="bg-muted font-semibold">
                    <TableCell colSpan={2}>Grand Total</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.scheduledValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.workPrevious)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.workThisPeriod)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.matThisPeriod)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.totalCompleted)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {g703Totals.scheduledValue > 0
                        ? formatPercent((g703Totals.totalCompleted / g703Totals.scheduledValue) * 100)
                        : "0.0%"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.balanceToFinish)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(g703Totals.retainage)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes & Timeline */}
      {(detail.notes || detail.approvedBy || detail.reviewedBy || detail.paidDate || detail.rejectedBy) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {detail.submittedDate && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="shrink-0">Submitted</Badge>
                  <span className="text-muted-foreground">{formatDate(detail.submittedDate)}</span>
                </div>
              )}
              {detail.reviewedDate && detail.reviewedBy && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="shrink-0">Reviewed</Badge>
                  <span>by {detail.reviewedBy} on {formatDate(detail.reviewedDate)}</span>
                </div>
              )}
              {detail.approvedDate && detail.approvedBy && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="shrink-0">Approved</Badge>
                  <span>by {detail.approvedBy} on {formatDate(detail.approvedDate)}</span>
                </div>
              )}
              {detail.rejectedDate && detail.rejectedBy && (
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="shrink-0 border-red-300 text-red-700 dark:text-red-400">Rejected</Badge>
                    <span>by {detail.rejectedBy} on {formatDate(detail.rejectedDate)}</span>
                  </div>
                  {detail.rejectionReason && (
                    <p className="text-sm text-red-700 dark:text-red-400 ml-[calc(theme(spacing.3)+4.5rem)]">
                      Reason: {detail.rejectionReason}
                    </p>
                  )}
                </div>
              )}
              {detail.paidDate && (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="shrink-0">Paid</Badge>
                  <span>
                    {detail.paidAmount != null ? formatCurrency(detail.paidAmount) : ""} on {formatDate(detail.paidDate)}
                    {detail.checkNumber && <> (Check: {detail.checkNumber})</>}
                  </span>
                </div>
              )}
              {detail.notes && (
                <div className="mt-3 rounded-md border p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">NOTES</p>
                  <p className="text-sm">{detail.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Dialogs ──────────────────────────────────────── */}

      <ConfirmDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        title="Submit for Review?"
        description="This will lock the line items and submit for review. You will not be able to edit amounts after submission."
        onConfirm={handleSubmit}
        isLoading={actionLoading}
        loadingText="Submitting..."
        confirmLabel="Submit"
        variant="warning"
      />

      <Dialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment Application</DialogTitle>
            <DialogDescription>
              This will reject the payment application. The subcontractor will need to resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain why this application is being rejected..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectConfirm(false)} disabled={actionLoading}>Cancel</Button>
            <LoadingButton onClick={handleReject} loading={actionLoading} loadingText="Rejecting..." variant="destructive">
              Reject
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Payment Application</DialogTitle>
            <DialogDescription>
              Mark this application as reviewed and ready for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reviewed By *</Label>
              <Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} placeholder="Optional review notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} disabled={actionLoading}>Cancel</Button>
            <LoadingButton onClick={handleReview} loading={actionLoading} loadingText="Reviewing..." className="bg-amber-500 hover:bg-amber-600 text-white">
              Mark Reviewed
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Payment Application</DialogTitle>
            <DialogDescription>
              Approve this application for payment. You can adjust the approved amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Approved By *</Label>
              <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Approved Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" step="0.01" min="0" className="pl-7" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Requested: {formatCurrency(detail.currentPaymentDue)}</p>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} rows={2} placeholder="Optional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={actionLoading}>Cancel</Button>
            <LoadingButton onClick={handleApprove} loading={actionLoading} loadingText="Approving..." className="bg-green-500 hover:bg-green-600 text-white">
              Approve
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record the payment details for this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Paid Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input type="number" step="0.01" min="0" className="pl-7" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Payment Reference *</Label>
              <Input value={paidReference} onChange={(e) => setPaidReference(e.target.value)} placeholder="Wire transfer ref, EFT #, etc." />
            </div>
            <div className="space-y-2">
              <Label>Check Number</Label>
              <Input value={paidCheckNumber} onChange={(e) => setPaidCheckNumber(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkPaidDialog(false)} disabled={actionLoading}>Cancel</Button>
            <LoadingButton onClick={handleMarkPaid} loading={actionLoading} loadingText="Recording..." className="bg-teal-500 hover:bg-teal-600 text-white">
              Mark Paid
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
