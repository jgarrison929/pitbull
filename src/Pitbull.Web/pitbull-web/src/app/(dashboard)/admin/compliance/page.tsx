"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Edit, Plus, ShieldCheck, Trash2 } from "lucide-react";

const ENTITY_TYPES = ["Employee", "Subcontractor", "Company"] as const;
const DOCUMENT_TYPES = [
  "OSHA10",
  "OSHA30",
  "FirstAid",
  "CPR",
  "CDL",
  "GeneralLiability",
  "WorkersComp",
  "AutoInsurance",
  "BondCapacity",
  "ContractorsLicense",
  "BusinessLicense",
  "W9",
  "COI",
] as const;
const STATUS_TYPES = ["Active", "ExpiringSoon", "Expired", "Revoked"] as const;

type EntityType = (typeof ENTITY_TYPES)[number];
type DocumentType = (typeof DOCUMENT_TYPES)[number];
type ComplianceStatus = (typeof STATUS_TYPES)[number];

interface ComplianceDocument {
  id: string;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  documentType: DocumentType;
  documentNumber: string;
  issuedDate: string | null;
  expirationDate: string | null;
  status: ComplianceStatus;
  fileUrl: string | null;
  notes: string | null;
  daysUntilExpiration: number | null;
}

interface ComplianceDashboard {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

interface ComplianceFormState {
  entityType: EntityType;
  entityId: string;
  documentType: DocumentType;
  documentNumber: string;
  issuedDate: string;
  expirationDate: string;
  status: ComplianceStatus;
  fileUrl: string;
  notes: string;
}

const defaultForm: ComplianceFormState = {
  entityType: "Employee",
  entityId: "",
  documentType: "OSHA10",
  documentNumber: "",
  issuedDate: "",
  expirationDate: "",
  status: "Active",
  fileUrl: "",
  notes: "",
};

const statusBadgeClass: Record<ComplianceStatus, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  ExpiringSoon: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
  Expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  Revoked: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoDate(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00Z`).toISOString();
}

export default function CompliancePage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [expiringAlerts, setExpiringAlerts] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("all");
  const [entityIdFilter, setEntityIdFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [form, setForm] = useState<ComplianceFormState>(defaultForm);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const buildQueryString = useMemo(() => {
    const params = new URLSearchParams();

    if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (documentTypeFilter !== "all") params.set("documentType", documentTypeFilter);

    const parsedEntityId = entityIdFilter.trim();
    if (parsedEntityId) {
      params.set("entityId", parsedEntityId);
    }

    return params.toString();
  }, [documentTypeFilter, entityIdFilter, entityTypeFilter, statusFilter]);

  const fetchDocuments = useCallback(async () => {
    const endpoint = buildQueryString
      ? `/api/compliance-documents?${buildQueryString}`
      : "/api/compliance-documents";

    const result = await api<ComplianceDocument[]>(endpoint);
    setDocuments(result);
  }, [buildQueryString]);

  const fetchDashboard = useCallback(async () => {
    const result = await api<ComplianceDashboard>("/api/compliance-documents/dashboard");
    setDashboard(result);
  }, []);

  const fetchExpiring = useCallback(async () => {
    const result = await api<ComplianceDocument[]>("/api/compliance-documents/expiring?days=30");
    setExpiringAlerts(result);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchDocuments(), fetchDashboard(), fetchExpiring()]);
    } catch {
      toast.error("Failed to load compliance documents");
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboard, fetchDocuments, fetchExpiring]);

  useEffect(() => {
    if (isAdmin) {
      refreshAll();
    }
  }, [isAdmin, refreshAll]);

  const openAddDialog = () => {
    setEditingDoc(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEditDialog = (doc: ComplianceDocument) => {
    setEditingDoc(doc);
    setForm({
      entityType: doc.entityType,
      entityId: doc.entityId,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber,
      issuedDate: toDateInputValue(doc.issuedDate),
      expirationDate: toDateInputValue(doc.expirationDate),
      status: doc.status,
      fileUrl: doc.fileUrl ?? "",
      notes: doc.notes ?? "",
    });
    setDialogOpen(true);
  };

  const saveDocument = async () => {
    if (!form.entityId.trim()) {
      toast.error("Entity ID is required");
      return;
    }

    setIsSaving(true);
    try {
      const body = {
        entityType: form.entityType,
        entityId: form.entityId.trim(),
        documentType: form.documentType,
        documentNumber: form.documentNumber.trim(),
        issuedDate: toIsoDate(form.issuedDate),
        expirationDate: toIsoDate(form.expirationDate),
        clearExpirationDate: !form.expirationDate,
        status: form.status,
        fileUrl: form.fileUrl.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingDoc) {
        await api(`/api/compliance-documents/${editingDoc.id}`, {
          method: "PUT",
          body,
        });
        toast.success("Compliance document updated");
      } else {
        await api("/api/compliance-documents", {
          method: "POST",
          body,
        });
        toast.success("Compliance document added");
      }

      setDialogOpen(false);
      await refreshAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save document";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!confirm("Delete this compliance document? This action cannot be undone.")) return;
    try {
      await api(`/api/compliance-documents/${id}`, { method: "DELETE" });
      toast.success("Compliance document deleted");
      await refreshAll();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compliance Tracking</h1>
          <p className="text-muted-foreground">
            Track certifications, licenses, and insurance for employees, subcontractors, and companies.
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-amber-500 text-white hover:bg-amber-600">
          <Plus className="mr-2 h-4 w-4" />
          Add Document
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{dashboard?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">Total Docs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{dashboard?.active ?? 0}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {dashboard?.expiringSoon ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{dashboard?.expired ?? 0}</div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All entity types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_TYPES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All document types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entity ID</Label>
              <Input
                placeholder="Filter by entity GUID"
                value={entityIdFilter}
                onChange={(e) => setEntityIdFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Doc Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No compliance documents found.
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="font-medium">{doc.entityName}</div>
                        <div className="text-xs text-muted-foreground">{doc.entityType}</div>
                      </TableCell>
                      <TableCell>{doc.documentType}</TableCell>
                      <TableCell className="font-mono text-xs">{doc.documentNumber}</TableCell>
                      <TableCell>{formatDate(doc.issuedDate)}</TableCell>
                      <TableCell>{formatDate(doc.expirationDate)}</TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[doc.status]}>{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(doc)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Expiration Alerts (Next 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expiringAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming expirations.</p>
          ) : (
            <div className="space-y-2">
              {expiringAlerts.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">
                      {doc.entityName} - {doc.documentType}
                    </p>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(doc.expirationDate)}</p>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">
                    {doc.daysUntilExpiration ?? 0} days
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit" : "Add"} Compliance Document</DialogTitle>
            <DialogDescription>
              Enter compliance document details for employees, subcontractors, or companies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select
                value={form.entityType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, entityType: value as EntityType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entity ID</Label>
              <Input
                value={form.entityId}
                onChange={(e) => setForm((prev) => ({ ...prev, entityId: e.target.value }))}
                placeholder="Entity GUID"
              />
            </div>

            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={form.documentType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, documentType: value as DocumentType }))}
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
              <Label>Document Number</Label>
              <Input
                value={form.documentNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
                placeholder="License/Certificate/Policy #"
              />
            </div>

            <div className="space-y-2">
              <Label>Issued Date</Label>
              <Input
                type="date"
                value={form.issuedDate}
                onChange={(e) => setForm((prev) => ({ ...prev, issuedDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Expiration Date</Label>
              <Input
                type="date"
                value={form.expirationDate}
                onChange={(e) => setForm((prev) => ({ ...prev, expirationDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ComplianceStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_TYPES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>File URL</Label>
              <Input
                value={form.fileUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, fileUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={saveDocument} disabled={isSaving}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
