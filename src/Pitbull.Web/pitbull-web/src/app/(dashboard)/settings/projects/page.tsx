"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FolderOpen,
  DollarSign,
  Save,
  RotateCcw,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { ProjectSettingsData } from "@/lib/types";

const DEFAULT_SETTINGS: ProjectSettingsData = {
  defaultNumberingFormat: "YYYY-####",
  requireBudgetBeforeActivation: false,
  autoCreatePhases: true,
  defaultRetentionPercent: 10,
};

export default function ProjectSettingsPage() {
  const [settings, setSettings] = useState<ProjectSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<ProjectSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<ProjectSettingsData>("/api/companies/settings/projects");
      setSettings(data);
      setSavedSettings(data);
    } catch {
      toast.error("Failed to load project settings");
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
      const data = await api<ProjectSettingsData>("/api/companies/settings/projects", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSavedSettings(data);
      toast.success("Project settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save project settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
  };

  const update = (partial: Partial<ProjectSettingsData>) => {
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
          { label: "Projects" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
          <p className="text-muted-foreground">
            Configure project numbering, budget requirements, and retention defaults
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
          These settings apply to all new projects created for this company.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Numbering & Phases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Numbering &amp; Phases
            </CardTitle>
            <CardDescription>
              Default project numbering format and phase settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numberingFormat">Default Numbering Format</Label>
              <Input
                id="numberingFormat"
                type="text"
                value={settings.defaultNumberingFormat}
                onChange={(e) => update({ defaultNumberingFormat: e.target.value })}
                placeholder="YYYY-####"
              />
              <p className="text-xs text-muted-foreground">
                Use YYYY for year and #### for sequential number (e.g., 2026-0001)
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Auto-Create Phases</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically create default phases when a new project is created
                </p>
              </div>
              <Switch
                checked={settings.autoCreatePhases}
                onCheckedChange={(checked) => update({ autoCreatePhases: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Budget & Retention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Budget &amp; Retention
            </CardTitle>
            <CardDescription>
              Budget requirements and default retention percentage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Require Budget Before Activation</Label>
                <p className="text-xs text-muted-foreground">
                  Projects must have a budget set before they can be activated
                </p>
              </div>
              <Switch
                checked={settings.requireBudgetBeforeActivation}
                onCheckedChange={(checked) =>
                  update({ requireBudgetBeforeActivation: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retentionPercent">Default Retention Percent</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="retentionPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.defaultRetentionPercent}
                  onChange={(e) =>
                    update({ defaultRetentionPercent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Applied to new subcontracts and payment applications by default
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
