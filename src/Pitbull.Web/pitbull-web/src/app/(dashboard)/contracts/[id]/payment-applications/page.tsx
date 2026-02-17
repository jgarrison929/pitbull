"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Receipt, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import type {
  PagedResult,
  PaymentApplication,
  PaymentApplicationStatus,
  Subcontract,
} from "@/lib/types";
import {
  formatCurrency,
  paymentApplicationStatusBadgeClass,
  paymentApplicationStatusLabel,
} from "@/lib/contracts";
import { toast } from "sonner";

type CreateForm = {
  periodStart: string;
  periodEnd: string;
  workCompletedThisPeriod: string;
  storedMaterials: string;
  invoiceNumber: string;
  notes: string;
};

type EditForm = {
  workCompletedThisPeriod: string;
  storedMaterials: string;
  status: PaymentApplicationStatus;
  approvedBy: string;
  approvedAmount: string;
  invoiceNumber: string;
  checkNumber: string;
  notes: string;
};

const emptyCreateForm: CreateForm = {
  periodStart: "",
  periodEnd: "",
  workCompletedThisPeriod: "0",
  storedMaterials: "0",
  invoiceNumber: "",
  notes: "",
};

const emptyEditForm: EditForm = {
  workCompletedThisPeriod: "0",
  storedMaterials: "0",
  status: 0,
  approvedBy: "",
  approvedAmount: "",
  invoiceNumber: "",
  checkNumber: "",
  notes: "",
};

const statusOptions: Array<{ value: PaymentApplicationStatus; label: string }> = [
  { value: 0, label: "Draft" },
  { value: 1, label: "Submitted" },
  { value: 2, label: "Under Review" },
  { value: 3, label: "Approved" },
  { value: 4, label: "Partially Approved" },
  { value: 5, label: "Rejected" },
  { value: 6, label: "Paid" },
  { value: 7, label: "Void" },
];

function dateOnly(dateValue?: string | null): string {
  if (!dateValue) return "";
  return new Date(dateValue).toISOString().slice(0, 10);
}

function formatDate(dateValue?: string | null): string {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString();
}

export default function PaymentApplicationsPage() {
  const params = useParams();
  const subcontractId = params.id as string;

  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [items, setItems] = useState<PaymentApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);

  const [editingItem, setEditingItem] = useState<PaymentApplication | null>(null);
  const [deletingItem, setDeletingItem] = useState<PaymentApplication | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalCurrentDue = useMemo(
    () => items.reduce((sum, item) => sum + item.currentPaymentDue, 0),
    [items]
  );

  const paidCount = useMemo(
    () => items.filter((item) => item.status === 6).length,
    [items]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subcontractRes, payAppsRes] = await Promise.all([
        api<Subcontract>(`/api/subcontracts/${subcontractId}`),
        api<PagedResult<PaymentApplication>>(
          `/api/paymentapplications?subcontractId=${subcontractId}&pageSize=200`
        ),
      ]);

      setSubcontract(subcontractRes);
      setItems(payAppsRes.items);
    } catch {
      toast.error("Failed to load payment applications");
    } finally {
      setIsLoading(false);
    }
  }, [subcontractId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreateDialog() {
    setCreateForm({
      ...emptyCreateForm,
      periodStart: new Date().toISOString().slice(0, 10),
      periodEnd: new Date().toISOString().slice(0, 10),
    });
    setCreateOpen(true);
  }

  function openEditDialog(item: PaymentApplication) {
    setEditingItem(item);
    setEditForm({
      workCompletedThisPeriod: String(item.workCompletedThisPeriod),
      storedMaterials: String(item.storedMaterials),
      status: item.status,
      approvedBy: item.approvedBy || "",
      approvedAmount:
        item.approvedAmount === null || item.approvedAmount === undefined
          ? ""
          : String(item.approvedAmount),
      invoiceNumber: item.invoiceNumber || "",
      checkNumber: item.checkNumber || "",
      notes: item.notes || "",
    });
    setEditOpen(true);
  }

  function openDeleteDialog(item: PaymentApplication) {
    setDeletingItem(item);
    setDeleteOpen(true);
  }

  async function onCreate() {
    if (!createForm.periodStart || !createForm.periodEnd) {
      toast.error("Period start and end are required");
      return;
    }

    const workCompletedThisPeriod = parseFloat(createForm.workCompletedThisPeriod);
    const storedMaterials = parseFloat(createForm.storedMaterials);

    if (isNaN(workCompletedThisPeriod) || isNaN(storedMaterials)) {
      toast.error("Work completed and stored materials must be valid numbers");
      return;
    }

    setIsSubmitting(true);
    try {
      await api<PaymentApplication>("/api/paymentapplications", {
        method: "POST",
        body: {
          subcontractId,
          periodStart: createForm.periodStart,
          periodEnd: createForm.periodEnd,
          workCompletedThisPeriod,
          storedMaterials,
          invoiceNumber: createForm.invoiceNumber.trim() || null,
          notes: createForm.notes.trim() || null,
        },
      });

      toast.success("Payment application created");
      setCreateOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create payment application"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onEdit() {
    if (!editingItem) return;

    const workCompletedThisPeriod = parseFloat(editForm.workCompletedThisPeriod);
    const storedMaterials = parseFloat(editForm.storedMaterials);

    if (isNaN(workCompletedThisPeriod) || isNaN(storedMaterials)) {
      toast.error("Work completed and stored materials must be valid numbers");
      return;
    }

    setIsSubmitting(true);
    try {
      await api<PaymentApplication>(`/api/paymentapplications/${editingItem.id}`, {
        method: "PUT",
        body: {
          id: editingItem.id,
          workCompletedThisPeriod,
          storedMaterials,
          status: editForm.status,
          approvedBy: editForm.approvedBy.trim() || null,
          approvedAmount: editForm.approvedAmount
            ? parseFloat(editForm.approvedAmount)
            : null,
          invoiceNumber: editForm.invoiceNumber.trim() || null,
          checkNumber: editForm.checkNumber.trim() || null,
          notes: editForm.notes.trim() || null,
        },
      });

      toast.success("Payment application updated");
      setEditOpen(false);
      setEditingItem(null);
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update payment application"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      await api(`/api/paymentapplications/${deletingItem.id}`, {
        method: "DELETE",
      });

      toast.success("Payment application deleted");
      setDeleteOpen(false);
      setDeletingItem(null);
      await fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete payment application"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Contracts", href: "/contracts" },
          {
            label: subcontract?.subcontractNumber || "Subcontract",
            href: `/contracts/${subcontractId}`,
          },
          { label: "Payment Applications" },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Applications</h1>
          <p className="text-muted-foreground">
            {subcontract
              ? `${subcontract.subcontractNumber} · ${subcontract.subcontractorName}`
              : "Manage subcontract payment applications"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/contracts/${subcontractId}`}>Back to Subcontract</Link>
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            + New Pay App
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pay Apps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Current Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCurrentDue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Register</CardTitle>
          <CardDescription>
            Create, update, and track payment applications for this subcontract.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payment applications yet"
              description="Create the first pay app to track billing progress."
              actionLabel="+ New Pay App"
              onAction={openCreateDialog}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Work This Period</TableHead>
                  <TableHead className="text-right">Stored Materials</TableHead>
                  <TableHead className="text-right">Current Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.applicationNumber}</TableCell>
                    <TableCell>
                      {formatDate(item.periodStart)} - {formatDate(item.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.workCompletedThisPeriod)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.storedMaterials)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.currentPaymentDue)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={paymentApplicationStatusBadgeClass(item.status)}
                      >
                        {paymentApplicationStatusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.invoiceNumber || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(item)}
                          aria-label="Edit payment application"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDeleteDialog(item)}
                          aria-label="Delete payment application"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Payment Application</DialogTitle>
            <DialogDescription>
              Start a new pay application period for this subcontract.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={createForm.periodStart}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, periodStart: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={createForm.periodEnd}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, periodEnd: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="work-this-period">Work Completed This Period</Label>
                <Input
                  id="work-this-period"
                  type="number"
                  step="0.01"
                  value={createForm.workCompletedThisPeriod}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      workCompletedThisPeriod: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stored-materials">Stored Materials</Label>
                <Input
                  id="stored-materials"
                  type="number"
                  step="0.01"
                  value={createForm.storedMaterials}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, storedMaterials: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-number">Invoice Number</Label>
              <Input
                id="invoice-number"
                value={createForm.invoiceNumber}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                }
                placeholder="INV-2026-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-notes">Notes</Label>
              <Textarea
                id="create-notes"
                rows={3}
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={isSubmitting}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {isSubmitting ? "Creating..." : "Create Pay App"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Payment Application</DialogTitle>
            <DialogDescription>
              Update values and advance the payment application lifecycle.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-work">Work Completed This Period</Label>
                <Input
                  id="edit-work"
                  type="number"
                  step="0.01"
                  value={editForm.workCompletedThisPeriod}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      workCompletedThisPeriod: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stored">Stored Materials</Label>
                <Input
                  id="edit-stored"
                  type="number"
                  step="0.01"
                  value={editForm.storedMaterials}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, storedMaterials: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={String(editForm.status)}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: Number(value) as PaymentApplicationStatus,
                  }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-approved-by">Approved By</Label>
                <Input
                  id="edit-approved-by"
                  value={editForm.approvedBy}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, approvedBy: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-approved-amount">Approved Amount</Label>
                <Input
                  id="edit-approved-amount"
                  type="number"
                  step="0.01"
                  value={editForm.approvedAmount}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, approvedAmount: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-invoice">Invoice Number</Label>
                <Input
                  id="edit-invoice"
                  value={editForm.invoiceNumber}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-check">Check Number</Label>
                <Input
                  id="edit-check"
                  value={editForm.checkNumber}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, checkNumber: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            {editingItem && (
              <div className="rounded border bg-muted/30 p-3 text-sm text-muted-foreground">
                <div>Application #: {editingItem.applicationNumber}</div>
                <div>
                  Period: {formatDate(editingItem.periodStart)} - {formatDate(editingItem.periodEnd)}
                </div>
                <div>Created: {formatDate(editingItem.createdAt)}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={onEdit}
              disabled={isSubmitting}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Application</DialogTitle>
            <DialogDescription>
              Delete pay app #{deletingItem?.applicationNumber}? Only Draft applications can be
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
