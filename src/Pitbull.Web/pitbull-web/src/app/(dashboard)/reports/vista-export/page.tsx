"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Download,
  FileSpreadsheet,
  Users,
  Building2,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

interface ExportMetadata {
  fileName: string;
  rowCount: number;
  totalHours: number;
  startDate: string;
  endDate: string;
  employeeCount: number;
  projectCount: number;
}

interface Project {
  id: string;
  name: string;
  number: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getDatePresets() {
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - today.getDay() + 1);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const yearStart = new Date(today.getFullYear(), 0, 1);

  return {
    thisWeek: { start: thisMonday, end: today },
    lastWeek: { start: lastMonday, end: lastSunday },
    thisMonth: { start: thisMonthStart, end: today },
    lastMonth: { start: lastMonthStart, end: lastMonthEnd },
    ytd: { start: yearStart, end: today },
  };
}

export default function VistaExportPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(ALL_VALUE);
  const [startDate, setStartDate] = useState<string>(() => {
    const presets = getDatePresets();
    return formatDate(presets.lastWeek.start);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const presets = getDatePresets();
    return formatDate(presets.lastWeek.end);
  });
  const [metadata, setMetadata] = useState<ExportMetadata | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects
  useEffect(() => {
    api
      .get<{ items: Project[] }>("/api/projects?page=1&pageSize=100")
      .then((res) => setProjects(res.data?.items || []))
      .catch(() => toast.error("Failed to load projects"));
  }, []);

  const applyPreset = useCallback((preset: keyof ReturnType<typeof getDatePresets>) => {
    const presets = getDatePresets();
    const { start, end } = presets[preset];
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
    setMetadata(null);
    setError(null);
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    setMetadata(null);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (selectedProject !== ALL_VALUE) {
        params.append("projectId", selectedProject);
      }

      const res = await api.get<ExportMetadata>(
        `/api/time-entries/export/vista?${params.toString()}`,
        {
          headers: { Accept: "application/json" },
        }
      );
      setMetadata(res.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            "Failed to generate preview";
      setError(message);
      toast.error("Preview failed", { description: message });
    } finally {
      setIsPreviewLoading(false);
    }
  }, [startDate, endDate, selectedProject]);

  const downloadCsv = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error("Please select date range first");
      return;
    }

    setIsDownloading(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (selectedProject !== ALL_VALUE) {
        params.append("projectId", selectedProject);
      }

      const res = await api.get(`/api/time-entries/export/vista?${params.toString()}`, {
        responseType: "blob",
      });

      // Create download link
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Get filename from metadata or generate one
      const fileName = metadata?.fileName || `vista-timesheet-${startDate}-${endDate}.csv`;
      link.setAttribute("download", fileName);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded", {
        description: `${metadata?.rowCount || 0} time entries exported`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            "Failed to download export";
      toast.error("Download failed", { description: message });
    } finally {
      setIsDownloading(false);
    }
  }, [startDate, endDate, selectedProject, metadata]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Vista Export</h1>
        </div>
        <p className="text-muted-foreground">
          Export approved time entries in Vista/Viewpoint compatible CSV format for payroll import.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Settings</CardTitle>
          <CardDescription>
            Select date range and project filter. Only approved time entries are included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Presets */}
          <div>
            <Label className="text-sm font-medium">Quick Select</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset("thisWeek")}>
                This Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("lastWeek")}>
                Last Week
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("thisMonth")}>
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("lastMonth")}>
                Last Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("ytd")}>
                Year to Date
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setMetadata(null);
                }}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setMetadata(null);
                }}
              />
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={selectedProject}
                onValueChange={(val) => {
                  setSelectedProject(val);
                  setMetadata(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={fetchPreview}
              disabled={isPreviewLoading || !startDate || !endDate}
            >
              {isPreviewLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Preview Results */}
      {metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Export Preview
            </CardTitle>
            <CardDescription>
              Review the export details before downloading.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{metadata.rowCount}</p>
                  <p className="text-xs text-muted-foreground">Time Entries</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{metadata.totalHours.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{metadata.employeeCount}</p>
                  <p className="text-xs text-muted-foreground">Employees</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                <Building2 className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{metadata.projectCount}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </div>

            {/* Date Range & Filename */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {metadata.startDate} to {metadata.endDate}
                </span>
              </div>
              <Badge variant="outline">{metadata.fileName}</Badge>
            </div>

            {/* Empty State */}
            {metadata.rowCount === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Data</AlertTitle>
                <AlertDescription>
                  No approved time entries found for the selected date range and filters.
                  Try adjusting your selection.
                </AlertDescription>
              </Alert>
            )}

            {/* Download Button */}
            {metadata.rowCount > 0 && (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={downloadCsv}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vista Import Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Select Date Range:</strong> Choose the pay period dates for the timesheet export.
              Only approved time entries will be included.
            </li>
            <li>
              <strong>Preview:</strong> Click Preview to see how many entries will be exported.
              Review the employee and project counts to ensure accuracy.
            </li>
            <li>
              <strong>Download CSV:</strong> Download the file and save it to your computer.
            </li>
            <li>
              <strong>Import to Vista:</strong> In Vista, go to Payroll → Import → Timesheet Import.
              Select the CSV file and follow the import wizard.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-4">
            The export includes: Employee Number, Name, Work Date, Project Number, Cost Code,
            Regular/OT/DT Hours, Hourly Rate, Amounts, and Approval Status.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
