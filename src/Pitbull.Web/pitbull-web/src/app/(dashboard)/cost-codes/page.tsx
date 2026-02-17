"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import {
  Layers,
  Wrench,
  Package,
  Truck,
  Users,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import api from "@/lib/api";
import {
  CostType,
  type CostCode,
  type ListCostCodesResult,
  type CreateCostCodeCommand,
  type UpdateCostCodeCommand,
} from "@/lib/types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

const costTypeLabels: Record<CostType, string> = {
  [CostType.Labor]: "Labor",
  [CostType.Material]: "Material",
  [CostType.Equipment]: "Equipment",
  [CostType.Subcontract]: "Subcontract",
  [CostType.Other]: "Other",
};

const costTypeBadgeClass: Record<CostType, string> = {
  [CostType.Labor]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  [CostType.Material]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  [CostType.Equipment]: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  [CostType.Subcontract]: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  [CostType.Other]: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const costTypeIcons: Record<CostType, React.ComponentType<{ className?: string }>> = {
  [CostType.Labor]: Users,
  [CostType.Material]: Package,
  [CostType.Equipment]: Truck,
  [CostType.Subcontract]: Wrench,
  [CostType.Other]: HelpCircle,
};

interface CostCodeFormData {
  code: string;
  description: string;
  division: string;
  costType: CostType;
  isActive: boolean;
}

const emptyFormData: CostCodeFormData = {
  code: "",
  description: "",
  division: "",
  costType: CostType.Labor,
  isActive: true,
};

export default function CostCodesPage() {
  const [costCodes, setCostCodes] = useState<CostCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [costTypeFilter, setCostTypeFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>("true");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCostCode, setEditingCostCode] = useState<CostCode | null>(null);
  const [formData, setFormData] = useState<CostCodeFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCostCode, setDeletingCostCode] = useState<CostCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({
    searchInputRef,
  });

  const fetchCostCodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      if (search.trim()) params.set("search", search.trim());
      if (costTypeFilter !== ALL_VALUE) params.set("costType", costTypeFilter);
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListCostCodesResult>(
        `/api/cost-codes?${params.toString()}`
      );
      setCostCodes(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load cost codes");
    } finally {
      setIsLoading(false);
    }
  }, [search, costTypeFilter, activeFilter]);

  useEffect(() => {
    fetchCostCodes();
  }, [fetchCostCodes]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCostCodes();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openAddDialog() {
    setEditingCostCode(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(cc: CostCode) {
    setEditingCostCode(cc);
    setFormData({
      code: cc.code,
      description: cc.description,
      division: cc.division || "",
      costType: cc.costType,
      isActive: cc.isActive,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(cc: CostCode) {
    setDeletingCostCode(cc);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.code.trim() || !formData.description.trim()) {
      toast.error("Code and Description are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCostCode) {
        const command: UpdateCostCodeCommand = {
          code: formData.code,
          description: formData.description,
          division: formData.division || null,
          costType: formData.costType,
          isActive: formData.isActive,
        };
        await api<CostCode>(`/api/cost-codes/${editingCostCode.id}`, {
          method: "PUT",
          body: command,
        });
        toast.success("Cost code updated");
      } else {
        const command: CreateCostCodeCommand = {
          code: formData.code,
          description: formData.description,
          division: formData.division || undefined,
          costType: formData.costType,
          isActive: formData.isActive,
        };
        await api<CostCode>("/api/cost-codes", {
          method: "POST",
          body: command,
        });
        toast.success("Cost code created");
      }
      setDialogOpen(false);
      fetchCostCodes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save cost code"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingCostCode) return;

    setIsDeleting(true);
    try {
      await api(`/api/cost-codes/${deletingCostCode.id}`, {
        method: "DELETE",
      });
      toast.success("Cost code deleted");
      setDeleteDialogOpen(false);
      setDeletingCostCode(null);
      fetchCostCodes();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete cost code"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  // Summary stats
  const laborCount = costCodes.filter((c) => c.costType === CostType.Labor).length;
  const materialCount = costCodes.filter((c) => c.costType === CostType.Material).length;
  const equipmentCount = costCodes.filter((c) => c.costType === CostType.Equipment).length;
  const subcontractCount = costCodes.filter((c) => c.costType === CostType.Subcontract).length;
  const activeCount = costCodes.filter((c) => c.isActive).length;

  return (
    <ErrorBoundary label="cost codes management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cost Codes</h1>
            <p className="text-muted-foreground">
              Standard construction cost codes for job cost accounting
            </p>
          </div>
          <Button
            onClick={openAddDialog}
            className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Cost Code
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Codes</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">{activeCount} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Labor</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{laborCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Material</CardTitle>
              <Package className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{materialCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipment</CardTitle>
              <Truck className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{equipmentCount}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subcontract</CardTitle>
              <Wrench className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subcontractCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  ref={searchInputRef}
                  id="search"
                  placeholder="Search by code or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costType">Cost Type</Label>
                <Select
                  value={costTypeFilter}
                  onValueChange={setCostTypeFilter}
                >
                  <SelectTrigger id="costType">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All types</SelectItem>
                    <SelectItem value="1">Labor</SelectItem>
                    <SelectItem value="2">Material</SelectItem>
                    <SelectItem value="3">Equipment</SelectItem>
                    <SelectItem value="4">Subcontract</SelectItem>
                    <SelectItem value="5">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Status</Label>
                <Select
                  value={activeFilter}
                  onValueChange={setActiveFilter}
                >
                  <SelectTrigger id="active">
                    <SelectValue placeholder="Active only" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active only</SelectItem>
                    <SelectItem value="false">Inactive only</SelectItem>
                    <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table (Desktop) */}
        <div className="hidden md:block">
          {isLoading ? (
            <TableSkeleton headers={["Code", "Description", "Division", "Type", "Status", ""]} rows={10} />
          ) : costCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-6">
                <Layers className="h-10 w-10 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2">
                No cost codes found
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-2">
                Add your first cost code to start tracking job costs.
                Cost codes categorize labor by type of work for budget tracking.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">N</kbd> to add a new cost code
              </p>
              <Button
                onClick={openAddDialog}
                className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Cost Code
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCodes.map((code) => {
                    const TypeIcon = costTypeIcons[code.costType] || HelpCircle;
                    return (
                      <TableRow key={code.id}>
                        <TableCell className="font-mono font-medium">
                          {code.code}
                        </TableCell>
                        <TableCell>{code.description}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {code.division || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={costTypeBadgeClass[code.costType]}
                          >
                            <TypeIcon className="mr-1 h-3 w-3" />
                            {costTypeLabels[code.costType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={code.isActive ? "default" : "secondary"}
                            className={
                              code.isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }
                          >
                            {code.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(code)}
                              title="Edit cost code"
                              aria-label="Edit cost code"
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(code)}
                              title="Delete cost code"
                              aria-label="Delete cost code"
                              className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Card List (Mobile) */}
        <div className="md:hidden">
          {isLoading ? (
            <CardListSkeleton rows={5} />
          ) : costCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
                <Layers className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight mb-1">
                No cost codes yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Add cost codes to categorize labor for job cost accounting.
              </p>
              <Button
                onClick={openAddDialog}
                className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Cost Code
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {costCodes.map((code) => {
                const TypeIcon = costTypeIcons[code.costType] || HelpCircle;
                return (
                  <Card key={code.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-semibold">{code.code}</p>
                            <Badge
                              variant={code.isActive ? "default" : "secondary"}
                              className={
                                code.isActive
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }
                            >
                              {code.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm">{code.description}</p>
                          {code.division && (
                            <p className="text-xs text-muted-foreground">
                              Division: {code.division}
                            </p>
                          )}
                          <Badge
                            variant="secondary"
                            className={costTypeBadgeClass[code.costType]}
                          >
                            <TypeIcon className="mr-1 h-3 w-3" />
                            {costTypeLabels[code.costType]}
                          </Badge>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(code)}
                            title="Edit"
                            aria-label="Edit"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(code)}
                            title="Delete"
                            aria-label="Delete"
                            className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination info */}
        {!isLoading && costCodes.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {costCodes.length} of {totalCount} cost codes
          </div>
        )}

        {/* Add/Edit Cost Code Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCostCode ? "Edit Cost Code" : "Add Cost Code"}
              </DialogTitle>
              <DialogDescription>
                {editingCostCode
                  ? "Update cost code details"
                  : "Add a new cost code for job cost accounting"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cc-code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cc-code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, code: e.target.value }))
                    }
                    placeholder="01-100"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-costType">Type</Label>
                  <Select
                    value={formData.costType.toString()}
                    onValueChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        costType: parseInt(v) as CostType,
                      }))
                    }
                  >
                    <SelectTrigger id="cc-costType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Labor</SelectItem>
                      <SelectItem value="2">Material</SelectItem>
                      <SelectItem value="3">Equipment</SelectItem>
                      <SelectItem value="4">Subcontract</SelectItem>
                      <SelectItem value="5">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cc-description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cc-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="General Conditions"
                  maxLength={200}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cc-division">Division</Label>
                  <Input
                    id="cc-division"
                    value={formData.division}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        division: e.target.value,
                      }))
                    }
                    placeholder="01 - General Requirements"
                    maxLength={50}
                  />
                </div>
                {editingCostCode && (
                  <div className="space-y-2">
                    <Label htmlFor="cc-active">Status</Label>
                    <Select
                      value={formData.isActive ? "true" : "false"}
                      onValueChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          isActive: v === "true",
                        }))
                      }
                    >
                      <SelectTrigger id="cc-active">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <LoadingButton
                onClick={handleSubmit}
                loading={isSubmitting}
                loadingText="Saving..."
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingCostCode ? "Update" : "Create"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Cost Code</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>
                  {deletingCostCode?.code} - {deletingCostCode?.description}
                </strong>
                ? This will remove the cost code. Existing time entries
                referencing it will be preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <LoadingButton
                variant="destructive"
                onClick={handleDelete}
                loading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
