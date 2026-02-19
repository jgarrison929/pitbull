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

interface Customer {
  id: string;
  name: string;
  code: string;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  paymentTerms?: string | null;
  creditLimit?: number | null;
  isActive: boolean;
}

interface ListCustomersResult {
  items: Customer[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CreateCustomerCommand {
  name: string;
  code: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  paymentTerms?: string;
  creditLimit?: number;
  isActive?: boolean;
}

interface UpdateCustomerCommand {
  name?: string;
  code?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  paymentTerms?: string | null;
  creditLimit?: number | null;
  isActive?: boolean;
}

interface CustomerFormData {
  name: string;
  code: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  paymentTerms: string;
  creditLimit: string;
  isActive: boolean;
}

const emptyFormData: CustomerFormData = {
  name: "",
  code: "",
  contactName: "",
  contactEmail: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  paymentTerms: "",
  creditLimit: "",
  isActive: true,
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListCustomersResult>(`/api/customers?${params.toString()}`);
      setCustomers(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, page, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  function openCreateDialog() {
    setEditingCustomer(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      code: customer.code,
      contactName: customer.contactName || "",
      contactEmail: customer.contactEmail || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      zip: customer.zip || "",
      paymentTerms: customer.paymentTerms || "",
      creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : "",
      isActive: customer.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Name and Code are required");
      return;
    }

    const parsedCreditLimit = formData.creditLimit.trim()
      ? Number(formData.creditLimit)
      : null;

    if (parsedCreditLimit != null && Number.isNaN(parsedCreditLimit)) {
      toast.error("Credit limit must be a number");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        const payload: UpdateCustomerCommand = {
          name: formData.name,
          code: formData.code,
          contactName: formData.contactName || null,
          contactEmail: formData.contactEmail || null,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          paymentTerms: formData.paymentTerms || null,
          creditLimit: parsedCreditLimit,
          isActive: formData.isActive,
        };
        await api<Customer>(`/api/customers/${editingCustomer.id}`, { method: "PUT", body: payload });
        toast.success("Customer updated");
      } else {
        const payload: CreateCustomerCommand = {
          name: formData.name,
          code: formData.code,
          contactName: formData.contactName || undefined,
          contactEmail: formData.contactEmail || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip: formData.zip || undefined,
          paymentTerms: formData.paymentTerms || undefined,
          creditLimit: parsedCreditLimit ?? undefined,
          isActive: formData.isActive,
        };
        await api<Customer>("/api/customers", { method: "POST", body: payload });
        toast.success("Customer created");
      }

      setDialogOpen(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      await api(`/api/customers/${customer.id}`, { method: "DELETE" });
      toast.success("Customer deleted");
      fetchCustomers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete customer");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage AR customer master records</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={openCreateDialog}>
          + Add Customer
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
        <TableSkeleton headers={["Customer", "Code", "Contact", "Credit Limit", "Status", "Actions"]} rows={8} />
      ) : totalCount === 0 ? (
        <EmptyState title="No customers found" description="Create your first customer to begin AR setup." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.code}</TableCell>
                    <TableCell>{customer.contactEmail || customer.contactName || "—"}</TableCell>
                    <TableCell>{customer.creditLimit != null ? customer.creditLimit.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={customer.isActive ? "default" : "secondary"}>
                        {customer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(customer)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(customer)}>
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
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Create Customer"}</DialogTitle>
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
              <Label>Credit Limit</Label>
              <Input value={formData.creditLimit} onChange={(e) => setFormData((p) => ({ ...p, creditLimit: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <input
                id="customerIsActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              />
              <Label htmlFor="customerIsActive">Active</Label>
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
              {editingCustomer ? "Save Changes" : "Create Customer"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
