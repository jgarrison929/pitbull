"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { ApiError, uploadFiles } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import { useOnlineStatus } from "@/lib/use-online-status";
import { enqueueDailyReportForSync, type OfflineDailyReport } from "@/lib/offline-store";
import { requestBackgroundSync } from "@/components/service-worker-register";
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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { LoadingButton } from "@/components/ui/loading-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useListPageShortcuts } from "@/hooks/use-page-shortcuts";
import { Plus, Pencil, Trash2, FileText, CheckCircle, Sparkles, Send, Paperclip, Camera, Download, ImageIcon } from "lucide-react";
import { OfflineIndicator } from "@/components/time-tracking/offline-indicator";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { getDownloadUrl } from "@/lib/api";

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

interface FileAttachmentInfo {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

interface DataMap {
  [key: string]: unknown;
}

interface ReportRow {
  id: string;
  title: string;
  reportDate: string;
  reportType: string;
  weatherSummary: string;
  temperatureLow: string;
  temperatureHigh: string;
  workNarrative: string;
  status: string;
  createdAt: string;
  attachmentCount: number;
}

interface CrewEntry {
  trade: string;
  count: number;
}

interface EquipmentEntry {
  name: string;
  status: string;
}

interface VisitorEntry {
  name: string;
  company: string;
  purpose: string;
}

interface ReportFormState {
  id?: string;
  title: string;
  reportDate: string;
  reportType: string;
  weatherSummary: string;
  temperatureLow: string;
  temperatureHigh: string;
  precipitation: string;
  wind: string;
  workNarrative: string;
  delaysNarrative: string;
  safetyNarrative: string;
  crewEntries: CrewEntry[];
  equipment: EquipmentEntry[];
  visitors: VisitorEntry[];
  status: string;
}

// DailyReportStatus enum: Draft, Submitted, Approved, Locked
const STATUSES = ["Draft", "Submitted", "Approved", "Locked"];

// DailyReportType enum: Foreman, ProjectManager
const REPORT_TYPES = ["Foreman", "ProjectManager"];
const REPORT_TYPE_LABELS: Record<string, string> = {
  Foreman: "Foreman",
  ProjectManager: "Project Manager",
};

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asDecimalString(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value !== "") return value;
  return "";
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

function weatherIcon(summary: string): string {
  const s = summary.toLowerCase();
  if (s.includes("rain") || s.includes("shower")) return "🌧";
  if (s.includes("snow") || s.includes("sleet")) return "🌨";
  if (s.includes("cloud") || s.includes("overcast")) return "☁";
  if (s.includes("fog") || s.includes("mist")) return "🌫";
  if (s.includes("storm") || s.includes("thunder")) return "⛈";
  if (s.includes("wind")) return "💨";
  if (s.includes("clear") || s.includes("sunny")) return "☀";
  if (s.includes("partly") || s.includes("partial")) return "⛅";
  return "🌤";
}

function parseArray<T>(data: DataMap, key: string, fallbackKey: string, parser: (item: unknown) => T): T[] {
  const raw = data[key] ?? data[fallbackKey];
  if (!Array.isArray(raw)) return [];
  return raw.map(parser);
}

function parseCrewEntries(data: DataMap): CrewEntry[] {
  return parseArray(data, "CrewEntries", "crewEntries", (item) => {
    const d = item as Record<string, unknown>;
    return {
      trade: asString(d.trade ?? d.Trade),
      count: typeof (d.count ?? d.Count) === "number" ? (d.count ?? d.Count) as number : 0,
    };
  });
}

function parseEquipment(data: DataMap): EquipmentEntry[] {
  return parseArray(data, "Equipment", "equipment", (item) => {
    const d = item as Record<string, unknown>;
    return {
      name: asString(d.name ?? d.Name),
      status: asString(d.status ?? d.Status) || "On-site",
    };
  });
}

function parseVisitors(data: DataMap): VisitorEntry[] {
  return parseArray(data, "Visitors", "visitors", (item) => {
    const d = item as Record<string, unknown>;
    return {
      name: asString(d.name ?? d.Name),
      company: asString(d.company ?? d.Company),
      purpose: asString(d.purpose ?? d.Purpose),
    };
  });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "Approved":
    case "Locked":
      return "default";
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

export default function DailyReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);

  const { isOnline, refreshPendingCount } = useOnlineStatus();

  const [reports, setReports] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const searchInputRef = useRef<HTMLInputElement>(null);
  useListPageShortcuts({ searchInputRef });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ReportFormState>({
    title: "",
    reportDate: "",
    reportType: "Foreman",
    weatherSummary: "",
    temperatureLow: "",
    temperatureHigh: "",
    precipitation: "",
    wind: "",
    workNarrative: "",
    delaysNarrative: "",
    safetyNarrative: "",
    status: "Draft",
    crewEntries: [],
    equipment: [],
    visitors: [],
  });

  const [formAttachments, setFormAttachments] = useState<FileItem[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<FileAttachmentInfo[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReportRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ model: string; provider: string; latencyMs: number } | null>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryReportId, setGalleryReportId] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<FileAttachmentInfo[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(
        `/api/projects/${projectId}/daily-reports?page=1&pageSize=500`
      );
      const items = result.items ?? [];
      setReports(items);

      // Fetch attachment counts for each report
      const counts: Record<string, number> = {};
      await Promise.all(
        items.map(async (report) => {
          try {
            const files = await api<FileAttachmentInfo[]>(
              `/api/files?entityType=DailyReport&entityId=${report.id}`
            );
            counts[report.id] = files.length;
          } catch {
            counts[report.id] = 0;
          }
        })
      );
      setAttachmentCounts(counts);
    } catch (error) {
      toast.error("Failed to load daily reports", {
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
    const mapped = reports.map<ReportRow>((report) => {
      const data = asDataMap(report.data);
      return {
        id: report.id,
        title: report.title || "Untitled report",
        reportDate: asString(data.ReportDate ?? data.reportDate) || report.createdAt,
        reportType: asString(data.ReportType ?? data.reportType) || "Foreman",
        weatherSummary: asString(data.WeatherSummary ?? data.weatherSummary),
        temperatureLow: asDecimalString(data.TemperatureLow ?? data.temperatureLow),
        temperatureHigh: asDecimalString(data.TemperatureHigh ?? data.temperatureHigh),
        workNarrative: asString(data.WorkNarrative ?? data.workNarrative),
        status: report.status || "Draft",
        createdAt: report.createdAt,
        attachmentCount: attachmentCounts[report.id] ?? 0,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q) ||
        row.weatherSummary.toLowerCase().includes(q) ||
        row.workNarrative.toLowerCase().includes(q)
      );
    });
  }, [reports, search, statusFilter, attachmentCounts]);

  const approvedCount = rows.filter((r) => r.status === "Approved" || r.status === "Locked").length;
  const draftCount = rows.filter((r) => r.status === "Draft").length;

  function openCreate() {
    setEditing(false);
    setForm({
      title: "",
      reportDate: new Date().toISOString().slice(0, 10),
      reportType: "Foreman",
      weatherSummary: "",
      temperatureLow: "",
      temperatureHigh: "",
      precipitation: "",
      wind: "",
      workNarrative: "",
      delaysNarrative: "",
      safetyNarrative: "",
      crewEntries: [],
      equipment: [],
      visitors: [],
      status: "Draft",
    });
    setFormAttachments([]);
    setExistingAttachments([]);
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
      reportType: row.reportType,
      weatherSummary: row.weatherSummary,
      temperatureLow: row.temperatureLow,
      temperatureHigh: row.temperatureHigh,
      precipitation: asString(data.Precipitation ?? data.precipitation),
      wind: asString(data.Wind ?? data.wind),
      workNarrative: row.workNarrative,
      delaysNarrative: asString(data.DelaysNarrative ?? data.delaysNarrative),
      safetyNarrative: asString(data.SafetyNarrative ?? data.safetyNarrative),
      crewEntries: parseCrewEntries(data),
      equipment: parseEquipment(data),
      visitors: parseVisitors(data),
      status: row.status,
    });
    setFormAttachments([]);

    // Load existing attachments for this report
    api<FileAttachmentInfo[]>(`/api/files?entityType=DailyReport&entityId=${row.id}`)
      .then(setExistingAttachments)
      .catch(() => setExistingAttachments([]));

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
        ReportType: form.reportType,
        WeatherSummary: form.weatherSummary || null,
        TemperatureLow: form.temperatureLow ? Number(form.temperatureLow) : null,
        TemperatureHigh: form.temperatureHigh ? Number(form.temperatureHigh) : null,
        Precipitation: form.precipitation || null,
        Wind: form.wind || null,
        WorkNarrative: form.workNarrative || null,
        DelaysNarrative: form.delaysNarrative || null,
        SafetyNarrative: form.safetyNarrative || null,
        CrewEntries: form.crewEntries.length > 0 ? form.crewEntries.filter(c => c.trade) : null,
        Equipment: form.equipment.length > 0 ? form.equipment.filter(e => e.name) : null,
        Visitors: form.visitors.length > 0 ? form.visitors.filter(v => v.name) : null,
      },
    };

    setSaving(true);
    try {
      // Offline: queue for sync (new reports only, edits require connectivity)
      if (!isOnline && !editing) {
        const offlineReport: OfflineDailyReport = {
          id: crypto.randomUUID(),
          projectId,
          title,
          reportDate: form.reportDate,
          reportType: form.reportType,
          weatherSummary: form.weatherSummary || undefined,
          temperatureLow: form.temperatureLow || undefined,
          temperatureHigh: form.temperatureHigh || undefined,
          precipitation: form.precipitation || undefined,
          wind: form.wind || undefined,
          workNarrative: form.workNarrative || undefined,
          delaysNarrative: form.delaysNarrative || undefined,
          safetyNarrative: form.safetyNarrative || undefined,
          crewEntries: form.crewEntries.filter(c => c.trade).length > 0
            ? form.crewEntries.filter(c => c.trade) : undefined,
          equipment: form.equipment.filter(e => e.name).length > 0
            ? form.equipment.filter(e => e.name) : undefined,
          visitors: form.visitors.filter(v => v.name).length > 0
            ? form.visitors.filter(v => v.name) : undefined,
          status: form.status,
          createdAt: new Date().toISOString(),
        };
        await enqueueDailyReportForSync(offlineReport);
        requestBackgroundSync();
        await refreshPendingCount();

        const realFiles = formAttachments.map((f) => f.file).filter((f): f is File => f !== undefined);
        if (realFiles.length > 0) {
          toast.info("Report saved offline. Attachments will be uploaded when online.");
        } else {
          toast.success("Report saved offline — will sync when connection returns");
        }

        setDialogOpen(false);
        return;
      }

      let savedId: string;

      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/daily-reports/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        savedId = form.id;
        toast.success("Daily report updated");
      } else {
        const created = await api<PmEntityDto>(`/api/projects/${projectId}/daily-reports`, {
          method: "POST",
          body: payload,
        });
        savedId = created.id;
        toast.success("Daily report created");
      }

      // Upload pending attachments
      const realFiles = formAttachments.map((f) => f.file).filter((f): f is File => f !== undefined);
      if (realFiles.length > 0) {
        try {
          const endpoint = realFiles.length === 1 ? "/api/files/upload" : "/api/files/upload-multiple";
          await uploadFiles(endpoint, realFiles, {
            relatedEntityType: "DailyReport",
            relatedEntityId: savedId,
          });
          toast.success(`${realFiles.length} attachment(s) uploaded`);
        } catch {
          toast.error("Report saved but file upload failed");
        }
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

  async function submitReport(id: string) {
    setSaving(true);
    try {
      await api<unknown>(`/api/projects/${projectId}/daily-reports/${id}/submit`, {
        method: "POST",
      });
      toast.success("Report submitted");
      await load();
    } catch (error) {
      toast.error("Failed to submit report", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function approveReport(id: string) {
    setSaving(true);
    try {
      await api<unknown>(`/api/projects/${projectId}/daily-reports/${id}/approve`, {
        method: "POST",
      });
      toast.success("Report approved");
      await load();
    } catch (error) {
      toast.error("Failed to approve report", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport() {
    if (!pendingDelete) return;

    setIsDeleting(true);
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
      setIsDeleting(false);
    }
  }

  async function openGallery(reportId: string) {
    setGalleryReportId(reportId);
    setGalleryPhotos([]);
    setGalleryLoading(true);
    setGalleryOpen(true);
    try {
      const files = await api<FileAttachmentInfo[]>(
        `/api/files?entityType=DailyReport&entityId=${reportId}`
      );
      setGalleryPhotos(files.filter((f) => f.contentType.startsWith("image/")));
    } catch {
      setGalleryPhotos([]);
    } finally {
      setGalleryLoading(false);
    }
  }

  async function requestAiSummary(reportId: string) {
    setAiSummary("");
    setAiMeta(null);
    setAiLoading(true);
    setAiSummaryOpen(true);
    try {
      const result = await api<{
        summary: string;
        model: string;
        provider: string;
        latencyMs: number;
      }>(`/api/ai/projects/${projectId}/daily-reports/${reportId}/summary`, {
        method: "POST",
      });
      setAiSummary(result.summary);
      setAiMeta({ model: result.model, provider: result.provider, latencyMs: result.latencyMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI service unavailable";
      setAiSummary(`Error: ${message}`);
      toast.error("AI summary failed", { description: message });
    } finally {
      setAiLoading(false);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <ErrorBoundary label="daily reports">
      <div className="space-y-6">
        <OfflineIndicator />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Reports</h1>
            <p className="text-muted-foreground">
              Field reports, weather conditions, work narratives, and safety logs.
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approvedCount}</div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Drafts</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground">awaiting submission</p>
            </CardContent>
          </Card>
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
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, weather, or work narrative"
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
              <>
                <div className="hidden sm:block">
                  <TableSkeleton headers={["Date", "Title", "Type", "Weather", "Temp", "Work Summary", "Status", ""]} rows={5} />
                </div>
                <div className="sm:hidden">
                  <CardListSkeleton rows={4} />
                </div>
              </>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-3 sm:hidden">
                  {rows.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No daily reports yet. Create your first report for this project.
                      </p>
                      <Button
                        className="mt-3 bg-amber-500 hover:bg-amber-600 text-white min-h-[44px]"
                        size="sm"
                        onClick={openCreate}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Report
                      </Button>
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
                          <span>{REPORT_TYPE_LABELS[row.reportType] ?? row.reportType}</span>
                          {row.weatherSummary && <span>{weatherIcon(row.weatherSummary)} {row.weatherSummary}</span>}
                          {(row.temperatureLow || row.temperatureHigh) && (
                            <span>{row.temperatureLow || "?"}&deg;-{row.temperatureHigh || "?"}&deg;F</span>
                          )}
                          {row.attachmentCount > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Paperclip className="h-3 w-3" />
                              {row.attachmentCount}
                            </span>
                          )}
                        </div>
                        {row.workNarrative && (
                          <p className="text-sm line-clamp-2">{row.workNarrative}</p>
                        )}
                        <div className="flex gap-1 pt-1">
                          {row.status === "Draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(row)}
                                title="Edit report"
                                aria-label="Edit report"
                                className="min-h-[44px] min-w-[44px]"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => submitReport(row.id)}
                                title="Submit report"
                                aria-label="Submit report"
                                className="min-h-[44px] min-w-[44px]"
                                disabled={saving}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setPendingDelete(row);
                                  setDeleteOpen(true);
                                }}
                                title="Delete report"
                                aria-label="Delete report"
                                className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {row.status === "Submitted" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => approveReport(row.id)}
                              title="Approve report"
                              aria-label="Approve report"
                              className="min-h-[44px] min-w-[44px]"
                              disabled={saving}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {row.attachmentCount > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openGallery(row.id)}
                              title="View Photos"
                              aria-label="View Photos"
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestAiSummary(row.id)}
                            title="AI Summary"
                            aria-label="AI Summary"
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Sparkles className="h-4 w-4" />
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
                        <TableHead>Type</TableHead>
                        <TableHead>Weather</TableHead>
                        <TableHead>Temp</TableHead>
                        <TableHead>Work Summary</TableHead>
                        <TableHead className="w-[50px]"><Paperclip className="h-3.5 w-3.5 text-muted-foreground" /></TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[180px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9}>
                            <div className="flex flex-col items-center gap-3 py-6 text-center">
                              <p className="text-sm text-muted-foreground">
                                No daily reports yet. Create your first report for this project.
                              </p>
                              <Button
                                size="sm"
                                onClick={openCreate}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Create Report
                              </Button>
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
                            <TableCell>{REPORT_TYPE_LABELS[row.reportType] ?? row.reportType}</TableCell>
                            <TableCell>
                              {row.weatherSummary ? (
                                <span className="flex items-center gap-1">
                                  <span>{weatherIcon(row.weatherSummary)}</span>
                                  <span>{row.weatherSummary}</span>
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.temperatureLow || row.temperatureHigh
                                ? `${row.temperatureLow || "?"}-${row.temperatureHigh || "?"}`
                                : "-"}
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate">
                              {row.workNarrative || "-"}
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {row.attachmentCount > 0 ? row.attachmentCount : ""}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {row.status === "Draft" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdit(row)}
                                      title="Edit report"
                                      aria-label="Edit report"
                                      className="min-h-[44px] min-w-[44px]"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => submitReport(row.id)}
                                      title="Submit report"
                                      aria-label="Submit report"
                                      className="min-h-[44px] min-w-[44px]"
                                      disabled={saving}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setPendingDelete(row);
                                        setDeleteOpen(true);
                                      }}
                                      title="Delete report"
                                      aria-label="Delete report"
                                      className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {row.status === "Submitted" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => approveReport(row.id)}
                                    title="Approve report"
                                    aria-label="Approve report"
                                    className="min-h-[44px] min-w-[44px]"
                                    disabled={saving}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => requestAiSummary(row.id)}
                                  title="AI Summary"
                                  aria-label="AI Summary"
                                  className="min-h-[44px] min-w-[44px]"
                                >
                                  <Sparkles className="h-4 w-4" />
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
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Daily Report" : "New Daily Report"}</DialogTitle>
              <DialogDescription>
                Record field conditions, weather, work performed, delays, and safety observations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="report-date">
                    Report Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="report-date"
                    type="date"
                    value={form.reportDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, reportDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select
                    value={form.reportType}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, reportType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          {REPORT_TYPE_LABELS[rt] ?? rt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-weather">Weather Summary</Label>
                  <Input
                    id="report-weather"
                    value={form.weatherSummary}
                    onChange={(e) => setForm((prev) => ({ ...prev, weatherSummary: e.target.value }))}
                    placeholder="e.g. Clear and sunny"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="report-temp-low">Temp Low</Label>
                    <Input
                      id="report-temp-low"
                      type="number"
                      value={form.temperatureLow}
                      onChange={(e) => setForm((prev) => ({ ...prev, temperatureLow: e.target.value }))}
                      placeholder="°F"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-temp-high">Temp High</Label>
                    <Input
                      id="report-temp-high"
                      type="number"
                      value={form.temperatureHigh}
                      onChange={(e) => setForm((prev) => ({ ...prev, temperatureHigh: e.target.value }))}
                      placeholder="°F"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-precipitation">Precipitation</Label>
                  <Input
                    id="report-precipitation"
                    value={form.precipitation}
                    onChange={(e) => setForm((prev) => ({ ...prev, precipitation: e.target.value }))}
                    placeholder="e.g. None, Light rain"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-wind">Wind</Label>
                  <Input
                    id="report-wind"
                    value={form.wind}
                    onChange={(e) => setForm((prev) => ({ ...prev, wind: e.target.value }))}
                    placeholder="e.g. Calm, 10-15 mph NW"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-work">Work Narrative</Label>
                <Textarea
                  id="report-work"
                  value={form.workNarrative}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, workNarrative: e.target.value }))
                  }
                  placeholder="Describe work performed today"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-delays">Delays Narrative</Label>
                <Textarea
                  id="report-delays"
                  value={form.delaysNarrative}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, delaysNarrative: e.target.value }))
                  }
                  placeholder="Describe any delays encountered"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-safety">Safety Narrative</Label>
                <Textarea
                  id="report-safety"
                  value={form.safetyNarrative}
                  onChange={(e) => setForm((prev) => ({ ...prev, safetyNarrative: e.target.value }))}
                  placeholder="Safety observations, incidents, or toolbox talks"
                  rows={2}
                />
              </div>

              {/* Crew Entries */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Crew On-Site (by trade)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        crewEntries: [...prev.crewEntries, { trade: "", count: 0 }],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Trade
                  </Button>
                </div>
                {form.crewEntries.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                    <Input
                      value={entry.trade}
                      onChange={(e) => {
                        const updated = [...form.crewEntries];
                        updated[idx] = { ...updated[idx], trade: e.target.value };
                        setForm((prev) => ({ ...prev, crewEntries: updated }));
                      }}
                      placeholder="e.g. Electricians, Plumbers, Iron Workers"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={entry.count || ""}
                      onChange={(e) => {
                        const updated = [...form.crewEntries];
                        updated[idx] = { ...updated[idx], count: Number(e.target.value) || 0 };
                        setForm((prev) => ({ ...prev, crewEntries: updated }));
                      }}
                      placeholder="Count"
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          crewEntries: prev.crewEntries.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {form.crewEntries.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: {form.crewEntries.reduce((sum, e) => sum + e.count, 0)} workers
                  </p>
                )}
              </div>

              {/* Equipment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Equipment On-Site</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        equipment: [...prev.equipment, { name: "", status: "On-site" }],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Equipment
                  </Button>
                </div>
                {form.equipment.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                    <Input
                      value={entry.name}
                      onChange={(e) => {
                        const updated = [...form.equipment];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setForm((prev) => ({ ...prev, equipment: updated }));
                      }}
                      placeholder="e.g. Crane, Excavator, Concrete Pump"
                      className="h-8 text-sm"
                    />
                    <Select
                      value={entry.status}
                      onValueChange={(value) => {
                        const updated = [...form.equipment];
                        updated[idx] = { ...updated[idx], status: value };
                        setForm((prev) => ({ ...prev, equipment: updated }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="On-site">On-site</SelectItem>
                        <SelectItem value="In Use">In Use</SelectItem>
                        <SelectItem value="Idle">Idle</SelectItem>
                        <SelectItem value="Down">Down</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          equipment: prev.equipment.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Visitors */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Visitor Log</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        visitors: [...prev.visitors, { name: "", company: "", purpose: "" }],
                      }))
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Visitor
                  </Button>
                </div>
                {form.visitors.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                    <Input
                      value={entry.name}
                      onChange={(e) => {
                        const updated = [...form.visitors];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setForm((prev) => ({ ...prev, visitors: updated }));
                      }}
                      placeholder="Visitor name"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={entry.company}
                      onChange={(e) => {
                        const updated = [...form.visitors];
                        updated[idx] = { ...updated[idx], company: e.target.value };
                        setForm((prev) => ({ ...prev, visitors: updated }));
                      }}
                      placeholder="Company"
                      className="h-8 text-sm"
                    />
                    <Input
                      value={entry.purpose}
                      onChange={(e) => {
                        const updated = [...form.visitors];
                        updated[idx] = { ...updated[idx], purpose: e.target.value };
                        setForm((prev) => ({ ...prev, visitors: updated }));
                      }}
                      placeholder="Purpose"
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          visitors: prev.visitors.filter((_, i) => i !== idx),
                        }));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
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

              <div className="space-y-2">
                <Label>Attachments</Label>
                {existingAttachments.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {existingAttachments.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-sm rounded border px-2 py-1">
                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 truncate">{f.fileName}</span>
                      </div>
                    ))}
                  </div>
                )}
                <FileDropZone
                  files={formAttachments}
                  onFilesChange={setFormAttachments}
                  maxSizeMB={10}
                  maxFiles={10}
                  disabled={saving}
                  enableCamera
                  placeholder="Drop photos, PDFs, or documents here"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <LoadingButton
                onClick={saveReport}
                loading={saving}
                loadingText="Saving..."
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {editing ? "Save Changes" : "Create Report"}
              </LoadingButton>
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
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <LoadingButton
                variant="destructive"
                onClick={deleteReport}
                loading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Summary Dialog */}
        <Dialog open={aiSummaryOpen} onOpenChange={setAiSummaryOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>AI Daily Report Summary</DialogTitle>
              <DialogDescription>
                AI-generated summary of the daily report content.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">Generating summary...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{aiSummary}</div>
                  {aiMeta && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      {aiMeta.provider} / {aiMeta.model} &middot; {aiMeta.latencyMs}ms
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiSummaryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Photo Gallery Dialog */}
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-500" />
                Report Photos
              </DialogTitle>
              <DialogDescription>
                {galleryPhotos.length} photo(s) attached to this report.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {galleryLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : galleryPhotos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No photos attached to this report.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {galleryPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative group rounded-lg overflow-hidden border bg-muted aspect-square"
                    >
                      <img
                        src={getDownloadUrl(photo.id)}
                        alt={photo.fileName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-xs text-white truncate">{photo.fileName}</p>
                        <p className="text-xs text-white/70">
                          {(photo.fileSize / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <a
                        href={getDownloadUrl(photo.id)}
                        download={photo.fileName}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="secondary" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download {photo.fileName}</span>
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGalleryOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
