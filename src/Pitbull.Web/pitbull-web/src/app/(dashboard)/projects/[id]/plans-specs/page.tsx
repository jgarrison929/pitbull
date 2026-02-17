"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DataMap {
  [key: string]: unknown;
}

interface PlanSetRow {
  id: string;
  title: string;
  discipline: string;
  revision: string;
  sheetCount: number;
  status: string;
  createdAt: string;
}

interface SpecSectionRow {
  id: string;
  number: string;
  title: string;
  division: string;
  status: string;
  createdAt: string;
}

interface PlanSetFormState {
  id?: string;
  title: string;
  discipline: string;
  revision: string;
  description: string;
  status: string;
}

interface SpecSectionFormState {
  id?: string;
  number: string;
  title: string;
  division: string;
  description: string;
  status: string;
}

const PLAN_STATUSES = ["Draft", "Current", "Superseded"];
const SPEC_STATUSES = ["Draft", "Current", "Revised"];
const DISCIPLINES = [
  "Architectural",
  "Structural",
  "Mechanical",
  "Electrical",
  "Plumbing",
  "Civil",
  "Landscape",
  "Fire Protection",
  "General",
  "Other",
];

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

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Current":
      return "default";
    case "Revised":
    case "Superseded":
      return "secondary";
    default:
      return "outline";
  }
}

export default function PlansSpecsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [planSets, setPlanSets] = useState<PmEntityDto[]>([]);
  const [specSections, setSpecSections] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Plan Set dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [planForm, setPlanForm] = useState<PlanSetFormState>({
    title: "",
    discipline: "General",
    revision: "",
    description: "",
    status: "Draft",
  });

  // Spec Section dialog
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [specEditing, setSpecEditing] = useState(false);
  const [specForm, setSpecForm] = useState<SpecSectionFormState>({
    number: "",
    title: "",
    division: "",
    description: "",
    status: "Draft",
  });

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

  const planRows = useMemo(() => {
    const mapped = planSets.map<PlanSetRow>((ps) => {
      const data = asDataMap(ps.data);
      return {
        id: ps.id,
        title: ps.title || ps.name || "Untitled plan set",
        discipline: asString(data.Discipline ?? data.discipline) || "General",
        revision: asString(data.Revision ?? data.revision),
        sheetCount: asNumber(data.SheetCount ?? data.sheetCount),
        status: ps.status || "Draft",
        createdAt: ps.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.discipline.toLowerCase().includes(q) ||
        row.revision.toLowerCase().includes(q)
    );
  }, [planSets, search]);

  const specRows = useMemo(() => {
    const mapped = specSections.map<SpecSectionRow>((ss) => {
      const data = asDataMap(ss.data);
      return {
        id: ss.id,
        number: ss.name || asString(data.Number ?? data.number) || "-",
        title: ss.title || "Untitled section",
        division: asString(data.Division ?? data.division),
        status: ss.status || "Draft",
        createdAt: ss.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    if (!q) return mapped;
    return mapped.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.number.toLowerCase().includes(q) ||
        row.division.toLowerCase().includes(q)
    );
  }, [specSections, search]);

  // Plan Set CRUD
  function openCreatePlan() {
    setPlanEditing(false);
    setPlanForm({ title: "", discipline: "General", revision: "", description: "", status: "Draft" });
    setPlanDialogOpen(true);
  }

  function openEditPlan(row: PlanSetRow) {
    setPlanEditing(true);
    const source = planSets.find((p) => p.id === row.id);
    const data = asDataMap(source?.data);
    setPlanForm({
      id: row.id,
      title: row.title,
      discipline: row.discipline,
      revision: row.revision,
      description: asString(data.Description ?? data.description),
      status: row.status,
    });
    setPlanDialogOpen(true);
  }

  async function savePlanSet() {
    if (!planForm.title.trim()) {
      toast.error("Plan set title is required");
      return;
    }

    const payload: PmUpsertRequest = {
      title: planForm.title.trim(),
      status: planForm.status,
      data: {
        Discipline: planForm.discipline,
        Revision: planForm.revision || null,
        Description: planForm.description || null,
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
    setSpecForm({ number: "", title: "", division: "", description: "", status: "Draft" });
    setSpecDialogOpen(true);
  }

  function openEditSpec(row: SpecSectionRow) {
    setSpecEditing(true);
    const source = specSections.find((s) => s.id === row.id);
    const data = asDataMap(source?.data);
    setSpecForm({
      id: row.id,
      number: row.number !== "-" ? row.number : "",
      title: row.title,
      division: row.division,
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
      name: specForm.number.trim() || undefined,
      status: specForm.status,
      data: {
        Division: specForm.division || null,
        Description: specForm.description || null,
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

      <Tabs defaultValue="plans" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="plans">Plan Sets</TabsTrigger>
            <TabsTrigger value="specs">Spec Sections</TabsTrigger>
          </TabsList>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
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
                <Button onClick={openCreatePlan}>+ New Plan Set</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading plan sets...</p>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="space-y-3 sm:hidden">
                    {planRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No plan sets found.</p>
                    ) : (
                      planRows.map((row) => (
                        <div key={row.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{row.title}</span>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </div>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{row.discipline}</span>
                            {row.revision && <span>Rev {row.revision}</span>}
                            {row.sheetCount > 0 && <span>{row.sheetCount} sheets</span>}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditPlan(row)}
                          >
                            Edit
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Discipline</TableHead>
                          <TableHead>Revision</TableHead>
                          <TableHead>Sheets</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-muted-foreground">
                              No plan sets found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          planRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.title}</TableCell>
                              <TableCell>{row.discipline}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {row.revision || "-"}
                              </TableCell>
                              <TableCell>{row.sheetCount || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(row.status)}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditPlan(row)}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
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
                <Button onClick={openCreateSpec}>+ New Spec Section</Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading spec sections...</p>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="space-y-3 sm:hidden">
                    {specRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No spec sections found.</p>
                    ) : (
                      specRows.map((row) => (
                        <div key={row.id} className="rounded-lg border p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-medium">{row.number}</span>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </div>
                          <p className="font-medium">{row.title}</p>
                          {row.division && (
                            <p className="text-sm text-muted-foreground">{row.division}</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditSpec(row)}
                          >
                            Edit
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section No.</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Division</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {specRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-muted-foreground">
                              No spec sections found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          specRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-sm">{row.number}</TableCell>
                              <TableCell className="font-medium">{row.title}</TableCell>
                              <TableCell>{row.division || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant(row.status)}>
                                  {row.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditSpec(row)}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
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
              <Label htmlFor="plan-title">Title</Label>
              <Input
                id="plan-title"
                value={planForm.title}
                onChange={(e) => setPlanForm((prev) => ({ ...prev, title: e.target.value }))}
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
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-revision">Revision</Label>
                <Input
                  id="plan-revision"
                  value={planForm.revision}
                  onChange={(e) =>
                    setPlanForm((prev) => ({ ...prev, revision: e.target.value }))
                  }
                  placeholder="e.g. Rev 3"
                />
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
            <Button onClick={savePlanSet} disabled={saving}>
              {saving ? "Saving..." : planEditing ? "Save Changes" : "Create Plan Set"}
            </Button>
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
              Define specification section number, title, and CSI division.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="spec-number">Section Number</Label>
                <Input
                  id="spec-number"
                  value={specForm.number}
                  onChange={(e) =>
                    setSpecForm((prev) => ({ ...prev, number: e.target.value }))
                  }
                  placeholder="e.g. 03 30 00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec-division">Division</Label>
                <Input
                  id="spec-division"
                  value={specForm.division}
                  onChange={(e) =>
                    setSpecForm((prev) => ({ ...prev, division: e.target.value }))
                  }
                  placeholder="e.g. Division 03 - Concrete"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spec-title">Title</Label>
              <Input
                id="spec-title"
                value={specForm.title}
                onChange={(e) => setSpecForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Cast-in-Place Concrete"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
            <Button onClick={saveSpecSection} disabled={saving}>
              {saving ? "Saving..." : specEditing ? "Save Changes" : "Create Spec Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
