"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Globe,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";
import {
  listCompanies,
  createCompany,
  updateCompany,
  deactivateCompany,
} from "@/lib/companies";
import type { Company, CreateCompanyCommand, UpdateCompanyCommand } from "@/lib/types";
import { toast } from "sonner";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const TIME_ZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

interface CompanyFormState {
  code: string;
  name: string;
  shortName: string;
  taxId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  website: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  isDefault: boolean;
  sortOrder: number;
}

const emptyForm: CompanyFormState = {
  code: "",
  name: "",
  shortName: "",
  taxId: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  phone: "",
  email: "",
  website: "",
  currency: "USD",
  timezone: "America/Los_Angeles",
  fiscalYearStartMonth: 1,
  isDefault: false,
  sortOrder: 0,
};

export default function CompaniesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { refreshCompanies } = useCompany();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies();
    }
  }, [isAdmin, fetchCompanies]);

  const openCreateDialog = () => {
    setEditingCompany(null);
    setForm({
      ...emptyForm,
      sortOrder: companies.length,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    setForm({
      code: company.code,
      name: company.name,
      shortName: company.shortName || "",
      taxId: company.taxId || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zipCode: company.zipCode || "",
      phone: company.phone || "",
      email: company.email || "",
      website: company.website || "",
      currency: company.currency || "USD",
      timezone: company.timezone || "America/Los_Angeles",
      fiscalYearStartMonth: company.fiscalYearStartMonth ?? 1,
      isDefault: company.isDefault,
      sortOrder: company.sortOrder,
    });
    setDialogOpen(true);
  };

  const updateForm = (field: keyof CompanyFormState, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Company code is required");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCompany) {
        // Update
        const payload: UpdateCompanyCommand = {
          code: form.code,
          name: form.name,
          shortName: form.shortName || null,
          taxId: form.taxId || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zipCode: form.zipCode || null,
          phone: form.phone || null,
          email: form.email || null,
          website: form.website || null,
          currency: form.currency,
          timezone: form.timezone,
          fiscalYearStartMonth: form.fiscalYearStartMonth,
          isDefault: form.isDefault,
          sortOrder: form.sortOrder,
        };

        const updated = await updateCompany(editingCompany.id, payload);
        setCompanies((prev) =>
          prev.map((c) => (c.id === editingCompany.id ? updated : c))
        );
        toast.success("Company updated successfully");
      } else {
        // Create
        const payload: CreateCompanyCommand = {
          code: form.code,
          name: form.name,
          shortName: form.shortName || undefined,
          taxId: form.taxId || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          website: form.website || undefined,
          currency: form.currency,
          timezone: form.timezone,
          fiscalYearStartMonth: form.fiscalYearStartMonth,
          isDefault: form.isDefault,
          sortOrder: form.sortOrder,
        };

        const created = await createCompany(payload);
        setCompanies((prev) => [...prev, created]);
        toast.success("Company created successfully");
      }

      setDialogOpen(false);
      setEditingCompany(null);
      // Refresh the company context (dropdown)
      await refreshCompanies();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save company";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deactivateCompany(deleteTarget.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} has been deactivated`);
      setDeleteTarget(null);
      await refreshCompanies();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to deactivate company";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  const activeCount = companies.filter((c) => c.isActive).length;
  const defaultCompany = companies.find((c) => c.isDefault);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Manage companies (legal entities) within your organization
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Summary Cards */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground">Total Companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Active Companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold truncate">
                {defaultCompany?.code || "—"}
              </div>
              <p className="text-xs text-muted-foreground">Default Company</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Companies
          </CardTitle>
          <CardDescription>
            Each company represents a separate legal entity with its own financials and projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={3} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["Code", "Name", "Location", "Status", "Default", "Actions"]}
                  rows={3}
                />
              </div>
            </>
          ) : companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add your first company to get started with multi-company management."
              actionLabel="+ Add Company"
              onAction={openCreateDialog}
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs bg-amber-100 text-amber-700 border-amber-200"
                          >
                            {company.code}
                          </Badge>
                          {company.isDefault && (
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <p className="font-medium mt-1">{company.name}</p>
                        {company.shortName && (
                          <p className="text-xs text-muted-foreground">
                            {company.shortName}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          company.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {(company.city || company.state) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[company.city, company.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(company)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {!company.isDefault && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteTarget(company)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs bg-amber-100 text-amber-700 border-amber-200"
                          >
                            {company.code}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{company.name}</span>
                            {company.shortName && (
                              <>
                                <br />
                                <span className="text-xs text-muted-foreground">
                                  {company.shortName}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {company.city || company.state
                            ? [company.city, company.state]
                                .filter(Boolean)
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              company.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {company.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {company.isDefault && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(company)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            {!company.isDefault && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget(company)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Company Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add New Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update the company details below."
                : "Create a new legal entity within your organization."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Information
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="code">Company Code *</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => updateForm("code", e.target.value.toUpperCase())}
                    placeholder="01 or GGC"
                    maxLength={20}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Short identifier (e.g., &quot;01&quot;, &quot;GGC&quot;)
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Garrison General Contractors LLC"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shortName">Short Name</Label>
                  <Input
                    id="shortName"
                    value={form.shortName}
                    onChange={(e) => updateForm("shortName", e.target.value)}
                    placeholder="Garrison GC"
                  />
                  <p className="text-xs text-muted-foreground">
                    Display name for the company switcher
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / EIN</Label>
                  <Input
                    id="taxId"
                    value={form.taxId}
                    onChange={(e) => updateForm("taxId", e.target.value)}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Street Address</Label>
                <Input
                  id="companyAddress"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="companyCity">City</Label>
                  <Input
                    id="companyCity"
                    value={form.city}
                    onChange={(e) => updateForm("city", e.target.value)}
                    placeholder="Los Angeles"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyState">State</Label>
                  <Select
                    value={form.state || "none"}
                    onValueChange={(value) =>
                      updateForm("state", value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="companyState">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select state</SelectItem>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyZip">ZIP Code</Label>
                  <Input
                    id="companyZip"
                    value={form.zipCode}
                    onChange={(e) => updateForm("zipCode", e.target.value)}
                    placeholder="90001"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateForm("phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    placeholder="info@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWebsite" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Website
                </Label>
                <Input
                  id="companyWebsite"
                  type="url"
                  value={form.website}
                  onChange={(e) => updateForm("website", e.target.value)}
                  placeholder="https://www.company.com"
                />
              </div>
            </div>

            {/* Business Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Business Settings</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="companyCurrency">Currency</Label>
                  <Input
                    id="companyCurrency"
                    value={form.currency}
                    onChange={(e) =>
                      updateForm("currency", e.target.value.toUpperCase())
                    }
                    placeholder="USD"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTimezone">Time Zone</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(value) => updateForm("timezone", value)}
                  >
                    <SelectTrigger id="companyTimezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyFiscalYear">Fiscal Year Start</Label>
                  <Select
                    value={String(form.fiscalYearStartMonth)}
                    onValueChange={(value) =>
                      updateForm("fiscalYearStartMonth", parseInt(value))
                    }
                  >
                    <SelectTrigger id="companyFiscalYear">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companySortOrder">Sort Order</Label>
                  <Input
                    id="companySortOrder"
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={(e) =>
                      updateForm("sortOrder", parseInt(e.target.value) || 0)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Order in the company switcher (lower = first)
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Checkbox
                    id="companyIsDefault"
                    checked={form.isDefault}
                    onCheckedChange={(checked) =>
                      updateForm("isDefault", !!checked)
                    }
                  />
                  <div>
                    <Label htmlFor="companyIsDefault" className="cursor-pointer">
                      Default Company
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-selected for new users on first login
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              onClick={handleSave}
              loading={isSaving}
              loadingText="Saving..."
              className="bg-amber-500 hover:bg-amber-600"
            >
              {editingCompany ? "Save Changes" : "Create Company"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Deactivate ${deleteTarget?.name}?`}
        description="This will deactivate the company. Existing data will be preserved but no new records can be created for this company. Users will no longer see it in the company switcher."
        confirmLabel="Deactivate"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        variant="warning"
      />
    </div>
  );
}
