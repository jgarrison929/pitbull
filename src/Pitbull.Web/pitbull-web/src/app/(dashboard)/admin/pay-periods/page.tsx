"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeleton } from "@/components/skeletons";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";

enum PayPeriodStatus {
  Open = 0,
  Locked = 1,
  Closed = 2,
}

enum PayPeriodType {
  Weekly = 0,
  BiWeekly = 1,
  SemiMonthly = 2,
  Monthly = 3,
}

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: PayPeriodStatus;
  name: string;
  lockedAt?: string | null;
  lockedById?: string | null;
  payrollExportMarkedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

interface PayPeriodConfig {
  type: PayPeriodType;
  weekStartDay: number;
  semiMonthlyFirstDay: number;
  semiMonthlySecondDay: number;
}

interface SummaryBreakdown {
  status: number;
  entryCount: number;
  totalHours: number;
}

interface PayPeriodSummary {
  payPeriodId: string;
  payPeriodName: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  employeeCount: number;
  entryCount: number;
  byStatus: SummaryBreakdown[];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

function statusLabel(status: PayPeriodStatus): string {
  switch (status) {
    case PayPeriodStatus.Open:
      return "Open";
    case PayPeriodStatus.Locked:
      return "Locked";
    case PayPeriodStatus.Closed:
      return "Closed";
    default:
      return "Unknown";
  }
}

function statusBadgeClass(status: PayPeriodStatus): string {
  switch (status) {
    case PayPeriodStatus.Open:
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case PayPeriodStatus.Locked:
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case PayPeriodStatus.Closed:
      return "bg-neutral-200 text-neutral-600 hover:bg-neutral-200";
    default:
      return "";
  }
}

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calculateNextPeriodBounds(lastPeriod: PayPeriod | null, config: PayPeriodConfig): { startDate: string; endDate: string } {
  const start = lastPeriod
    ? new Date(`${lastPeriod.endDate.slice(0, 10)}T00:00:00`)
    : new Date();

  if (lastPeriod) {
    start.setDate(start.getDate() + 1);
  }

  const startDate = toIsoDateOnly(start);
  const working = new Date(start);

  switch (config.type) {
    case PayPeriodType.Weekly: {
      const end = new Date(working);
      end.setDate(end.getDate() + 6);
      return { startDate, endDate: toIsoDateOnly(end) };
    }
    case PayPeriodType.BiWeekly: {
      const end = new Date(working);
      end.setDate(end.getDate() + 13);
      return { startDate, endDate: toIsoDateOnly(end) };
    }
    case PayPeriodType.SemiMonthly: {
      const year = working.getFullYear();
      const month = working.getMonth();
      const day = working.getDate();
      if (day < config.semiMonthlySecondDay) {
        const end = new Date(year, month, config.semiMonthlySecondDay - 1);
        return { startDate, endDate: toIsoDateOnly(end) };
      }
      const end = new Date(year, month + 1, 0);
      return { startDate, endDate: toIsoDateOnly(end) };
    }
    case PayPeriodType.Monthly:
    default: {
      const end = new Date(working.getFullYear(), working.getMonth() + 1, 0);
      return { startDate, endDate: toIsoDateOnly(end) };
    }
  }
}

export default function AdminPayPeriodsPage() {
  const { isAdmin } = useRequireAdmin();
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PayPeriodSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStartDate, setCreateStartDate] = useState("");
  const [createEndDate, setCreateEndDate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<PayPeriod | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState<"lock" | "unlock" | "close" | null>(null);
  const [actionPeriod, setActionPeriod] = useState<PayPeriod | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPeriods = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const result = await api<PagedResult<PayPeriod>>(`/api/pay-periods?${params.toString()}`);
      setPeriods(result.items);

      if (result.items.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(result.items[0].id);
      }
      if (result.items.length === 0) {
        setSelectedPeriodId(null);
        setSummary(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pay periods");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedPeriodId]);

  const loadSummary = useCallback(async (payPeriodId: string) => {
    setIsSummaryLoading(true);
    try {
      const result = await api<PayPeriodSummary>(`/api/pay-periods/${payPeriodId}/summary`);
      setSummary(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load summary");
      setSummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (selectedPeriodId) {
      loadSummary(selectedPeriodId);
    }
  }, [selectedPeriodId, loadSummary]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId]
  );

  function openCreateDialog() {
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + 13);

    setCreateStartDate(toIsoDateOnly(now));
    setCreateEndDate(toIsoDateOnly(end));
    setCreateOpen(true);
  }

  async function handleCreatePeriod() {
    if (!createStartDate || !createEndDate) {
      toast.error("Start and end dates are required");
      return;
    }

    if (parseDateInput(createEndDate) < parseDateInput(createStartDate)) {
      toast.error("End date must be on or after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      await api<PayPeriod>("/api/pay-periods", {
        method: "POST",
        body: {
          startDate: createStartDate,
          endDate: createEndDate,
        },
      });

      toast.success("Pay period created");
      setCreateOpen(false);
      await loadPeriods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create pay period");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditDialog(period: PayPeriod) {
    setEditPeriod(period);
    setEditStartDate(toDateInput(period.startDate));
    setEditEndDate(toDateInput(period.endDate));
    setEditOpen(true);
  }

  async function handleUpdatePeriod() {
    if (!editPeriod) return;

    if (!editStartDate || !editEndDate) {
      toast.error("Start and end dates are required");
      return;
    }

    if (parseDateInput(editEndDate) < parseDateInput(editStartDate)) {
      toast.error("End date must be on or after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      await api<PayPeriod>(`/api/pay-periods/${editPeriod.id}`, {
        method: "PUT",
        body: {
          startDate: editStartDate,
          endDate: editEndDate,
        },
      });

      toast.success("Pay period updated");
      setEditOpen(false);
      setEditPeriod(null);
      await loadPeriods();
      if (selectedPeriodId) await loadSummary(selectedPeriodId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pay period");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openActionDialog(type: "lock" | "unlock" | "close", period: PayPeriod) {
    setActionType(type);
    setActionPeriod(period);
    setActionOpen(true);
  }

  async function handleConfirmAction() {
    if (!actionPeriod || !actionType) return;

    const endpoint = `/api/pay-periods/${actionPeriod.id}/${actionType}`;

    setIsSubmitting(true);
    try {
      await api<PayPeriod>(endpoint, { method: "POST", body: {} });
      toast.success(`Pay period ${actionType}ed`);
      setActionOpen(false);
      setActionType(null);
      setActionPeriod(null);
      await loadPeriods();
      if (selectedPeriodId) await loadSummary(selectedPeriodId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${actionType} pay period`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateNextPeriod() {
    setIsSubmitting(true);
    try {
      const config = await api<PayPeriodConfig>("/api/pay-periods/configuration");
      const latest = periods.length > 0 ? periods[0] : null;
      const { startDate, endDate } = calculateNextPeriodBounds(latest, config);

      await api<PayPeriod>("/api/pay-periods", {
        method: "POST",
        body: { startDate, endDate },
      });

      toast.success("Next pay period generated");
      await loadPeriods();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate next period");
    } finally {
      setIsSubmitting(false);
    }
  }

  const breakdownMap = useMemo(() => {
    const map = new Map<number, SummaryBreakdown>();
    for (const item of summary?.byStatus ?? []) {
      map.set(item.status, item);
    }
    return map;
  }, [summary]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay Period Management</h1>
          <p className="text-muted-foreground">Manage pay period lifecycle with lock, unlock, and close workflow.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateNextPeriod} variant="outline" disabled={isSubmitting}>
            Generate Next Period
          </Button>
          <Button onClick={openCreateDialog} className="bg-amber-500 hover:bg-amber-600 text-white" disabled={isSubmitting}>
            + Create Pay Period
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Pay Periods</CardTitle>
              <CardDescription>Filter by status and manage actions from the register.</CardDescription>
            </div>
            <div className="w-full sm:w-52">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value={String(PayPeriodStatus.Open)}>Open</SelectItem>
                  <SelectItem value={String(PayPeriodStatus.Locked)}>Locked</SelectItem>
                  <SelectItem value={String(PayPeriodStatus.Closed)}>Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton headers={["Name", "Dates", "Status", "Locked", "Actions"]} rows={6} />
            ) : periods.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No pay periods found.</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Locked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((period) => (
                    <TableRow
                      key={period.id}
                      className={selectedPeriodId === period.id ? "bg-muted/40" : ""}
                      onClick={() => setSelectedPeriodId(period.id)}
                    >
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell>{formatDate(period.startDate)} - {formatDate(period.endDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusBadgeClass(period.status)}>
                          {statusLabel(period.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{period.lockedAt ? formatDate(period.lockedAt) : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {period.status === PayPeriodStatus.Open && (
                            <>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditDialog(period); }}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openActionDialog("lock", period); }}>
                                Lock
                              </Button>
                            </>
                          )}
                          {period.status === PayPeriodStatus.Locked && (
                            <>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openActionDialog("unlock", period); }}>
                                Unlock
                              </Button>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); openActionDialog("close", period); }} className="bg-neutral-700 hover:bg-neutral-800 text-white">
                                Close
                              </Button>
                            </>
                          )}
                          {period.status === PayPeriodStatus.Closed && (
                            <span className="text-xs text-muted-foreground">Closed</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Period Summary</CardTitle>
            <CardDescription>
              {selectedPeriod ? selectedPeriod.name : "Select a period to view summary"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isSummaryLoading ? (
              <p className="text-muted-foreground">Loading summary...</p>
            ) : !summary ? (
              <p className="text-muted-foreground">No summary available.</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Hours</span>
                  <span className="font-mono font-semibold">{summary.totalHours.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employees</span>
                  <span className="font-semibold">{summary.employeeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entries</span>
                  <span className="font-semibold">{summary.entryCount}</span>
                </div>
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">By Status</p>
                  <div className="flex justify-between">
                    <span>Draft</span>
                    <span>{breakdownMap.get(3)?.entryCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Submitted</span>
                    <span>{breakdownMap.get(0)?.entryCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Approved</span>
                    <span>{breakdownMap.get(1)?.entryCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rejected</span>
                    <span>{breakdownMap.get(2)?.entryCount ?? 0}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Pay Period</DialogTitle>
            <DialogDescription>Select start and end dates for the new pay period.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-start">Start Date</Label>
              <Input id="create-start" type="date" value={createStartDate} onChange={(e) => setCreateStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-end">End Date</Label>
              <Input id="create-end" type="date" value={createEndDate} onChange={(e) => setCreateEndDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleCreatePeriod} disabled={isSubmitting} className="bg-amber-500 hover:bg-amber-600 text-white">
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pay Period</DialogTitle>
            <DialogDescription>Update pay period date range (open periods only).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start Date</Label>
              <Input id="edit-start" type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">End Date</Label>
              <Input id="edit-end" type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdatePeriod} disabled={isSubmitting}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "lock" && "Lock Pay Period"}
              {actionType === "unlock" && "Unlock Pay Period"}
              {actionType === "close" && "Close Pay Period"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "lock" && "Locking prevents any time entry edits for this pay period."}
              {actionType === "unlock" && "Unlocking reopens this pay period for corrections."}
              {actionType === "close" && "Closing is permanent and marks final payroll export."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {actionPeriod?.name}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleConfirmAction} disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
