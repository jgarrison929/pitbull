"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  DollarSign,
  Percent,
  BarChart3,
  Wallet,
} from "lucide-react";
import api from "@/lib/api";
import type {
  Subcontract,
  ScheduleOfValues,
  SOVLineItem,
  SOVSummary,
  CreateSOVLineItemCommand,
  UpdateSOVLineItemCommand,
} from "@/lib/types";
import { formatCurrency } from "@/lib/contracts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusBadgeClass: Record<number, string> = {
  0: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  1: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const statusLabel: Record<number, string> = {
  0: "Draft",
  1: "Active",
  2: "Closed",
};

/** Phone SOV is glance / review only — mutations stay desktop-first (band 3.5.7). */
export const SOV_PHONE_READONLY_BANNER =
  "On phone: SOV is a read-only glance. Add or edit line items on a larger screen.";

export default function SOVPage() {
  const params = useParams();
  const contractId = params.id as string;

  const [subcontract, setSubcontract] = useState<Subcontract | null>(null);
  const [sov, setSov] = useState<ScheduleOfValues | null>(null);
  const [summary, setSummary] = useState<SOVSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add line item sheet
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState<CreateSOVLineItemCommand>({
    itemNumber: "",
    description: "",
    scheduledValue: 0,
  });

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: "currentBilled" | "storedMaterials" | "retainage";
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sub = await api<Subcontract>(`/api/subcontracts/${contractId}`);
      setSubcontract(sub);

      try {
        const sovData = await api<ScheduleOfValues>(
          `/api/contracts/${contractId}/sov`
        );
        setSov(sovData);
        const sumData = await api<SOVSummary>(
          `/api/sov/${sovData.id}/summary`
        );
        setSummary(sumData);
      } catch {
        // No SOV yet - that's fine
        setSov(null);
        setSummary(null);
      }
    } catch {
      toast.error("Failed to load contract details");
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSOV = async () => {
    setIsCreating(true);
    try {
      const created = await api<ScheduleOfValues>(
        `/api/contracts/${contractId}/sov`,
        {
          method: "POST",
          body: {
            name: `SOV - ${subcontract?.subcontractorName || "Contract"}`,
            retainagePercent: subcontract?.retainagePercent ?? 10,
          },
        }
      );
      setSov(created);
      toast.success("Schedule of Values created");
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create SOV"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddLineItem = async () => {
    if (!sov || !newItem.itemNumber || !newItem.description) return;
    setIsSaving(true);
    try {
      await api<SOVLineItem>(`/api/sov/${sov.id}/line-items`, {
        method: "POST",
        body: newItem,
      });
      toast.success("Line item added");
      setIsAddOpen(false);
      setNewItem({ itemNumber: "", description: "", scheduledValue: 0 });
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add line item"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLineItem = async (lineItemId: string) => {
    if (!sov) return;
    if (!confirm("Remove this line item from the schedule of values?")) return;
    try {
      await api(`/api/sov/${sov.id}/line-items/${lineItemId}`, {
        method: "DELETE",
      });
      toast.success("Line item removed");
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete line item"
      );
    }
  };

  const startEditing = (
    id: string,
    field: "currentBilled" | "storedMaterials" | "retainage",
    currentValue: number
  ) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
    setTimeout(() => editInputRef.current?.select(), 0);
  };

  const saveEdit = async () => {
    if (!editingCell || !sov) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      setEditingCell(null);
      return;
    }

    const update: UpdateSOVLineItemCommand = {
      [editingCell.field]: val,
    };

    try {
      await api(`/api/sov/${sov.id}/line-items/${editingCell.id}`, {
        method: "PUT",
        body: update,
      });
      setEditingCell(null);
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update"
      );
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditingCell(null);
  };

  const nextItemNumber = useMemo(() => {
    if (!sov || sov.lineItems.length === 0) return "001";
    const numbers = sov.lineItems.map((li) => parseInt(li.itemNumber) || 0);
    return String(Math.max(...numbers) + 1).padStart(3, "0");
  }, [sov]);

  const handleExportCSV = () => {
    if (!sov) return;
    const headers = [
      "Item #",
      "Description",
      "Scheduled Value",
      "Previously Billed",
      "Current Period",
      "Stored Materials",
      "Total Completed",
      "% Complete",
      "Balance to Finish",
      "Retainage",
    ];
    const rows = sov.lineItems.map((li) => [
      li.itemNumber,
      `"${li.description}"`,
      li.scheduledValue.toFixed(2),
      li.previouslyBilled.toFixed(2),
      li.currentBilled.toFixed(2),
      li.storedMaterials.toFixed(2),
      li.totalCompletedToDate.toFixed(2),
      li.percentComplete.toFixed(1),
      li.balanceToFinish.toFixed(2),
      li.retainage.toFixed(2),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sov-${sov.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute footer totals from line items
  const totals = useMemo(() => {
    if (!sov) return null;
    const items = sov.lineItems;
    const scheduled = items.reduce((s, li) => s + li.scheduledValue, 0);
    const prev = items.reduce((s, li) => s + li.previouslyBilled, 0);
    const current = items.reduce((s, li) => s + li.currentBilled, 0);
    const stored = items.reduce((s, li) => s + li.storedMaterials, 0);
    const completed = items.reduce((s, li) => s + li.totalCompletedToDate, 0);
    const balance = items.reduce((s, li) => s + li.balanceToFinish, 0);
    const retainage = items.reduce((s, li) => s + li.retainage, 0);
    const pct = scheduled > 0 ? (completed / scheduled) * 100 : 0;
    return { scheduled, prev, current, stored, completed, pct, balance, retainage };
  }, [sov]);

  if (isLoading) {
    return (
      <div className="max-w-7xl space-y-6">
        <Breadcrumbs
          items={[
            { label: "Contracts", href: "/contracts" },
            { label: "Contract", href: `/contracts/${contractId}` },
            { label: "Schedule of Values" },
          ]}
        />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!subcontract) {
    return (
      <div className="max-w-7xl space-y-6">
        <p className="text-muted-foreground">Contract not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      <Breadcrumbs
        items={[
          { label: "Contracts", href: "/contracts" },
          {
            label:
              subcontract.subcontractorName || subcontract.subcontractNumber,
            href: `/contracts/${contractId}`,
          },
          { label: "Schedule of Values" },
        ]}
      />

      <p
        className="sm:hidden text-xs text-muted-foreground rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2"
        data-testid="sov-phone-readonly-banner"
      >
        {SOV_PHONE_READONLY_BANNER}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/contracts/${contractId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Schedule of Values
            </h1>
            <p className="text-muted-foreground">
              {subcontract.subcontractorName} &mdash;{" "}
              {subcontract.subcontractNumber}
            </p>
          </div>
        </div>

        {sov && (
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={statusBadgeClass[sov.status] || ""}
            >
              {statusLabel[sov.status] || "Unknown"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Total Contract Value
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalScheduledValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Billed to Date
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalCompletedToDate)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.overallPercentComplete.toFixed(1)}% complete
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Retainage Held
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalRetainage)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Balance Remaining
                </span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(summary.totalBalanceToFinish)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No SOV yet - create one */}
      {!sov && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-muted-foreground">
              No Schedule of Values has been created for this contract yet.
            </p>
            <Button
              onClick={handleCreateSOV}
              disabled={isCreating}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isCreating ? "Creating..." : "Create Schedule of Values"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SOV Table */}
      {sov && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Line Items</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setNewItem({
                  itemNumber: nextItemNumber,
                  description: "",
                  scheduledValue: 0,
                });
                setIsAddOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">Item #</TableHead>
                    <TableHead className="min-w-[200px] text-xs">
                      Description
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Scheduled Value
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Previously Billed
                    </TableHead>
                    <TableHead className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20">
                      Current Period
                    </TableHead>
                    <TableHead className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20">
                      Stored Materials
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Total Completed
                    </TableHead>
                    <TableHead className="text-right text-xs w-16">
                      %
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Balance
                    </TableHead>
                    <TableHead className="text-right text-xs bg-amber-50/50 dark:bg-amber-950/20">
                      Retainage
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sov.lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center text-muted-foreground py-8"
                      >
                        No line items yet. Click &ldquo;Add Item&rdquo; to get
                        started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {sov.lineItems.map((li) => (
                        <TableRow key={li.id}>
                          <TableCell className="font-mono text-xs">
                            {li.itemNumber}
                          </TableCell>
                          <TableCell className="text-sm">
                            {li.description}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(li.scheduledValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">
                            {formatCurrency(li.previouslyBilled)}
                          </TableCell>

                          {/* Current Period - inline editable */}
                          <TableCell className="text-right bg-amber-50/50 dark:bg-amber-950/20 p-1">
                            {editingCell?.id === li.id &&
                            editingCell?.field === "currentBilled" ? (
                              <Input
                                ref={editInputRef}
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-7 w-28 text-right font-mono text-sm ml-auto"
                                step="0.01"
                                min="0"
                              />
                            ) : (
                              <button
                                type="button"
                                className="font-mono text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 px-2 py-0.5 rounded cursor-text text-right w-full"
                                onClick={() =>
                                  startEditing(
                                    li.id,
                                    "currentBilled",
                                    li.currentBilled
                                  )
                                }
                              >
                                {formatCurrency(li.currentBilled)}
                              </button>
                            )}
                          </TableCell>

                          {/* Stored Materials - inline editable */}
                          <TableCell className="text-right bg-amber-50/50 dark:bg-amber-950/20 p-1">
                            {editingCell?.id === li.id &&
                            editingCell?.field === "storedMaterials" ? (
                              <Input
                                ref={editInputRef}
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-7 w-28 text-right font-mono text-sm ml-auto"
                                step="0.01"
                                min="0"
                              />
                            ) : (
                              <button
                                type="button"
                                className="font-mono text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 px-2 py-0.5 rounded cursor-text text-right w-full"
                                onClick={() =>
                                  startEditing(
                                    li.id,
                                    "storedMaterials",
                                    li.storedMaterials
                                  )
                                }
                              >
                                {formatCurrency(li.storedMaterials)}
                              </button>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-mono text-sm font-medium">
                            {formatCurrency(li.totalCompletedToDate)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <span
                              className={cn(
                                "font-medium",
                                li.percentComplete >= 100
                                  ? "text-green-600 dark:text-green-400"
                                  : li.percentComplete >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                              )}
                            >
                              {li.percentComplete.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(li.balanceToFinish)}
                          </TableCell>

                          {/* Retainage - inline editable */}
                          <TableCell className="text-right bg-amber-50/50 dark:bg-amber-950/20 p-1">
                            {editingCell?.id === li.id &&
                            editingCell?.field === "retainage" ? (
                              <Input
                                ref={editInputRef}
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleEditKeyDown}
                                className="h-7 w-28 text-right font-mono text-sm ml-auto"
                                step="0.01"
                                min="0"
                              />
                            ) : (
                              <button
                                type="button"
                                className="font-mono text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 px-2 py-0.5 rounded cursor-text text-right w-full"
                                onClick={() =>
                                  startEditing(
                                    li.id,
                                    "retainage",
                                    li.retainage
                                  )
                                }
                              >
                                {formatCurrency(li.retainage)}
                              </button>
                            )}
                          </TableCell>

                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteLineItem(li.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Footer totals row */}
                      {totals && (
                        <TableRow className="bg-muted/50 font-medium border-t-2">
                          <TableCell className="text-xs" />
                          <TableCell className="text-sm font-bold">
                            TOTALS
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            {formatCurrency(totals.scheduled)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(totals.prev)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm bg-amber-50/50 dark:bg-amber-950/20">
                            {formatCurrency(totals.current)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm bg-amber-50/50 dark:bg-amber-950/20">
                            {formatCurrency(totals.stored)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            {formatCurrency(totals.completed)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold">
                            {totals.pct.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            {formatCurrency(totals.balance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm bg-amber-50/50 dark:bg-amber-950/20 font-bold">
                            {formatCurrency(totals.retainage)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Line Item Sheet */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Line Item</SheetTitle>
            <SheetDescription>
              Add a new scope item to the schedule of values.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemNumber">Item #</Label>
                <Input
                  id="itemNumber"
                  value={newItem.itemNumber}
                  onChange={(e) =>
                    setNewItem({ ...newItem, itemNumber: e.target.value })
                  }
                  placeholder="001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledValue">Scheduled Value ($)</Label>
                <Input
                  id="scheduledValue"
                  type="number"
                  value={newItem.scheduledValue || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      scheduledValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newItem.description}
                onChange={(e) =>
                  setNewItem({ ...newItem, description: e.target.value })
                }
                placeholder="Concrete foundations, Structural steel..."
              />
            </div>

            <Button
              onClick={handleAddLineItem}
              disabled={
                isSaving ||
                !newItem.itemNumber ||
                !newItem.description
              }
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isSaving ? "Adding..." : "Add Line Item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
