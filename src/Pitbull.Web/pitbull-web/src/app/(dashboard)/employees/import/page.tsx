"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingButton } from "@/components/ui/loading-button";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { ChevronRight, Download, Upload, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { uploadFiles } from "@/lib/api";
import type { ImportResultDto } from "@/lib/types/employee-onboarding";

// ─── CSV Template ──────────────────────────────────────────

const TEMPLATE_HEADER = [
  "firstName", "lastName", "email", "phone", "employeeNumber",
  "classification", "title", "hireDate", "baseHourlyRate",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship",
].join(",");

const TEMPLATE_ROW = [
  "John", "Doe", "john.doe@example.com", "555-0100", "EMP-001",
  "0", "Laborer", "2026-03-01", "28.50",
  "Jane Doe", "555-0101", "Spouse",
].join(",");

// ─── Parser ────────────────────────────────────────────────

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}

/** Parse a single CSV line respecting quoted fields (RFC 4180). */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += c;
  }

  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = values[idx] || "";
    });

    const errors: string[] = [];
    if (!data.firstName) errors.push("firstName is required");
    if (!data.lastName) errors.push("lastName is required");
    if (!data.email) errors.push("email is required");
    if (data.baseHourlyRate && isNaN(Number(data.baseHourlyRate))) {
      errors.push("baseHourlyRate must be a number");
    }

    rows.push({ rowNumber: i + 1, data, errors });
  }

  return { headers, rows };
}

// ─── Component ─────────────────────────────────────────────

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export default function EmployeeImportPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResultDto | null>(null);

  const handleFilesChange = useCallback((newFiles: FileItem[]) => {
    setFiles(newFiles);
    setResult(null);

    if (newFiles.length > 0 && newFiles[0].file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setParsed(parseCSV(text));
        }
      };
      reader.readAsText(newFiles[0].file);
    } else {
      setParsed(null);
    }
  }, []);

  const handleDownloadTemplate = () => {
    const csv = `${TEMPLATE_HEADER}\n${TEMPLATE_ROW}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    const file = files[0]?.file;
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await uploadFiles<ImportResultDto>("/api/employee-onboarding/import", [file]);
      setResult(data);
      if (data.failureCount === 0) {
        toast.success(`Successfully imported ${data.successCount} employees`);
      } else {
        toast.warning(
          `Imported ${data.successCount} of ${data.totalRows} rows. ${data.failureCount} failed.`
        );
      }
    } catch {
      toast.error("Import failed. Check your CSV format and try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = parsed?.rows.filter((r) => r.errors.length === 0).length ?? 0;
  const errorCount = parsed?.rows.filter((r) => r.errors.length > 0).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/employees" className="hover:text-foreground transition-colors">
          Employees
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Import CSV</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Employees</h1>
          <p className="text-muted-foreground">
            Upload a CSV file to bulk-create employee onboarding records
          </p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Download Template
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Download the template CSV, fill in employee data, then upload it here.
          Each row will create a new onboarding submission in Draft status.
        </AlertDescription>
      </Alert>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Select a .csv file (max 5 MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropZone
            files={files}
            onFilesChange={handleFilesChange}
            accept=".csv"
            maxFiles={1}
            maxSizeMB={5}
            placeholder="Drag & drop your CSV file here, or click to browse"
          />
        </CardContent>
      </Card>

      {/* Import result banner */}
      {result && (
        <Alert className={result.failureCount === 0
          ? "border-green-200 bg-green-50 dark:bg-green-900/10"
          : "border-amber-200 bg-amber-50 dark:bg-amber-900/10"
        }>
          {result.failureCount === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-amber-600" />
          )}
          <AlertDescription>
            <strong>{result.successCount}</strong> of <strong>{result.totalRows}</strong> rows imported successfully.
            {result.failureCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {" "}{result.failureCount} failed.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Preview */}
      {parsed && parsed.rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  {parsed.rows.length} rows found
                  {errorCount > 0 && (
                    <span className="text-red-600 dark:text-red-400 ml-2">
                      ({errorCount} with errors)
                    </span>
                  )}
                </CardDescription>
              </div>
              <LoadingButton
                onClick={handleUpload}
                loading={isUploading}
                loadingText="Importing..."
                disabled={validCount === 0}
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                <Upload className="h-4 w-4" />
                Import {validCount} Valid Rows
              </LoadingButton>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {parsed.rows.slice(0, 50).map((row) => (
                <div
                  key={row.rowNumber}
                  className={`border rounded-lg p-3 space-y-2 ${
                    row.errors.length > 0 ? "border-red-300 bg-red-50 dark:bg-red-900/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Row {row.rowNumber}: {row.data.firstName} {row.data.lastName}
                    </span>
                    {row.errors.length === 0 ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="destructive">{row.errors.length} errors</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{row.data.email}</p>
                  {row.errors.length > 0 && (
                    <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-4">
                      {row.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Employee #</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 100).map((row) => (
                    <TableRow
                      key={row.rowNumber}
                      className={row.errors.length > 0 ? "bg-red-50 dark:bg-red-900/10" : ""}
                    >
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">
                        {row.data.firstName} {row.data.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.data.email}</TableCell>
                      <TableCell className="font-mono text-xs">{row.data.employeeNumber}</TableCell>
                      <TableCell className="font-mono">
                        {row.data.baseHourlyRate ? `$${row.data.baseHourlyRate}` : "—"}
                      </TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                            Valid
                          </Badge>
                        ) : (
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {row.errors.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsed.rows.length > 100 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing first 100 of {parsed.rows.length} rows
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
