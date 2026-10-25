"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormSkeleton } from "@/components/skeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ImageIcon,
  CalendarDays,
  Timer,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { CompanySettings, UpdateCompanySettingsCommand } from "@/lib/types";
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

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
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

const WORK_DAYS = [
  { value: "Mon", label: "Monday" },
  { value: "Tue", label: "Tuesday" },
  { value: "Wed", label: "Wednesday" },
  { value: "Thu", label: "Thursday" },
  { value: "Fri", label: "Friday" },
  { value: "Sat", label: "Saturday" },
  { value: "Sun", label: "Sunday" },
];

function getFiscalYearEnd(startMonth: number): string {
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  return MONTHS.find((m) => m.value === String(endMonth))?.label || "";
}

export default function CompanySettingsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateCompanySettingsCommand>({
    name: "",
    taxId: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    website: "",
    timezone: "America/Los_Angeles",
    fiscalYearStartMonth: 1,
    payPeriodType: "Weekly",
    defaultWorkWeekDays: "Mon,Tue,Wed,Thu,Fri",
    overtimeEnabled: true,
    dailyOtThreshold: 8,
    weeklyOtThreshold: 40,
    dailyDtThreshold: 12,
    californiaOtRules: false,
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<CompanySettings>("/api/admin/company");
      setForm({
        name: data.name || "",
        taxId: data.taxId || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        zipCode: data.zipCode || "",
        phone: data.phone || "",
        website: data.website || "",
        timezone: data.timezone || "America/Los_Angeles",
        fiscalYearStartMonth: data.fiscalYearStartMonth ?? 1,
        payPeriodType: data.payPeriodType || "Weekly",
        defaultWorkWeekDays: data.defaultWorkWeekDays || "Mon,Tue,Wed,Thu,Fri",
        overtimeEnabled: data.overtimeEnabled ?? true,
        dailyOtThreshold: data.dailyOtThreshold ?? 8,
        weeklyOtThreshold: data.weeklyOtThreshold ?? 40,
        dailyDtThreshold: data.dailyDtThreshold ?? 12,
        californiaOtRules: data.californiaOtRules ?? false,
      });
    } catch {
      toast.error("Failed to load company settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin, fetchSettings]);

  const updateForm = (field: keyof UpdateCompanySettingsCommand, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const selectedWorkDays = (form.defaultWorkWeekDays || "Mon,Tue,Wed,Thu,Fri").split(",");

  const toggleWorkDay = (day: string) => {
    const current = selectedWorkDays.includes(day)
      ? selectedWorkDays.filter((d) => d !== day)
      : [...selectedWorkDays, day];
    const ordered = WORK_DAYS.filter((wd) => current.includes(wd.value)).map((wd) => wd.value);
    updateForm("defaultWorkWeekDays", ordered.join(","));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name?.trim()) {
      setErrorMessage("Company name is required");
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api<CompanySettings>("/api/admin/company", {
        method: "PUT",
        body: form,
      });
      setHasChanges(false);
      setSuccessMessage("Company settings saved successfully!");
      toast.success("Company settings saved");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save settings";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization&apos;s information and preferences
          </p>
        </div>
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your organization&apos;s information and preferences
          </p>
        </div>
        {hasChanges && (
          <span className="text-sm text-amber-600 font-medium">
            You have unsaved changes
          </span>
        )}
      </div>

      {successMessage && (
        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Core company details used throughout the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={form.name || ""}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Pitbull Construction Solutions"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / EIN</Label>
                <Input
                  id="taxId"
                  value={form.taxId || ""}
                  onChange={(e) => updateForm("taxId", e.target.value || null)}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
            <CardDescription>Company headquarters location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={form.address || ""}
                onChange={(e) => updateForm("address", e.target.value || null)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city || ""}
                  onChange={(e) => updateForm("city", e.target.value || null)}
                  placeholder="Los Angeles"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={form.state || ""}
                  onValueChange={(value) => updateForm("state", value || null)}
                >
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={form.zipCode || ""}
                  onChange={(e) => updateForm("zipCode", e.target.value || null)}
                  placeholder="90001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              How clients and partners can reach your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone || ""}
                  onChange={(e) => updateForm("phone", e.target.value || null)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Website
                </Label>
                <Input
                  id="website"
                  type="url"
                  value={form.website || ""}
                  onChange={(e) => updateForm("website", e.target.value || null)}
                  placeholder="https://www.company.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fiscal Year & Time Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fiscal Year &amp; Regional
            </CardTitle>
            <CardDescription>
              Fiscal year boundaries and time zone for reporting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fiscalYearStartMonth">Fiscal Year Start</Label>
                <Select
                  value={String(form.fiscalYearStartMonth ?? 1)}
                  onValueChange={(value) =>
                    updateForm("fiscalYearStartMonth", parseInt(value))
                  }
                >
                  <SelectTrigger id="fiscalYearStartMonth">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year End</Label>
                <Input
                  value={getFiscalYearEnd(form.fiscalYearStartMonth ?? 1)}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Calculated from start month
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Time Zone
                </Label>
                <Select
                  value={form.timezone || "America/Los_Angeles"}
                  onValueChange={(value) => updateForm("timezone", value)}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select time zone" />
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
            </div>
          </CardContent>
        </Card>

        {/* Pay Period Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Pay Period Configuration
            </CardTitle>
            <CardDescription>
              How often payroll cycles run and which days make up a standard work week
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payPeriodType">Pay Period Frequency</Label>
                <Select
                  value={form.payPeriodType || "Weekly"}
                  onValueChange={(value) => updateForm("payPeriodType", value)}
                >
                  <SelectTrigger id="payPeriodType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly (52/year)</SelectItem>
                    <SelectItem value="BiWeekly">Bi-Weekly (26/year)</SelectItem>
                    <SelectItem value="SemiMonthly">Semi-Monthly (24/year)</SelectItem>
                    <SelectItem value="Monthly">Monthly (12/year)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Default Work Week Days</Label>
              <p className="text-xs text-muted-foreground">
                Select the days that make up a standard work week
              </p>
              <div className="flex flex-wrap gap-2">
                {WORK_DAYS.map((day) => {
                  const isSelected = selectedWorkDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkDay(day.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[44px] ${
                        isSelected
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-background text-muted-foreground border-border hover:border-amber-300"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedWorkDays.length} day{selectedWorkDays.length !== 1 ? "s" : ""} selected
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Overtime Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Overtime Rules
            </CardTitle>
            <CardDescription>
              Configure daily and weekly overtime thresholds for labor cost calculations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Overtime Calculation</Label>
                <p className="text-xs text-muted-foreground">
                  When disabled, all hours are treated as regular time
                </p>
              </div>
              <Switch
                checked={form.overtimeEnabled ?? true}
                onCheckedChange={(checked) => updateForm("overtimeEnabled", checked)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dailyOt">Daily OT Threshold (hours)</Label>
                <Input
                  id="dailyOt"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={form.dailyOtThreshold ?? 8}
                  onChange={(e) =>
                    updateForm("dailyOtThreshold", parseFloat(e.target.value) || 8)
                  }
                  disabled={!form.overtimeEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Hours before overtime kicks in (CA default: 8)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyOt">Weekly OT Threshold (hours)</Label>
                <Input
                  id="weeklyOt"
                  type="number"
                  min={0}
                  max={168}
                  step={1}
                  value={form.weeklyOtThreshold ?? 40}
                  onChange={(e) =>
                    updateForm("weeklyOtThreshold", parseFloat(e.target.value) || 40)
                  }
                  disabled={!form.overtimeEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Federal default: 40 hours/week
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyDt">Daily Double-Time Threshold (hours)</Label>
                <Input
                  id="dailyDt"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={form.dailyDtThreshold ?? 12}
                  onChange={(e) =>
                    updateForm("dailyDtThreshold", parseFloat(e.target.value) || 12)
                  }
                  disabled={!form.overtimeEnabled}
                />
                <p className="text-xs text-muted-foreground">
                  Hours before double-time kicks in (CA default: 12)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>California Overtime Rules</Label>
                <p className="text-xs text-muted-foreground">
                  Enables daily OT after 8 hours, daily DT after 12 hours, and 7th consecutive day rules
                </p>
              </div>
              <Switch
                checked={form.californiaOtRules ?? false}
                onCheckedChange={(checked) => updateForm("californiaOtRules", checked)}
                disabled={!form.overtimeEnabled}
              />
            </div>

            {/* Visual breakdown */}
            {form.overtimeEnabled && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  DAILY BREAKDOWN
                </p>
                <div className="flex h-6 rounded-full overflow-hidden text-[10px] font-medium">
                  <div
                    className="bg-amber-400 text-white flex items-center justify-center"
                    style={{
                      width: `${((form.dailyOtThreshold ?? 8) / (form.dailyDtThreshold ?? 12)) * 100}%`,
                    }}
                  >
                    Regular ({form.dailyOtThreshold ?? 8}h)
                  </div>
                  <div
                    className="bg-amber-500 text-white flex items-center justify-center"
                    style={{
                      width: `${
                        (((form.dailyDtThreshold ?? 12) - (form.dailyOtThreshold ?? 8)) /
                          (form.dailyDtThreshold ?? 12)) *
                        100
                      }%`,
                    }}
                  >
                    OT 1.5x ({(form.dailyDtThreshold ?? 12) - (form.dailyOtThreshold ?? 8)}h)
                  </div>
                  <div className="bg-red-500 text-white flex items-center justify-center flex-1">
                    DT 2x
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logo / Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo &amp; Branding
            </CardTitle>
            <CardDescription>
              Company logo for reports, invoices, and the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-500/10 mb-4">
                <Building2 className="h-8 w-8 text-amber-500" />
              </div>
              <p className="text-sm font-medium">Company Logo</p>
              <p className="text-xs text-muted-foreground mb-4">
                Drag &amp; drop or click to upload (PNG, SVG, JPG — max 2MB)
              </p>
              <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={() => toast.info("Logo upload feature coming soon")}
                />
                Choose File
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <LoadingButton
            type="submit"
            loading={isSaving}
            loadingText="Saving..."
            className="min-w-[140px]"
            disabled={!hasChanges}
          >
            Save Changes
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
