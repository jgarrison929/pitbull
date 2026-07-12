"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import api, { getDownloadUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { isValidGuid, cn } from "@/lib/utils";
import {
  PLANS_ADMIN_BLOCK_CLASS,
  PLANS_ADMIN_CTA_CLASS,
} from "@/lib/plans-specs-mobile";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  filterPlanSets,
  filterSpecSections,
  selectPlanOrSpecFromDeepLink,
  type PlanSetSearchItem,
  type SpecSectionSearchItem,
} from "@/lib/plans-specs-lookup";
import { Plus, Pencil, Trash2, FileStack, BookOpen, Eye, Search } from "lucide-react";

interface DataMap {
  [key: string]: unknown;
}

interface PlanSetRow {
  id: string;
  name: string;
  discipline: string;
  revision: string;
  issueDate: string;
  status: string;
  createdAt: string;
}

interface SpecSectionRow {
  id: string;
  sectionCode: string;
  title: string;
  divisionCode: string;
  csiEdition: string;
  status: string;
  createdAt: string;
}

interface PlanSetFormState {
  id?: string;
  name: string;
  discipline: string;
  revision: string;
  issueDate: string;
  description: string;
  status: string;
}

interface SpecSectionFormState {
  id?: string;
  sectionCode: string;
  title: string;
  divisionCode: string;
  csiEdition: string;
  description: string;
  status: string;
}

// PlanSetStatus enum: Draft, Issued, Superseded, Archived
const PLAN_STATUSES = ["Draft", "Issued", "Superseded", "Archived"];
const SPEC_STATUSES = ["Draft", "Current", "Revised"];

// PlanDiscipline enum values (must match C# enum names exactly)
const DISCIPLINES = [
  "Architectural",
  "Structural",
  "Civil",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "FireProtection",
  "Other",
];

const DISCIPLINE_LABELS: Record<string, string> = {
  Architectural: "Architectural",
  Structural: "Structural",
  Civil: "Civil",
  Mechanical: "Mechanical",
  Electrical: "Electrical",
  Plumbing: "Plumbing",
  FireProtection: "Fire Protection",
  Other: "Other",
};

// PlanRevisionType enum values
const REVISION_TYPES = ["IFC", "Bulletin", "ASI", "Addendum", "RecordDrawing", "Other"];

const REVISION_LABELS: Record<string, string> = {
  IFC: "IFC",
  Bulletin: "Bulletin",
  ASI: "ASI",
  Addendum: "Addendum",
  RecordDrawing: "Record Drawing",
  Other: "Other",
};

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Issued":
    case "Current":
      return "default";
    case "Superseded":
    case "Archived":
    case "Revised":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function PlansSpecsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);
  const searchParams = useSearchParams();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [planSets, setPlanSets] = useState<PmEntityDto[]>([]);
  const [specSections, setSpecSections] = useState<PmEntityDto[]>([]);
  const [planFiles, setPlanFiles] = useState<
    Array<{
      id: string;
      fileName: string;
      contentType: string;
      category?: string;
    }>
  >([]);
  const [viewingFileId, setViewingFileId] = useState<string | null>(null);
  /** Authenticated blob URL for in-page View (API downloads require Bearer). */
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);
  const [viewingBlobLoading, setViewingBlobLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [viewingPlan, setViewingPlan] = useState<PlanSetSearchItem | null>(null);
  const [viewingSpec, setViewingSpec] = useState<SpecSectionSearchItem | null>(null);
  const [activeTab, setActiveTab] = useState(
    searchParams.get("view") === "specs" ? "specs" : "plans"
  );
  const deepLinkApplied = useRef(false);

  // Plan Set dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [planForm, setPlanForm] = useState<PlanSetFormState>({
    name: "",
    discipline: "Architectural",
    revision: "IFC",
    issueDate: "",
    description: "",
    status: "Draft",
  });

  // Spec Section dialog
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [specEditing, setSpecEditing] = useState(false);
  const [specForm, setSpecForm] = useState<SpecSectionFormState>({
    sectionCode: "",
    title: "",
    divisionCode: "",
    csiEdition: "",
    description: "",
    status: "Draft",
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "plan" | "spec"; id: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, specRes, filesRes] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/plan-sets?page=1&pageSize=500`),
        api<PmPagedResult>(`/api/projects/${projectId}/spec-sections?page=1&pageSize=500`),
        // Real documents uploaded to the project (Plans category preferred)
        api<
          Array<{
            id: string;
            fileName: string;
            contentType: string;
            category?: string;
          }>
        >(`/api/files?entityType=Project&entityId=${projectId}`).catch(() => []),
      ]);
      setPlanSets(planRes.items ?? []);
      setSpecSections(specRes.items ?? []);
      const files = Array.isArray(filesRes) ? filesRes : [];
      const planLike = files.filter((f) => {
        const cat = (f.category ?? "").toLowerCase();
        const name = (f.fileName ?? "").toLowerCase();
        const type = (f.contentType ?? "").toLowerCase();
        return (
          cat === "plans" ||
          cat === "specs" ||
          type.includes("pdf") ||
          /\.(pdf|dwg|png|jpe?g)$/i.test(name)
        );
      });
      setPlanFiles(planLike.length > 0 ? planLike : files.slice(0, 20));
    } catch (error) {
      toast.error("Failed to load plans & specs", {
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

  useListPageShortcuts({ searchInputRef });

  // Load authenticated blob when user taps View (iframe cannot send Authorization)
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    async function loadBlob() {
      if (!viewingFileId) {
        setViewingBlobUrl(null);
        return;
      }
      setViewingBlobLoading(true);
      try {
        const token = getToken();
        const url = getDownloadUrl(viewingFileId);
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        revoked = blobUrl;
        setViewingBlobUrl(blobUrl);
      } catch {
        if (!cancelled) {
          setViewingBlobUrl(null);
          toast.error("Could not open drawing — try Open or re-upload");
        }
      } finally {
        if (!cancelled) setViewingBlobLoading(false);
      }
    }
    void loadBlob();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [viewingFileId]);

  function openAuthenticatedDownload(fileId: string, fileName: string) {
    const token = getToken();
    const url = getDownloadUrl(fileId);
    if (!token) {
      window.open(url, "_blank");
      return;
    }
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("download failed");
        return r.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = fileName;
        a.target = "_blank";
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => toast.error("Download failed"));
  }

  const planSearchItems = useMemo((): PlanSetSearchItem[] => {
    return planSets.map((ps) => {
      const data = asDataMap(ps.data);
      return {
        id: ps.id,
        name: ps.name || "Untitled plan set",
        discipline: asString(data.Discipline ?? data.discipline) || "Architectural",
        revision: asString(data.Revision ?? data.revision),
        issueDate: asString(data.IssueDate ?? data.issueDate),
        status: ps.status || "Draft",
        description: asString(data.Description ?? data.description),
        documentUrl: asString(data.DocumentUrl ?? data.documentUrl) || undefined,
        sheetNumber: asString(data.SheetNumber ?? data.sheetNumber) || undefined,
      };
    });
  }, [planSets]);

  const specSearchItems = useMemo((): SpecSectionSearchItem[] => {
    return specSections.map((ss) => {
      const data = asDataMap(ss.data);
      return {
        id: ss.id,
        sectionCode: asString(data.SectionCode ?? data.sectionCode) || "-",
        title: ss.title || "Untitled section",
        divisionCode: asString(data.DivisionCode ?? data.divisionCode),
        status: ss.status || "Draft",
        description: asString(data.Description ?? data.description),
      };
    });
  }, [specSections]);

  const filteredPlans = useMemo(
    () => filterPlanSets(planSearchItems, search),
    [planSearchItems, search]
  );

  const filteredSpecs = useMemo(
    () => filterSpecSections(specSearchItems, search),
    [specSearchItems, search]
  );

  const planRows = useMemo(() => {
    return filteredPlans.map<PlanSetRow>((p) => {
      const source = planSets.find((ps) => ps.id === p.id);
      return {
        id: p.id,
        name: p.name,
        discipline: p.discipline,
        revision: p.revision,
        issueDate: p.issueDate || "",
        status: p.status,
        createdAt: source?.createdAt || "",
      };
    });
  }, [filteredPlans, planSets]);

  const specRows = useMemo(() => {
    return filteredSpecs.map<SpecSectionRow>((s) => {
      const source = specSections.find((ss) => ss.id === s.id);
      const data = asDataMap(source?.data);
      return {
        id: s.id,
        sectionCode: s.sectionCode,
        title: s.title,
        divisionCode: s.divisionCode,
        csiEdition: asString(data.CsiEdition ?? data.csiEdition),
        status: s.status,
        createdAt: source?.createdAt || "",
      };
    });
  }, [filteredSpecs, specSections]);

  // Deep link from daily report / site walk: ?planId= &sheet= &section= &view=
  useEffect(() => {
    if (loading || deepLinkApplied.current) return;
    const planId = searchParams.get("planId") || undefined;
    const sheet = searchParams.get("sheet") || undefined;
    const section = searchParams.get("section") || undefined;
    if (!planId && !sheet && !section) return;
    if (planSearchItems.length === 0 && specSearchItems.length === 0) return;

    const { plan, spec } = selectPlanOrSpecFromDeepLink(
      planSearchItems,
      specSearchItems,
      { planId, sheet, section }
    );
    if (plan) {
      setViewingPlan(plan);
      setActiveTab("plans");
      deepLinkApplied.current = true;
    }
    if (spec) {
      setViewingSpec(spec);
      setActiveTab("specs");
      deepLinkApplied.current = true;
    }
  }, [loading, planSearchItems, specSearchItems, searchParams]);

  // Summary stats
  const planIssuedCount = planRows.filter((r) => r.status === "Issued").length;
  const specCurrentCount = specRows.filter((r) => r.status === "Current").length;

  // Plan Set CRUD
  function openCreatePlan() {
    setPlanEditing(false);
    setPlanForm({ name: "", discipline: "Architectural", revision: "IFC", issueDate: "", description: "", status: "Draft" });
    setPlanDialogOpen(true);
  }

  function openEditPlan(row: PlanSetRow) {
    setPlanEditing(true);
    const source = planSets.find((p) => p.id === row.id);
    const data = asDataMap(source?.data);
    setPlanForm({
      id: row.id,
      name: row.name,
      discipline: row.discipline,
      revision: row.revision,
      issueDate: row.issueDate ? row.issueDate.slice(0, 10) : "",
      description: asString(data.Description ?? data.description),
      status: row.status,
    });
    setPlanDialogOpen(true);
  }

  async function savePlanSet() {
    if (!planForm.name.trim()) {
      toast.error("Plan set name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: planForm.name.trim(),
      status: planForm.status,
      data: {
        Discipline: planForm.discipline,
        Revision: planForm.revision || null,
        IssueDate: planForm.issueDate || null,
      },
    };

    setSaving(true);
    try {
      if (planEditing && planForm.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/plan-sets/${planForm.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Plan set updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/plan-sets`, {
          method: "POST",
          body: payload,
        });
        toast.success("Plan set created");
      }

      setPlanDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save plan set", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  // Spec Section CRUD
  function openCreateSpec() {
    setSpecEditing(false);
    setSpecForm({ sectionCode: "", title: "", divisionCode: "", csiEdition: "", description: "", status: "Draft" });
    setSpecDialogOpen(true);
  }

  function openEditSpec(row: SpecSectionRow) {
    setSpecEditing(true);
    const source = specSections.find((s) => s.id === row.id);
    const data = asDataMap(source?.data);
    setSpecForm({
      id: row.id,
      sectionCode: row.sectionCode !== "-" ? row.sectionCode : "",
      title: row.title,
      divisionCode: row.divisionCode,
      csiEdition: row.csiEdition,
      description: asString(data.Description ?? data.description),
      status: row.status,
    });
    setSpecDialogOpen(true);
  }

  async function saveSpecSection() {
    if (!specForm.title.trim()) {
      toast.error("Spec section title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: specForm.title.trim(),
      status: specForm.status,
      data: {
        SectionCode: specForm.sectionCode.trim() || null,
        DivisionCode: specForm.divisionCode.trim() || null,
        CsiEdition: specForm.csiEdition.trim() || null,
      },
    };

    setSaving(true);
    try {
      if (specEditing && specForm.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/spec-sections/${specForm.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Spec section updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/spec-sections`, {
          method: "POST",
          body: payload,
        });
        toast.success("Spec section created");
      }

      setSpecDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save spec section", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  // Delete handler
  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const endpoint =
        deleteTarget.type === "plan"
          ? `/api/projects/${projectId}/plan-sets/${deleteTarget.id}`
          : `/api/projects/${projectId}/spec-sections/${deleteTarget.id}`;
      await api(endpoint, { method: "DELETE" });
      toast.success(`${deleteTarget.type === "plan" ? "Plan set" : "Spec section"} deleted`);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast.error(`Failed to delete ${deleteTarget.type === "plan" ? "plan set" : "spec section"}`, {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 2.13.4 field mode: viewer-first on phone */}
      <p className="text-sm text-muted-foreground lg:hidden" data-testid="plans-field-mode-hint">
        Field view — search and open sheets. Admin upload/edit is available on desktop.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans &amp; Specs</h1>
          <p className="text-muted-foreground">
            Plan sets, sheets, spec sections — mobile-ready view + search.
          </p>
        </div>
      </div>

      {/* Field view surface: open plan/spec detail (not CRUD-only) */}
      {(viewingPlan || viewingSpec) && (
        <Card className="border-amber-300 bg-amber-50/40 dark:bg-amber-900/10" data-testid="plans-specs-viewer">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5 text-amber-600" />
                  {viewingPlan ? "Plan view" : "Spec view"}
                </CardTitle>
                <CardDescription>
                  Deep-linked field reference — pinch-zoom browser zoom works on description/text.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewingPlan(null);
                  setViewingSpec(null);
                }}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {viewingPlan && (
              <div className="space-y-2 rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">{viewingPlan.name}</h2>
                  <Badge variant={statusBadgeVariant(viewingPlan.status)}>
                    {viewingPlan.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {DISCIPLINE_LABELS[viewingPlan.discipline] ?? viewingPlan.discipline}
                  {viewingPlan.revision
                    ? ` · ${REVISION_LABELS[viewingPlan.revision] ?? viewingPlan.revision}`
                    : ""}
                  {viewingPlan.sheetNumber ? ` · Sheet ${viewingPlan.sheetNumber}` : ""}
                </p>
                {viewingPlan.issueDate && (
                  <p className="text-sm">Issued: {formatDate(viewingPlan.issueDate)}</p>
                )}
                {viewingPlan.description && (
                  <p className="text-sm whitespace-pre-wrap border-t pt-3">
                    {viewingPlan.description}
                  </p>
                )}
                {viewingPlan.documentUrl ? (
                  <a
                    href={viewingPlan.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[48px] items-center text-amber-700 underline"
                  >
                    Open document
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No file URL on this plan set — open a project drawing below if uploaded.
                  </p>
                )}
              </div>
            )}
            {viewingSpec && (
              <div className="space-y-2 rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{viewingSpec.sectionCode}</span>
                  <h2 className="text-xl font-semibold">{viewingSpec.title}</h2>
                  <Badge variant={statusBadgeVariant(viewingSpec.status)}>
                    {viewingSpec.status}
                  </Badge>
                </div>
                {viewingSpec.divisionCode && (
                  <p className="text-sm text-muted-foreground">
                    Division {viewingSpec.divisionCode}
                  </p>
                )}
                {viewingSpec.description && (
                  <p className="text-sm whitespace-pre-wrap border-t pt-3">
                    {viewingSpec.description}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Real plan PDFs / drawings from project documents */}
      {planFiles.length > 0 && (
        <Card data-testid="plans-document-viewer">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="h-4 w-4 text-amber-500" />
              Drawing files
            </CardTitle>
            <CardDescription>
              Open uploaded PDFs/images full-screen (browser zoom works on mobile).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {planFiles.map((f) => {
              const isPdf =
                (f.contentType ?? "").includes("pdf") ||
                f.fileName.toLowerCase().endsWith(".pdf");
              const isImage = (f.contentType ?? "").startsWith("image/");
              const open = viewingFileId === f.id;
              return (
                <div key={f.id} className="rounded-lg border overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{f.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.category || f.contentType || "file"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(isPdf || isImage) && (
                        <Button
                          type="button"
                          variant={open ? "default" : "outline"}
                          className="min-h-[44px]"
                          onClick={() =>
                            setViewingFileId(open ? null : f.id)
                          }
                        >
                          {open ? "Hide" : "View"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() =>
                          openAuthenticatedDownload(f.id, f.fileName)
                        }
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                  {open && viewingBlobLoading && (
                    <p className="p-3 text-sm text-muted-foreground border-t">
                      Loading drawing…
                    </p>
                  )}
                  {open && !viewingBlobLoading && viewingBlobUrl && isPdf && (
                    <iframe
                      title={f.fileName}
                      src={viewingBlobUrl}
                      className="w-full h-[70vh] border-t bg-muted"
                    />
                  )}
                  {open && !viewingBlobLoading && viewingBlobUrl && isImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewingBlobUrl}
                      alt={f.fileName}
                      className="w-full max-h-[70vh] object-contain border-t bg-muted"
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plan Sets</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planRows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plans Issued</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planIssuedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spec Sections</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{specRows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Specs Current</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{specCurrentCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="plans">Plan Sets</TabsTrigger>
            <TabsTrigger value="specs">Spec Sections</TabsTrigger>
          </TabsList>
          <div className="relative sm:max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sheet, title, section…"
              className={cn(PLANS_MOBILE_SEARCH_INPUT_CLASS)}
              data-testid="plans-specs-search" aria-label="Search plan sheets"
            />
          </div>
        </div>

        {/* Plan Sets Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan Sets</CardTitle>
                  <CardDescription>Drawing sets organized by discipline.</CardDescription>
                </div>
                <Button className={cn("bg-amber-500 hover:bg-amber-600 text-white", PLANS_ADMIN_CTA_CLASS)} onClick={openCreatePlan}>
                  <Plus className="mr-2 h-4 w-4" /> New Plan Set
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <>
                  <div className="sm:hidden"><CardListSkeleton rows={3} /></div>
                  <div className="hidden sm:block"><TableSkeleton headers={["Name", "Discipline", "Revision", "Issue Date", "Status", "Actions"]} rows={5} /></div>
                </>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="space-y-3 sm:hidden">
                    {planRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          No plan sets yet. Create your first plan set for this project.
                        </p>
                        <Button className={cn("mt-3 bg-amber-500 hover:bg-amber-600 text-white", PLANS_ADMIN_CTA_CLASS)} size="sm" onClick={openCreatePlan}>Create Plan Set</Button>
                      </div>
                    ) : (
                      planRows.map((row) => (
                        <div key={row.id} className="rounded-lg border p-4 space-y-2">
                          <button
                            type="button"
                            className="w-full text-left touch-manipulation space-y-2"
                            onClick={() => {
                              const item = planSearchItems.find((p) => p.id === row.id);
                              if (item) setViewingPlan(item);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{row.name}</span>
                              <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                            </div>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>{DISCIPLINE_LABELS[row.discipline] ?? row.discipline}</span>
                              {row.revision && <span>{REVISION_LABELS[row.revision] ?? row.revision}</span>}
                              {row.issueDate && <span>{formatDate(row.issueDate)}</span>}
                            </div>
                            <span className="text-xs text-amber-700">Tap to view</span>
                          </button>
                          <div className={cn("flex gap-2 pt-1", PLANS_ADMIN_BLOCK_CLASS)}>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-[44px] w-[44px]"
                              onClick={() => openEditPlan(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-[44px] w-[44px] text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: "plan", id: row.id, label: row.name })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <div className="overflow-x-auto"><Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Discipline</TableHead>
                          <TableHead>Revision</TableHead>
                          <TableHead>Issue Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="flex flex-col items-center gap-3 py-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                  No plan sets yet. Create your first plan set for this project.
                                </p>
                                <Button className="bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreatePlan}>Create Plan Set</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          planRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{DISCIPLINE_LABELS[row.discipline] ?? row.discipline}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {(REVISION_LABELS[row.revision] ?? row.revision) || "-"}
                              </TableCell>
                              <TableCell>{formatDate(row.issueDate)}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(row.status)}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditPlan(row)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTarget({ type: "plan", id: row.id, label: row.name })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spec Sections Tab */}
        <TabsContent value="specs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Spec Sections</CardTitle>
                  <CardDescription>
                    Specification sections organized by CSI division.
                  </CardDescription>
                </div>
                <Button className={cn("bg-amber-500 hover:bg-amber-600 text-white", PLANS_ADMIN_CTA_CLASS)} onClick={openCreateSpec}>
                  <Plus className="mr-2 h-4 w-4" /> New Spec Section
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <>
                  <div className="sm:hidden"><CardListSkeleton rows={3} /></div>
                  <div className="hidden sm:block"><TableSkeleton headers={["Section Code", "Title", "Division Code", "CSI Edition", "Status", "Actions"]} rows={5} /></div>
                </>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="space-y-3 sm:hidden">
                    {specRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          No spec sections yet. Create your first spec section for this project.
                        </p>
                        <Button className={cn("mt-3 bg-amber-500 hover:bg-amber-600 text-white", PLANS_ADMIN_CTA_CLASS)} size="sm" onClick={openCreateSpec}>Create Spec Section</Button>
                      </div>
                    ) : (
                      specRows.map((row) => (
                        <div key={row.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium">{row.sectionCode}</span>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </div>
                          <p className="font-medium">{row.title}</p>
                          {row.divisionCode && (
                            <p className="text-sm text-muted-foreground">Div {row.divisionCode}</p>
                          )}
                          {row.csiEdition && (
                            <p className="text-sm text-muted-foreground">CSI {row.csiEdition}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-[44px] w-[44px]"
                              onClick={() => openEditSpec(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-[44px] w-[44px] text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: "spec", id: row.id, label: row.title })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <div className="overflow-x-auto"><Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Division Code</TableHead>
                          <TableHead>CSI Edition</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {specRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="flex flex-col items-center gap-3 py-6 text-center">
                                <p className="text-sm text-muted-foreground">
                                  No spec sections yet. Create your first spec section for this project.
                                </p>
                                <Button className="bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreateSpec}>Create Spec Section</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          specRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-sm">{row.sectionCode}</TableCell>
                              <TableCell className="font-medium">{row.title}</TableCell>
                              <TableCell>{row.divisionCode || "-"}</TableCell>
                              <TableCell>{row.csiEdition || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(row.status)}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditSpec(row)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDeleteTarget({ type: "spec", id: row.id, label: row.title })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Set Create/Edit Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{planEditing ? "Edit Plan Set" : "New Plan Set"}</DialogTitle>
            <DialogDescription>
              Define plan set details, discipline, and revision.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="plan-name"
                value={planForm.name}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Architectural Drawings - Building A"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Discipline</Label>
                <Select
                  value={planForm.discipline}
                  onValueChange={(value) =>
                    setPlanForm((prev) => ({ ...prev, discipline: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DISCIPLINE_LABELS[d] ?? d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Revision Type</Label>
                <Select
                  value={planForm.revision}
                  onValueChange={(value) =>
                    setPlanForm((prev) => ({ ...prev, revision: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVISION_TYPES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REVISION_LABELS[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={planForm.status}
                  onValueChange={(value) =>
                    setPlanForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-issue-date">Issue Date</Label>
              <Input
                id="plan-issue-date"
                type="date"
                value={planForm.issueDate}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, issueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-desc">Description</Label>
              <Textarea
                id="plan-desc"
                value={planForm.description}
                onChange={(e) =>
                  setPlanForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={savePlanSet}
              loading={saving}
            >
              {planEditing ? "Save Changes" : "Create Plan Set"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spec Section Create/Edit Dialog */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {specEditing ? "Edit Spec Section" : "New Spec Section"}
            </DialogTitle>
            <DialogDescription>
              Define specification section code, title, and CSI division.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spec-section-code">Section Code</Label>
                <Input
                  id="spec-section-code"
                  value={specForm.sectionCode}
                  onChange={(e) =>
                    setSpecForm((prev) => ({ ...prev, sectionCode: e.target.value }))
                  }
                  placeholder="e.g. 03 30 00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec-division-code">Division Code</Label>
                <Input
                  id="spec-division-code"
                  value={specForm.divisionCode}
                  onChange={(e) =>
                    setSpecForm((prev) => ({ ...prev, divisionCode: e.target.value }))
                  }
                  placeholder="e.g. 03"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spec-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="spec-title"
                value={specForm.title}
                onChange={(e) => setSpecForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Cast-in-Place Concrete"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spec-csi-edition">CSI Edition</Label>
                <Input
                  id="spec-csi-edition"
                  value={specForm.csiEdition}
                  onChange={(e) =>
                    setSpecForm((prev) => ({ ...prev, csiEdition: e.target.value }))
                  }
                  placeholder="e.g. 2020"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={specForm.status}
                  onValueChange={(value) =>
                    setSpecForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPEC_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spec-desc">Description</Label>
              <Textarea
                id="spec-desc"
                value={specForm.description}
                onChange={(e) =>
                  setSpecForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSpecDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <LoadingButton
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={saveSpecSection}
              loading={saving}
            >
              {specEditing ? "Save Changes" : "Create Spec Section"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === "plan" ? "Plan Set" : "Spec Section"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.label}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <LoadingButton
              variant="destructive"
              onClick={confirmDelete}
              loading={isDeleting}
            >
              Delete
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PlansSpecsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ErrorBoundary>
      <PlansSpecsContent params={params} />
    </ErrorBoundary>
  );
}
