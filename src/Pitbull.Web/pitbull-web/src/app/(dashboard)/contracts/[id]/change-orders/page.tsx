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
import { ArrowRight, FileText, Pencil, Trash2 } from "lucide-react";
import api from "@/lib/api";
import type { ChangeOrder, ChangeOrderStatus, PagedResult, Subcontract } from "@/lib/types";
import { changeOrderStatusBadgeClass, changeOrderStatusLabel, formatCurrency } from "@/lib/contracts";
import { getAllowedChangeOrderStatuses } from "@/lib/workflow-transitions";
import { toast } from "sonner";

type FormData = {
  number: string;
  title: string;
  description: string;
  amount: string;
  status: ChangeOrderStatus;
  scheduleImpactDays: string;
  costImpact: string;
  requestedBy: string;
  requestDate: string;
  approvedDate: string;
};

const emptyForm: FormData = {
  number: "",
  title: "",
  description: "",
  amount: "",
  status: 0,
  scheduleImpactDays: "",
  costImpact: "",
  requestedBy: "",
  requestDate: new Date().toISOString().slice(0, 10),
  approvedDate: "",
};

const allStatusOptions: Array<{ value: ChangeOrderStatus; label: string }> = [
  { value: 0, label: "Pending" },
  { value: 1, label: "Under Review" },
  { value: 2, label: "Approved" },
  { value: 3, label: "Rejected" },
  { value: 4, label: "Withdrawn" },
  { value: 5, label: "Void" },
];

function getStatusOptions(currentStatus: ChangeOrderStatus | null): Array<{ value: ChangeOrderStatus; label: string }> {
  const allowed = getAllowedChangeOrderStatuses(currentStatus);
  return allStatusOptions.filter((opt) => allowed.includes(opt.value));
}

function toIsoDate(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ChangeOrdersPage() {
  const params = useParams();
  const subcontractId = params.id as string;

  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [items, setItems] = useState<ChangeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<ChangeOrder | null>(null);
  const [deleting, setDeleting] = useState<ChangeOrder | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const approvedTotal = useMemo(
    () => items.filter((co) => co.status === 2).reduce((sum, co) => sum + co.amount, 0),
    [items]
  );

  const pendingCount = useMemo(
    () => items.filter((co) => co.status === 0).length,
    [items]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subRes, coRes] = await Promise.all([
        api<Subcontract>(`/api/subcontracts/${subcontractId}`),
        api<PagedResult<ChangeOrder>>(`/api/changeorders?subcontractId=${subcontractId}&pageSize=200`),
      ]);
      setSubcontract(subRes);
      setItems(coRes.items);
    } catch {
      toast.error("Failed to load change orders");
    } finally {
      setIsLoading(false);
    }
  }, [subcontractId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(co: ChangeOrder) {
    setEditing(co);
    setFormData({
      number: co.number || co.changeOrderNumber,
      title: co.title,
      description: co.description,
      amount: String(co.amount),
      status: co.status,
      scheduleImpactDays: String(co.scheduleImpactDays ?? co.daysExtension ?? ""),
      costImpact: String(co.costImpact ?? ""),
      requestedBy: co.requestedBy ?? "",
      requestDate: toIsoDate(co.requestDate ?? co.submittedDate),
      approvedDate: toIsoDate(co.approvedDate),
    });
    setDialogOpen(true);
  }

  function openDelete(co: ChangeOrder) {
    setDeleting(co);
    setDeleteOpen(true);
  }

  async function onSubmit() {
    if (!formData.number.trim() || !formData.title.trim() || !formData.description.trim()) {
      toast.error("Number, title, and description are required");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount)) {
      toast.error("Amount must be a valid number");
      return;
    }

    const payload = {
      id: editing?.id,
      subcontractId,
      number: formData.number.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      amount,
      status: formData.status,
      scheduleImpactDays: formData.scheduleImpactDays
        ? parseInt(formData.scheduleImpactDays, 10)
        : null,
      costImpact: formData.costImpact ? parseFloat(formData.costImpact) : null,
      requestedBy: formData.requestedBy.trim() || null,
      requestDate: formData.requestDate || null,
      approvedDate: formData.approvedDate || null,
    };

    setIsSubmitting(true);
    try {
      if (editing) {
        await api<ChangeOrder>(`/api/changeorders/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Change order updated");
      } else {
        await api<ChangeOrder>("/api/changeorders", {
          method: "POST",
          body: payload,
        });
        toast.success("Change order created");
      }

      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error("Failed to save change order", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await api(`/api/changeorders/${deleting.id}`, { method: "DELETE" });
      toast.success("Change order deleted");
      setDeleteOpen(false);
      setDeleting(null);
      await fetchData();
    } catch (err) {
      toast.error("Failed to delete change order", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Contracts", href: "/contracts" },
          { label: subcontract?.subcontractNumber || "Subcontract", href: `/contracts/${subcontractId}` },
          { label: "Change Orders" },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Change Orders</h1>
          <p className="text-muted-foreground">
            {subcontract
              ? `${subcontract.subcontractNumber} · ${subcontract.subcontractorName}`
              : "Manage subcontract change orders"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/contracts/${subcontractId}`}>Back to Subcontract</Link>
          </Button>
          <Button onClick={openCreate} className="bg-amber-500 text-white hover:bg-amber-600">
            + New Change Order
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total COs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Approved Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(approvedTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revised Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subcontract ? formatCurrency((subcontract.originalValue ?? 0) + approvedTotal) : "—"}
            </div>
            {subcontract && approvedTotal !== 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <span>{formatCurrency(subcontract.originalValue ?? 0)}</span>
                <ArrowRight className="h-3 w-3" />
                <span className={approvedTotal > 0 ? "text-amber-600" : "text-green-600"}>
                  {approvedTotal > 0 ? "+" : ""}{formatCurrency(approvedTotal)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Order Register</CardTitle>
          <CardDescription>Track pending, approved, and rejected change orders.</CardDescription>
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
              icon={FileText}
              title="No change orders yet"
              description="Create your first change order for this subcontract."
              actionLabel="+ New Change Order"
              onAction={openCreate}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Cost Impact</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="font-mono">{co.number || co.changeOrderNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{co.title}</div>
                      <div className="max-w-[360px] truncate text-xs text-muted-foreground">{co.description}</div>
                    </TableCell>
                    <TableCell>{co.requestedBy || "-"}</TableCell>
                    <TableCell>{co.requestDate ? new Date(co.requestDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(co.amount)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(co.costImpact ?? 0)}</TableCell>
                    <TableCell>{co.scheduleImpactDays ?? co.daysExtension ?? 0}d</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={changeOrderStatusBadgeClass(co.status)}>
                        {changeOrderStatusLabel(co.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(co)}
                          aria-label="Edit change order"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openDelete(co)}
                          aria-label="Delete change order"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Change Order" : "Create Change Order"}</DialogTitle>
            <DialogDescription>
              Capture subcontract change details, approval status, and schedule/cost impact.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="co-number">Number</Label>
                <Input
                  id="co-number"
                  value={formData.number}
                  onChange={(e) => setFormData((p) => ({ ...p, number: e.target.value }))}
                  placeholder="CO-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-status">Status</Label>
                <Select
                  value={String(formData.status)}
                  onValueChange={(value) =>
                    setFormData((p) => ({ ...p, status: Number(value) as ChangeOrderStatus }))
                  }
                >
                  <SelectTrigger id="co-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions(editing?.status ?? null).map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="co-title">Title</Label>
              <Input
                id="co-title"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="Additional steel framing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="co-description">Description</Label>
              <Textarea
                id="co-description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Describe scope and reason for the requested change"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="co-requested-by">Requested By</Label>
                <Input
                  id="co-requested-by"
                  value={formData.requestedBy}
                  onChange={(e) => setFormData((p) => ({ ...p, requestedBy: e.target.value }))}
                  placeholder="Project Manager"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-request-date">Request Date</Label>
                <Input
                  id="co-request-date"
                  type="date"
                  value={formData.requestDate}
                  onChange={(e) => setFormData((p) => ({ ...p, requestDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="co-amount">Amount</Label>
                <Input
                  id="co-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-cost-impact">Cost Impact</Label>
                <Input
                  id="co-cost-impact"
                  type="number"
                  step="0.01"
                  value={formData.costImpact}
                  onChange={(e) => setFormData((p) => ({ ...p, costImpact: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-schedule-impact">Schedule Impact (days)</Label>
                <Input
                  id="co-schedule-impact"
                  type="number"
                  value={formData.scheduleImpactDays}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, scheduleImpactDays: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="co-approved-date">Approved Date</Label>
              <Input
                id="co-approved-date"
                type="date"
                value={formData.approvedDate}
                onChange={(e) => setFormData((p) => ({ ...p, approvedDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={isSubmitting} className="bg-amber-500 text-white hover:bg-amber-600">
              {isSubmitting ? "Saving..." : editing ? "Save Changes" : "Create Change Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Change Order</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Delete {deleting?.number || deleting?.changeOrderNumber}?
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
