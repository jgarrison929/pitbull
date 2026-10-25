"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  Info,
  Loader2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";

interface TimecardSettingsData {
  timecardMode: number;
  weeklyEntryMode: number;
  defaultProjectId: string | null;
  requirePhase: boolean;
  requireEquipment: boolean;
  weekStartDay: number;
}

const DEFAULT_SETTINGS: TimecardSettingsData = {
  timecardMode: 0,
  weeklyEntryMode: 1,
  defaultProjectId: null,
  requirePhase: false,
  requireEquipment: false,
  weekStartDay: 1,
};

const WEEK_START_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "6", label: "Saturday" },
];

export default function TimecardSettingsPage() {
  const [settings, setSettings] = useState<TimecardSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<TimecardSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<TimecardSettingsData>("/api/companies/settings/time-tracking");
      setSettings(data);
      setSavedSettings(data);
    } catch {
      toast.error("Failed to load timecard settings");
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
      const data = await api<TimecardSettingsData>("/api/companies/settings/time-tracking", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSavedSettings(data);
      toast.success("Timecard settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save timecard settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
  };

  const update = (partial: Partial<TimecardSettingsData>) => {
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
          { label: "Time Tracking" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timecard Settings</h1>
          <p className="text-muted-foreground">
            Configure crew timecard entry mode, required fields, and work week
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
          These settings apply to all crew timecard entry across your company.
        </AlertDescription>
      </Alert>

      {/* Entry Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Entry Mode
          </CardTitle>
          <CardDescription>
            How crews enter time — one day at a time or a full week at once
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timecard Mode</Label>
            <Select
              value={String(settings.timecardMode)}
              onValueChange={(v) => update({ timecardMode: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Daily</SelectItem>
                <SelectItem value="1">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Daily: one day at a time. Weekly: entire week submitted at once.
            </p>
          </div>

          {settings.timecardMode === 1 && (
            <div className="space-y-2">
              <Label>Weekly Entry Mode</Label>
              <Select
                value={String(settings.weeklyEntryMode)}
                onValueChange={(v) => update({ weeklyEntryMode: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Simple (Reg/OT/DT totals)</SelectItem>
                  <SelectItem value="1">Detailed (day-by-day breakdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Week */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Work Week
          </CardTitle>
          <CardDescription>
            Define when your work week starts for overtime calculation and reporting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Week Start Day</Label>
            <Select
              value={String(settings.weekStartDay)}
              onValueChange={(v) => update({ weekStartDay: parseInt(v) })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEK_START_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for week boundaries in time tracking, approval, and reporting
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Required Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Required Fields
          </CardTitle>
          <CardDescription>
            Fields that must be filled on every crew timecard entry
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label>Require Phase</Label>
              <p className="text-xs text-muted-foreground">
                Employees must select a phase/cost code for each time entry
              </p>
            </div>
            <Switch
              checked={settings.requirePhase}
              onCheckedChange={(checked) => update({ requirePhase: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label>Require Equipment</Label>
              <p className="text-xs text-muted-foreground">
                Employees must log equipment used for each time entry
              </p>
            </div>
            <Switch
              checked={settings.requireEquipment}
              onCheckedChange={(checked) => update({ requireEquipment: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
