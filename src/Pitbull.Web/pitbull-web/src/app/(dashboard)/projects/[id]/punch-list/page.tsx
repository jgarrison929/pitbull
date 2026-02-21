"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError, uploadFiles, getDownloadUrl } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest, PmActionResultDto } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { WorkflowStepper, type WorkflowStep } from "@/components/ui/workflow-stepper";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import {
  Pencil,
  Trash2,
  Download,
  Paperclip,
  CheckCircle2,
  FileDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

interface FileAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

interface DataMap {
  [key: string]: unknown;
}

interface PunchListRow {
  id: string;
  itemNumber: number;
  location: string;
  category: string;
  description: string;
  responsiblePartyType: string;
  assignedToName: string;
  dueDate: string | null;
  status: string;
  priority: string;
  costImpact: number | null;
  scheduleImpactDays: number | null;
  notes: string;
  createdAt: string;
}

interface PunchListFormState {
  id?: string;
  location: string;
  category: string;
  description: string;
  responsiblePartyType: string;
  assignedToName: string;
  dueDate: string;
  status: string;
  priority: string;
  costImpact: string;
  scheduleImpactDays: string;
  notes: string;
}

interface PunchListSummary {
  Total: number;
  Open: number;
  InProgress: number;
  ReadyForInspection: number;
  Closed: number;
  Disputed: number;
  OverdueCount: number;
  ByCategory: Record<string, number>;
  ByPriority: Record<string, number>;
}

type SortField = "itemNumber" | "status" | "priority" | "dueDate" | "category";
type SortDirection = "asc" | "desc";

// PunchListItemStatus enum
const STATUSES = ["Open", "InProgress", "ReadyForInspection", "Closed", "Disputed"];
const STATUS_LABELS: Record<string, string> = {
  Open: "Open",
  InProgress: "In Progress",
  ReadyForInspection: "Ready for Inspection",
  Closed: "Closed",
  Disputed: "Disputed",
};

// PunchListCategory enum
const CATEGORIES = ["Architectural", "Structural", "MEP", "Sitework", "LifeSafety", "Other"];
const CATEGORY_LABELS: Record<string, string> = {
  Architectural: "Architectural",
  Structural: "Structural",
  MEP: "MEP",
  Sitework: "Sitework",
  LifeSafety: "Life Safety",
  Other: "Other",
};

// PunchListResponsiblePartyType enum
const RESPONSIBLE_PARTIES = ["GC", "Subcontractor", "Owner", "Architect"];
const PARTY_LABELS: Record<string, string> = {
  GC: "General Contractor",
  Subcontractor: "Subcontractor",
  Owner: "Owner",
  Architect: "Architect",
};

// TaskPriority enum (shared) — matches backend: Low, Normal, High, Critical
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };
const STATUS_ORDER: Record<string, number> = { Open: 0, InProgress: 1, ReadyForInspection: 2, Disputed: 3, Closed: 4 };

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "Closed") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due < new Date();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Closed":
      return "default";
    case "InProgress":
    case "ReadyForInspection":
      return "secondary";
    case "Disputed":
      return "destructive";
    default:
      return "outline";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Closed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
    case "InProgress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "ReadyForInspection":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
    case "Disputed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Critical":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "High":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "Normal":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function buildPunchListWorkflowSteps(status: string): WorkflowStep[] {
  const normalFlow = ["Open", "InProgress", "ReadyForInspection", "Closed"];

  if (status === "Disputed") {
    return [
      { label: "Open", status: "completed" },
      { label: "In Progress", status: "completed" },
      { label: "Disputed", status: "overdue" },
    ];
  }

  const currentIndex = normalFlow.indexOf(status);

  return normalFlow.map((step, i) => ({
    label: step === "InProgress" ? "In Progress" : step === "ReadyForInspection" ? "Ready for Inspection" : step,
    status:
      i < currentIndex ? "completed" as const :
      i === currentIndex ? "current" as const :
      "upcoming" as const,
  }));
}

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>
    </TableHead>
  );
}

function PunchListContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({ searchInputRef });

  const [items, setItems] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [summary, setSummary] = useState<PunchListSummary | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PunchListFormState>({
    location: "",
    category: "Architectural",
    description: "",
    responsiblePartyType: "Subcontractor",
    assignedToName: "",
    dueDate: "",
    status: "Open",
    priority: "Normal",
    costImpact: "",
    scheduleImpactDays: "",
    notes: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PunchListRow | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileItem[]>([]);
  const [existingFiles, setExistingFiles] = useState<FileAttachment[]>([]);
  const [exporting, setExporting] = useState(false);

  async function exportPdf() {
    setExporting(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (typeof window !== "undefined") {
        const companyId = localStorage.getItem("pitbull_active_company_id");
        if (companyId) headers["X-Company-Id"] = companyId;
      }
      const response = await fetch(
        `${API_BASE_URL}/api/projects/${projectId}/punch-list/export-pdf`,
        { headers }
      );
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `punch-list-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Punch list exported");
    } catch (error) {
      toast.error("Failed to export PDF", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, summaryResult] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/punch-list?page=1&pageSize=500`),
        api<PmActionResultDto>(`/api/projects/${projectId}/punch-list/summary`),
      ]);
      setItems(result.items ?? []);
      if (summaryResult.data) {
        setSummary(summaryResult.data as PunchListSummary);
      }
    } catch (error) {
      toast.error("Failed to load punch list", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!isProjectIdValid) {
      setLoading(false);
      return;
    }
    void load();
  }, [isProjectIdValid, load]);

  const rows = useMemo(() => {
    const mapped = items.map<PunchListRow>((item) => {
      const data = asDataMap(item.data);
      return {
        id: item.id,
        itemNumber: asNumber(data.ItemNumber),
        location: asString(data.Location),
        category: asString(data.Category) || "Other",
        description: item.name || asString(data.Description) || "No description",
        responsiblePartyType: asString(data.ResponsiblePartyType) || "GC",
        assignedToName: asString(data.AssignedToName),
        dueDate: asString(data.DueDate) || null,
        status: item.status || "Open",
        priority: asString(data.Priority) || "Normal",
        costImpact: data.CostImpact != null ? asNumber(data.CostImpact) : null,
        scheduleImpactDays: data.ScheduleImpactDays != null ? asNumber(data.ScheduleImpactDays) : null,
        notes: asString(data.Notes),
        createdAt: item.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    const filtered = mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && row.priority !== priorityFilter) return false;
      if (overdueOnly && !isOverdue(row.dueDate, row.status)) return false;
      if (q) {
        return (
          row.description.toLowerCase().includes(q) ||
          row.location.toLowerCase().includes(q) ||
          String(row.itemNumber).includes(q) ||
          row.assignedToName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "itemNumber":
          cmp = a.itemNumber - b.itemNumber;
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          if (cmp === 0) {
            // Secondary sort by dueDate ascending
            const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            cmp = aDate - bDate;
          }
          break;
        case "dueDate": {
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          cmp = aDate - bDate;
          break;
        }
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return filtered;
  }, [items, search, statusFilter, categoryFilter, priorityFilter, overdueOnly, sortField, sortDirection]);

  // Compute local stats from items for the progress bar (always available)
  const localStats = useMemo(() => {
    const total = items.length;
    const closed = items.filter((i) => i.status === "Closed").length;
    return { total, closed };
  }, [items]);

  const completionPercent = localStats.total > 0 ? Math.round((localStats.closed / localStats.total) * 100) : 0;

  const hasActiveFilters = statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all" || overdueOnly;

  function clearFilters() {
    setStatusFilter("all");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setOverdueOnly(false);
    setSearch("");
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  async function bulkMarkReadyForInspection() {
    const eligibleItems = rows.filter(
      (r) => selectedIds.has(r.id) && r.status === "InProgress"
    );
    if (eligibleItems.length === 0) {
      toast.error("No eligible items selected", {
        description: "Only In Progress items can be marked Ready for Inspection.",
      });
      return;
    }

    setIsBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of eligibleItems) {
      try {
        const payload: PmUpsertRequest = {
          name: item.description,
          status: "ReadyForInspection",
          data: {
            Location: item.location,
            Category: item.category,
            Description: item.description,
            ResponsiblePartyType: item.responsiblePartyType,
            AssignedToName: item.assignedToName || null,
            DueDate: item.dueDate || null,
            Priority: item.priority,
          },
        };
        await api<PmEntityDto>(`/api/projects/${projectId}/punch-list/${item.id}`, {
          method: "PUT",
          body: payload,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} item(s) marked Ready for Inspection`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} item(s) failed to update`);
    }

    setSelectedIds(new Set());
    setIsBulkUpdating(false);
    await load();
  }

  function openCreate() {
    setEditing(false);
    setForm({
      location: "",
      category: "Architectural",
      description: "",
      responsiblePartyType: "Subcontractor",
      assignedToName: "",
      dueDate: "",
      status: "Open",
      priority: "Normal",
      costImpact: "",
      scheduleImpactDays: "",
      notes: "",
    });
    setPendingFiles([]);
    setExistingFiles([]);
    setDialogOpen(true);
  }

  function openEdit(row: PunchListRow) {
    setEditing(true);
    setForm({
      id: row.id,
      location: row.location,
      category: row.category,
      description: row.description,
      responsiblePartyType: row.responsiblePartyType,
      assignedToName: row.assignedToName,
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : "",
      status: row.status,
      priority: row.priority,
      costImpact: row.costImpact != null ? String(row.costImpact) : "",
      scheduleImpactDays: row.scheduleImpactDays != null ? String(row.scheduleImpactDays) : "",
      notes: row.notes,
    });
    setPendingFiles([]);
    api<FileAttachment[]>(`/api/files?entityType=PunchListItem&entityId=${row.id}`)
      .then(setExistingFiles)
      .catch(() => setExistingFiles([]));
    setDialogOpen(true);
  }

  async function saveItem() {
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!form.location.trim()) {
      toast.error("Location is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.description.trim(),
      status: form.status,
      data: {
        Location: form.location.trim(),
        Category: form.category,
        Description: form.description.trim(),
        ResponsiblePartyType: form.responsiblePartyType,
        AssignedToName: form.assignedToName || null,
        DueDate: form.dueDate || null,
        Priority: form.priority,
        CostImpact: form.costImpact ? Number.parseFloat(form.costImpact) : null,
        ScheduleImpactDays: form.scheduleImpactDays ? Number.parseInt(form.scheduleImpactDays, 10) : null,
        Notes: form.notes || null,
      },
    };

    setSaving(true);
    try {
      let itemId = form.id;
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/punch-list/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Punch list item updated");
      } else {
        const created = await api<PmEntityDto>(`/api/projects/${projectId}/punch-list`, {
          method: "POST",
          body: payload,
        });
        itemId = created.id;
        toast.success("Punch list item created");
      }
      const realFiles = pendingFiles.map((f) => f.file).filter((f): f is File => f !== undefined);
      if (realFiles.length > 0 && itemId) {
        try {
          const endpoint = realFiles.length === 1 ? "/api/files/upload" : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "PunchListItem",
            relatedEntityId: itemId,
          });
          toast.success(`${realFiles.length} photo(s) uploaded`);
        } catch {
          toast.error("Item saved but photo upload failed");
        }
      }
      setPendingFiles([]);
      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save punch list item", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function closeItem(row: PunchListRow) {
    setIsClosing(true);
    try {
      await api<unknown>(`/api/projects/${projectId}/punch-list/${row.id}/close`, {
        method: "POST",
      });
      toast.success(`Item #${row.itemNumber} closed`);
      await load();
    } catch (error) {
      toast.error("Failed to close item", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsClosing(false);
    }
  }

  async function deleteItem() {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await api<void>(`/api/projects/${projectId}/punch-list/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Punch list item deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        const payload: PmUpsertRequest = {
          name: pendingDelete.description,
          status: "Closed",
          data: {
            Location: pendingDelete.location,
            Category: pendingDelete.category,
            Description: pendingDelete.description,
          },
        };
        await api<PmEntityDto>(`/api/projects/${projectId}/punch-list/${pendingDelete.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Item marked closed (delete endpoint unavailable)");
        setDeleteOpen(false);
        setPendingDelete(null);
        await load();
      } else {
        toast.error("Failed to delete item", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Punch List</h1>
          <p className="text-muted-foreground">
            Close-out deficiency tracking for project completion.
          </p>
        </div>
        <div className="flex gap-2">
          <LoadingButton
            variant="outline"
            onClick={exportPdf}
            loading={exporting}
            loadingText="Exporting..."
            disabled={items.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </LoadingButton>
          <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
            + New Item
          </Button>
        </div>
      </div>

      {/* Summary cards with progress */}
      <div className="space-y-3">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-lg">{summary?.Total ?? localStats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-lg text-gray-600 dark:text-gray-400">
                {summary?.Open ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-lg text-blue-600">{summary?.InProgress ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ready</CardDescription>
              <CardTitle className="text-lg text-violet-600">{summary?.ReadyForInspection ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Closed</CardDescription>
              <CardTitle className="text-lg text-emerald-600">{summary?.Closed ?? localStats.closed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Disputed</CardDescription>
              <CardTitle className="text-lg text-red-600">{summary?.Disputed ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overdue</CardDescription>
              <CardTitle className="text-lg text-amber-600">
                <span className="flex items-center gap-1">
                  {summary?.OverdueCount ?? "-"}
                  {(summary?.OverdueCount ?? 0) > 0 && <AlertTriangle className="h-4 w-4" />}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Completion progress bar */}
        {localStats.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Completion: {localStats.closed}/{localStats.total} ({completionPercent}%)
            </span>
            <Progress value={completionPercent} className="flex-1 h-2.5" />
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Punch List Items</CardTitle>
          <CardDescription>
            Track deficiencies from walkthrough to close-out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_160px_160px_160px]">
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, location, or assignee (press / to focus)"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer min-h-[44px]">
                <Switch
                  checked={overdueOnly}
                  onCheckedChange={setOverdueOnly}
                />
                <span>Overdue only</span>
              </label>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear filters
                </Button>
              )}
              <span className="text-sm text-muted-foreground ml-auto">
                {rows.length} of {items.length} items
              </span>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <LoadingButton
                size="sm"
                variant="outline"
                onClick={bulkMarkReadyForInspection}
                loading={isBulkUpdating}
                loadingText="Updating..."
              >
                <ClipboardCheck className="h-4 w-4 mr-1" />
                Mark Ready for Inspection
              </LoadingButton>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          )}

          {loading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={3} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton headers={["", "#", "Description", "Location", "Category", "Due Date", "Priority", "Status", "Actions"]} rows={5} />
              </div>
            </>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No punch list items yet. Start a walkthrough and add deficiency items.
                    </p>
                    <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreate}>
                      Add Item
                    </Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelect(row.id)}
                          className="min-h-[44px] min-w-[44px] h-5 w-5"
                          aria-label={`Select item ${row.itemNumber}`}
                        />
                        <span className="font-mono text-sm font-medium">
                          #{row.itemNumber}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <Badge className={statusBadgeClass(row.status)}>
                            {STATUS_LABELS[row.status] || row.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="font-medium">{row.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{row.location}</span>
                        <span>{CATEGORY_LABELS[row.category] || row.category}</span>
                        <Badge className={priorityBadgeClass(row.priority) + " text-xs"}>
                          {row.priority}
                        </Badge>
                      </div>
                      {row.assignedToName && (
                        <p className="text-sm text-muted-foreground">
                          Assigned: {row.assignedToName}
                        </p>
                      )}
                      {row.dueDate && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          Due: {formatDate(row.dueDate)}
                          {isOverdue(row.dueDate, row.status) && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                              Overdue
                            </Badge>
                          )}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px]"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        {row.status === "ReadyForInspection" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 min-h-[44px] min-w-[44px] text-emerald-600 hover:text-emerald-700"
                            onClick={() => closeItem(row)}
                            disabled={isClosing}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                          onClick={() => {
                            setPendingDelete(row);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={rows.length > 0 && selectedIds.size === rows.length}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all"
                          />
                        </TableHead>
                        <SortableHeader label="#" field="itemNumber" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                        <TableHead>Description</TableHead>
                        <TableHead>Location</TableHead>
                        <SortableHeader label="Category" field="category" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                        <TableHead>Responsible</TableHead>
                        <SortableHeader label="Due Date" field="dueDate" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Priority" field="priority" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                        <SortableHeader label="Status" field="status" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No punch list items yet. Start a walkthrough and add deficiency items.
                              </p>
                              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
                                Add Item
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id} className={selectedIds.has(row.id) ? "bg-muted/50" : undefined}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(row.id)}
                                onCheckedChange={() => toggleSelect(row.id)}
                                aria-label={`Select item ${row.itemNumber}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">#{row.itemNumber}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {row.description}
                            </TableCell>
                            <TableCell>{row.location || "-"}</TableCell>
                            <TableCell>{CATEGORY_LABELS[row.category] || row.category}</TableCell>
                            <TableCell>
                              <div>
                                <span className="text-xs text-muted-foreground">
                                  {PARTY_LABELS[row.responsiblePartyType] || row.responsiblePartyType}
                                </span>
                                {row.assignedToName && (
                                  <p className="text-sm">{row.assignedToName}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-1.5">
                                {formatDate(row.dueDate)}
                                {isOverdue(row.dueDate, row.status) && (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={priorityBadgeClass(row.priority) + " text-xs"}>
                                {row.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusBadgeClass(row.status)}>
                                {STATUS_LABELS[row.status] || row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 min-h-[44px] min-w-[44px]"
                                  onClick={() => openEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                {row.status === "ReadyForInspection" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 min-h-[44px] min-w-[44px] text-emerald-600 hover:text-emerald-700"
                                    onClick={() => closeItem(row)}
                                    disabled={isClosing}
                                    title="Close item"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setPendingDelete(row);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Punch List Item" : "New Punch List Item"}</DialogTitle>
            <DialogDescription>
              Document deficiency details, assign responsibility, and track resolution.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <WorkflowStepper
              steps={buildPunchListWorkflowSteps(form.status)}
              orientation="horizontal"
              className="py-2"
            />
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pl-desc">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="pl-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the deficiency (e.g., Paint touch-up needed on east wall)"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pl-location">
                  Location <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pl-location"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Building A, 3rd Floor, Room 302"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Responsible Party</Label>
                <Select
                  value={form.responsiblePartyType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, responsiblePartyType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSIBLE_PARTIES.map((party) => (
                      <SelectItem key={party} value={party}>
                        {PARTY_LABELS[party]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-assignee">Assigned To</Label>
                <Input
                  id="pl-assignee"
                  value={form.assignedToName}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedToName: e.target.value }))}
                  placeholder="e.g., John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-due">Due Date</Label>
                <Input
                  id="pl-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-cost">Cost Impact ($)</Label>
                <Input
                  id="pl-cost"
                  type="number"
                  step="0.01"
                  value={form.costImpact}
                  onChange={(e) => setForm((prev) => ({ ...prev, costImpact: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pl-schedule-impact">Schedule Impact (days)</Label>
                <Input
                  id="pl-schedule-impact"
                  type="number"
                  value={form.scheduleImpactDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, scheduleImpactDays: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pl-notes">Notes</Label>
                <Textarea
                  id="pl-notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or context"
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              {existingFiles.length > 0 && (
                <div className="space-y-1 mb-2">
                  {existingFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-sm rounded border px-2 py-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{f.fileName}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                        const url = getDownloadUrl(f.id);
                        const token = getToken();
                        if (token) {
                          fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                            .then((r) => r.blob())
                            .then((blob) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = f.fileName; a.click(); URL.revokeObjectURL(u); })
                            .catch(() => toast.error("Download failed"));
                        }
                      }}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <FileDropZone
                files={pendingFiles}
                onFilesChange={setPendingFiles}
                accept=".jpg,.jpeg,.png,.heic,.pdf"
                placeholder="Drop photos of the deficiency here"
                maxFiles={10}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveItem}
              loading={saving}
              loadingText="Saving..."
            >
              {editing ? "Save Changes" : "Create Item"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Punch List Item</AlertDialogTitle>
            <AlertDialogDescription>
              Delete item #{pendingDelete?.itemNumber ?? ""} &quot;{pendingDelete?.description ?? "this item"}&quot;? If delete is
              unavailable, it will be marked Closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <LoadingButton
              variant="destructive"
              onClick={deleteItem}
              loading={isDeleting}
              loadingText="Deleting..."
            >
              Delete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PunchListPage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary section="Punch List">
      <PunchListContent {...props} />
    </ErrorBoundary>
  );
}
