"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt, DollarSign, Clock, CheckCircle } from "lucide-react";
import api from "@/lib/api";
import type { PagedResult, Subcontract, PaymentApplication } from "@/lib/types";
import { PaymentApplicationStatus } from "@/lib/types";
import {
  paymentApplicationStatusBadgeClass,
  paymentApplicationStatusLabel,
  formatCurrency,
} from "@/lib/contracts";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";

const ALL_VALUE = "__all__";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "\u2014";
  return new Date(dateString).toLocaleDateString();
}

export default function PaymentApplicationsPage() {
  const { activeCompany } = useCompany();
  const [payApps, setPayApps] = useState<PaymentApplication[]>([]);
  const [subcontracts, setSubcontracts] = useState<Subcontract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [subcontractFilter, setSubcontractFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubcontractId, setFormSubcontractId] = useState("");
  const [formPeriodStart, setFormPeriodStart] = useState("");
  const [formPeriodEnd, setFormPeriodEnd] = useState("");
  const [formWorkCompleted, setFormWorkCompleted] = useState("");
  const [formStoredMaterials, setFormStoredMaterials] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchSubcontracts = useCallback(async () => {
    try {
      const result = await api<PagedResult<Subcontract>>("/api/subcontracts?pageSize=100");
      setSubcontracts(result.items);
    } catch {
      // silently handle
    }
  }, []);

  const fetchPayApps = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      if (subcontractFilter !== ALL_VALUE) params.set("subcontractId", subcontractFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const result = await api<PagedResult<PaymentApplication>>(
        `/api/paymentapplications?${params.toString()}`
      );
      setPayApps(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load payment applications");
    } finally {
      setIsLoading(false);
    }
  }, [subcontractFilter, statusFilter]);

  useEffect(() => {
    fetchSubcontracts();
  }, [fetchSubcontracts, activeCompany?.id]);

  useEffect(() => {
    fetchPayApps();
  }, [fetchPayApps, activeCompany?.id]);

  // Summary calculations
  const totalDue = payApps.reduce((sum, pa) => sum + pa.currentPaymentDue, 0);
  const totalWork = payApps.reduce((sum, pa) => sum + pa.workCompletedThisPeriod, 0);
  const approvedCount = payApps.filter(
    (pa) => pa.status === PaymentApplicationStatus.Approved || pa.status === PaymentApplicationStatus.Paid
  ).length;
  const pendingCount = payApps.filter(
    (pa) => pa.status === PaymentApplicationStatus.Submitted || pa.status === PaymentApplicationStatus.UnderReview
  ).length;

  function openCreate() {
    setFormSubcontractId("");
    setFormPeriodStart("");
    setFormPeriodEnd("");
    setFormWorkCompleted("");
    setFormStoredMaterials("0");
    setFormInvoiceNumber("");
    setFormNotes("");
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formSubcontractId) {
      toast.error("Select a subcontract");
      return;
    }
    const workCompleted = parseFloat(formWorkCompleted);
    if (isNaN(workCompleted) || workCompleted < 0) {
      toast.error("Enter a valid work completed amount");
      return;
    }
    if (!formPeriodStart || !formPeriodEnd) {
      toast.error("Period dates are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api<PaymentApplication>("/api/paymentapplications", {
        method: "POST",
        body: {
          subcontractId: formSubcontractId,
          periodStart: formPeriodStart,
          periodEnd: formPeriodEnd,
          workCompletedThisPeriod: workCompleted,
          storedMaterials: parseFloat(formStoredMaterials) || 0,
          invoiceNumber: formInvoiceNumber.trim() || null,
          notes: formNotes.trim() || null,
        },
      });
      toast.success("Payment application created");
      setCreateOpen(false);
      fetchPayApps();
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || "Failed to create payment application");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Applications</h1>
          <p className="text-muted-foreground">
            Track billing progress and payments across all subcontracts
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          + New Pay App
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payment Due</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved / Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="subcontractFilter">Subcontract</Label>
              <Select value={subcontractFilter} onValueChange={setSubcontractFilter}>
                <SelectTrigger id="subcontractFilter">
                  <SelectValue placeholder="All subcontracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Subcontracts</SelectItem>
                  {subcontracts.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.subcontractNumber} - {sub.subcontractorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="UnderReview">Under Review</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="PartiallyApproved">Partially Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Payment Applications</CardTitle>
          <CardDescription>{totalCount} total</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={5} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["#", "Subcontract", "Period", "Work This Period", "Payment Due", "Status"]}
                  rows={5}
                />
              </div>
            </>
          ) : payApps.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payment applications"
              description="Create your first payment application to start tracking billing progress."
              actionLabel="+ Create Pay App"
              onAction={openCreate}
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {payApps.map((pa) => (
                  <div key={pa.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          App #{pa.applicationNumber}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(pa.periodStart)} - {formatDate(pa.periodEnd)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${paymentApplicationStatusBadgeClass(pa.status)} text-xs shrink-0`}
                      >
                        {paymentApplicationStatusLabel(pa.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Work This Period</span>
                        <p className="font-medium font-mono">
                          {formatCurrency(pa.workCompletedThisPeriod)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Payment Due</span>
                        <p className="font-medium font-mono">
                          {formatCurrency(pa.currentPaymentDue)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Retainage</span>
                        <p className="font-medium font-mono">
                          {formatCurrency(pa.totalRetainage)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Invoice</span>
                        <p className="font-medium">{pa.invoiceNumber || "\u2014"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Scheduled Value</TableHead>
                      <TableHead className="text-right">Work This Period</TableHead>
                      <TableHead className="text-right">Retainage</TableHead>
                      <TableHead className="text-right">Payment Due</TableHead>
                      <TableHead>Invoice</TableHead>
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
                          {formatCurrency(pa.scheduledValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pa.workCompletedThisPeriod)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(pa.totalRetainage)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(pa.currentPaymentDue)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {pa.invoiceNumber || "\u2014"}
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
                    {/* Totals */}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalWork)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(payApps.reduce((s, pa) => s + pa.totalRetainage, 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(totalDue)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Payment Application</DialogTitle>
            <DialogDescription>
              Create a new pay app for billing against a subcontract.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Subcontract <span className="text-destructive">*</span></Label>
              <Select value={formSubcontractId} onValueChange={setFormSubcontractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subcontract" />
                </SelectTrigger>
                <SelectContent>
                  {subcontracts.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.subcontractNumber} - {sub.subcontractorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={formPeriodStart}
                  onChange={(e) => setFormPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Period End <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={formPeriodEnd}
                  onChange={(e) => setFormPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Work Completed ($) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formWorkCompleted}
                  onChange={(e) => setFormWorkCompleted(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Stored Materials ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formStoredMaterials}
                  onChange={(e) => setFormStoredMaterials(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input
                value={formInvoiceNumber}
                onChange={(e) => setFormInvoiceNumber(e.target.value)}
                placeholder="INV-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Pay App"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
