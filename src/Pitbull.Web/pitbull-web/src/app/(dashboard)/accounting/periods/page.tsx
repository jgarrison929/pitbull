"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 25;

type PeriodStatus = "Open" | "SoftClosed" | "HardClosed";

interface AccountingPeriodDto {
  id: string;
  periodNumber: number;
  fiscalYear: number;
  periodName: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt?: string | null;
  reopenedCount: number;
  lastReopenedAt?: string | null;
  lastReopenReason?: string | null;
}

interface ListResult {
  items: AccountingPeriodDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusColors: Record<PeriodStatus, "default" | "secondary" | "destructive"> = {
  Open: "default",
  SoftClosed: "secondary",
  HardClosed: "destructive",
};

const statusLabels: Record<PeriodStatus, string> = {
  Open: "Open",
  SoftClosed: "Soft Closed",
  HardClosed: "Closed",
};

export default function AccountingPeriodsPage() {
  const [periods, setPeriods] = useState<AccountingPeriodDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [seedYear, setSeedYear] = useState(String(new Date().getFullYear()));
  const [isSeeding, setIsSeeding] = useState(false);

  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenPeriod, setReopenPeriod] = useState<AccountingPeriodDto | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  const fetchPeriods = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (yearFilter !== ALL_VALUE) params.set("fiscalYear", yearFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const result = await api<ListResult>(`/api/accounting-periods?${params.toString()}`);
      setPeriods(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load accounting periods");
    } finally {
      setIsLoading(false);
    }
  }, [page, yearFilter, statusFilter]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  useEffect(() => {
    setPage(1);
  }, [yearFilter, statusFilter]);

  async function handleSeedYear() {
    const year = parseInt(seedYear, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      toast.error("Enter a valid fiscal year (2000-2100)");
      return;
    }

    setIsSeeding(true);
    try {
      await api(`/api/accounting-periods/seed/${year}`, { method: "POST" });
      toast.success(`Created 12 periods for FY ${year}`);
      setSeedDialogOpen(false);
      setYearFilter(String(year));
      fetchPeriods();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed fiscal year");
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleClose(period: AccountingPeriodDto) {
    if (!confirm(`Close period "${period.periodName}"? Journal entries cannot be posted to a closed period.`)) return;
    try {
      await api(`/api/accounting-periods/${period.id}/close`, { method: "POST" });
      toast.success(`${period.periodName} closed`);
      fetchPeriods();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close period");
    }
  }

  function openReopenDialog(period: AccountingPeriodDto) {
    setReopenPeriod(period);
    setReopenReason("");
    setReopenDialogOpen(true);
  }

  async function handleReopen() {
    if (!reopenPeriod || !reopenReason.trim()) {
      toast.error("A reason is required to reopen a period");
      return;
    }

    setIsReopening(true);
    try {
      await api(`/api/accounting-periods/${reopenPeriod.id}/reopen`, {
        method: "POST",
        body: { reason: reopenReason.trim() },
      });
      toast.success(`${reopenPeriod.periodName} reopened`);
      setReopenDialogOpen(false);
      fetchPeriods();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen period");
    } finally {
      setIsReopening(false);
    }
  }

  async function handleDelete(period: AccountingPeriodDto) {
    if (!confirm(`Delete period "${period.periodName}"?`)) return;
    try {
      await api(`/api/accounting-periods/${period.id}`, { method: "DELETE" });
      toast.success("Period deleted");
      fetchPeriods();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete period");
    }
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting Periods</h1>
          <p className="text-muted-foreground">Manage fiscal year periods for journal entry posting</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setSeedDialogOpen(true)}>
          + Seed Fiscal Year
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="SoftClosed">Soft Closed</SelectItem>
                  <SelectItem value="HardClosed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton headers={["Period", "Year", "Dates", "Status", "Reopened", "Actions"]} rows={8} />
      ) : totalCount === 0 ? (
        <EmptyState
          title="No accounting periods found"
          description="Seed a fiscal year to create monthly periods."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Reopened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">{period.periodName}</TableCell>
                    <TableCell>{period.fiscalYear}</TableCell>
                    <TableCell>{period.startDate}</TableCell>
                    <TableCell>{period.endDate}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[period.status]}>
                        {statusLabels[period.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{period.reopenedCount || "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {period.status === "Open" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleClose(period)}>
                            Close
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(period)}>
                            Delete
                          </Button>
                        </>
                      )}
                      {period.status === "HardClosed" && (
                        <Button size="sm" variant="outline" onClick={() => openReopenDialog(period)}>
                          Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {totalCount === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1}-
          {Math.min(page * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span>
            Page {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Seed Fiscal Year Dialog */}
      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seed Fiscal Year</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will create 12 monthly accounting periods for the selected fiscal year.
          </p>
          <div className="space-y-2">
            <Label>Fiscal Year</Label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={seedYear}
              onChange={(e) => setSeedYear(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isSeeding} onClick={handleSeedYear}>
              Seed Year
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Period Dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Period</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reopening <strong>{reopenPeriod?.periodName}</strong> will allow journal entries to be posted to this period again.
            A reason is required for audit purposes.
          </p>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              placeholder="Why is this period being reopened?"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
              Cancel
            </Button>
            <LoadingButton loading={isReopening} onClick={handleReopen} disabled={!reopenReason.trim()}>
              Reopen Period
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
