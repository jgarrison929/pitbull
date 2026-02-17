"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
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
import { Plus, Pencil, Trash2, FileStack, BookOpen } from "lucide-react";

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

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [planSets, setPlanSets] = useState<PmEntityDto[]>([]);
  const [specSections, setSpecSections] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");

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
      const [planRes, specRes] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/plan-sets?page=1&pageSize=500`),
        api<PmPagedResult>(`/api/projects/${projectId}/spec-sections?page=1&pageSize=500`),
      ]);
      setPlanSets(planRes.items ?? []);
      setSpecSections(specRes.items ?? []);
    } catch (error) {
      toast.error("Failed to load plans & specs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useListPageShortcuts({ searchInputRef });

  const planRows = useMemo(() => {
    const mapped = planSets.map<PlanSetRow>((ps) => {
      const data = asDataMap(ps.data);
      return {
        id: ps.id,
        name: ps.name || "Untitled plan set",
        discipline: asString(data.Discipline ?? data.discipline) || "Architectural",
        revision: asString(data.Revision ?? data.revision),
        issueDate: asString(data.IssueDate ?? data.issueDate),
        status: ps.status || "Draft",
        createdAt: ps.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.discipline.toLowerCase().includes(q) ||
        row.revision.toLowerCase().includes(q)
    );
  }, [planSets, search]);

  const specRows = useMemo(() => {
    const mapped = specSections.map<SpecSectionRow>((ss) => {
      const data = asDataMap(ss.data);
      return {
        id: ss.id,
        sectionCode: asString(data.SectionCode ?? data.sectionCode) || "-",
        title: ss.title || "Untitled section",
        divisionCode: asString(data.DivisionCode ?? data.divisionCode),
        csiEdition: asString(data.CsiEdition ?? data.csiEdition),
        status: ss.status || "Draft",
        createdAt: ss.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.sectionCode.toLowerCase().includes(q) ||
        row.divisionCode.toLowerCase().includes(q)
    );
  }, [specSections, search]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans &amp; Specs</h1>
          <p className="text-muted-foreground">
            Plan sets, sheets, spec sections, and document distributions.
          </p>
        </div>
      </div>

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

      <Tabs defaultValue="plans" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="plans">Plan Sets</TabsTrigger>
            <TabsTrigger value="specs">Spec Sections</TabsTrigger>
          </TabsList>
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search... (Ctrl+K)"
            className="sm:max-w-xs"
          />
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
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreatePlan}>
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
                        <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreatePlan}>Create Plan Set</Button>
                      </div>
                    ) : (
                      planRows.map((row) => (
                        <div key={row.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{row.name}</span>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{DISCIPLINE_LABELS[row.discipline] ?? row.discipline}</span>
                            {row.revision && <span>{REVISION_LABELS[row.revision] ?? row.revision}</span>}
                            {row.issueDate && <span>{formatDate(row.issueDate)}</span>}
                          </div>
                          <div className="flex gap-2 pt-1">
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
                <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreateSpec}>
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
                        <Button className="mt-3 bg-amber-500 hover:bg-amber-600 text-white" size="sm" onClick={openCreateSpec}>Create Spec Section</Button>
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
