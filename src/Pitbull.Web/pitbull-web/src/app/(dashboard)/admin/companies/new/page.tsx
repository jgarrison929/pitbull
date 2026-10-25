"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  BookOpen,
  Calendar,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";
import {
  getCoaTemplates,
  provisionCompany,
  type CoaTemplateInfo,
  type CompanyProvisioningRequest,
  type CompanyProvisioningResult,
} from "@/lib/company-provisioning";
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

const INDUSTRY_TYPES = [
  { value: "general-contractor", label: "General Contractor" },
  { value: "specialty-contractor", label: "Specialty Contractor" },
  { value: "real-estate-developer", label: "Real Estate Developer" },
  { value: "real-estate-partnership", label: "Real Estate Partnership" },
  { value: "property-management", label: "Property Management" },
  { value: "construction-management", label: "Construction Management" },
  { value: "engineering", label: "Engineering Firm" },
  { value: "architecture", label: "Architecture Firm" },
  { value: "other", label: "Other" },
];

interface FormState {
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
  industryType: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  coaTemplateKey: string;
  periodsToCreate: number;
}

const initialForm: FormState = {
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
  industryType: "",
  currency: "USD",
  timezone: "America/Los_Angeles",
  fiscalYearStartMonth: 1,
  coaTemplateKey: "construction-default",
  periodsToCreate: 12,
};

export default function NewCompanyPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { refreshCompanies } = useCompany();

  const [form, setForm] = useState<FormState>(initialForm);
  const [templates, setTemplates] = useState<CoaTemplateInfo[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<CompanyProvisioningResult | null>(null);

  // Check admin access
  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  // Load templates
  const fetchTemplates = useCallback(async () => {
    try {
      const data = await getCoaTemplates();
      setTemplates(data);
    } catch {
      toast.error("Failed to load chart of accounts templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchTemplates();
    }
  }, [isAdmin, fetchTemplates]);

  const updateForm = (field: keyof FormState, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
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
      const request: CompanyProvisioningRequest = {
        code: form.code.trim(),
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        industryType: form.industryType || undefined,
        currency: form.currency,
        timezone: form.timezone,
        fiscalYearStartMonth: form.fiscalYearStartMonth,
        coaTemplateKey: form.coaTemplateKey,
        periodsToCreate: form.periodsToCreate,
      };

      const provisionResult = await provisionCompany(request);
      setResult(provisionResult);
      toast.success("Company provisioned successfully!");
      await refreshCompanies();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to provision company";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) return null;

  // ── Success State ──
  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Company Provisioned Successfully</CardTitle>
                <CardDescription>{result.summary}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Company</span>
                <p className="font-medium">{result.companyName} ({result.companyCode})</p>
              </div>
              <div>
                <span className="text-muted-foreground">COA Template</span>
                <p className="font-medium capitalize">{result.coaTemplate.replace(/-/g, " ")}</p>
              </div>
              <div>
                <span className="text-muted-foreground">GL Accounts Created</span>
                <p className="font-medium">{result.accountsCreated}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Accounting Periods</span>
                <p className="font-medium">{result.periodsCreated}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => router.push("/admin/companies")}
                className="bg-amber-500 hover:bg-amber-600"
              >
                View All Companies
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setForm(initialForm);
                }}
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Form State ──
  const selectedTemplate = templates.find((t) => t.key === form.coaTemplateKey);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/companies")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Company Setup</h1>
          <p className="text-muted-foreground">
            Create a new legal entity with chart of accounts and accounting periods
          </p>
        </div>
      </div>

      {/* Step 1: Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-500" />
            Company Information
          </CardTitle>
          <CardDescription>
            Basic details about the new legal entity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="code">Company Code *</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => updateForm("code", e.target.value.toUpperCase())}
                placeholder="05 or REP"
                maxLength={20}
                required
              />
              <p className="text-xs text-muted-foreground">
                Unique short identifier
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Oak Creek Development Partners LLC"
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
                placeholder="Oak Creek Dev"
              />
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

          <div className="space-y-2">
            <Label htmlFor="industryType">Industry Type</Label>
            <Select
              value={form.industryType || "none"}
              onValueChange={(value) =>
                updateForm("industryType", value === "none" ? "" : value)
              }
            >
              <SelectTrigger id="industryType">
                <SelectValue placeholder="Select industry type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select industry type</SelectItem>
                {INDUSTRY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Address & Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            Address & Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateForm("address", e.target.value)}
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
                placeholder="Sacramento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={form.state || "none"}
                onValueChange={(value) =>
                  updateForm("state", value === "none" ? "" : value)
                }
              >
                <SelectTrigger id="state">
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
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={form.zipCode}
                onChange={(e) => updateForm("zipCode", e.target.value)}
                placeholder="95814"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="info@company.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-1">
              <Globe className="h-3 w-3" /> Website
            </Label>
            <Input
              id="website"
              type="url"
              value={form.website}
              onChange={(e) => updateForm("website", e.target.value)}
              placeholder="https://www.company.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Chart of Accounts Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-500" />
            Chart of Accounts Template
          </CardTitle>
          <CardDescription>
            Select a pre-built chart of accounts to provision for this company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingTemplates ? (
            <div className="h-10 bg-muted rounded animate-pulse" />
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="coaTemplate">Template</Label>
                <Select
                  value={form.coaTemplateKey}
                  onValueChange={(value) => updateForm("coaTemplateKey", value)}
                >
                  <SelectTrigger id="coaTemplate">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="rounded-lg bg-muted/50 border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Fiscal Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            Fiscal Year & Accounting Periods
          </CardTitle>
          <CardDescription>
            Configure the fiscal calendar and initial accounting periods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Fiscal Year Starts</Label>
              <Select
                value={String(form.fiscalYearStartMonth)}
                onValueChange={(value) =>
                  updateForm("fiscalYearStartMonth", parseInt(value))
                }
              >
                <SelectTrigger id="fiscalYearStart">
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
            <div className="space-y-2">
              <Label htmlFor="timezone">Time Zone</Label>
              <Select
                value={form.timezone}
                onValueChange={(value) => updateForm("timezone", value)}
              >
                <SelectTrigger id="timezone">
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
              <Label htmlFor="periodsToCreate">Periods to Create</Label>
              <Select
                value={String(form.periodsToCreate)}
                onValueChange={(value) =>
                  updateForm("periodsToCreate", parseInt(value))
                }
              >
                <SelectTrigger id="periodsToCreate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months (1 year)</SelectItem>
                  <SelectItem value="18">18 months</SelectItem>
                  <SelectItem value="24">24 months (2 years)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={form.currency}
              onChange={(e) =>
                updateForm("currency", e.target.value.toUpperCase())
              }
              placeholder="USD"
              maxLength={10}
              className="max-w-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pb-8">
        <Button variant="outline" onClick={() => router.push("/admin/companies")}>
          Cancel
        </Button>
        <LoadingButton
          onClick={handleSubmit}
          loading={isSaving}
          loadingText="Provisioning..."
          className="bg-amber-500 hover:bg-amber-600 min-w-[180px]"
          disabled={!form.code.trim() || !form.name.trim()}
        >
          <Building2 className="h-4 w-4 mr-2" />
          Create Company
        </LoadingButton>
      </div>
    </div>
  );
}
