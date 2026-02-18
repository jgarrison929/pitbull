"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/auth";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Download, Upload, History, FileUp, CheckCircle2 } from "lucide-react";
import { TableSkeleton } from "@/components/skeletons";

const IMPORT_TYPES = [
  { value: "employees", label: "Employees" },
  { value: "projects", label: "Projects" },
  { value: "cost-codes", label: "Cost Codes" },
  { value: "equipment", label: "Equipment" },
  { value: "time-entries", label: "Time Entries" },
] as const;

type ImportType = (typeof IMPORT_TYPES)[number]["value"];

type ExportType = "time-entries" | "employees" | "projects" | "cost-codes";

interface ImportPreviewRow {
  rowNumber: number;
  isValid: boolean;
  values: Record<string, string>;
  errors: string[];
}

interface ImportPreviewResponse {
  importId: string;
  type: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ImportPreviewRow[];
}

interface ImportCommitResponse {
  importId: string;
  status: string;
  importedRows: number;
  message: string;
}

interface ImportHistoryItem {
  id: string;
  type: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdAt: string;
  completedAt: string | null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
    case "Failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "Processing":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function downloadTemplate(type: ImportType) {
  const templates: Record<ImportType, string> = {
    "employees": "EmployeeNumber,FirstName,LastName,Email,Department,JobTitle,PayRate,HireDate\nEMP-001,John,Smith,john@company.com,Field Ops,Foreman,45.50,2025-01-15\n",
    "projects": "ProjectNumber,Name,Description,StartDate,EndDate,ContractAmount,Status\nPRJ-1001,Main Street Bridge,Bridge rehabilitation,2025-02-01,2025-12-20,2500000,Active\n",
    "cost-codes": "Code,Description,Category,UnitOfMeasure\n03-100,Concrete Formwork,Labor,HR\n",
    "equipment": "Name,Code,Type,HourlyRate,DailyRate\nCAT 320 Excavator,EQ-001,HeavyEquipment,135.00,1080.00\n",
    "time-entries": "EmployeeNumber,ProjectNumber,CostCode,Date,Hours,OvertimeHours,Description\nEMP-001,PRJ-1001,03-100,2025-03-01,8,2,Bridge deck formwork\n",
  };

  const blob = new Blob([templates[type]], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}-template.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function DataImportPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [importType, setImportType] = useState<ImportType>("employees");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [exportType, setExportType] = useState<ExportType>("time-entries");
  const [exportFormat, setExportFormat] = useState("vista");
  const [fromDate, setFromDate] = useState<string>(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isExporting, setIsExporting] = useState(false);

  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const data = await api<ImportHistoryItem[]>("/api/import/history?take=100");
      setHistory(data);
    } catch {
      toast.error("Failed to load import history");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchHistory();
    }
  }, [isAdmin, fetchHistory]);

  const sortedColumns = useMemo(() => {
    if (!preview || preview.rows.length === 0) return [] as string[];
    return Object.keys(preview.rows[0].values);
  }, [preview]);

  const canConfirm = !!preview && preview.validRows > 0 && !isConfirming;

  const uploadForPreview = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Select a CSV file first");
      return;
    }

    setIsUploading(true);
    setPreview(null);
    setImportProgress(20);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/import/${importType}`, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: formData,
      });

      setImportProgress(70);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Upload failed with status ${response.status}`);
      }

      const data = (await response.json()) as ImportPreviewResponse;
      setPreview(data);
      setImportProgress(100);

      toast.success("Preview generated", {
        description: `${data.validRows} valid row(s), ${data.errorRows} error row(s)`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate preview";
      toast.error(message);
      setImportProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [importType, selectedFile]);

  const confirmImport = useCallback(async () => {
    if (!preview) return;

    setIsConfirming(true);
    setImportProgress(25);

    try {
      const result = await api<ImportCommitResponse>(`/api/import/${importType}/confirm/${preview.importId}`, {
        method: "POST",
      });

      setImportProgress(100);

      if (result.status !== "Completed") {
        toast.error(result.message || "Import failed");
      } else {
        toast.success("Import completed", {
          description: `${result.importedRows} row(s) imported`,
        });
      }

      await fetchHistory();
      setPreview(null);
      setSelectedFile(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm import";
      toast.error(message);
      setImportProgress(0);
    } finally {
      setIsConfirming(false);
    }
  }, [fetchHistory, importType, preview]);

  const downloadExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();

      if (exportType === "time-entries") {
        params.set("from", fromDate);
        params.set("to", toDate);
        params.set("format", "vista");
      } else {
        params.set("format", "csv");
      }

      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/export/${exportType}?${params.toString()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") || "";
      const fileNameMatch = contentDisposition.match(/filename="?([^\";]+)"?/i);
      const fileName = fileNameMatch?.[1] || `${exportType}-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Export downloaded");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to export";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  }, [exportType, fromDate, toDate]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vista Data Import/Export</h1>
        <p className="text-muted-foreground">
          Migrate data between Trimble Vista/Viewpoint and Pitbull using CSV validation and two-step import.
        </p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import" className="gap-2"><FileUp className="h-4 w-4" />Import</TabsTrigger>
          <TabsTrigger value="export" className="gap-2"><Download className="h-4 w-4" />Export</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import CSV</CardTitle>
              <CardDescription>Upload and validate data before committing to the database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data Type</Label>
                  <Select value={importType} onValueChange={(value) => setImportType(value as ImportType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Button variant="outline" className="w-full" onClick={() => downloadTemplate(importType)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download {importType} template
                  </Button>
                </div>
              </div>

              <div
                className="rounded-lg border-2 border-dashed p-6 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              >
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">Drag and drop CSV here, or browse</p>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                {selectedFile && (
                  <p className="mt-2 text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
                )}
              </div>

              {(isUploading || isConfirming || importProgress > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{isConfirming ? "Processing import" : "Uploading/validating"}</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={uploadForPreview} disabled={isUploading || !selectedFile}>
                  {isUploading ? "Generating preview..." : "Upload & Preview"}
                </Button>
                <Button onClick={confirmImport} disabled={!canConfirm} className="bg-amber-500 hover:bg-amber-600 text-white">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Import
                </Button>
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle>Preview Results</CardTitle>
                <CardDescription>
                  {preview.totalRows} total, {preview.validRows} valid, {preview.errorRows} with errors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Valid: {preview.validRows}</Badge>
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">Errors: {preview.errorRows}</Badge>
                  <Badge variant="outline">Import ID: {preview.importId.slice(0, 8)}</Badge>
                </div>

                <div className="max-h-[520px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Row</TableHead>
                        {sortedColumns.map((column) => (
                          <TableHead key={column}>{column}</TableHead>
                        ))}
                        <TableHead>Error Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row) => (
                        <TableRow key={row.rowNumber} className={row.isValid ? "bg-green-50/30" : "bg-red-50/30"}>
                          <TableCell>
                            <Badge className={row.isValid
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"}
                            >
                              {row.isValid ? "Valid" : "Error"}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.rowNumber}</TableCell>
                          {sortedColumns.map((column) => (
                            <TableCell key={`${row.rowNumber}-${column}`} className="text-xs">{row.values[column] ?? ""}</TableCell>
                          ))}
                          <TableCell className="text-xs text-red-700">
                            {row.errors.length > 0 ? row.errors.join("; ") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Generate Vista-compatible and CSV exports for migration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Data Type</Label>
                  <Select value={exportType} onValueChange={(value) => {
                    const type = value as ExportType;
                    setExportType(type);
                    setExportFormat(type === "time-entries" ? "vista" : "csv");
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time-entries">Time Entries</SelectItem>
                      <SelectItem value="employees">Employees</SelectItem>
                      <SelectItem value="projects">Projects</SelectItem>
                      <SelectItem value="cost-codes">Cost Codes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {exportType === "time-entries" ? (
                        <SelectItem value="vista">vista</SelectItem>
                      ) : (
                        <SelectItem value="csv">csv</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {exportType === "time-entries" && (
                  <>
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              <Button onClick={downloadExport} disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Preparing export..." : "Download Export"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Track import batches and outcomes.</CardDescription>
            </CardHeader>
            <CardContent>
              {isHistoryLoading ? (
                <TableSkeleton headers={["Type", "Status", "Total", "Valid", "Errors", "Created", "Completed"]} rows={4} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Valid</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No import history found.</TableCell>
                      </TableRow>
                    ) : (
                      history.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>
                            <Badge className={statusBadgeClass(item.status)}>{item.status}</Badge>
                          </TableCell>
                          <TableCell>{item.totalRows}</TableCell>
                          <TableCell>{item.validRows}</TableCell>
                          <TableCell>{item.errorRows}</TableCell>
                          <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                          <TableCell>{formatDateTime(item.completedAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
