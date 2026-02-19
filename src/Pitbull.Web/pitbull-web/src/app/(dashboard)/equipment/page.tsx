"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
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
  Calendar,
  Link2,
  Clock3,
  DollarSign,
} from "lucide-react";
import api from "@/lib/api";
import {
  EquipmentType,
  type Equipment,
  type ListEquipmentResult,
  type CreateEquipmentCommand,
  type UpdateEquipmentCommand,
  type PagedResult,
  type Project,
} from "@/lib/types";
import {
  type EquipmentAssignment,
  type EquipmentWorkflowData,
  parseEquipmentDescription,
  serializeEquipmentDescription,
} from "@/lib/equipment-workflow";
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
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function dateInRange(dateIso: string, startIso: string, endIso: string): boolean {
  return dateIso >= startIso && dateIso <= endIso;
}

function createAssignmentSeed(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [workflows, setWorkflows] = useState<Record<string, EquipmentWorkflowData>>({});
  const [plainDescriptions, setPlainDescriptions] = useState<Record<string, string>>({});

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>("true");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [assignmentProjectId, setAssignmentProjectId] = useState<string>("");
  const [assignmentStartDate, setAssignmentStartDate] = useState<string>(isoDate(new Date()));
  const [assignmentEndDate, setAssignmentEndDate] = useState<string>(isoDate(addDays(new Date(), 6)));
  const [assignmentHoursPerDay, setAssignmentHoursPerDay] = useState<string>("8");
  const [maintenanceNextServiceDate, setMaintenanceNextServiceDate] = useState<string>("");
  const [maintenanceServiceIntervalHours, setMaintenanceServiceIntervalHours] = useState<string>("0");
  const [maintenanceCurrentHours, setMaintenanceCurrentHours] = useState<string>("0");
  const [dailyRateInput, setDailyRateInput] = useState<string>("0");

  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({
    searchInputRef,
  });

  const fetchProjects = useCallback(async () => {
    try {
      const result = await api<PagedResult<Project>>("/api/projects?pageSize=250");
      setProjects(result.items);
    } catch {
      toast.error("Failed to load projects for assignments");
    }
  }, []);

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

      const nextWorkflows: Record<string, EquipmentWorkflowData> = {};
      const nextPlain: Record<string, string> = {};

      for (const eq of result.items) {
        const parsed = parseEquipmentDescription(eq.description);
        nextWorkflows[eq.id] = parsed.workflow;
        nextPlain[eq.id] = parsed.plainDescription ?? "";
      }

      setWorkflows(nextWorkflows);
      setPlainDescriptions(nextPlain);

      if (!selectedEquipmentId && result.items.length > 0) {
        setSelectedEquipmentId(result.items[0].id);
      }
    } catch {
      toast.error("Failed to load equipment");
    } finally {
      setIsLoading(false);
    }
  }, [search, typeFilter, activeFilter, selectedEquipmentId]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEquipment();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchEquipment]);

  const selectedEquipment = useMemo(
    () => equipment.find((eq) => eq.id === selectedEquipmentId) ?? null,
    [equipment, selectedEquipmentId]
  );

  const selectedWorkflow = useMemo(
    () => (selectedEquipment ? workflows[selectedEquipment.id] : undefined),
    [selectedEquipment, workflows]
  );

  useEffect(() => {
    if (!selectedWorkflow) return;
    setDailyRateInput(String(selectedWorkflow.dailyRate ?? 0));
    setMaintenanceNextServiceDate(selectedWorkflow.nextServiceDate ?? "");
    setMaintenanceServiceIntervalHours(String(selectedWorkflow.serviceIntervalHours ?? 0));
    setMaintenanceCurrentHours(String(selectedWorkflow.currentHours ?? 0));
  }, [selectedWorkflow]);

  async function updateEquipmentWorkflow(
    eq: Equipment,
    updater: (prev: EquipmentWorkflowData) => EquipmentWorkflowData
  ) {
    const prev = workflows[eq.id] ?? {
      dailyRate: 0,
      nextServiceDate: null,
      serviceIntervalHours: 0,
      currentHours: 0,
      assignments: [],
    };

    const next = updater(prev);
    const serializedDescription = serializeEquipmentDescription(next, plainDescriptions[eq.id] ?? "");

    const command: UpdateEquipmentCommand = {
      code: eq.code,
      name: eq.name,
      description: serializedDescription,
      type: eq.type,
      hourlyRate: eq.hourlyRate,
      billingRate: eq.billingRate ?? null,
      isActive: eq.isActive,
      serialNumber: eq.serialNumber ?? null,
      licensePlate: eq.licensePlate ?? null,
    };

    const updated = await api<Equipment>(`/api/equipment/${eq.id}`, {
      method: "PUT",
      body: command,
    });

    const parsed = parseEquipmentDescription(updated.description);
    setWorkflows((prevMap) => ({ ...prevMap, [eq.id]: parsed.workflow }));
    setPlainDescriptions((prevMap) => ({ ...prevMap, [eq.id]: parsed.plainDescription ?? "" }));
    setEquipment((prevList) => prevList.map((item) => (item.id === eq.id ? updated : item)));

    return parsed.workflow;
  }

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
      description: plainDescriptions[eq.id] ?? "",
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
        const currentWorkflow = workflows[editingEquipment.id] ?? {
          dailyRate: 0,
          nextServiceDate: null,
          serviceIntervalHours: 0,
          currentHours: 0,
          assignments: [],
        };

        const command: UpdateEquipmentCommand = {
          code: formData.code,
          name: formData.name,
          description: serializeEquipmentDescription(currentWorkflow, formData.description),
          type: formData.type,
          hourlyRate: parseFloat(formData.hourlyRate) || 0,
          billingRate: formData.billingRate ? parseFloat(formData.billingRate) : null,
          serialNumber: formData.serialNumber || null,
          licensePlate: formData.licensePlate || null,
          isActive: formData.isActive,
        };
        const updated = await api<Equipment>(`/api/equipment/${editingEquipment.id}`, {
          method: "PUT",
          body: command,
        });

        const parsed = parseEquipmentDescription(updated.description);
        setWorkflows((prevMap) => ({ ...prevMap, [updated.id]: parsed.workflow }));
        setPlainDescriptions((prevMap) => ({ ...prevMap, [updated.id]: parsed.plainDescription ?? "" }));
        setEquipment((prevList) => prevList.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Equipment updated");
      } else {
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
        await fetchEquipment();
      }

      setDialogOpen(false);
    } catch (err) {
      toast.error("Failed to save equipment", { description: err instanceof Error ? err.message : undefined });
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
      await fetchEquipment();
    } catch (err) {
      toast.error("Failed to delete equipment", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAssignEquipment() {
    if (!selectedEquipment) {
      toast.error("Select equipment first");
      return;
    }
    const project = projects.find((p) => p.id === assignmentProjectId);
    if (!project) {
      toast.error("Select a project");
      return;
    }
    if (!assignmentStartDate || !assignmentEndDate || assignmentStartDate > assignmentEndDate) {
      toast.error("Provide a valid assignment date range");
      return;
    }

    const hoursPerDay = Number(assignmentHoursPerDay);
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
      toast.error("Hours per day must be greater than 0");
      return;
    }

    setIsSavingWorkflow(true);
    try {
      await updateEquipmentWorkflow(selectedEquipment, (prev) => ({
        ...prev,
        assignments: [
          ...prev.assignments,
          {
            id: createAssignmentSeed(),
            projectId: project.id,
            projectName: `${project.number} - ${project.name}`,
            startDate: assignmentStartDate,
            endDate: assignmentEndDate,
            hoursPerDay,
          },
        ],
      }));
      toast.success("Equipment assigned to project");
    } catch (err) {
      toast.error("Failed to assign equipment", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function handleUnassignEquipment(assignment: EquipmentAssignment) {
    if (!selectedEquipment) return;

    setIsSavingWorkflow(true);
    try {
      await updateEquipmentWorkflow(selectedEquipment, (prev) => ({
        ...prev,
        assignments: prev.assignments.filter((a) => a.id !== assignment.id),
      }));
      toast.success("Equipment unassigned");
    } catch (err) {
      toast.error("Failed to unassign equipment", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function handleSaveMaintenanceAndRates() {
    if (!selectedEquipment) return;

    const dailyRate = Number(dailyRateInput);
    const serviceIntervalHours = Number(maintenanceServiceIntervalHours);
    const currentHours = Number(maintenanceCurrentHours);

    if (!Number.isFinite(dailyRate) || dailyRate < 0) {
      toast.error("Daily rate must be 0 or greater");
      return;
    }
    if (!Number.isFinite(serviceIntervalHours) || serviceIntervalHours < 0) {
      toast.error("Service interval hours must be 0 or greater");
      return;
    }
    if (!Number.isFinite(currentHours) || currentHours < 0) {
      toast.error("Current hours must be 0 or greater");
      return;
    }

    setIsSavingWorkflow(true);
    try {
      await updateEquipmentWorkflow(selectedEquipment, (prev) => ({
        ...prev,
        dailyRate,
        nextServiceDate: maintenanceNextServiceDate || null,
        serviceIntervalHours,
        currentHours,
      }));
      toast.success("Maintenance and cost profile saved");
    } catch (err) {
      toast.error("Failed to save maintenance profile", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  const calendarDays = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const day = addDays(start, index);
      return {
        iso: isoDate(day),
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      };
    });
  }, []);

  const assignmentRows = useMemo(() => {
    if (!selectedWorkflow) return [];

    return selectedWorkflow.assignments.map((assignment) => {
      const days =
        Math.floor(
          (new Date(`${assignment.endDate}T00:00:00Z`).getTime() -
            new Date(`${assignment.startDate}T00:00:00Z`).getTime()) /
            86400000
        ) + 1;
      const activeDays = Math.max(0, days);
      const hourlyTotal = selectedEquipment ? selectedEquipment.hourlyRate * assignment.hoursPerDay * activeDays : 0;
      const dailyRate = selectedWorkflow.dailyRate;
      const dailyTotal = dailyRate > 0 ? dailyRate * activeDays : hourlyTotal;

      return {
        assignment,
        activeDays,
        hourlyTotal,
        dailyTotal,
      };
    });
  }, [selectedEquipment, selectedWorkflow]);

  const totalProjectCost = assignmentRows.reduce((sum, row) => sum + row.dailyTotal, 0);
  const hoursUntilService = Math.max(
    0,
    (selectedWorkflow?.serviceIntervalHours ?? 0) - (selectedWorkflow?.currentHours ?? 0)
  );

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Equipment</h1>
            <p className="text-muted-foreground">
              Manage equipment assignments, utilization, maintenance, and cost tracking
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
              <div className="text-2xl font-bold font-mono">{formatCurrency(avgHourlyRate)}</div>
              <p className="text-xs text-muted-foreground">{toolCount} tools</p>
            </CardContent>
          </Card>
        </div>

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

        <Tabs defaultValue="register" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="register">Equipment Register</TabsTrigger>
            <TabsTrigger value="assignments">Assignments & Maintenance</TabsTrigger>
            <TabsTrigger value="calendar">Utilization Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <div className="hidden md:block">
              {isLoading ? (
                <TableSkeleton
                  headers={["Code", "Name", "Type", "Hourly Rate", "Billing Rate", "Serial #", "Status", ""]}
                  rows={8}
                />
              ) : equipment.length === 0 ? (
                <EmptyState
                  icon={PackagePlus}
                  title="No equipment yet"
                  description="Add your first equipment item to start tracking usage and costs on projects."
                  actionLabel="+ Add Your First Equipment"
                  onAction={openAddDialog}
                />
              ) : (
                <div className="rounded-md border overflow-x-auto">
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
                            <TableCell className="font-mono font-medium">{eq.code}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{eq.name}</div>
                                {(plainDescriptions[eq.id] || "") && (
                                  <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                                    {plainDescriptions[eq.id]}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={equipmentTypeBadgeClass[eq.type]}>
                                <TypeIcon className="mr-1 h-3 w-3" />
                                {equipmentTypeLabels[eq.type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(eq.hourlyRate)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {eq.billingRate != null ? formatCurrency(eq.billingRate) : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{eq.serialNumber || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={eq.isActive ? "default" : "secondary"}
                                className={eq.isActive
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"}
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
                                  className="min-h-[44px] min-w-[44px]"
                                  aria-label={`Edit ${eq.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openDeleteDialog(eq)}
                                  className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                                  aria-label={`Delete ${eq.name}`}
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

            <div className="md:hidden">
              {isLoading ? (
                <CardListSkeleton rows={5} />
              ) : equipment.length === 0 ? (
                <EmptyState
                  icon={PackagePlus}
                  title="No equipment yet"
                  description="Add equipment to track usage and costs on projects."
                  actionLabel="+ Add Your First Equipment"
                  onAction={openAddDialog}
                />
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
                                <Badge variant={eq.isActive ? "default" : "secondary"}>
                                  {eq.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{eq.name}</p>
                              {(plainDescriptions[eq.id] || "") && (
                                <p className="text-xs text-muted-foreground">{plainDescriptions[eq.id]}</p>
                              )}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Badge variant="secondary" className={equipmentTypeBadgeClass[eq.type]}>
                                  <TypeIcon className="mr-1 h-3 w-3" />
                                  {equipmentTypeLabels[eq.type]}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(eq.hourlyRate)}/hr
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(eq)} className="min-h-[44px] min-w-[44px]" aria-label={`Edit ${eq.name}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(eq)} className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive" aria-label={`Delete ${eq.name}`}>
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
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Assign / Unassign
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Equipment</Label>
                    <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipment.map((eq) => (
                          <SelectItem key={eq.id} value={eq.id}>
                            {eq.code} - {eq.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select value={assignmentProjectId} onValueChange={setAssignmentProjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.number} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Start</Label>
                      <Input type="date" value={assignmentStartDate} onChange={(e) => setAssignmentStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End</Label>
                      <Input type="date" value={assignmentEndDate} onChange={(e) => setAssignmentEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Hours / Day</Label>
                    <Input type="number" min="1" step="0.5" value={assignmentHoursPerDay} onChange={(e) => setAssignmentHoursPerDay(e.target.value)} />
                  </div>
                  <LoadingButton
                    onClick={handleAssignEquipment}
                    loading={isSavingWorkflow}
                    loadingText="Saving..."
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Assign Equipment
                  </LoadingButton>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Current Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedEquipment ? (
                    <p className="text-sm text-muted-foreground">Select equipment to view assignments.</p>
                  ) : assignmentRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assignments yet for this equipment.</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Dates</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">Hourly Rate</TableHead>
                          <TableHead className="text-right">Daily Rate</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignmentRows.map(({ assignment, activeDays, hourlyTotal, dailyTotal }) => (
                          <TableRow key={assignment.id}>
                            <TableCell>{assignment.projectName}</TableCell>
                            <TableCell>{formatDate(assignment.startDate)} - {formatDate(assignment.endDate)}</TableCell>
                            <TableCell className="text-right">{activeDays}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(hourlyTotal)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {selectedWorkflow && selectedWorkflow.dailyRate > 0
                                ? formatCurrency(selectedWorkflow.dailyRate * activeDays)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">{formatCurrency(dailyTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnassignEquipment(assignment)}
                                disabled={isSavingWorkflow}
                              >
                                Unassign
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40">
                          <TableCell colSpan={5} className="font-medium">Total Cost Across Assigned Projects</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(totalProjectCost)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  Maintenance Schedule Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-5">
                <div className="space-y-2 md:col-span-2">
                  <Label>Next Service Date</Label>
                  <Input type="date" value={maintenanceNextServiceDate} onChange={(e) => setMaintenanceNextServiceDate(e.target.value)} disabled={!selectedEquipment} />
                </div>
                <div className="space-y-2">
                  <Label>Service Interval Hours</Label>
                  <Input type="number" min="0" step="1" value={maintenanceServiceIntervalHours} onChange={(e) => setMaintenanceServiceIntervalHours(e.target.value)} disabled={!selectedEquipment} />
                </div>
                <div className="space-y-2">
                  <Label>Current Hours</Label>
                  <Input type="number" min="0" step="1" value={maintenanceCurrentHours} onChange={(e) => setMaintenanceCurrentHours(e.target.value)} disabled={!selectedEquipment} />
                </div>
                <div className="space-y-2">
                  <Label>Hours Until Service</Label>
                  <Input value={selectedEquipment ? String(hoursUntilService) : ""} readOnly disabled />
                </div>
                <div className="space-y-2">
                  <Label>Daily Rate ($)</Label>
                  <Input type="number" min="0" step="0.01" value={dailyRateInput} onChange={(e) => setDailyRateInput(e.target.value)} disabled={!selectedEquipment} />
                </div>
                <div className="md:col-span-4 flex items-end">
                  <p className="text-xs text-muted-foreground">
                    Hourly rate comes from Equipment settings; daily rate is used for project cost rollups when set.
                  </p>
                </div>
                <div className="flex items-end justify-end">
                  <LoadingButton
                    onClick={handleSaveMaintenanceAndRates}
                    loading={isSavingWorkflow}
                    loadingText="Saving..."
                    disabled={!selectedEquipment}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    Save Tracking
                  </LoadingButton>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Utilization Calendar (Next 14 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {equipment.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No equipment available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px]">Equipment</TableHead>
                          {calendarDays.map((day) => (
                            <TableHead key={day.iso} className="text-center min-w-[110px]">
                              {day.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipment.map((eq) => {
                          const workflow = workflows[eq.id];
                          return (
                            <TableRow key={eq.id}>
                              <TableCell>
                                <div className="font-medium">{eq.code} - {eq.name}</div>
                                <div className="text-xs text-muted-foreground">{formatCurrency(eq.hourlyRate)}/hr</div>
                              </TableCell>
                              {calendarDays.map((day) => {
                                const assigned = workflow?.assignments.find((assignment) =>
                                  dateInRange(day.iso, assignment.startDate, assignment.endDate)
                                );

                                return (
                                  <TableCell key={`${eq.id}-${day.iso}`} className="text-center">
                                    {assigned ? (
                                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 whitespace-normal">
                                        {assigned.projectName}
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Equipment Cost Tracking by Project
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEquipment ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Selected equipment:</span>{" "}
                      <span className="font-medium">{selectedEquipment.code} - {selectedEquipment.name}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Hourly rate:</span>{" "}
                      <span className="font-mono">{formatCurrency(selectedEquipment.hourlyRate)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Daily rate:</span>{" "}
                      <span className="font-mono">{formatCurrency(selectedWorkflow?.dailyRate ?? 0)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Total assigned project cost:</span>{" "}
                      <span className="font-mono font-semibold">{formatCurrency(totalProjectCost)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select equipment in the Assignments tab to view detailed costs.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {!isLoading && equipment.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {equipment.length} of {totalCount} equipment items
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingEquipment ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
              <DialogDescription>
                {editingEquipment ? "Update equipment details" : "Add a new equipment item for tracking on projects"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-code">Code <span className="text-destructive">*</span></Label>
                  <Input id="eq-code" value={formData.code} onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))} placeholder="EX-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-name">Name <span className="text-destructive">*</span></Label>
                  <Input id="eq-name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="CAT 320 Excavator" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eq-description">Description</Label>
                <Textarea id="eq-description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} rows={2} placeholder="Optional description..." />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-type">Type</Label>
                  <Select value={formData.type.toString()} onValueChange={(v) => setFormData((prev) => ({ ...prev, type: parseInt(v) as EquipmentType }))}>
                    <SelectTrigger id="eq-type"><SelectValue /></SelectTrigger>
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
                    <Select value={formData.isActive ? "true" : "false"} onValueChange={(v) => setFormData((prev) => ({ ...prev, isActive: v === "true" }))}>
                      <SelectTrigger id="eq-active"><SelectValue /></SelectTrigger>
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
                  <Input id="eq-hourlyRate" type="number" min="0" step="0.01" value={formData.hourlyRate} onChange={(e) => setFormData((prev) => ({ ...prev, hourlyRate: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-billingRate">Billing Rate ($)</Label>
                  <Input id="eq-billingRate" type="number" min="0" step="0.01" value={formData.billingRate} onChange={(e) => setFormData((prev) => ({ ...prev, billingRate: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eq-serial">Serial Number</Label>
                  <Input id="eq-serial" value={formData.serialNumber} onChange={(e) => setFormData((prev) => ({ ...prev, serialNumber: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq-plate">License Plate</Label>
                  <Input id="eq-plate" value={formData.licensePlate} onChange={(e) => setFormData((prev) => ({ ...prev, licensePlate: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <LoadingButton onClick={handleSubmit} loading={isSubmitting} loadingText="Saving..." className="bg-amber-500 hover:bg-amber-600 text-white">
                {editingEquipment ? "Update" : "Create"}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Equipment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deletingEquipment?.code} - {deletingEquipment?.name}</strong>? This deactivates the equipment.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
              <LoadingButton variant="destructive" onClick={handleDelete} loading={isDeleting} loadingText="Deleting...">Delete</LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
