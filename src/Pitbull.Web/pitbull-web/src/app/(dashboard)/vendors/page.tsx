"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

interface Vendor {
  id: string;
  name: string;
  code: string;
  taxId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  insuranceExpDate?: string | null;
  w9OnFile: boolean;
  minorityWbeStatus?: string | null;
  tradeClassification?: string | null;
  paymentTerms?: string | null;
  isActive: boolean;
}

interface ListVendorsResult {
  items: Vendor[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CreateVendorCommand {
  name: string;
  code: string;
  taxId?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  insuranceExpDate?: string | null;
  w9OnFile?: boolean;
  minorityWbeStatus?: string;
  tradeClassification?: string;
  paymentTerms?: string;
  isActive?: boolean;
}

interface UpdateVendorCommand {
  name?: string;
  code?: string;
  taxId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  insuranceExpDate?: string | null;
  w9OnFile?: boolean;
  minorityWbeStatus?: string | null;
  tradeClassification?: string | null;
  paymentTerms?: string | null;
  isActive?: boolean;
}

interface VendorFormData {
  name: string;
  code: string;
  taxId: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  insuranceExpDate: string;
  w9OnFile: boolean;
  minorityWbeStatus: string;
  tradeClassification: string;
  paymentTerms: string;
  isActive: boolean;
}

const emptyFormData: VendorFormData = {
  name: "",
  code: "",
  taxId: "",
  contactName: "",
  contactEmail: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  insuranceExpDate: "",
  w9OnFile: false,
  minorityWbeStatus: "",
  tradeClassification: "",
  paymentTerms: "",
  isActive: true,
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState<VendorFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVendors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListVendorsResult>(`/api/vendors?${params.toString()}`);
      setVendors(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, page, search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  const sortedVendors = useMemo(() => {
    return [...vendors].sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors]);

  function openCreateDialog() {
    setEditingVendor(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      code: vendor.code,
      taxId: vendor.taxId || "",
      contactName: vendor.contactName || "",
      contactEmail: vendor.contactEmail || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      zip: vendor.zip || "",
      insuranceExpDate: vendor.insuranceExpDate || "",
      w9OnFile: vendor.w9OnFile,
      minorityWbeStatus: vendor.minorityWbeStatus || "",
      tradeClassification: vendor.tradeClassification || "",
      paymentTerms: vendor.paymentTerms || "",
      isActive: vendor.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and Code are required");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVendor) {
        const payload: UpdateVendorCommand = {
          name: formData.name,
          code: formData.code,
          taxId: formData.taxId || null,
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          insuranceExpDate: formData.insuranceExpDate || null,
          w9OnFile: formData.w9OnFile,
          minorityWbeStatus: formData.minorityWbeStatus || null,
          tradeClassification: formData.tradeClassification || null,
          paymentTerms: formData.paymentTerms || null,
          isActive: formData.isActive,
        };
        await api<Vendor>(`/api/vendors/${editingVendor.id}`, { method: "PUT", body: payload });
        toast.success("Vendor updated");
      } else {
        const payload: CreateVendorCommand = {
          name: formData.name,
          code: formData.code,
          taxId: formData.taxId || undefined,
          contactName: formData.contactName || undefined,
          contactEmail: formData.contactEmail || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip: formData.zip || undefined,
          insuranceExpDate: formData.insuranceExpDate || null,
          w9OnFile: formData.w9OnFile,
          minorityWbeStatus: formData.minorityWbeStatus || undefined,
          tradeClassification: formData.tradeClassification || undefined,
          paymentTerms: formData.paymentTerms || undefined,
          isActive: formData.isActive,
        };
        await api<Vendor>("/api/vendors", { method: "POST", body: payload });
        toast.success("Vendor created");
      }

      setDialogOpen(false);
      fetchVendors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save vendor");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(vendor: Vendor) {
    if (!confirm(`Delete vendor "${vendor.name}"?`)) return;
    try {
      await api(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      toast.success("Vendor deleted");
      fetchVendors();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete vendor");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground">Manage AP vendor master records</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreateDialog}>
          + Add Vendor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input placeholder="Name, code, contact..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                  <SelectItem value={ALL_VALUE}>All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton headers={["Vendor", "Code", "Contact", "Terms", "Status", "Actions"]} rows={8} />
      ) : totalCount === 0 ? (
        <EmptyState title="No vendors found" description="Create your first vendor to begin AP setup." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>{vendor.code}</TableCell>
                    <TableCell>{vendor.contactEmail || vendor.contactName || "—"}</TableCell>
                    <TableCell>{vendor.paymentTerms || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={vendor.isActive ? "default" : "secondary"}>
                        {vendor.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(vendor)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(vendor)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {totalCount === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1}-
          {Math.min(page * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Create Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={formData.code} onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input value={formData.contactName} onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input value={formData.contactEmail} onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input value={formData.paymentTerms} onChange={(e) => setFormData((p) => ({ ...p, paymentTerms: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Trade Classification</Label>
              <Input value={formData.tradeClassification} onChange={(e) => setFormData((p) => ({ ...p, tradeClassification: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Minority/WBE Status</Label>
              <Input value={formData.minorityWbeStatus} onChange={(e) => setFormData((p) => ({ ...p, minorityWbeStatus: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input value={formData.taxId} onChange={(e) => setFormData((p) => ({ ...p, taxId: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Insurance Expiration</Label>
              <Input type="date" value={formData.insuranceExpDate} onChange={(e) => setFormData((p) => ({ ...p, insuranceExpDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input
                id="w9OnFile"
                type="checkbox"
                checked={formData.w9OnFile}
                onChange={(e) => setFormData((p) => ({ ...p, w9OnFile: e.target.checked }))}
              />
              <Label htmlFor="w9OnFile">W-9 On File</Label>
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Zip</Label>
              <Input value={formData.zip} onChange={(e) => setFormData((p) => ({ ...p, zip: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isSubmitting} onClick={handleSubmit}>
              {editingVendor ? "Save Changes" : "Create Vendor"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
