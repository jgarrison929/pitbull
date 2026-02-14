"use client";

import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
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

export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriodListResult | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<PayPeriod | null>(null);
  const [config, setConfig] = useState<PayPeriodConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // TODO: Get actual user ID from auth context
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
      // TODO: Get actual user ID from auth context
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
            Manage pay period locking for time entries
          </p>
        </div>
        <div className="flex gap-2">
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
        <Card>
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
                <Badge className={getStatusColor(currentPeriod.status)}>
                  {getStatusLabel(currentPeriod.status)}
                </Badge>
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
                  {periods.items.filter((p) => p.status === PayPeriodStatus.Open).length}
                </p>
                <p>
                  <span className="text-muted-foreground">Locked:</span>{" "}
                  {periods.items.filter((p) => p.status === PayPeriodStatus.Locked).length}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Filter by Status:</Label>
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

      {/* Periods Table */}
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
                    <th className="text-left py-3 px-2">Days</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Locked By</th>
                    <th className="text-left py-3 px-2">Notes</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.items.map((period) => (
                    <tr key={period.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="font-medium">{period.label}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatDate(period.startDate)} - {formatDate(period.endDate)}
                        </div>
                      </td>
                      <td className="py-3 px-2">{period.dayCount}</td>
                      <td className="py-3 px-2">
                        <Badge className={getStatusColor(period.status)}>
                          {getStatusLabel(period.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {period.lockedByName || "-"}
                        {period.lockedAt && (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(period.lockedAt)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 max-w-[200px] truncate">
                        {period.notes || "-"}
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pay periods found.</p>
              <p className="text-sm">Click &quot;Generate Periods&quot; to create pay periods.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
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

            <div className="space-y-2">
              <Label>Week Start Day</Label>
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

            {configForm.autoLockEnabled && (
              <div className="space-y-2">
                <Label>Grace Days After Period End</Label>
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
                />
              </div>
            )}
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
