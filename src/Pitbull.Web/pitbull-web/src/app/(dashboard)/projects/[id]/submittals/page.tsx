"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError, uploadFiles, getDownloadUrl } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import { getToken } from "@/lib/auth";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Pencil, Trash2, Download, Paperclip } from "lucide-react";

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

interface SubmittalRow {
  id: string;
  submittalNumber: number;
  title: string;
  specSectionCode: string;
  specSectionTitle: string;
  submittalType: string;
  status: string;
  requiredByDate: string | null;
  submittedDate: string | null;
  revisionNumber: number;
  isSubstitutionRequest: boolean;
  createdAt: string;
}

interface SubmittalFormState {
  id?: string;
  title: string;
  specSectionCode: string;
  specSectionTitle: string;
  submittalType: string;
  description: string;
  requiredByDate: string;
  isSubstitutionRequest: boolean;
  status: string;
}

// SubmittalStatus enum: Draft, Submitted, InReview, Approved, ApprovedAsNoted, ReviseAndResubmit, Rejected, Closed
const STATUSES = ["Draft", "Submitted", "InReview", "Approved", "ApprovedAsNoted", "ReviseAndResubmit", "Rejected", "Closed"];
const STATUS_LABELS: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  InReview: "In Review",
  Approved: "Approved",
  ApprovedAsNoted: "Approved as Noted",
  ReviseAndResubmit: "Revise & Resubmit",
  Rejected: "Rejected",
  Closed: "Closed",
};

// SubmittalType enum: ProductData, ShopDrawing, Sample, Mockup, Closeout, Other
const SUBMITTAL_TYPES = ["ProductData", "ShopDrawing", "Sample", "Mockup", "Closeout", "Other"];
const TYPE_LABELS: Record<string, string> = {
  ProductData: "Product Data",
  ShopDrawing: "Shop Drawing",
  Sample: "Sample",
  Mockup: "Mockup",
  Closeout: "Closeout",
  Other: "Other",
};

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true";
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Approved":
    case "ApprovedAsNoted":
      return "default";
    case "Submitted":
    case "InReview":
      return "secondary";
    case "Rejected":
    case "ReviseAndResubmit":
      return "destructive";
    default:
      return "outline";
  }
}

function SubmittalsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useListPageShortcuts({ searchInputRef });

  const [submittals, setSubmittals] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SubmittalFormState>({
    title: "",
    specSectionCode: "",
    specSectionTitle: "",
    submittalType: "ShopDrawing",
    description: "",
    requiredByDate: "",
    isSubstitutionRequest: false,
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SubmittalRow | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileItem[]>([]);
  const [existingFiles, setExistingFiles] = useState<FileAttachment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/submittals?page=1&pageSize=500`
      );
      setSubmittals(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load submittals", {
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
    const mapped = submittals.map<SubmittalRow>((sub) => {
      const data = asDataMap(sub.data);
      return {
        id: sub.id,
        submittalNumber: asNumber(data.SubmittalNumber),
        title: sub.title || asString(data.Title) || "Untitled submittal",
        specSectionCode: asString(data.SpecSectionCode),
        specSectionTitle: asString(data.SpecSectionTitle),
        submittalType: asString(data.SubmittalType) || "Other",
        status: sub.status || "Draft",
        requiredByDate: asString(data.RequiredByDate) || null,
        submittedDate: asString(data.SubmittedDate) || null,
        revisionNumber: asNumber(data.RevisionNumber),
        isSubstitutionRequest: asBool(data.IsSubstitutionRequest),
        createdAt: sub.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.submittalType !== typeFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        String(row.submittalNumber).includes(q) ||
        row.specSectionCode.toLowerCase().includes(q) ||
        row.specSectionTitle.toLowerCase().includes(q)
      );
    });
  }, [submittals, search, statusFilter, typeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const total = submittals.length;
    const pending = submittals.filter((s) => s.status === "Submitted" || s.status === "InReview").length;
    const approved = submittals.filter((s) => s.status === "Approved" || s.status === "ApprovedAsNoted").length;
    const actionNeeded = submittals.filter((s) => s.status === "Rejected" || s.status === "ReviseAndResubmit").length;
    return { total, pending, approved, actionNeeded };
  }, [submittals]);

  function openCreate() {
    setEditing(false);
    setForm({ title: "", specSectionCode: "", specSectionTitle: "", submittalType: "ShopDrawing", description: "", requiredByDate: "", isSubstitutionRequest: false, status: "Draft" });
    setPendingFiles([]);
    setExistingFiles([]);
    setDialogOpen(true);
  }

  function openEdit(row: SubmittalRow) {
    setEditing(true);
    const source = submittals.find((s) => s.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      title: row.title,
      specSectionCode: row.specSectionCode,
      specSectionTitle: row.specSectionTitle,
      submittalType: row.submittalType,
      description: asString(data.Description),
      requiredByDate: row.requiredByDate ? row.requiredByDate.slice(0, 10) : "",
      isSubstitutionRequest: row.isSubstitutionRequest,
      status: row.status,
    });
    setPendingFiles([]);
    // Load existing attachments for this submittal
    api<FileAttachment[]>(`/api/files?entityType=Submittal&entityId=${row.id}`)
      .then(setExistingFiles)
      .catch(() => setExistingFiles([]));
    setDialogOpen(true);
  }

  async function saveSubmittal() {
    if (!form.title.trim()) {
      toast.error("Submittal title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: form.title.trim(),
      status: form.status,
      data: {
        SpecSectionCode: form.specSectionCode || null,
        SpecSectionTitle: form.specSectionTitle || null,
        SubmittalType: form.submittalType,
        Description: form.description || null,
        RequiredByDate: form.requiredByDate || null,
        IsSubstitutionRequest: form.isSubstitutionRequest,
      },
    };

    setSaving(true);
    try {
      let submittalId = form.id;
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/submittals/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Submittal updated");
      } else {
        const created = await api<PmEntityDto>(`/api/projects/${projectId}/submittals`, { method: "POST", body: payload });
        submittalId = created.id;
        toast.success("Submittal created");
      }
      // Upload pending files
      const realFiles = pendingFiles.map((f) => f.file).filter((f): f is File => f !== undefined);
      if (realFiles.length > 0 && submittalId) {
        try {
          const endpoint = realFiles.length === 1 ? "/api/files/upload" : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "Submittal",
            relatedEntityId: submittalId,
          });
          toast.success(`${realFiles.length} attachment(s) uploaded`);
        } catch {
          toast.error("Submittal saved but file upload failed");
        }
      }
      setPendingFiles([]);
      setDialogOpen(false); await load();
    } catch (error) {
      toast.error("Failed to save submittal", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubmittal() {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await api<void>(`/api/projects/${projectId}/submittals/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Submittal deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        // Fallback: mark as Closed if DELETE not available
        const payload: PmUpsertRequest = {
          title: pendingDelete.title,
          status: "Closed",
          data: {
            SpecSectionCode: pendingDelete.specSectionCode || null,
            SubmittalType: pendingDelete.submittalType,
          },
        };

        await api<PmEntityDto>(`/api/projects/${projectId}/submittals/${pendingDelete.id}`, {
          method: "PUT",
          body: payload,
        });

        toast.success("Submittal marked closed (delete endpoint unavailable)");
        setDeleteOpen(false);
        setPendingDelete(null);
        await load();
      } else {
        toast.error("Failed to delete submittal", {
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
          <h1 className="text-2xl font-bold tracking-tight">Submittals</h1>
          <p className="text-muted-foreground">
            Submittal register, review workflow, and tracking.
          </p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
          + New Submittal
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Submittals</CardDescription>
            <CardTitle className="text-lg">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-lg text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-lg text-emerald-600">{stats.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Action Needed</CardDescription>
            <CardTitle className="text-lg text-red-600">{stats.actionNeeded}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submittal Register</CardTitle>
          <CardDescription>
            Track submittals from creation through review and approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search number, title, or spec section (press / to focus)"
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SUBMITTAL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={3} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton headers={["No.", "Title", "Spec Section", "Type", "Required By", "Status", "Actions"]} rows={5} />
              </div>
            </>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No submittals yet. Create your first submittal to begin routing reviews.
                    </p>
                    <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreate}>
                      Create Submittal
                    </Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">
                          #{row.submittalNumber}
                          {row.revisionNumber > 0 && <span className="text-muted-foreground"> Rev {row.revisionNumber}</span>}
                        </span>
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABELS[row.status] || row.status}
                        </Badge>
                      </div>
                      <p className="font-medium">{row.title}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {row.specSectionCode && <span>Spec: {row.specSectionCode}</span>}
                        <span>{TYPE_LABELS[row.submittalType] || row.submittalType}</span>
                        {row.isSubstitutionRequest && (
                          <Badge variant="outline" className="text-xs">Substitution</Badge>
                        )}
                      </div>
                      {row.requiredByDate && (
                        <p className="text-sm text-muted-foreground">
                          Required by: {formatDate(row.requiredByDate)}
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
                        <TableHead>No.</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Spec Section</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Required By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No submittals yet. Create your first submittal to begin routing reviews.
                              </p>
                              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreate}>
                                Create Submittal
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-sm">
                              #{row.submittalNumber}
                              {row.revisionNumber > 0 && (
                                <span className="text-muted-foreground text-xs ml-1">R{row.revisionNumber}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.title}
                              {row.isSubstitutionRequest && (
                                <Badge variant="outline" className="ml-2 text-xs">Sub</Badge>
                              )}
                            </TableCell>
                            <TableCell>{row.specSectionCode || "-"}</TableCell>
                            <TableCell>{TYPE_LABELS[row.submittalType] || row.submittalType}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {formatDate(row.requiredByDate)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(row.status)}>
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
            <DialogTitle>{editing ? "Edit Submittal" : "New Submittal"}</DialogTitle>
            <DialogDescription>
              Define submittal details, spec section, type, and review requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sub-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sub-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Submittal title"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub-spec-code">Spec Section Code</Label>
                <Input
                  id="sub-spec-code"
                  value={form.specSectionCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, specSectionCode: e.target.value }))}
                  placeholder="e.g. 03 30 00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-spec-title">Spec Section Title</Label>
                <Input
                  id="sub-spec-title"
                  value={form.specSectionTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, specSectionTitle: e.target.value }))}
                  placeholder="e.g. Cast-in-Place Concrete"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.submittalType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, submittalType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMITTAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-required-by">Required By Date</Label>
                <Input
                  id="sub-required-by"
                  type="date"
                  value={form.requiredByDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, requiredByDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-desc">Description</Label>
              <Textarea
                id="sub-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description or notes"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="flex items-end pb-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sub-substitution"
                    checked={form.isSubstitutionRequest}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, isSubstitutionRequest: checked === true }))
                    }
                  />
                  <Label htmlFor="sub-substitution" className="text-sm font-normal cursor-pointer">
                    Substitution Request
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Attachments</Label>
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
                placeholder="Drop files to attach to this submittal"
                maxFiles={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveSubmittal}
              loading={saving}
              loadingText="Saving..."
            >
              {editing ? "Save Changes" : "Create Submittal"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submittal</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this submittal"}&quot;? If delete is
              unavailable, it will be marked Closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <LoadingButton
              variant="destructive"
              onClick={deleteSubmittal}
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

export default function SubmittalsPage(props: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary section="Submittals">
      <SubmittalsContent {...props} />
    </ErrorBoundary>
  );
}
