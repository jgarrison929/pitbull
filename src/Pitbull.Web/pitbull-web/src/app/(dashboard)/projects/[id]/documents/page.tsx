"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api, { uploadFiles, getDownloadUrl } from "@/lib/api";
import { isValidGuid } from "@/lib/utils";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Download, Trash2, Upload } from "lucide-react";
import { AiDocumentAnalysisButton } from "@/components/ai-document-analysis";
import { getToken } from "@/lib/auth";
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

interface DataMap {
  [key: string]: unknown;
}

interface TemplateRow {
  id: string;
  name: string;
  templateType: string;
  engine: string;
  isDefault: boolean;
  version: number;
  createdAt: string;
}

interface GeneratedDocRow {
  id: string;
  documentType: string;
  generatedAt: string;
  outputFormat: string;
  createdAt: string;
}

interface TemplateFormState {
  id?: string;
  name: string;
  description: string;
  templateType: string;
  engine: string;
  bodyTemplate: string;
  isDefault: boolean;
}

interface FileAttachment {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedById: string;
  createdAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TEMPLATE_TYPES = ["Transmittal", "MeetingMinutes", "DailyReport", "Letter", "Narrative"];
const ENGINE_TYPES = ["Razor", "Handlebars"];
const OUTPUT_FORMATS = ["Pdf", "Docx"];

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  Transmittal: "Transmittal",
  MeetingMinutes: "Meeting Minutes",
  DailyReport: "Daily Report",
  Letter: "Letter",
  Narrative: "Narrative",
};

function asDataMap(value: unknown): DataMap {
  return value && typeof value === "object" ? (value as DataMap) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
}

export default function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const isProjectIdValid = isValidGuid(projectId);

  const [templates, setTemplates] = useState<PmEntityDto[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TemplateFormState>({
    name: "",
    description: "",
    templateType: "Transmittal",
    engine: "Razor",
    bodyTemplate: "",
    isDefault: false,
  });

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateTemplateId, setGenerateTemplateId] = useState("");
  const [generateFormat, setGenerateFormat] = useState("Pdf");

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const loadFiles = useCallback(async () => {
    try {
      const files = await api<FileAttachment[]>(
        `/api/files?entityType=Project&entityId=${projectId}`
      );
      setUploadedFiles(files);
    } catch {
      // Non-critical
    }
  }, [projectId]);

  async function handleFileUpload(filesToUpload: File[]) {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    try {
      const endpoint = filesToUpload.length === 1
        ? "/api/files/upload"
        : "/api/files/upload-multiple";
      await uploadFiles<FileAttachment | FileAttachment[]>(endpoint, filesToUpload, {
        relatedEntityType: "Project",
        relatedEntityId: projectId,
      });
      toast.success(`${filesToUpload.length} file(s) uploaded`);
      setPendingFiles([]);
      await loadFiles();
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file? This action cannot be undone.")) return;
    try {
      await api(`/api/files/${fileId}`, { method: "DELETE" });
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("File deleted");
    } catch (error) {
      toast.error("Failed to delete file", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  function handleDownload(fileId: string, fileName: string) {
    const url = getDownloadUrl(fileId);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    // Attach auth token via fetch for download
    const token = getToken();
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.click();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => toast.error("Download failed"));
    } else {
      a.click();
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templateRes, generatedRes] = await Promise.all([
        api<PmPagedResult>(`/api/projects/${projectId}/document-templates?page=1&pageSize=500`),
        api<PmPagedResult>(`/api/projects/${projectId}/generated-documents?page=1&pageSize=500`),
      ]);
      setTemplates(templateRes.items ?? []);
      setGeneratedDocs(generatedRes.items ?? []);
    } catch (error) {
      toast.error("Failed to load documents", {
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
    void loadFiles();
  }, [isProjectIdValid, load, loadFiles]);

  const templateRows = useMemo(() => {
    const mapped = templates.map<TemplateRow>((t) => {
      const data = asDataMap(t.data);
      return {
        id: t.id,
        name: t.name || t.title || "Untitled template",
        templateType: asString(data.TemplateType ?? data.templateType) || "Transmittal",
        engine: asString(data.Engine ?? data.engine) || "Razor",
        isDefault: asBool(data.IsDefault ?? data.isDefault),
        version: asNumber(data.Version ?? data.version) || 1,
        createdAt: t.createdAt,
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (typeFilter !== "all" && row.templateType !== typeFilter) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.templateType.toLowerCase().includes(q);
    });
  }, [templates, search, typeFilter]);

  const generatedDocRows = useMemo(() => {
    return generatedDocs.map<GeneratedDocRow>((d) => {
      const data = asDataMap(d.data);
      return {
        id: d.id,
        documentType: asString(data.DocumentType ?? data.documentType) || "Unknown",
        generatedAt: asString(data.GeneratedAt ?? data.generatedAt) || d.createdAt,
        outputFormat: asString(data.OutputFormat ?? data.outputFormat) || "Pdf",
        createdAt: d.createdAt,
      };
    });
  }, [generatedDocs]);

  function openCreate() {
    setEditing(false);
    setForm({
      name: "",
      description: "",
      templateType: "Transmittal",
      engine: "Razor",
      bodyTemplate: "",
      isDefault: false,
    });
    setDialogOpen(true);
  }

  function openEdit(row: TemplateRow) {
    setEditing(true);
    const source = templates.find((t) => t.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      name: row.name,
      description: asString(data.Description ?? data.description),
      templateType: row.templateType,
      engine: row.engine,
      bodyTemplate: asString(data.BodyTemplate ?? data.bodyTemplate),
      isDefault: row.isDefault,
    });
    setDialogOpen(true);
  }

  async function saveTemplate() {
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.name.trim(),
      title: form.name.trim(),
      data: {
        TemplateType: form.templateType,
        Description: form.description || null,
        Engine: form.engine,
        BodyTemplate: form.bodyTemplate || null,
        IsDefault: form.isDefault,
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/document-templates/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Template updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/document-templates`, {
          method: "POST",
          body: payload,
        });
        toast.success("Template created");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function openGenerate() {
    setGenerateTemplateId(templates[0]?.id ?? "");
    setGenerateFormat("Pdf");
    setGenerateOpen(true);
  }

  async function generateDocument() {
    if (!generateTemplateId) {
      toast.error("Select a template to generate from");
      return;
    }

    const payload: PmUpsertRequest = {
      name: "Generated Document",
      data: {
        TemplateId: generateTemplateId,
        OutputFormat: generateFormat,
      },
    };

    setSaving(true);
    try {
      await api<PmEntityDto>(`/api/projects/${projectId}/documents/generate`, {
        method: "POST",
        body: payload,
      });
      toast.success("Document generated");
      setGenerateOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to generate document", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!isProjectIdValid) {
    return <div className="p-6 text-sm text-destructive">Invalid project ID.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage document templates and generate project documents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openGenerate} disabled={templates.length === 0}>
            Generate Document
          </Button>
          <Button onClick={openCreate}>+ New Template</Button>
        </div>
      </div>

      {/* Project Files Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Project Files</CardTitle>
              <CardDescription>
                Upload and manage files for this project.
              </CardDescription>
            </div>
            <Badge variant="secondary">{uploadedFiles.length} files</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            files={pendingFiles}
            onFilesChange={setPendingFiles}
            placeholder="Drag & drop project files here, or click to browse"
          />
          {pendingFiles.length > 0 && (
            <Button
              onClick={() => {
                const realFiles = pendingFiles
                  .map((f) => f.file)
                  .filter((f): f is File => f !== undefined);
                if (realFiles.length > 0) handleFileUpload(realFiles);
              }}
              disabled={uploading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file(s)`}
            </Button>
          )}

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Uploaded Files</h4>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-md border bg-accent/20 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 truncate font-medium">{file.fileName}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatFileSize(file.fileSize)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(file.createdAt)}
                    </span>
                    <div className="flex gap-1">
                      <AiDocumentAnalysisButton fileId={file.id} fileName={file.fileName} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownload(file.id, file.fileName)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="sr-only">Download</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Document Templates</CardTitle>
          <CardDescription>
            Create and manage templates for generating project documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search template name or type"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TEMPLATE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TEMPLATE_TYPE_LABELS[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <>
              <div className="sm:hidden"><CardListSkeleton rows={3} /></div>
              <div className="hidden sm:block"><TableSkeleton headers={["Name", "Type", "Engine", "Version", "Default", "Actions"]} rows={3} /></div>
            </>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {templateRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No templates yet. Create your first document template.
                    </p>
                    <Button className="mt-3" size="sm" onClick={openCreate}>Create Template</Button>
                  </div>
                ) : (
                  templateRows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{row.name}</span>
                        <Badge variant="outline">
                          {TEMPLATE_TYPE_LABELS[row.templateType] || row.templateType}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{row.engine}</span>
                        <span>v{row.version}</span>
                        {row.isDefault && <Badge variant="secondary">Default</Badge>}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                          Edit
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
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              No templates yet. Create your first document template.
                            </p>
                            <Button size="sm" onClick={openCreate}>Create Template</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      templateRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {TEMPLATE_TYPE_LABELS[row.templateType] || row.templateType}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.engine}</TableCell>
                          <TableCell>{row.version}</TableCell>
                          <TableCell>{row.isDefault ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
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

      {/* Generated Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Documents</CardTitle>
          <CardDescription>
            Documents generated from templates for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <>
              <div className="sm:hidden"><CardListSkeleton rows={3} /></div>
              <div className="hidden sm:block"><TableSkeleton headers={["Document Type", "Generated At", "Output Format"]} rows={3} /></div>
            </>
          ) : generatedDocRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No generated documents yet. Create a template and generate your first document.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 sm:hidden">
                {generatedDocRows.map((row) => (
                  <div key={row.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {TEMPLATE_TYPE_LABELS[row.documentType] || row.documentType}
                      </Badge>
                      <Badge variant="secondary">{row.outputFormat}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Generated: {formatDate(row.generatedAt)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <div className="overflow-x-auto"><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Generated At</TableHead>
                      <TableHead>Output Format</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedDocRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {TEMPLATE_TYPE_LABELS[row.documentType] || row.documentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatDate(row.generatedAt)}</TableCell>
                        <TableCell>{row.outputFormat}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Template Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>
              Define a document template with a name, type, engine, and body content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Standard Transmittal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template Type</Label>
                <Select
                  value={form.templateType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, templateType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TEMPLATE_TYPE_LABELS[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Engine</Label>
                <Select
                  value={form.engine}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, engine: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGINE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-body">Body Template</Label>
              <Textarea
                id="template-body"
                value={form.bodyTemplate}
                onChange={(e) => setForm((prev) => ({ ...prev, bodyTemplate: e.target.value }))}
                placeholder="Template body content (Razor or Handlebars syntax)"
                rows={8}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Document Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Document</DialogTitle>
            <DialogDescription>
              Select a template and output format to generate a project document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={generateTemplateId} onValueChange={setGenerateTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || t.title || "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select value={generateFormat} onValueChange={setGenerateFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {format}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={generateDocument} disabled={saving}>
              {saving ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
