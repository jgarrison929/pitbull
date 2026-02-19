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
  Calculator,
  Clock,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { BidSettingsData } from "@/lib/types";

const DEFAULT_SETTINGS: BidSettingsData = {
  defaultValidityPeriodDays: 30,
  requireEstimatorSignOff: false,
  defaultOverheadPercent: 10,
  defaultProfitPercent: 10,
};

export default function BidSettingsPage() {
  const [settings, setSettings] = useState<BidSettingsData>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<BidSettingsData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api<BidSettingsData>("/api/companies/settings/bids");
      setSettings(data);
      setSavedSettings(data);
    } catch {
      toast.error("Failed to load bid settings");
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
      const data = await api<BidSettingsData>("/api/companies/settings/bids", {
        method: "PUT",
        body: settings,
      });
      setSettings(data);
      setSavedSettings(data);
      toast.success("Bid settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save bid settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(savedSettings);
  };

  const update = (partial: Partial<BidSettingsData>) => {
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
          { label: "Bids" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bid Settings</h1>
          <p className="text-muted-foreground">
            Configure bid validity, estimator requirements, and markup defaults
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
          These settings apply to all new bids created for this company.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Validity & Sign-Off */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Validity &amp; Sign-Off
            </CardTitle>
            <CardDescription>
              Default bid validity period and estimator requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="validityDays">Default Validity Period</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="validityDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={settings.defaultValidityPeriodDays}
                  onChange={(e) =>
                    update({ defaultValidityPeriodDays: parseInt(e.target.value) || 30 })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                How long a bid remains valid after submission
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label>Require Estimator Sign-Off</Label>
                <p className="text-xs text-muted-foreground">
                  Bids must be reviewed and signed off by an estimator before submission
                </p>
              </div>
              <Switch
                checked={settings.requireEstimatorSignOff}
                onCheckedChange={(checked) => update({ requireEstimatorSignOff: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Markup Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Markup Defaults
            </CardTitle>
            <CardDescription>
              Default overhead and profit percentages applied to new bids
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overheadPercent">Default Overhead</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="overheadPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.defaultOverheadPercent}
                  onChange={(e) =>
                    update({ defaultOverheadPercent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                General and administrative overhead applied to bid cost
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profitPercent">Default Profit</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="profitPercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={settings.defaultProfitPercent}
                  onChange={(e) =>
                    update({ defaultProfitPercent: parseFloat(e.target.value) || 0 })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Profit margin applied on top of overhead
              </p>
            </div>

            {/* Combined Markup Display */}
            <div className="rounded-lg border bg-muted/30 p-3 mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                COMBINED MARKUP
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {(settings.defaultOverheadPercent + settings.defaultProfitPercent).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {settings.defaultOverheadPercent}% overhead + {settings.defaultProfitPercent}% profit
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
