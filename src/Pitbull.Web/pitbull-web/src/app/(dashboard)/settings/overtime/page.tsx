"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  Calculator,
  CalendarDays,
  Plus,
  Trash2,
  Info,
  Save,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import api from "@/lib/api";
import type { ReportSettingsData } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────
interface OvertimeRules {
  dailyOtThreshold: number;
  weeklyOtThreshold: number;
  dailyDtThreshold: number;
  saturdayRule: "regular" | "overtime" | "doubletime";
  sundayRule: "regular" | "overtime" | "doubletime";
  holidays: Holiday[];
  holidayRule: "overtime" | "doubletime";
  enabled: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
}

const DEFAULT_HOLIDAYS: Holiday[] = [
  { id: "1", name: "New Year's Day", date: "01-01", recurring: true },
  { id: "2", name: "Memorial Day", date: "05-26", recurring: true },
  { id: "3", name: "Independence Day", date: "07-04", recurring: true },
  { id: "4", name: "Labor Day", date: "09-01", recurring: true },
  { id: "5", name: "Thanksgiving", date: "11-27", recurring: true },
  { id: "6", name: "Christmas Day", date: "12-25", recurring: true },
];

const DEFAULT_RULES: OvertimeRules = {
  dailyOtThreshold: 8,
  weeklyOtThreshold: 40,
  dailyDtThreshold: 12,
  saturdayRule: "overtime",
  sundayRule: "doubletime",
  holidays: DEFAULT_HOLIDAYS,
  holidayRule: "doubletime",
  enabled: true,
};

function parseHolidays(json: string): Holiday[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* use defaults */ }
  return DEFAULT_HOLIDAYS;
}

// ─── Preview calculation ──────────────────────────────────
function computePreview(
  hoursWorked: number,
  rules: OvertimeRules,
  dayType: "weekday" | "saturday" | "sunday" | "holiday"
): { regular: number; overtime: number; doubletime: number } {
  if (!rules.enabled) {
    return { regular: hoursWorked, overtime: 0, doubletime: 0 };
  }

  // Determine if the day has special rules
  let dayRule: "regular" | "overtime" | "doubletime" = "regular";
  if (dayType === "saturday") dayRule = rules.saturdayRule;
  else if (dayType === "sunday") dayRule = rules.sundayRule;
  else if (dayType === "holiday") dayRule = rules.holidayRule;

  if (dayRule === "doubletime") {
    return { regular: 0, overtime: 0, doubletime: hoursWorked };
  }
  if (dayRule === "overtime") {
    return { regular: 0, overtime: hoursWorked, doubletime: 0 };
  }

  // Regular weekday - apply daily thresholds
  let regular = 0;
  let overtime = 0;
  let doubletime = 0;

  if (hoursWorked <= rules.dailyOtThreshold) {
    regular = hoursWorked;
  } else if (hoursWorked <= rules.dailyDtThreshold) {
    regular = rules.dailyOtThreshold;
    overtime = hoursWorked - rules.dailyOtThreshold;
  } else {
    regular = rules.dailyOtThreshold;
    overtime = rules.dailyDtThreshold - rules.dailyOtThreshold;
    doubletime = hoursWorked - rules.dailyDtThreshold;
  }

  return { regular, overtime, doubletime };
}

// ─── Component ────────────────────────────────────────────
export default function OvertimeRulesPage() {
  const [rules, setRules] = useState<OvertimeRules>(DEFAULT_RULES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", recurring: true });
  const [serverSettings, setServerSettings] = useState<ReportSettingsData | null>(null);

  // Preview state
  const [previewHours, setPreviewHours] = useState(10);
  const [previewDay, setPreviewDay] = useState<"weekday" | "saturday" | "sunday" | "holiday">("weekday");

  // Load settings from API on mount
  useEffect(() => {
    async function load() {
      try {
        const data = await api<ReportSettingsData>("/api/companies/settings/reports");
        setServerSettings(data);
        setRules({
          enabled: data.overtimeEnabled,
          dailyOtThreshold: data.dailyOvertimeThreshold,
          weeklyOtThreshold: data.weeklyOvertimeThreshold,
          dailyDtThreshold: data.dailyDoubletimeThreshold,
          saturdayRule: (data.saturdayRule as OvertimeRules["saturdayRule"]) || "overtime",
          sundayRule: (data.sundayRule as OvertimeRules["sundayRule"]) || "doubletime",
          holidays: parseHolidays(data.holidaysJson),
          holidayRule: (data.holidayRule as OvertimeRules["holidayRule"]) || "doubletime",
        });
      } catch {
        toast.error("Failed to load overtime settings");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const preview = useMemo(
    () => computePreview(previewHours, rules, previewDay),
    [previewHours, rules, previewDay]
  );

  const updateRules = useCallback(
    (update: Partial<OvertimeRules>) => {
      setRules((prev) => ({ ...prev, ...update }));
      setHasChanges(true);
    },
    []
  );

  const handleSave = async () => {
    if (!serverSettings) return;
    setIsSaving(true);
    try {
      const updated = await api<ReportSettingsData>("/api/companies/settings/reports", {
        method: "PUT",
        body: {
          overtimeRules: serverSettings.overtimeRules,
          overtimeEnabled: rules.enabled,
          dailyOvertimeThreshold: rules.dailyOtThreshold,
          dailyDoubletimeThreshold: rules.dailyDtThreshold,
          weeklyOvertimeThreshold: rules.weeklyOtThreshold,
          saturdayRule: rules.saturdayRule,
          sundayRule: rules.sundayRule,
          holidayRule: rules.holidayRule,
          holidaysJson: JSON.stringify(rules.holidays),
          reportBrandingName: serverSettings.reportBrandingName,
          reportLogoUrl: serverSettings.reportLogoUrl,
          fiscalYearStartMonth: serverSettings.fiscalYearStartMonth,
        },
      });
      setServerSettings(updated);
      setHasChanges(false);
      toast.success("Overtime rules saved");
    } catch {
      toast.error("Failed to save overtime settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setRules(DEFAULT_RULES);
    setHasChanges(true);
  };

  const addHoliday = () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast.error("Holiday name and date are required");
      return;
    }
    const holiday: Holiday = {
      id: Date.now().toString(),
      name: newHoliday.name,
      date: newHoliday.date,
      recurring: newHoliday.recurring,
    };
    updateRules({ holidays: [...rules.holidays, holiday] });
    setNewHoliday({ name: "", date: "", recurring: true });
    setShowAddHoliday(false);
  };

  const removeHoliday = (id: string) => {
    updateRules({ holidays: rules.holidays.filter((h) => h.id !== id) });
  };

  const ruleLabel = (rule: "regular" | "overtime" | "doubletime") => {
    switch (rule) {
      case "regular":
        return "Regular Pay";
      case "overtime":
        return "Overtime (1.5×)";
      case "doubletime":
        return "Double Time (2×)";
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Overtime" },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overtime Rules</h1>
          <p className="text-muted-foreground">
            Configure overtime and double-time calculation thresholds
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Rules"}
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
          These rules define the UI configuration only. Actual overtime calculations are
          performed by the backend payroll engine using these saved settings.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Daily Thresholds
            </CardTitle>
            <CardDescription>
              Hours per day before overtime and double-time kick in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <Label>Enable OT Calculation</Label>
                <p className="text-xs text-muted-foreground">
                  Turn off to treat all hours as regular
                </p>
              </div>
              <Switch
                checked={rules.enabled}
                onCheckedChange={(checked) => updateRules({ enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyOt">
                Daily Overtime Threshold (hours)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="dailyOt"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={rules.dailyOtThreshold}
                  onChange={(e) =>
                    updateRules({ dailyOtThreshold: parseFloat(e.target.value) || 8 })
                  }
                  className="w-24"
                  disabled={!rules.enabled}
                />
                <span className="text-sm text-muted-foreground">
                  California default: 8 hours
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyDt">
                Daily Double-Time Threshold (hours)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="dailyDt"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={rules.dailyDtThreshold}
                  onChange={(e) =>
                    updateRules({ dailyDtThreshold: parseFloat(e.target.value) || 12 })
                  }
                  className="w-24"
                  disabled={!rules.enabled}
                />
                <span className="text-sm text-muted-foreground">
                  California default: 12 hours
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weeklyOt">
                Weekly Overtime Threshold (hours)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="weeklyOt"
                  type="number"
                  min={0}
                  max={168}
                  step={1}
                  value={rules.weeklyOtThreshold}
                  onChange={(e) =>
                    updateRules({ weeklyOtThreshold: parseFloat(e.target.value) || 40 })
                  }
                  className="w-24"
                  disabled={!rules.enabled}
                />
                <span className="text-sm text-muted-foreground">
                  Federal default: 40 hours
                </span>
              </div>
            </div>

            {/* Visual breakdown */}
            {rules.enabled && (
              <div className="rounded-lg border bg-muted/30 p-3 mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  DAILY BREAKDOWN
                </p>
                <div className="flex h-6 rounded-full overflow-hidden text-[10px] font-medium">
                  <div
                    className="bg-green-500 text-white flex items-center justify-center"
                    style={{
                      width: `${(rules.dailyOtThreshold / rules.dailyDtThreshold) * 100}%`,
                    }}
                  >
                    Regular ({rules.dailyOtThreshold}h)
                  </div>
                  <div
                    className="bg-amber-500 text-white flex items-center justify-center"
                    style={{
                      width: `${
                        ((rules.dailyDtThreshold - rules.dailyOtThreshold) /
                          rules.dailyDtThreshold) *
                        100
                      }%`,
                    }}
                  >
                    OT 1.5× ({rules.dailyDtThreshold - rules.dailyOtThreshold}h)
                  </div>
                  <div className="bg-red-500 text-white flex items-center justify-center flex-1">
                    DT 2×
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekend & Holiday Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Weekend &amp; Holiday Rules
            </CardTitle>
            <CardDescription>
              How Saturday, Sunday, and holiday hours are classified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Saturday Rule</Label>
              <Select
                value={rules.saturdayRule}
                onValueChange={(v) =>
                  updateRules({ saturdayRule: v as OvertimeRules["saturdayRule"] })
                }
                disabled={!rules.enabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Pay</SelectItem>
                  <SelectItem value="overtime">Overtime (1.5×)</SelectItem>
                  <SelectItem value="doubletime">Double Time (2×)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sunday Rule</Label>
              <Select
                value={rules.sundayRule}
                onValueChange={(v) =>
                  updateRules({ sundayRule: v as OvertimeRules["sundayRule"] })
                }
                disabled={!rules.enabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Pay</SelectItem>
                  <SelectItem value="overtime">Overtime (1.5×)</SelectItem>
                  <SelectItem value="doubletime">Double Time (2×)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Holiday Rule</Label>
              <Select
                value={rules.holidayRule}
                onValueChange={(v) =>
                  updateRules({ holidayRule: v as OvertimeRules["holidayRule"] })
                }
                disabled={!rules.enabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overtime">Overtime (1.5×)</SelectItem>
                  <SelectItem value="doubletime">Double Time (2×)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary badges */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">SUMMARY</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  Sat: {ruleLabel(rules.saturdayRule)}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  Sun: {ruleLabel(rules.sundayRule)}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  Holiday: {ruleLabel(rules.holidayRule)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holiday List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Holiday List
                </CardTitle>
                <CardDescription>
                  Days that receive special pay rates
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddHoliday(true)}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules.holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No holidays configured
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {rules.holidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.date}{" "}
                        {h.recurring && (
                          <span className="text-amber-600">(yearly)</span>
                        )}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeHoliday(h.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Calculator */}
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-amber-600" />
              Pay Preview Calculator
            </CardTitle>
            <CardDescription>
              See how these rules affect a sample workday
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hours Worked</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={previewHours}
                  onChange={(e) => setPreviewHours(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Day Type</Label>
                <Select
                  value={previewDay}
                  onValueChange={(v) => setPreviewDay(v as typeof previewDay)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekday">Weekday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">
                Employee working{" "}
                <span className="text-amber-600">{previewHours} hours</span> on a{" "}
                <span className="text-amber-600">{previewDay}</span> would get:
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {preview.regular}
                  </p>
                  <p className="text-xs text-muted-foreground">Regular</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {preview.overtime}
                  </p>
                  <p className="text-xs text-muted-foreground">OT (1.5×)</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {preview.doubletime}
                  </p>
                  <p className="text-xs text-muted-foreground">DT (2×)</p>
                </div>
              </div>
              {previewHours > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {preview.regular}h × 1.0 + {preview.overtime}h × 1.5 +{" "}
                  {preview.doubletime}h × 2.0 ={" "}
                  <span className="font-medium">
                    {(
                      preview.regular +
                      preview.overtime * 1.5 +
                      preview.doubletime * 2
                    ).toFixed(1)}{" "}
                    equivalent hours
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={showAddHoliday} onOpenChange={setShowAddHoliday}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a day that receives special pay rates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input
                placeholder="e.g., Veterans Day"
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Date (MM-DD)</Label>
              <Input
                placeholder="e.g., 11-11"
                value={newHoliday.date}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, date: e.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Recurring Yearly</Label>
                <p className="text-xs text-muted-foreground">
                  Applies every year on this date
                </p>
              </div>
              <Switch
                checked={newHoliday.recurring}
                onCheckedChange={(checked) =>
                  setNewHoliday({ ...newHoliday, recurring: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddHoliday(false)}>
              Cancel
            </Button>
            <Button onClick={addHoliday}>Add Holiday</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
