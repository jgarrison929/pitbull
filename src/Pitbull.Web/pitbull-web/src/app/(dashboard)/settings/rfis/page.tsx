"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Save,
  RotateCcw,
  MessageSquare,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { RfiSettingsData } from "@/lib/types";

const DEFAULT_SETTINGS: RfiSettingsData = {
  defaultResponseDeadlineDays: 14,
  autoAssignToPm: true,
  requireCostImpact: false,
};

export default function RfiSettingsPage() {
  const [settings, setSettings] = useState<RfiSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<RfiSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<RfiSettingsData>("/api/companies/settings/rfis");
      setSettings(data);
      setSavedSettings(data);
    } catch {
      toast.error("Failed to load RFI settings");
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
      const data = await api<RfiSettingsData>("/api/companies/settings/rfis", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSavedSettings(data);
      toast.success("RFI settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save RFI settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
  };

  const update = (partial: Partial<RfiSettingsData>) => {
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
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "RFIs" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RFI Settings</h1>
          <p className="text-muted-foreground">
            Configure RFI response deadlines, assignment rules, and cost tracking
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
          These settings apply to all new RFIs created for this company.
        </AlertDescription>
      </Alert>

      {/* RFI Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            RFI Workflow
          </CardTitle>
          <CardDescription>
            Response deadlines, automatic assignment, and cost impact requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="responseDeadline">Default Response Deadline</Label>
            <div className="flex items-center gap-2">
              <Input
                id="responseDeadline"
                type="number"
                min={1}
                max={365}
                step={1}
                value={settings.defaultResponseDeadlineDays}
                onChange={(e) =>
                  update({ defaultResponseDeadlineDays: parseInt(e.target.value) || 14 })
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Number of days given for an RFI response before it is considered overdue
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label>Auto-Assign to Project Manager</Label>
              <p className="text-xs text-muted-foreground">
                Automatically assign new RFIs to the project manager for review
              </p>
            </div>
            <Switch
              checked={settings.autoAssignToPm}
              onCheckedChange={(checked) => update({ autoAssignToPm: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label>Require Cost Impact</Label>
              <p className="text-xs text-muted-foreground">
                Require cost impact assessment before an RFI can be closed
              </p>
            </div>
            <Switch
              checked={settings.requireCostImpact}
              onCheckedChange={(checked) => update({ requireCostImpact: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
