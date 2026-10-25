"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  FileSpreadsheet,
  Building2,
  Users,
  Loader2,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  entityTypes: EntityTypeInfo[];
}

interface EntityTypeInfo {
  id: string;
  label: string;
  hasDateRange: boolean;
  hasProjectFilter: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "quickbooks-desktop",
    name: "QuickBooks Desktop",
    description: "IIF format for desktop import",
    icon: <Building2 className="h-6 w-6" />,
    entityTypes: [
      { id: "chart-of-accounts", label: "Chart of Accounts", hasDateRange: false, hasProjectFilter: false },
      { id: "journal-entries", label: "Journal Entries", hasDateRange: true, hasProjectFilter: false },
      { id: "vendors", label: "Vendors", hasDateRange: false, hasProjectFilter: false },
      { id: "customers", label: "Customers", hasDateRange: false, hasProjectFilter: false },
      { id: "employees", label: "Employees", hasDateRange: false, hasProjectFilter: false },
      { id: "time-entries", label: "Time Entries", hasDateRange: true, hasProjectFilter: true },
    ],
  },
  {
    id: "quickbooks-online",
    name: "QuickBooks Online",
    description: "CSV format for online import",
    icon: <FileSpreadsheet className="h-6 w-6" />,
    entityTypes: [
      { id: "chart-of-accounts", label: "Chart of Accounts", hasDateRange: false, hasProjectFilter: false },
      { id: "journal-entries", label: "Journal Entries", hasDateRange: true, hasProjectFilter: false },
      { id: "vendors", label: "Vendors", hasDateRange: false, hasProjectFilter: false },
      { id: "customers", label: "Customers", hasDateRange: false, hasProjectFilter: false },
    ],
  },
  {
    id: "adp",
    name: "ADP Payroll",
    description: "CSV format for ADP payroll import",
    icon: <Users className="h-6 w-6" />,
    entityTypes: [
      { id: "employees", label: "Employees", hasDateRange: false, hasProjectFilter: false },
      { id: "time-entries", label: "Time Entries", hasDateRange: true, hasProjectFilter: true },
      { id: "payroll-runs", label: "Payroll Runs", hasDateRange: true, hasProjectFilter: false },
    ],
  },
  {
    id: "generic-csv",
    name: "Generic CSV",
    description: "Standard CSV for any system",
    icon: <FileSpreadsheet className="h-6 w-6" />,
    entityTypes: [
      { id: "chart-of-accounts", label: "Chart of Accounts", hasDateRange: false, hasProjectFilter: false },
      { id: "journal-entries", label: "Journal Entries", hasDateRange: true, hasProjectFilter: false },
      { id: "employees", label: "Employees", hasDateRange: false, hasProjectFilter: false },
      { id: "time-entries", label: "Time Entries", hasDateRange: true, hasProjectFilter: true },
      { id: "payroll-runs", label: "Payroll Runs", hasDateRange: true, hasProjectFilter: false },
      { id: "vendors", label: "Vendors", hasDateRange: false, hasProjectFilter: false },
      { id: "customers", label: "Customers", hasDateRange: false, hasProjectFilter: false },
    ],
  },
];

interface ProjectOption {
  id: string;
  name: string;
  number: string;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await api<{ items: ProjectOption[] }>("/api/projects?pageSize=200");
        setProjects(data.items || []);
      } catch {
        // Projects may not be available
      }
    }
    if (isAdmin) loadProjects();
  }, [isAdmin]);

  const activeFormat = EXPORT_FORMATS.find((f) => f.id === selectedFormat);
  const activeEntity = activeFormat?.entityTypes.find((e) => e.id === selectedEntity);

  const handleFormatSelect = useCallback((formatId: string) => {
    setSelectedFormat(formatId);
    setSelectedEntity(null);
    setExportResult(null);
  }, []);

  const handleEntitySelect = useCallback((entityId: string) => {
    setSelectedEntity(entityId);
    setExportResult(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (!selectedFormat || !selectedEntity) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      const params = new URLSearchParams();
      params.set("format", selectedFormat);
      params.set("entityType", selectedEntity);

      if (activeEntity?.hasDateRange) {
        params.set("from", fromDate);
        params.set("to", toDate);
      }

      if (activeEntity?.hasProjectFilter && projectId) {
        params.set("projectId", projectId);
      }

      const token = getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/integrations/export?${params.toString()}`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error || `Export failed with status ${response.status}`
        );
      }

      const blob = await response.blob();
      const contentDisposition =
        response.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(
        /filename="?([^\";]+)"?/i
      );
      const fileName =
        fileNameMatch?.[1] ||
        `${selectedEntity}-${selectedFormat}-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // Read row count from response header if available
      const rowCount = response.headers.get("x-export-row-count");
      const formatLabel = activeFormat?.name || selectedFormat;
      const summary = rowCount
        ? `Exported ${rowCount} rows as ${formatLabel}`
        : `Export downloaded as ${formatLabel}`;
      setExportResult(summary);
      toast.success("Export downloaded");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to export";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }, [selectedFormat, selectedEntity, activeEntity, activeFormat, fromDate, toDate, projectId]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Data Integration
        </h1>
        <p className="text-muted-foreground">
          Export data to accounting and payroll systems
        </p>
      </div>

      {/* Step 1: Target System */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium">
            Step 1
          </Badge>
          <span className="text-sm font-medium">Select Target System</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {EXPORT_FORMATS.map((format) => (
            <Card
              key={format.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                selectedFormat === format.id
                  ? "ring-2 ring-amber-500 border-amber-500"
                  : "hover:border-muted-foreground/30"
              )}
              onClick={() => handleFormatSelect(format.id)}
            >
              <CardContent className="pt-6 pb-4 px-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "rounded-lg p-2",
                      selectedFormat === format.id
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {format.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{format.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Step 2: Entity Type */}
      {activeFormat && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium">
              Step 2
            </Badge>
            <span className="text-sm font-medium">Select Data Type</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeFormat.entityTypes.map((entity) => (
              <Card
                key={entity.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-sm",
                  selectedEntity === entity.id
                    ? "ring-2 ring-amber-500 border-amber-500"
                    : "hover:border-muted-foreground/30"
                )}
                onClick={() => handleEntitySelect(entity.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {entity.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-colors",
                        selectedEntity === entity.id
                          ? "text-amber-500"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Options & Export */}
      {activeEntity && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-medium">
                Step 3
              </Badge>
              <CardTitle className="text-base">Export Options</CardTitle>
            </div>
            <CardDescription>
              Configure filters for your {activeEntity.label.toLowerCase()}{" "}
              export
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeEntity.hasDateRange && (
                <>
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {activeEntity.hasProjectFilter && (
                <div className="space-y-2">
                  <Label>Project (Optional)</Label>
                  <Select
                    value={projectId}
                    onValueChange={setProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Projects</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.number} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!activeEntity.hasDateRange && !activeEntity.hasProjectFilter && (
              <p className="text-sm text-muted-foreground">
                No additional options required. Click Export to download.
              </p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Export
                  </>
                )}
              </Button>

              {exportResult && (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{exportResult}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
