"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api, { ApiError } from "@/lib/api";
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

interface DataMap {
  [key: string]: unknown;
}

interface ReportRow {
  id: string;
  title: string;
  reportDate: string;
  weather: string;
  crewCount: number;
  workDescription: string;
  status: string;
  createdAt: string;
}

interface ReportFormState {
  id?: string;
  title: string;
  reportDate: string;
  weather: string;
  temperature: string;
  crewCount: string;
  workDescription: string;
  safetyNotes: string;
  status: string;
}

const STATUSES = ["Draft", "Submitted", "Approved"];

const WEATHER_OPTIONS = [
  "Clear",
  "Partly Cloudy",
  "Overcast",
  "Rain",
  "Snow",
  "Wind",
  "Fog",
  "Extreme Heat",
  "Extreme Cold",
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
    case "Approved":
      return "default";
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

export default function DailyReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [reports, setReports] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReportFormState>({
    title: "",
    reportDate: "",
    weather: "Clear",
    temperature: "",
    crewCount: "",
    workDescription: "",
    safetyNotes: "",
    status: "Draft",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReportRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/daily-reports?page=1&pageSize=500`
      );
      setReports(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load daily reports", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const mapped = reports.map<ReportRow>((report) => {
      const data = asDataMap(report.data);
      return {
        id: report.id,
        title: report.title || "Untitled report",
        reportDate: asString(data.ReportDate ?? data.reportDate) || report.createdAt,
        weather: asString(data.Weather ?? data.weather) || "-",
        crewCount: asNumber(data.CrewCount ?? data.crewCount),
        workDescription: asString(data.WorkDescription ?? data.workDescription),
        status: report.status || "Draft",
        createdAt: report.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.weather.toLowerCase().includes(q) ||
        row.workDescription.toLowerCase().includes(q)
      );
    });
  }, [reports, search, statusFilter]);

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      reportDate: new Date().toISOString().slice(0, 10),
      weather: "Clear",
      temperature: "",
      crewCount: "",
      workDescription: "",
      safetyNotes: "",
      status: "Draft",
    });
    setDialogOpen(true);
  }

  function openEdit(row: ReportRow) {
    setEditing(true);
    const source = reports.find((r) => r.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      title: row.title,
      reportDate: row.reportDate ? row.reportDate.slice(0, 10) : "",
      weather: row.weather !== "-" ? row.weather : "Clear",
      temperature: asString(data.Temperature ?? data.temperature),
      crewCount: row.crewCount ? String(row.crewCount) : "",
      workDescription: row.workDescription,
      safetyNotes: asString(data.SafetyNotes ?? data.safetyNotes),
      status: row.status,
    });
    setDialogOpen(true);
  }

  async function saveReport() {
    if (!form.reportDate) {
      toast.error("Report date is required");
      return;
    }

    const title = form.title.trim() || `Daily Report - ${form.reportDate}`;

    const payload: PmUpsertRequest = {
      title,
      status: form.status,
      data: {
        ReportDate: form.reportDate,
        Weather: form.weather,
        Temperature: form.temperature || null,
        CrewCount: form.crewCount ? Number.parseInt(form.crewCount, 10) : null,
        WorkDescription: form.workDescription || null,
        SafetyNotes: form.safetyNotes || null,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/daily-reports/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Daily report updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/daily-reports`, {
          method: "POST",
          body: payload,
        });
        toast.success("Daily report created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save daily report", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/daily-reports/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Daily report deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete endpoint is not available yet for daily reports"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete daily report", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Reports</h1>
          <p className="text-muted-foreground">
            Field reports, weather, crews, and safety logs.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Report</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Log</CardTitle>
          <CardDescription>
            Create, edit, and filter daily field reports for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, weather, or description"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading daily reports...</p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No daily reports yet. Create your first report for this project.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Report</Button>
                  </div>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{formatDate(row.reportDate)}</span>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{row.title}</p>
                      <div className="flex gap-4 text-sm">
                        <span>{row.weather}</span>
                        <span>{row.crewCount} crew</span>
                      </div>
                      {row.workDescription && (
                        <p className="text-sm line-clamp-2">{row.workDescription}</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPendingDelete(row);
                            setDeleteOpen(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Weather</TableHead>
                      <TableHead>Crew</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              No daily reports yet. Create your first report for this project.
                            </p>
                            <Button size="sm" onClick={openCreate}>Create Report</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(row.reportDate)}
                          </TableCell>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell>{row.weather}</TableCell>
                          <TableCell>{row.crewCount || "-"}</TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {row.workDescription || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPendingDelete(row);
                                  setDeleteOpen(true);
                                }}
                              >
                                Delete
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Daily Report" : "New Daily Report"}</DialogTitle>
            <DialogDescription>
              Record field conditions, crew headcount, work performed, and safety observations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-date">Report Date</Label>
                <Input
                  id="report-date"
                  type="date"
                  value={form.reportDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, reportDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-title">Title (optional)</Label>
                <Input
                  id="report-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder={`Daily Report - ${form.reportDate || "date"}`}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Weather</Label>
                <Select
                  value={form.weather}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, weather: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-temp">Temperature</Label>
                <Input
                  id="report-temp"
                  value={form.temperature}
                  onChange={(e) => setForm((prev) => ({ ...prev, temperature: e.target.value }))}
                  placeholder="e.g. 72°F"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-crew">Crew Count</Label>
                <Input
                  id="report-crew"
                  type="number"
                  min="0"
                  value={form.crewCount}
                  onChange={(e) => setForm((prev) => ({ ...prev, crewCount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-work">Work Description</Label>
              <Textarea
                id="report-work"
                value={form.workDescription}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, workDescription: e.target.value }))
                }
                placeholder="Describe work performed today"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-safety">Safety Notes</Label>
              <Textarea
                id="report-safety"
                value={form.safetyNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, safetyNotes: e.target.value }))}
                placeholder="Safety observations, incidents, or toolbox talks"
                rows={2}
              />
            </div>

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
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveReport} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Daily Report</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.title ?? "this report"}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteReport} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
