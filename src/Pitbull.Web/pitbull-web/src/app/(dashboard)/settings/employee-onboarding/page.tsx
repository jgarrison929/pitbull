"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, RotateCcw, Settings, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { OnboardingSettingsDto, ContractorType } from "@/lib/types/employee-onboarding";

const DEFAULT_SETTINGS: OnboardingSettingsDto = {
  enabled: true,
  requireApprovalWorkflow: true,
  autoCreateEmployeeOnSubmit: false,
  allowBulkImportCreate: true,
  defaultContractorType: "W2Employee" as ContractorType,
  requireOsha10: true,
  requireOsha30: false,
  requireEmergencyContact: true,
  requireTaxCompliance: true,
};

export default function OnboardingSettingsPage() {
  const [settings, setSettings] = useState<OnboardingSettingsDto>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<OnboardingSettingsDto>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<OnboardingSettingsDto>("/api/employee-onboarding/settings");
      setSettings(data);
      setSaved(data);
    } catch {
      // Use defaults on failure (API might not exist yet)
      setSettings(DEFAULT_SETTINGS);
      setSaved(DEFAULT_SETTINGS);
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
      const data = await api<OnboardingSettingsDto>("/api/employee-onboarding/settings", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSaved(data);
      toast.success("Onboarding settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(saved);
  };

  const update = (patch: Partial<OnboardingSettingsDto>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  if (isLoading) return null; // loading.tsx handles skeleton

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Employee Onboarding" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding Settings</h1>
          <p className="text-muted-foreground">
            Configure employee onboarding workflow and requirements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges} className="gap-2">
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
          These settings control the employee onboarding workflow for your organization.
          Changes apply to all new onboarding submissions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General
            </CardTitle>
            <CardDescription>Core onboarding workflow settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Onboarding</Label>
                <p className="text-xs text-muted-foreground">
                  Allow new onboarding submissions
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => update({ enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Approval Workflow</Label>
                <p className="text-xs text-muted-foreground">
                  Submissions must be approved before creating employee
                </p>
              </div>
              <Switch
                checked={settings.requireApprovalWorkflow}
                onCheckedChange={(checked) => update({ requireApprovalWorkflow: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Create Employee</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create employee record on submission
                </p>
              </div>
              <Switch
                checked={settings.autoCreateEmployeeOnSubmit}
                onCheckedChange={(checked) => update({ autoCreateEmployeeOnSubmit: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Bulk CSV Import</Label>
                <p className="text-xs text-muted-foreground">
                  Enable the CSV import feature for batch onboarding
                </p>
              </div>
              <Switch
                checked={settings.allowBulkImportCreate}
                onCheckedChange={(checked) => update({ allowBulkImportCreate: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Contractor Type</Label>
              <Select
                value={settings.defaultContractorType}
                onValueChange={(v) => update({ defaultContractorType: v as ContractorType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="W2Employee">W-2 Employee</SelectItem>
                  <SelectItem value="Contractor1099">1099 Contractor</SelectItem>
                  <SelectItem value="SubContractor">Subcontractor</SelectItem>
                  <SelectItem value="TempAgency">Temp Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Requirements
            </CardTitle>
            <CardDescription>Mandatory fields and certifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require OSHA 10</Label>
                <p className="text-xs text-muted-foreground">
                  OSHA 10-hour safety training certificate
                </p>
              </div>
              <Switch
                checked={settings.requireOsha10}
                onCheckedChange={(checked) => update({ requireOsha10: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require OSHA 30</Label>
                <p className="text-xs text-muted-foreground">
                  OSHA 30-hour safety training certificate
                </p>
              </div>
              <Switch
                checked={settings.requireOsha30}
                onCheckedChange={(checked) => update({ requireOsha30: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Emergency Contact</Label>
                <p className="text-xs text-muted-foreground">
                  Emergency contact info must be provided
                </p>
              </div>
              <Switch
                checked={settings.requireEmergencyContact}
                onCheckedChange={(checked) => update({ requireEmergencyContact: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Tax Compliance</Label>
                <p className="text-xs text-muted-foreground">
                  W-4 and I-9 forms must be completed
                </p>
              </div>
              <Switch
                checked={settings.requireTaxCompliance}
                onCheckedChange={(checked) => update({ requireTaxCompliance: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
