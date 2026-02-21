"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import api, { uploadFiles } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Upload,
  FileSpreadsheet,
  Building2,
  Database,
  Calculator,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- Types ---

type SourceSystem = "Vista" | "Sage300" | "SageFoundation" | "QuickBooksDesktop" | "QuickBooksOnline" | "GenericCSV";

interface SourceOption {
  id: SourceSystem;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DetectFormatResponse {
  sourceSystem: string;
  displayName: string;
  detectedFormat: string;
  confidence: number;
  headers: string[];
  columns: string[];
  rowCount: number;
  columnCount: number;
  previewRows: Record<string, string>[];
}

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform: string;
  autoMapped: boolean;
}

interface MapFieldsRequest {
  migrationProjectId: string;
  entityType: string;
  headers: string[];
  mappings?: FieldMapping[];
}

interface MapFieldsResponse {
  suggestedMappings: FieldMapping[];
  savedMappings: FieldMapping[];
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  errors: Array<{ row: number; column: string; message: string }>;
  warnings: Array<{ row: number; column: string; message: string }>;
  issues: Array<{ row: number; column: string; message: string; severity: string }>;
}

interface ExecutionResult {
  status: string;
  importedCount: number;
  failedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; message: string }>;
}

const WIZARD_STEPS = [
  "Source System",
  "Upload File",
  "Field Mapping",
  "Validation",
  "Import",
] as const;

const SOURCE_SYSTEMS: SourceOption[] = [
  { id: "Vista", name: "Trimble Vista", description: "Viewpoint Vista ERP time entries, projects, employees", icon: Building2 },
  { id: "Sage300", name: "Sage 300 CRE", description: "Sage 300 Construction and Real Estate", icon: Calculator },
  { id: "SageFoundation", name: "Sage Foundation", description: "Foundation Software construction accounting", icon: Database },
  { id: "QuickBooksDesktop", name: "QuickBooks Desktop", description: "QuickBooks Desktop Pro/Premier/Enterprise", icon: FileSpreadsheet },
  { id: "QuickBooksOnline", name: "QuickBooks Online", description: "QuickBooks Online export files", icon: FileSpreadsheet },
  { id: "GenericCSV", name: "Generic CSV", description: "Any CSV file with custom field mapping", icon: FileText },
];

export default function MigrationWizardPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [step, setStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [sourceSystem, setSourceSystem] = useState<SourceSystem | null>(null);

  // Step 2: File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detection, setDetection] = useState<DetectFormatResponse | null>(null);

  // Step 2b: entity type for mapping/validation
  const [entityType, setEntityType] = useState("Employee");

  // Step 3: Field mapping
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [transforms, setTransforms] = useState<string[]>([]);
  const [isMappingLoading, setIsMappingLoading] = useState(false);

  // Step 4: Validation
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Step 5: Execution
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  // --- Step 1: Select source + create project ---
  const handleSelectSource = useCallback(async (source: SourceSystem) => {
    setSourceSystem(source);
  }, []);

  const handleCreateProject = useCallback(async () => {
    if (!sourceSystem || !projectName.trim()) {
      toast.error("Enter a project name");
      return;
    }

    try {
      const result = await api<{ id: string }>("/api/migration/projects", {
        method: "POST",
        body: { name: projectName.trim(), sourceSystem },
      });
      setProjectId(result.id);
      setStep(1);
    } catch (err) {
      toast.error("Failed to create migration project", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [sourceSystem, projectName]);

  // --- Step 2: Upload file + detect format ---
  const handleUploadFile = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const result = await uploadFiles<DetectFormatResponse>(
        "/api/migration/detect-format",
        [selectedFile]
      );
      setDetection(result);
      toast.success("File analyzed", {
        description: `Detected ${result.displayName} with ${result.rowCount} rows, ${result.headers.length} columns`,
      });
    } catch (err) {
      toast.error("Failed to analyze file", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  const handleProceedToMapping = useCallback(async () => {
    if (!projectId || !detection) return;
    setIsMappingLoading(true);
    try {
      const result = await api<MapFieldsResponse>("/api/migration/map-fields", {
        method: "POST",
        body: {
          migrationProjectId: projectId,
          entityType,
          headers: detection.headers,
        } satisfies MapFieldsRequest,
      });
      const allMappings = result.savedMappings.length > 0
        ? result.savedMappings
        : result.suggestedMappings;
      setMappings(allMappings);
      // Extract unique target fields from suggested mappings
      const fields = [...new Set(result.suggestedMappings.map((m) => m.targetField).filter(Boolean))];
      setTargetFields(fields);
      setTransforms(["uppercase", "lowercase", "trim", "date-mdy", "date-dmy"]);
      setStep(2);
    } catch (err) {
      toast.error("Failed to load field mappings", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsMappingLoading(false);
    }
  }, [projectId, detection, entityType]);

  // --- Step 3: Field mapping ---
  const updateMapping = useCallback((index: number, field: keyof FieldMapping, value: string) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, autoMapped: false };
      return updated;
    });
  }, []);

  const handleSaveMappings = useCallback(async () => {
    if (!projectId) return;
    try {
      await api(`/api/migration/projects/${projectId}/mappings`, {
        method: "PUT",
        body: { mappings },
      });
      setStep(3);
      // Trigger validation
      setIsValidating(true);
      try {
        const result = await api<ValidationResult>(
          `/api/migration/projects/${projectId}/validate`,
          { method: "POST" }
        );
        setValidation(result);
      } catch (err) {
        toast.error("Validation failed", {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setIsValidating(false);
      }
    } catch (err) {
      toast.error("Failed to save mappings", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [projectId, mappings]);

  // --- Step 4: Validation results ---
  const handleRevalidate = useCallback(async () => {
    if (!projectId) return;
    setIsValidating(true);
    try {
      const result = await api<ValidationResult>(
        `/api/migration/projects/${projectId}/validate`,
        { method: "POST" }
      );
      setValidation(result);
    } catch (err) {
      toast.error("Validation failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsValidating(false);
    }
  }, [projectId]);

  // --- Step 5: Execute ---
  const handleExecute = useCallback(async () => {
    if (!projectId) return;
    setIsExecuting(true);
    setExecutionProgress(10);

    const progressInterval = setInterval(() => {
      setExecutionProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    try {
      const result = await api<ExecutionResult>(
        `/api/migration/projects/${projectId}/execute`,
        { method: "POST" }
      );
      setExecution(result);
      setExecutionProgress(100);

      if (result.status === "Complete") {
        toast.success("Migration complete", {
          description: `${result.importedCount} records imported`,
        });
      } else {
        toast.error("Migration completed with errors");
      }
    } catch (err) {
      toast.error("Migration execution failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      clearInterval(progressInterval);
      setIsExecuting(false);
    }
  }, [projectId]);

  const mappedCount = useMemo(
    () => mappings.filter((m) => m.targetField && m.targetField !== "").length,
    [mappings]
  );

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin/company" },
          { label: "Data Migration", href: "/admin/migration" },
          { label: "New Migration" },
        ]}
      />

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (step === 0) {
              router.push("/admin/migration");
            } else {
              setStep(step - 1);
            }
          }}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Migration</h1>
          <p className="text-muted-foreground">
            Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step]}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                i < step
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : i === step
                    ? "bg-amber-500 text-white"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1",
                  i < step ? "bg-green-400 dark:bg-green-600" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* --- Step 1: Source Selection --- */}
      {step === 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Migration Name</CardTitle>
              <CardDescription>Give this migration a name for tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Vista Employee Import - Feb 2026"
                className="max-w-lg"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Source System</CardTitle>
              <CardDescription>Choose the system you are migrating data from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SOURCE_SYSTEMS.map((source) => {
                  const Icon = source.icon;
                  const isSelected = sourceSystem === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => handleSelectSource(source.id)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                        isSelected
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10"
                          : "hover:border-amber-500/50 hover:bg-accent/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-5 w-5", isSelected ? "text-amber-500" : "text-muted-foreground")} />
                        <span className="font-medium">{source.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{source.description}</p>
                      {isSelected && (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          Selected
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleCreateProject}
              disabled={!sourceSystem || !projectName.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* --- Step 2: File Upload --- */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload the CSV export from {sourceSystem}. The file will be analyzed to detect format and columns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
                  "hover:border-amber-500/50 hover:bg-accent/30"
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv,text/csv";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) setSelectedFile(file);
                  };
                  input.click();
                }}
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : "Drag & drop CSV here, or click to browse"}
                  </p>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUploadFile}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? "Analyzing..." : "Analyze File"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {detection && (
            <Card>
              <CardHeader>
                <CardTitle>Detection Results</CardTitle>
                <CardDescription>
                  Format: <strong>{detection.detectedFormat}</strong> (confidence: {Math.round(detection.confidence * 100)}%)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <span>{detection.rowCount} rows</span>
                  <span>{detection.columnCount} columns</span>
                </div>

                <div className="max-h-[300px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {detection.columns.map((col) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detection.previewRows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {detection.columns.map((col) => (
                            <TableCell key={col} className="text-xs">
                              {row[col] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleProceedToMapping}
                    disabled={isMappingLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {isMappingLoading ? "Loading mappings..." : "Proceed to Field Mapping"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- Step 3: Field Mapping --- */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping</CardTitle>
              <CardDescription>
                Map source columns to Pitbull fields. {mappedCount} of {mappings.length} mapped.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mappings.map((mapping, index) => (
                  <div
                    key={mapping.sourceColumn}
                    className={cn(
                      "grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center rounded-lg border p-3",
                      mapping.targetField
                        ? mapping.autoMapped
                          ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-900/10"
                          : "border-blue-200 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10"
                        : "border-amber-200 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10"
                    )}
                  >
                    <div>
                      <Label className="text-xs text-muted-foreground">Source Column</Label>
                      <p className="font-medium text-sm">{mapping.sourceColumn}</p>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />

                    <div>
                      <Label className="text-xs text-muted-foreground">Target Field</Label>
                      <Select
                        value={mapping.targetField || ""}
                        onValueChange={(value) => updateMapping(index, "targetField", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- Skip --</SelectItem>
                          {targetFields.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Transform</Label>
                      <Select
                        value={mapping.transform || "none"}
                        onValueChange={(value) => updateMapping(index, "transform", value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {transforms.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {mapping.autoMapped && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 text-xs sm:col-span-4 w-fit">
                        Auto-mapped
                      </Badge>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <Button
                  onClick={handleSaveMappings}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Save Mappings & Validate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- Step 4: Validation --- */}
      {step === 3 && (
        <div className="space-y-6">
          {isValidating ? (
            <Card>
              <CardContent className="py-16 text-center space-y-4">
                <div className="flex justify-center">
                  <Skeleton className="h-8 w-8 rounded-full animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Validating data...</p>
              </CardContent>
            </Card>
          ) : validation ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Validation Results</CardTitle>
                  <CardDescription>
                    {validation.totalRows} rows analyzed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border bg-green-50/50 dark:bg-green-900/10 p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{validation.validRows}</p>
                      <p className="text-xs text-muted-foreground">Valid</p>
                    </div>
                    <div className="rounded-lg border bg-red-50/50 dark:bg-red-900/10 p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{validation.errorCount}</p>
                      <p className="text-xs text-muted-foreground">Errors</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{validation.warningCount}</p>
                      <p className="text-xs text-muted-foreground">Warnings</p>
                    </div>
                    <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{validation.infoCount}</p>
                      <p className="text-xs text-muted-foreground">Info</p>
                    </div>
                  </div>

                  {validation.issues.length > 0 && (
                    <div className="max-h-[400px] overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Sev.</TableHead>
                            <TableHead className="w-16">Row</TableHead>
                            <TableHead className="w-32">Column</TableHead>
                            <TableHead>Message</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validation.issues.map((issue, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                {issue.severity === "error" && (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                                {issue.severity === "warning" && (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                )}
                                {issue.severity === "info" && (
                                  <Info className="h-4 w-4 text-blue-500" />
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums">{issue.row}</TableCell>
                              <TableCell className="text-xs font-mono">{issue.column}</TableCell>
                              <TableCell className="text-sm">{issue.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Fix Mappings
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRevalidate}>
                    Re-validate
                  </Button>
                  <Button
                    onClick={() => setStep(4)}
                    disabled={validation.errorCount > 0 && validation.validRows === 0}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {validation.errorCount > 0 ? "Proceed with Warnings" : "Proceed to Import"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* --- Step 5: Execute --- */}
      {step === 4 && (
        <div className="space-y-6">
          {!execution ? (
            <Card>
              <CardHeader>
                <CardTitle>Execute Import</CardTitle>
                <CardDescription>
                  Ready to import {validation?.validRows ?? 0} valid records into Pitbull.
                  {validation && validation.errorCount > 0 && (
                    <span className="text-amber-600">
                      {" "}{validation.errorCount} rows with errors will be skipped.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isExecuting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Importing records...</span>
                      <span>{executionProgress}%</span>
                    </div>
                    <Progress value={executionProgress} className="h-2" />
                  </div>
                )}

                <Button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {isExecuting ? "Importing..." : "Start Import"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card
              className={
                execution.status === "Complete"
                  ? "border-green-200 dark:border-green-800"
                  : "border-red-200 dark:border-red-800"
              }
            >
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-start gap-4">
                  {execution.status === "Complete" ? (
                    <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">
                      {execution.status === "Complete" ? "Migration Complete" : "Migration Completed with Errors"}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-3 mt-4">
                      <div className="rounded-lg border bg-green-50/50 dark:bg-green-900/10 p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{execution.importedCount}</p>
                        <p className="text-xs text-muted-foreground">Imported</p>
                      </div>
                      <div className="rounded-lg border bg-red-50/50 dark:bg-red-900/10 p-3 text-center">
                        <p className="text-2xl font-bold text-red-600">{execution.failedCount}</p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                      <div className="rounded-lg border bg-gray-50/50 dark:bg-gray-900/10 p-3 text-center">
                        <p className="text-2xl font-bold text-muted-foreground">{execution.skippedCount}</p>
                        <p className="text-xs text-muted-foreground">Skipped</p>
                      </div>
                    </div>
                  </div>
                </div>

                {execution.errors.length > 0 && (
                  <div className="max-h-[300px] overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Row</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {execution.errors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell className="tabular-nums">{err.row}</TableCell>
                            <TableCell className="text-sm text-red-600">{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/admin/migration")}
                  >
                    Back to Dashboard
                  </Button>
                  {execution.errors.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const csv = ["Row,Error"]
                          .concat(
                            execution.errors.map(
                              (err) => `${err.row},"${err.message.replace(/"/g, '""')}"`
                            )
                          )
                          .join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "migration-errors.csv";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download Error Report
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
