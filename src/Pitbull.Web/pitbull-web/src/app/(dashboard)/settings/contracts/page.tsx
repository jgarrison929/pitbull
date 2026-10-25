"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Save, RotateCcw, FileText, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { ContractSettingsData } from "@/lib/types";

const DEFAULT_SETTINGS: ContractSettingsData = {
  defaultRetainagePercent: 10,
  requireSignedSubcontractBeforePayApp: true,
  approvalWorkflowType: "Sequential",
  aiaArchitectName: "",
  aiaOwnerName: "",
};

export default function ContractSettingsPage() {
  const [settings, setSettings] = useState<ContractSettingsData>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<ContractSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<ContractSettingsData>(
        "/api/companies/settings/contracts"
      );
      setSettings(data);
      setSaved(data);
    } catch {
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
      const data = await api<ContractSettingsData>(
        "/api/companies/settings/contracts",
        { method: "PUT", body: settings }
      );
      setSettings(data);
      setSaved(data);
      toast.success("Contract settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(saved);
  };

  const update = (patch: Partial<ContractSettingsData>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Contracts" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contract Settings</h1>
          <p className="text-muted-foreground">
            Configure subcontract retainage, approval workflows, and AIA form defaults
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
          These settings apply to all new subcontracts created for this company.
          Existing subcontracts are not affected by changes.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Retainage & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Retainage & Compliance
            </CardTitle>
            <CardDescription>Retainage defaults and subcontract requirements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="retainagePercent">Default Retainage Percent</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="retainagePercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.defaultRetainagePercent}
                  onChange={(e) => update({ defaultRetainagePercent: parseFloat(e.target.value) || 0 })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Industry standard is 5-10%. Applied to new subcontracts by default.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Signed Subcontract Before Pay App</Label>
                <p className="text-xs text-muted-foreground">
                  Block payment application submission until subcontract is executed
                </p>
              </div>
              <Switch
                checked={settings.requireSignedSubcontractBeforePayApp}
                onCheckedChange={(checked) => update({ requireSignedSubcontractBeforePayApp: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Approval Workflow & AIA Forms */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Approval Workflow & AIA Forms
            </CardTitle>
            <CardDescription>Approval process and AIA document defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Approval Workflow Type</Label>
              <Select
                value={settings.approvalWorkflowType}
                onValueChange={(v) => update({ approvalWorkflowType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">No Approval</SelectItem>
                  <SelectItem value="Sequential">PM then Executive</SelectItem>
                  <SelectItem value="Parallel">Any Approver</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines how subcontract approvals are routed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiaArchitectName">AIA Architect Name</Label>
              <Input
                id="aiaArchitectName"
                type="text"
                value={settings.aiaArchitectName}
                onChange={(e) => update({ aiaArchitectName: e.target.value })}
                placeholder="Enter architect name for AIA forms"
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled on AIA G702/G703 forms as the Architect field.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aiaOwnerName">AIA Owner Name</Label>
              <Input
                id="aiaOwnerName"
                type="text"
                value={settings.aiaOwnerName}
                onChange={(e) => update({ aiaOwnerName: e.target.value })}
                placeholder="Enter owner name for AIA forms"
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled on AIA G702/G703 forms as the Owner field.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
