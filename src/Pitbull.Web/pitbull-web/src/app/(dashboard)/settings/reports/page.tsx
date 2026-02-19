"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Save,
  RotateCcw,
  BarChart3,
  Palette,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import type { ReportSettingsData } from "@/lib/types";

const DEFAULT_SETTINGS: ReportSettingsData = {
  overtimeRules: "Federal",
  overtimeEnabled: true,
  dailyOvertimeThreshold: 8,
  dailyDoubletimeThreshold: 12,
  weeklyOvertimeThreshold: 40,
  saturdayRule: "overtime",
  sundayRule: "doubletime",
  holidayRule: "doubletime",
  holidaysJson: "[]",
  reportBrandingName: "",
  reportLogoUrl: "",
  fiscalYearStartMonth: 1,
};

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

export default function ReportSettingsPage() {
  const [settings, setSettings] = useState<ReportSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<ReportSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<ReportSettingsData>("/api/companies/settings/reports");
      setSettings(data);
      setSavedSettings(data);
    } catch {
      toast.error("Failed to load report settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = await api<ReportSettingsData>("/api/companies/settings/reports", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSavedSettings(data);
      toast.success("Report settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save report settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
  };

  const update = (partial: Partial<ReportSettingsData>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Report Settings</h1>
          <p className="text-muted-foreground">
            Configure overtime calculation rules, fiscal year, and report branding
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            You have unsaved changes. Click Save to apply.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These settings control how reports are generated and branded for this company.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overtime & Fiscal Year */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Overtime &amp; Fiscal Year
            </CardTitle>
            <CardDescription>
              Overtime calculation rules and fiscal year configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Overtime Rules</Label>
              <Select
                value={settings.overtimeRules}
                onValueChange={(value) => update({ overtimeRules: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select overtime rules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Federal">Federal (Weekly 40hr Only)</SelectItem>
                  <SelectItem value="California">California (Daily 8hr + Weekly 40hr)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines how overtime hours are calculated on reports
              </p>
            </div>

            <div className="space-y-2">
              <Label>Fiscal Year Start Month</Label>
              <Select
                value={String(settings.fiscalYearStartMonth)}
                onValueChange={(value) =>
                  update({ fiscalYearStartMonth: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The month your fiscal year begins for financial reporting
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Report Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Report Branding
            </CardTitle>
            <CardDescription>
              Company name and logo displayed on generated reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandingName">Branding Name</Label>
              <Input
                id="brandingName"
                type="text"
                value={settings.reportBrandingName}
                onChange={(e) => update({ reportBrandingName: e.target.value })}
                placeholder="Your Company Name"
              />
              <p className="text-xs text-muted-foreground">
                Company name displayed in report headers and footers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="text"
                value={settings.reportLogoUrl}
                onChange={(e) => update({ reportLogoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                URL to your company logo for report headers (PNG or JPEG recommended)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
