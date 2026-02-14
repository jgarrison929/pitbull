"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { SimpleTooltip } from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import {
  Truck,
  Wrench,
  HardHat,
  Hammer,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  Upload,
  PackagePlus,
} from "lucide-react";
import api from "@/lib/api";
import {
  EquipmentType,
  type Equipment,
  type ListEquipmentResult,
  type CreateEquipmentCommand,
  type UpdateEquipmentCommand,
} from "@/lib/types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

const equipmentTypeLabels: Record<EquipmentType, string> = {
  [EquipmentType.HeavyEquipment]: "Heavy Equipment",
  [EquipmentType.LightEquipment]: "Light Equipment",
  [EquipmentType.Vehicles]: "Vehicles",
  [EquipmentType.Tools]: "Tools",
  [EquipmentType.Other]: "Other",
};

const equipmentTypeBadgeClass: Record<EquipmentType, string> = {
  [EquipmentType.HeavyEquipment]: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  [EquipmentType.LightEquipment]: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  [EquipmentType.Vehicles]: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  [EquipmentType.Tools]: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  [EquipmentType.Other]: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const equipmentTypeIcons: Record<EquipmentType, React.ComponentType<{ className?: string }>> = {
  [EquipmentType.HeavyEquipment]: Truck,
  [EquipmentType.LightEquipment]: Wrench,
  [EquipmentType.Vehicles]: Truck,
  [EquipmentType.Tools]: Hammer,
  [EquipmentType.Other]: HelpCircle,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

interface EquipmentFormData {
  code: string;
  name: string;
  description: string;
  type: EquipmentType;
  hourlyRate: string;
  billingRate: string;
  serialNumber: string;
  licensePlate: string;
  isActive: boolean;
}

const emptyFormData: EquipmentFormData = {
  code: "",
  name: "",
  description: "",
  type: EquipmentType.Other,
  hourlyRate: "0",
  billingRate: "",
  serialNumber: "",
  licensePlate: "",
  isActive: true,
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>("true");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: 'n' for new, '/' for search
  useListPageShortcuts({
    searchInputRef,
  });

  const fetchEquipment = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      if (search.trim()) params.set("searchTerm", search.trim());
      if (typeFilter !== ALL_VALUE) params.set("type", typeFilter);
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListEquipmentResult>(
        `/api/equipment?${params.toString()}`
      );
      setEquipment(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load equipment");
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEquipment();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openAddDialog() {
    setEditingEquipment(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(eq: Equipment) {
    setEditingEquipment(eq);
    setFormData({
      code: eq.code,
      name: eq.name,
      description: eq.description || "",
      type: eq.type,
      hourlyRate: eq.hourlyRate.toString(),
      billingRate: eq.billingRate != null ? eq.billingRate.toString() : "",
      serialNumber: eq.serialNumber || "",
      licensePlate: eq.licensePlate || "",
      isActive: eq.isActive,
    });
    setDialogOpen(true);
  }

  function openDeleteDialog(eq: Equipment) {
    setDeletingEquipment(eq);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEquipment) {
        // Update
        const command: UpdateEquipmentCommand = {
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          hourlyRate: parseFloat(formData.hourlyRate) || 0,
          billingRate: formData.billingRate ? parseFloat(formData.billingRate) : null,
          serialNumber: formData.serialNumber || null,
          licensePlate: formData.licensePlate || null,
          isActive: formData.isActive,
        };
        await api<Equipment>(`/api/equipment/${editingEquipment.id}`, {
          method: "PUT",
          body: command,
        });
        toast.success("Equipment updated");
      } else {
        // Create
        const command: CreateEquipmentCommand = {
          code: formData.code,
          name: formData.name,
          description: formData.description || undefined,
          type: formData.type,
          hourlyRate: parseFloat(formData.hourlyRate) || 0,
          billingRate: formData.billingRate ? parseFloat(formData.billingRate) : undefined,
          serialNumber: formData.serialNumber || undefined,
          licensePlate: formData.licensePlate || undefined,
        };
        await api<Equipment>("/api/equipment", {
          method: "POST",
          body: command,
        });
        toast.success("Equipment created");
      }
      setDialogOpen(false);
      fetchEquipment();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save equipment"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingEquipment) return;

    setIsDeleting(true);
    try {
      await api(`/api/equipment/${deletingEquipment.id}`, {
        method: "DELETE",
      });
      toast.success("Equipment deactivated");
      setDeleteDialogOpen(false);
      setDeletingEquipment(null);
      fetchEquipment();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete equipment"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  // Summary stats
  const heavyCount = equipment.filter((e) => e.type === EquipmentType.HeavyEquipment).length;
  const lightCount = equipment.filter((e) => e.type === EquipmentType.LightEquipment).length;
  const vehicleCount = equipment.filter((e) => e.type === EquipmentType.Vehicles).length;
  const toolCount = equipment.filter((e) => e.type === EquipmentType.Tools).length;
  const activeCount = equipment.filter((e) => e.isActive).length;
  const avgHourlyRate =
    equipment.length > 0
      ? equipment.reduce((sum, e) => sum + e.hourlyRate, 0) / equipment.length
      : 0;

  return (
    <ErrorBoundary label="equipment management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipment</h1>
            <p className="text-muted-foreground">
              Manage equipment for tracking on time entries and job costing
            </p>
          </div>
          <div className="flex gap-2">
            <SimpleTooltip content="Bulk CSV import — Coming Soon" side="bottom">
              <Button
                variant="outline"
                className="min-h-[44px] gap-2 opacity-60 cursor-not-allowed"
                disabled
                aria-label="Bulk import (coming soon)"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import CSV</span>
              </Button>
            </SimpleTooltip>
            <Button
              onClick={openAddDialog}
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <HardHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">{activeCount} active</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Heavy</CardTitle>
              <Truck className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{heavyCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Light</CardTitle>
              <Wrench className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lightCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
              <Truck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vehicleCount}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rate</CardTitle>
              <Hammer className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {formatCurrency(avgHourlyRate)}
              </div>
              <p className="text-xs text-muted-foreground">{toolCount} tools</p>
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
                  placeholder="Search by code, name, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All types</SelectItem>
                    <SelectItem value="HeavyEquipment">Heavy Equipment</SelectItem>
                    <SelectItem value="LightEquipment">Light Equipment</SelectItem>
                    <SelectItem value="Vehicles">Vehicles</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Status</Label>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
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
            <TableSkeleton
              headers={["Code", "Name", "Type", "Hourly Rate", "Billing Rate", "Serial #", "Status", ""]}
              rows={8}
            />
          ) : equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20 mb-6">
                <PackagePlus className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2">
                No equipment found
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-2">
                Add your first equipment item to start tracking equipment usage
                on time entries. Equipment costs flow directly to job costing.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">N</kbd> to add new equipment
              </p>
              <Button
                onClick={openAddDialog}
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Hourly Rate</TableHead>
                    <TableHead className="text-right">Billing Rate</TableHead>
                    <TableHead>Serial #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((eq) => {
                    const TypeIcon = equipmentTypeIcons[eq.type] || HelpCircle;
                    return (
                      <TableRow key={eq.id}>
                        <TableCell className="font-mono font-medium">
                          {eq.code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{eq.name}</div>
                            {eq.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {eq.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={equipmentTypeBadgeClass[eq.type]}
                          >
                            <TypeIcon className="mr-1 h-3 w-3" />
                            {equipmentTypeLabels[eq.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(eq.hourlyRate)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {eq.billingRate != null
                            ? formatCurrency(eq.billingRate)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {eq.serialNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={eq.isActive ? "default" : "secondary"}
                            className={
                              eq.isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                            }
                          >
                            {eq.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(eq)}
                              title="Edit equipment" aria-label="Edit equipment"
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(eq)}
                              title="Delete equipment" aria-label="Delete equipment"
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
          ) : equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-muted-foreground/20 rounded-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20 mb-4">
                <PackagePlus className="h-8 w-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight mb-1">
                No equipment yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Add equipment to track usage and costs on time entries.
              </p>
              <Button
                onClick={openAddDialog}
                className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {equipment.map((eq) => {
                const TypeIcon = equipmentTypeIcons[eq.type] || HelpCircle;
                return (
                  <Card key={eq.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-semibold">{eq.code}</p>
                            <Badge
                              variant={eq.isActive ? "default" : "secondary"}
                              className={
                                eq.isActive
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                              }
                            >
                              {eq.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{eq.name}</p>
                          {eq.description && (
                            <p className="text-xs text-muted-foreground">
                              {eq.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Badge
                              variant="secondary"
                              className={equipmentTypeBadgeClass[eq.type]}
                            >
                              <TypeIcon className="mr-1 h-3 w-3" />
                              {equipmentTypeLabels[eq.type]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Rate: {formatCurrency(eq.hourlyRate)}/hr
                            </span>
                            {eq.serialNumber && (
                              <span className="text-xs text-muted-foreground">
                                S/N: {eq.serialNumber}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(eq)}
                            title="Edit" aria-label="Edit"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(eq)}
                            title="Delete" aria-label="Delete"
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
        {!isLoading && equipment.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {equipment.length} of {totalCount} equipment items
          </div>
        )}

        {/* Add/Edit Equipment Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? "Edit Equipment" : "Add Equipment"}
              </DialogTitle>
              <DialogDescription>
                {editingEquipment
                  ? "Update equipment details"
                  : "Add a new equipment item for tracking on time entries"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-code">
                    Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="eq-code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, code: e.target.value }))
                    }
                    placeholder="EX-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="eq-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="CAT 320 Excavator"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eq-description">Description</Label>
                <Textarea
                  id="eq-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-type">Type</Label>
                  <Select
                    value={formData.type.toString()}
                    onValueChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        type: parseInt(v) as EquipmentType,
                      }))
                    }
                  >
                    <SelectTrigger id="eq-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Heavy Equipment</SelectItem>
                      <SelectItem value="1">Light Equipment</SelectItem>
                      <SelectItem value="2">Vehicles</SelectItem>
                      <SelectItem value="3">Tools</SelectItem>
                      <SelectItem value="4">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingEquipment && (
                  <div className="space-y-2">
                    <Label htmlFor="eq-active">Status</Label>
                    <Select
                      value={formData.isActive ? "true" : "false"}
                      onValueChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          isActive: v === "true",
                        }))
                      }
                    >
                      <SelectTrigger id="eq-active">
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-hourlyRate">Hourly Rate ($)</Label>
                  <Input
                    id="eq-hourlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hourlyRate: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-billingRate">Billing Rate ($)</Label>
                  <Input
                    id="eq-billingRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.billingRate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        billingRate: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-serial">Serial Number</Label>
                  <Input
                    id="eq-serial"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        serialNumber: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-plate">License Plate</Label>
                  <Input
                    id="eq-plate"
                    value={formData.licensePlate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        licensePlate: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
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
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {editingEquipment ? "Update" : "Create"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Equipment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <strong>
                  {deletingEquipment?.code} - {deletingEquipment?.name}
                </strong>
                ? This will deactivate the equipment. Existing time entries
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
