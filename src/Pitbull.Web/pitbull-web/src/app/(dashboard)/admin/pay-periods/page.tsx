"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  addDays,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock,
  Unlock,
  RefreshCw,
  Settings,
  Calendar,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
} from "lucide-react";
import {
  listPayPeriods,
  getCurrentPayPeriod,
  getPayPeriodConfiguration,
  updatePayPeriodConfiguration,
  lockPayPeriod,
  unlockPayPeriod,
  generatePayPeriods,
} from "@/lib/pay-periods-api";
import type {
  PayPeriod,
  PayPeriodConfiguration,
  PayPeriodListResult,
} from "@/types/pay-period.types";
import {
  PayPeriodStatus,
  PayPeriodType,
  getStatusColor,
  getStatusLabel,
  getPeriodTypeLabel,
  getDayOfWeekLabel,
} from "@/types/pay-period.types";

// ─── Helpers ──────────────────────────────────────────────
function computePreviewPeriods(
  type: number,
  weekStartDay: number,
  semiMonthlyFirstDay: number,
  semiMonthlySecondDay: number
): { start: Date; end: Date; label: string }[] {
  const today = new Date();
  const results: { start: Date; end: Date; label: string }[] = [];

  if (type === PayPeriodType.Weekly) {
    // Find current week start
    let d = new Date(today);
    const dow = d.getDay();
    const diff = (dow - weekStartDay + 7) % 7;
    d = addDays(d, -diff);
    for (let i = 0; i < 4; i++) {
      const start = addDays(d, i * 7);
      const end = addDays(start, 6);
      results.push({
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      });
    }
  } else if (type === PayPeriodType.BiWeekly) {
    let d = new Date(today);
    const dow = d.getDay();
    const diff = (dow - weekStartDay + 7) % 7;
    d = addDays(d, -diff);
    for (let i = 0; i < 4; i++) {
      const start = addDays(d, i * 14);
      const end = addDays(start, 13);
      results.push({
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
      });
    }
  } else if (type === PayPeriodType.SemiMonthly) {
    let current = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 4; i++) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = endOfMonth(monthStart);
      // First half
      const firstStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), semiMonthlyFirstDay);
      const firstEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), semiMonthlySecondDay - 1);
      // Second half
      const secondStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), semiMonthlySecondDay);
      const secondEnd = monthEnd;

      if (i < 2) {
        results.push({
          start: firstStart,
          end: firstEnd,
          label: `${format(firstStart, "MMM d")} – ${format(firstEnd, "MMM d, yyyy")}`,
        });
        if (results.length < 4) {
          results.push({
            start: secondStart,
            end: secondEnd,
            label: `${format(secondStart, "MMM d")} – ${format(secondEnd, "MMM d, yyyy")}`,
          });
        }
      }
      current = addMonths(current, 1);
    }
  } else {
    // Monthly
    let current = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 4; i++) {
      const start = new Date(current.getFullYear(), current.getMonth(), 1);
      const end = endOfMonth(start);
      results.push({
        start,
        end,
        label: format(start, "MMMM yyyy"),
      });
      current = addMonths(current, 1);
    }
  }

  return results.slice(0, 4);
}

// Color classes for calendar period highlighting
const PERIOD_COLORS = [
  "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100",
  "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100",
  "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100",
  "bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100",
];

// ─── Component ────────────────────────────────────────────
export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriodListResult | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<PayPeriod | null>(null);
  const [config, setConfig] = useState<PayPeriodConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calendar nav
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Dialog states
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"table" | "calendar">("table");

  // Form states
  const [lockNotes, setLockNotes] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [configForm, setConfigForm] = useState({
    type: PayPeriodType.Weekly,
    weekStartDay: 0,
    semiMonthlyFirstDay: 1,
    semiMonthlySecondDay: 16,
    autoLockEnabled: false,
    autoLockDaysAfterEnd: 3,
    periodsToGenerateAhead: 4,
    enforcementEnabled: true,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [periodsData, currentData, configData] = await Promise.all([
        listPayPeriods({
          status: statusFilter !== "all" ? parseInt(statusFilter) : undefined,
          pageSize: 20,
        }),
        getCurrentPayPeriod(),
        getPayPeriodConfiguration(),
      ]);
      setPeriods(periodsData);
      setCurrentPeriod(currentData);
      setConfig(configData);
      setConfigForm({
        type: configData.type,
        weekStartDay: configData.weekStartDay,
        semiMonthlyFirstDay: configData.semiMonthlyFirstDay,
        semiMonthlySecondDay: configData.semiMonthlySecondDay,
        autoLockEnabled: configData.autoLockEnabled,
        autoLockDaysAfterEnd: configData.autoLockDaysAfterEnd,
        periodsToGenerateAhead: configData.periodsToGenerateAhead,
        enforcementEnabled: configData.enforcementEnabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pay periods");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Calendar data ──
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calendarMonth]);

  const getDayPeriod = useCallback(
    (day: Date): PayPeriod | null => {
      if (!periods) return null;
      return (
        periods.items.find((p) => {
          try {
            const start = parseISO(p.startDate);
            const end = parseISO(p.endDate);
            return isWithinInterval(day, { start, end });
          } catch {
            return false;
          }
        }) ?? null
      );
    },
    [periods]
  );

  // Preview periods for config form
  const previewPeriods = useMemo(
    () =>
      computePreviewPeriods(
        configForm.type,
        configForm.weekStartDay,
        configForm.semiMonthlyFirstDay,
        configForm.semiMonthlySecondDay
      ),
    [configForm.type, configForm.weekStartDay, configForm.semiMonthlyFirstDay, configForm.semiMonthlySecondDay]
  );

  // ── Handlers ──
  const handleGeneratePeriods = async () => {
    setIsSubmitting(true);
    try {
      const result = await generatePayPeriods();
      await loadData();
      alert(
        `Generated ${result.periodsCreated} periods (${result.periodsSkipped} skipped)`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate periods");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLock = async () => {
    if (!selectedPeriod) return;
    setIsSubmitting(true);
    try {
      await lockPayPeriod(selectedPeriod.id, {
        lockedById: "00000000-0000-0000-0000-000000000000",
        notes: lockNotes || undefined,
      });
      setShowLockDialog(false);
      setLockNotes("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock period");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedPeriod || !unlockReason.trim()) return;
    setIsSubmitting(true);
    try {
      await unlockPayPeriod(selectedPeriod.id, {
        unlockedById: "00000000-0000-0000-0000-000000000000",
        reason: unlockReason,
      });
      setShowUnlockDialog(false);
      setUnlockReason("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock period");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSubmitting(true);
    try {
      await updatePayPeriodConfiguration({
        ...configForm,
        biWeeklyReferenceDate: null,
      });
      setShowConfigDialog(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay Periods</h1>
          <p className="text-muted-foreground">
            Manage pay period locking and configuration
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreviewDialog(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowConfigDialog(true)}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Configure
          </Button>
          <Button
            onClick={handleGeneratePeriods}
            disabled={isSubmitting}
            className="gap-2 bg-amber-500 hover:bg-amber-600"
          >
            <RefreshCw className={`h-4 w-4 ${isSubmitting ? "animate-spin" : ""}`} />
            Generate Periods
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Current Period Card */}
        <Card className={currentPeriod ? "ring-2 ring-amber-500/50" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Current Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentPeriod ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold">{currentPeriod.label}</p>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(currentPeriod.status)}>
                    {getStatusLabel(currentPeriod.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(currentPeriod.startDate)} – {formatDate(currentPeriod.endDate)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No period configured</p>
            )}
          </CardContent>
        </Card>

        {/* Configuration Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  {getPeriodTypeLabel(config.type)}
                </p>
                <p>
                  <span className="text-muted-foreground">Week Start:</span>{" "}
                  {getDayOfWeekLabel(config.weekStartDay)}
                </p>
                <p>
                  <span className="text-muted-foreground">Lock:</span>{" "}
                  {config.autoLockEnabled ? (
                    <span className="text-green-600">{config.autoLockDaysAfterEnd} days after end</span>
                  ) : (
                    <span className="text-muted-foreground">Manual</span>
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Enforcement:</span>{" "}
                  {config.enforcementEnabled ? (
                    <span className="text-green-600">Enabled</span>
                  ) : (
                    <span className="text-amber-600">Disabled</span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Using defaults</p>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Period Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {periods ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Total Periods:</span>{" "}
                  {periods.totalCount}
                </p>
                <p>
                  <span className="text-muted-foreground">Open:</span>{" "}
                  <span className="text-green-600 font-medium">
                    {periods.items.filter((p) => p.status === PayPeriodStatus.Open).length}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Locked:</span>{" "}
                  <span className="text-red-600 font-medium">
                    {periods.items.filter((p) => p.status === PayPeriodStatus.Locked).length}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <Label>Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="0">Open</SelectItem>
              <SelectItem value="1">Locked</SelectItem>
              <SelectItem value="2">Processed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === "table"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === "calendar"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {activeTab === "calendar" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {format(calendarMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, calendarMonth);
                const isToday = isSameDay(day, new Date());
                const period = getDayPeriod(day);
                const isCurrent =
                  currentPeriod &&
                  period &&
                  period.id === currentPeriod.id;

                // Assign color by period index
                let periodColorIdx = -1;
                if (period && periods) {
                  periodColorIdx = periods.items.indexOf(period) % PERIOD_COLORS.length;
                }

                return (
                  <div
                    key={day.toISOString()}
                    className={`relative bg-background p-1.5 min-h-[48px] sm:min-h-[64px] ${
                      !inMonth ? "opacity-40" : ""
                    } ${isCurrent ? "ring-2 ring-inset ring-amber-500" : ""}`}
                  >
                    <span
                      className={`text-xs font-medium block text-center ${
                        isToday
                          ? "bg-amber-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto"
                          : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {period && periodColorIdx >= 0 && (
                      <div
                        className={`mt-0.5 text-[10px] rounded px-1 py-0.5 text-center truncate ${
                          PERIOD_COLORS[periodColorIdx]
                        }`}
                        title={period.label}
                      >
                        {period.status === PayPeriodStatus.Locked ? "🔒" : ""}
                        {period.status === PayPeriodStatus.Processed ? "✓" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                Today
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border-2 border-amber-500" />
                Current Period
              </div>
              <div className="flex items-center gap-1.5">
                🔒 Locked
              </div>
              <div className="flex items-center gap-1.5">
                ✓ Processed
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table View */}
      {activeTab === "table" && (
        <Card>
          <CardHeader>
            <CardTitle>Pay Periods</CardTitle>
            <CardDescription>
              Lock periods to prevent time entry modifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {periods && periods.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Period</th>
                      <th className="text-left py-3 px-2 hidden sm:table-cell">Days</th>
                      <th className="text-left py-3 px-2">Status</th>
                      <th className="text-left py-3 px-2 hidden md:table-cell">Locked By</th>
                      <th className="text-left py-3 px-2 hidden lg:table-cell">Notes</th>
                      <th className="text-right py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.items.map((period) => {
                      const isCurrent = currentPeriod?.id === period.id;
                      return (
                        <tr
                          key={period.id}
                          className={`border-b hover:bg-muted/50 ${
                            isCurrent ? "bg-amber-50 dark:bg-amber-900/10" : ""
                          }`}
                        >
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{period.label}</div>
                              {isCurrent && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {formatDate(period.startDate)} – {formatDate(period.endDate)}
                            </div>
                          </td>
                          <td className="py-3 px-2 hidden sm:table-cell">{period.dayCount}</td>
                          <td className="py-3 px-2">
                            <Badge className={getStatusColor(period.status)}>
                              {getStatusLabel(period.status)}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 hidden md:table-cell">
                            {period.lockedByName || "–"}
                            {period.lockedAt && (
                              <div className="text-xs text-muted-foreground">
                                {formatDate(period.lockedAt)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-2 max-w-[200px] truncate hidden lg:table-cell">
                            {period.notes || "–"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {period.status === PayPeriodStatus.Open ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowLockDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Lock className="h-3 w-3" />
                                Lock
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPeriod(period);
                                  setShowUnlockDialog(true);
                                }}
                                className="gap-1"
                              >
                                <Unlock className="h-3 w-3" />
                                Unlock
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pay periods found.</p>
                <p className="text-sm">
                  Click &quot;Generate Periods&quot; to create pay periods.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog — Next 4 Periods */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Upcoming Pay Periods Preview
            </DialogTitle>
            <DialogDescription>
              Based on current configuration ({getPeriodTypeLabel(configForm.type)}, start: {getDayOfWeekLabel(configForm.weekStartDay)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {previewPeriods.map((pp, i) => {
              const isCurrentPreview =
                new Date() >= pp.start && new Date() <= pp.end;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCurrentPreview
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-400 dark:bg-amber-900/10"
                      : "border-border"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{pp.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.ceil(
                        (pp.end.getTime() - pp.start.getTime()) / (1000 * 60 * 60 * 24)
                      ) + 1}{" "}
                      days
                    </p>
                  </div>
                  {isCurrentPreview && (
                    <Badge className="bg-amber-500 text-white">Current</Badge>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Lock date: {configForm.autoLockEnabled
                ? `${configForm.autoLockDaysAfterEnd} days after period end (auto)`
                : "Manual lock only"}
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pay Period Configuration</DialogTitle>
            <DialogDescription>
              Configure how pay periods are generated and enforced.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Period Type</Label>
              <Select
                value={String(configForm.type)}
                onValueChange={(v) =>
                  setConfigForm({ ...configForm, type: parseInt(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Weekly</SelectItem>
                  <SelectItem value="1">Bi-Weekly</SelectItem>
                  <SelectItem value="2">Semi-Monthly</SelectItem>
                  <SelectItem value="3">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(configForm.type === PayPeriodType.Weekly ||
              configForm.type === PayPeriodType.BiWeekly) && (
              <div className="space-y-2">
                <Label>Period Start Day</Label>
                <Select
                  value={String(configForm.weekStartDay)}
                  onValueChange={(v) =>
                    setConfigForm({ ...configForm, weekStartDay: parseInt(v) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                    <SelectItem value="2">Tuesday</SelectItem>
                    <SelectItem value="3">Wednesday</SelectItem>
                    <SelectItem value="4">Thursday</SelectItem>
                    <SelectItem value="5">Friday</SelectItem>
                    <SelectItem value="6">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {configForm.type === PayPeriodType.SemiMonthly && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Period Day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={configForm.semiMonthlyFirstDay}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        semiMonthlyFirstDay: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Second Period Day</Label>
                  <Input
                    type="number"
                    min={2}
                    max={31}
                    value={configForm.semiMonthlySecondDay}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        semiMonthlySecondDay: parseInt(e.target.value) || 16,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Lock Date (days after period end)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={configForm.autoLockDaysAfterEnd}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      autoLockDaysAfterEnd: parseInt(e.target.value) || 3,
                    })
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  days grace period
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enforcement Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Block time entries in locked periods
                </p>
              </div>
              <Switch
                checked={configForm.enforcementEnabled}
                onCheckedChange={(checked) =>
                  setConfigForm({ ...configForm, enforcementEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Lock</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically lock periods after grace days
                </p>
              </div>
              <Switch
                checked={configForm.autoLockEnabled}
                onCheckedChange={(checked) =>
                  setConfigForm({ ...configForm, autoLockEnabled: checked })
                }
              />
            </div>

            {/* Inline Preview */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                PREVIEW — Next 4 Periods
              </p>
              <div className="space-y-1.5">
                {previewPeriods.map((pp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{pp.label}</span>
                    <span className="text-muted-foreground">
                      {Math.ceil(
                        (pp.end.getTime() - pp.start.getTime()) / (1000 * 60 * 60 * 24)
                      ) + 1}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Pay Period</DialogTitle>
            <DialogDescription>
              Lock this period to prevent time entry modifications.
              {selectedPeriod && (
                <span className="block mt-2 font-medium">
                  Period: {selectedPeriod.label}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add notes about locking this period..."
                value={lockNotes}
                onChange={(e) => setLockNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLock} disabled={isSubmitting} className="gap-2">
              <Lock className="h-4 w-4" />
              {isSubmitting ? "Locking..." : "Lock Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={showUnlockDialog} onOpenChange={setShowUnlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Pay Period</DialogTitle>
            <DialogDescription>
              Unlock this period to allow time entry modifications.
              This action is logged for compliance.
              {selectedPeriod && (
                <span className="block mt-2 font-medium">
                  Period: {selectedPeriod.label}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Reason Required</AlertTitle>
              <AlertDescription>
                Please provide a reason for unlocking this period.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Textarea
                placeholder="Why is this period being unlocked?"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlockDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={isSubmitting || !unlockReason.trim()}
              className="gap-2"
            >
              <Unlock className="h-4 w-4" />
              {isSubmitting ? "Unlocking..." : "Unlock Period"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
