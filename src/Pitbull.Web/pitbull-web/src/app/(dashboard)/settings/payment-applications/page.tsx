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
import { Save, RotateCcw, DollarSign, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { PaymentApplicationSettings } from "@/lib/types";

const DEFAULT_SETTINGS: PaymentApplicationSettings = {
  defaultRetainagePercent: 10,
  enableApprovalWorkflow: true,
  requireSignedSubcontract: true,
  allowRetainageOverride: false,
  allowRetainageReleaseBeforeFinal: false,
  defaultBookMode: "Both",
  lockSubmittedLineItems: true,
  requireLienWaiverBeforePaid: false,
};

export default function PaymentApplicationSettingsPage() {
  const [settings, setSettings] = useState<PaymentApplicationSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState<PaymentApplicationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(saved);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<PaymentApplicationSettings>(
        "/api/companies/settings/payment-applications"
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
      const data = await api<PaymentApplicationSettings>(
        "/api/companies/settings/payment-applications",
        { method: "PUT", body: settings }
      );
      setSettings(data);
      setSaved(data);
      toast.success("Payment application settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(saved);
  };

  const update = (patch: Partial<PaymentApplicationSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Payment Applications" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Application Settings</h1>
          <p className="text-muted-foreground">
            Configure retainage, approval workflow, and billing defaults
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
          These settings apply to all new payment applications created for this company.
          Existing applications are not affected by changes.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Financial Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Defaults
            </CardTitle>
            <CardDescription>Retainage and accounting settings</CardDescription>
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
                Industry standard is 5-10%. Applied to new pay apps by default.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Retainage Override</Label>
                <p className="text-xs text-muted-foreground">
                  Allow per-application retainage percent adjustment
                </p>
              </div>
              <Switch
                checked={settings.allowRetainageOverride}
                onCheckedChange={(checked) => update({ allowRetainageOverride: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Early Retainage Release</Label>
                <p className="text-xs text-muted-foreground">
                  Release retainage before final completion
                </p>
              </div>
              <Switch
                checked={settings.allowRetainageReleaseBeforeFinal}
                onCheckedChange={(checked) => update({ allowRetainageReleaseBeforeFinal: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Accounting Book Mode</Label>
              <Select
                value={settings.defaultBookMode}
                onValueChange={(v) => update({ defaultBookMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gaap">GAAP Only</SelectItem>
                  <SelectItem value="BonusJobCost">Bonus/Job Cost Only</SelectItem>
                  <SelectItem value="Both">Both (GAAP + Bonus/Job Cost)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines which accounting book entries are generated per pay app.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Workflow & Compliance
            </CardTitle>
            <CardDescription>Approval process and compliance controls</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Approval Workflow</Label>
                <p className="text-xs text-muted-foreground">
                  Require Submit &rarr; Review &rarr; Approve &rarr; Paid process
                </p>
              </div>
              <Switch
                checked={settings.enableApprovalWorkflow}
                onCheckedChange={(checked) => update({ enableApprovalWorkflow: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Signed Subcontract</Label>
                <p className="text-xs text-muted-foreground">
                  Block submission if subcontract has no execution date
                </p>
              </div>
              <Switch
                checked={settings.requireSignedSubcontract}
                onCheckedChange={(checked) => update({ requireSignedSubcontract: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Lock Submitted Line Items</Label>
                <p className="text-xs text-muted-foreground">
                  Prevent line item edits once submitted for review
                </p>
              </div>
              <Switch
                checked={settings.lockSubmittedLineItems}
                onCheckedChange={(checked) => update({ lockSubmittedLineItems: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Lien Waiver Before Payment</Label>
                <p className="text-xs text-muted-foreground">
                  Must upload lien waiver before marking as paid
                </p>
              </div>
              <Switch
                checked={settings.requireLienWaiverBeforePaid}
                onCheckedChange={(checked) => update({ requireLienWaiverBeforePaid: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
