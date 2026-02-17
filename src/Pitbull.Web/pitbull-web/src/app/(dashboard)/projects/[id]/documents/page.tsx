"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import api, { ApiError } from "@/lib/api";
import type { PmEntityDto, PmPagedResult, PmUpsertRequest } from "@/lib/pm-types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  uploadedDate: string;
  version: string;
}

interface DocumentFormState {
  id?: string;
  name: string;
  type: string;
  uploadedDate: string;
  version: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

const DOCUMENT_TYPES = [
  "Contract",
  "Drawing",
  "Specification",
  "Submittal",
  "RFI",
  "Photo",
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

  const [documents, setDocuments] = useState<PmEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<DocumentFormState>({
    name: "",
    type: "Other",
    uploadedDate: new Date().toISOString().slice(0, 10),
    version: "1.0",
    fileName: "",
    mimeType: "",
    fileSizeBytes: 0,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocumentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<PmPagedResult>(`/api/projects/${projectId}/documents?page=1&pageSize=500`);
      setDocuments(result.items ?? []);
    } catch (error) {
      toast.error("Failed to load documents", {
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
    const mapped = documents.map<DocumentRow>((document) => {
      const data = asDataMap(document.data);
      return {
        id: document.id,
        name: asString(data.FileName ?? data.fileName) || document.name || document.title || "Untitled document",
        type: asString(data.DocumentType ?? data.documentType) || "Other",
        uploadedDate:
          asString(data.UploadedAt ?? data.uploadedAt) ||
          asString(data.UploadedDate ?? data.uploadedDate) ||
          document.createdAt,
        version:
          asString(data.VersionNumber ?? data.versionNumber) ||
          asString(data.Version ?? data.version) ||
          "1.0",
      };
    });

    const q = search.trim().toLowerCase();
    return mapped.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.type.toLowerCase().includes(q);
    });
  }, [documents, search, typeFilter]);

  function openUpload() {
    setEditing(false);
    setForm({
      name: "",
      type: "Other",
      uploadedDate: new Date().toISOString().slice(0, 10),
      version: "1.0",
      fileName: "",
      mimeType: "",
      fileSizeBytes: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(row: DocumentRow) {
    setEditing(true);
    const source = documents.find((entry) => entry.id === row.id);
    const data = asDataMap(source?.data);

    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      uploadedDate: row.uploadedDate ? row.uploadedDate.slice(0, 10) : "",
      version: row.version,
      fileName: asString(data.FileName ?? data.fileName) || row.name,
      mimeType: asString(data.MimeType ?? data.mimeType),
      fileSizeBytes: asNumber(data.FileSizeBytes ?? data.fileSizeBytes),
    });
    setDialogOpen(true);
  }

  async function saveDocument() {
    if (!form.name.trim()) {
      toast.error("Document name is required");
      return;
    }

    const payload: PmUpsertRequest = {
      name: form.name.trim(),
      title: form.name.trim(),
      data: {
        FileName: form.fileName || form.name.trim(),
        MimeType: form.mimeType || "application/octet-stream",
        FileSizeBytes: form.fileSizeBytes,
        UploadedAt: form.uploadedDate || null,
        UploadedDate: form.uploadedDate || null,
        DocumentType: form.type,
        VersionNumber: form.version || "1.0",
      },
    };

    setSaving(true);
    try {
      if (editing && form.id) {
        await api<PmEntityDto>(`/api/projects/${projectId}/documents/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        toast.success("Document updated");
      } else {
        await api<PmEntityDto>(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: payload,
        });
        toast.success("Document uploaded");
      }

      setDialogOpen(false);
      await load();
    } catch (error) {
      toast.error("Failed to save document", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument() {
    if (!pendingDelete) return;

    setSaving(true);
    try {
      await api<void>(`/api/projects/${projectId}/documents/${pendingDelete.id}`, {
        method: "DELETE",
      });
      toast.success("Document deleted");
      setDeleteOpen(false);
      setPendingDelete(null);
      await load();
    } catch (error) {
      const message =
        error instanceof ApiError && (error.status === 404 || error.status === 405)
          ? "Delete endpoint is not available yet for documents"
          : error instanceof Error
            ? error.message
            : "Unknown error";

      toast.error("Failed to delete document", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage project documents, versions, and upload metadata.
          </p>
        </div>
        <Button onClick={openUpload}>+ Upload Document</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Register</CardTitle>
          <CardDescription>
            Track documents by type, upload date, and revision version.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search document name or type"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded Date</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          No documents yet. Upload your first project document.
                        </p>
                        <Button size="sm" onClick={openUpload}>Upload Document</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-mono text-sm">{formatDate(row.uploadedDate)}</TableCell>
                      <TableCell>{row.version}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Document" : "Upload Document"}</DialogTitle>
            <DialogDescription>
              Provide document metadata and upload details for project filing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="document-file">File</Label>
              <Input
                id="document-file"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setForm((prev) => ({
                    ...prev,
                    fileName: file.name,
                    mimeType: file.type || "application/octet-stream",
                    fileSizeBytes: file.size,
                    name: prev.name || file.name,
                  }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-name">Name</Label>
              <Input
                id="document-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="IFC Structural Set"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-date">Uploaded Date</Label>
                <Input
                  id="document-date"
                  type="date"
                  value={form.uploadedDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, uploadedDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-version">Version</Label>
                <Input
                  id="document-version"
                  value={form.version}
                  onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveDocument} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Delete &quot;{pendingDelete?.name ?? "this document"}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteDocument} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
