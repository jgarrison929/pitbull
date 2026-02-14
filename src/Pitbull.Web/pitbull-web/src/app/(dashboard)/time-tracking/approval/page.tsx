"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  CalendarDays,
  Undo2,
  Filter,
  Wrench,
  Layers,
} from "lucide-react";
import api from "@/lib/api";
import type {
  ListTimeEntriesResult,
  TimeEntry,
  PagedResult,
  Project,
  ListEmployeesResult,
  Employee,
} from "@/lib/types";
import {
  timeEntryStatusBadgeClass,
  timeEntryStatusLabel,
  formatHours,
  formatDate,
  getTodayISO,
} from "@/lib/time-tracking";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

/** Color-coded hours display for construction time tracking */
function ColorCodedHours({ entry }: { entry: TimeEntry }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-sm">
      {entry.regularHours > 0 && (
        <span className="text-blue-600 font-medium" title="Regular hours">
          {entry.regularHours.toFixed(1)}
        </span>
      )}
      {entry.overtimeHours > 0 && (
        <>
          {entry.regularHours > 0 && <span className="text-muted-foreground">+</span>}
          <span className="text-amber-600 font-medium" title="Overtime hours (1.5x)">
            {entry.overtimeHours.toFixed(1)}
            <span className="text-[10px] align-super">OT</span>
          </span>
        </>
      )}
      {entry.doubletimeHours > 0 && (
        <>
          <span className="text-muted-foreground">+</span>
          <span className="text-red-600 font-medium" title="Double time hours (2x)">
            {entry.doubletimeHours.toFixed(1)}
            <span className="text-[10px] align-super">DT</span>
          </span>
        </>
      )}
      <span className="text-muted-foreground mx-0.5">=</span>
      <span className="font-semibold">{entry.totalHours.toFixed(1)}</span>
    </div>
  );
}

export default function TimeTrackingApprovalPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvers, setApprovers] = useState<Employee[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL_VALUE);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Undo state for mobile swipe
  const [undoAction, setUndoAction] = useState<{ entryId: string; action: "approve" | "reject"; timer: ReturnType<typeof setTimeout> } | null>(null);

  // Selection and actions
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [approverId, setApproverId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [approvalComment, setApprovalComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<"approve" | "reject" | "bulk-approve" | "bulk-reject" | null>(
    null
  );

  // Swipe tracking
  const touchStartX = useRef<number>(0);
  const touchStartId = useRef<string>("");
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      params.set("status", "0"); // Submitted only
      if (projectFilter !== ALL_VALUE) params.set("projectId", projectFilter);
      if (employeeFilter !== ALL_VALUE) params.set("employeeId", employeeFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const result = await api<ListTimeEntriesResult>(
        `/api/time-entries?${params.toString()}`
      );
      setEntries(result.items);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to load time entries");
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter, employeeFilter, startDate, endDate]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [projectsRes, approversRes, employeesRes] = await Promise.all([
          api<PagedResult<Project>>("/api/projects?pageSize=100"),
          api<ListEmployeesResult>(
            "/api/employees?isActive=true&classification=4&pageSize=100"
          ),
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=200"),
        ]);
        setProjects(projectsRes.items);
        setApprovers(approversRes.items);
        setEmployees(employeesRes.items);

        if (approversRes.items.length > 0) {
          setApproverId(approversRes.items[0]!.id);
        }
      } catch {
        // Non-fatal
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const isAllSelected = entries.length > 0 && selectedIds.size === entries.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < entries.length;

  const openApproveDialog = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setApprovalComment("");
    setDialogMode("approve");
  };

  const openRejectDialog = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setRejectReason("");
    setDialogMode("reject");
  };

  const openBulkApproveDialog = () => {
    setApprovalComment("");
    setDialogMode("bulk-approve");
  };

  const openBulkRejectDialog = () => {
    setRejectReason("");
    setDialogMode("bulk-reject");
  };

  const closeDialog = () => {
    setSelectedEntry(null);
    setDialogMode(null);
  };

  const handleApprove = async () => {
    if (!selectedEntry || !approverId) return;
    setIsSubmitting(true);

    try {
      await api(`/api/time-entries/${selectedEntry.id}/approve`, {
        method: "POST",
        body: {
          approverId,
          comments: approvalComment || undefined,
        },
      });
      toast.success("Time entry approved");
      closeDialog();
      fetchEntries();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedEntry || !approverId || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setIsSubmitting(true);

    try {
      await api(`/api/time-entries/${selectedEntry.id}/reject`, {
        method: "POST",
        body: {
          approverId,
          reason: rejectReason,
        },
      });
      toast.success("Time entry rejected");
      closeDialog();
      fetchEntries();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject entry"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!approverId || selectedIds.size === 0) return;
    setIsSubmitting(true);

    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await api(`/api/time-entries/${id}/approve`, {
          method: "POST",
          body: {
            approverId,
            comments: approvalComment || undefined,
          },
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Approved ${successCount} time ${successCount === 1 ? "entry" : "entries"}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to approve ${failCount} ${failCount === 1 ? "entry" : "entries"}`);
    }

    closeDialog();
    fetchEntries();
    setIsSubmitting(false);
  };

  const handleBulkReject = async () => {
    if (!approverId || selectedIds.size === 0 || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setIsSubmitting(true);

    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await api(`/api/time-entries/${id}/reject`, {
          method: "POST",
          body: {
            approverId,
            reason: rejectReason,
          },
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Rejected ${successCount} time ${successCount === 1 ? "entry" : "entries"}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to reject ${failCount} ${failCount === 1 ? "entry" : "entries"}`);
    }

    closeDialog();
    fetchEntries();
    setIsSubmitting(false);
  };

  // "Approve All for Date" quick action
  const handleApproveAllForDate = async (dateStr: string) => {
    if (!approverId) {
      toast.error("Please select an approver first");
      return;
    }

    const dateEntries = entries.filter((e) => e.date.startsWith(dateStr));
    if (dateEntries.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const entry of dateEntries) {
      try {
        await api(`/api/time-entries/${entry.id}/approve`, {
          method: "POST",
          body: { approverId },
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Approved ${successCount} entries for ${formatDate(dateStr)}`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} entries failed`);
    }
    fetchEntries();
  };

  // Mobile swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, entryId: string) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartId.current = entryId;
    setSwipingId(entryId);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingId) return;
    const delta = e.touches[0]!.clientX - touchStartX.current;
    setSwipeOffset(delta);
  }, [swipingId]);

  const handleTouchEnd = useCallback(() => {
    if (!swipingId || !approverId) {
      setSwipingId(null);
      setSwipeOffset(0);
      return;
    }

    const entry = entries.find((e) => e.id === swipingId);
    if (!entry) {
      setSwipingId(null);
      setSwipeOffset(0);
      return;
    }

    if (swipeOffset > 100) {
      // Swipe right = approve
      const timer = setTimeout(async () => {
        try {
          await api(`/api/time-entries/${entry.id}/approve`, {
            method: "POST",
            body: { approverId },
          });
          toast.success(`Approved ${entry.employeeName}'s entry`);
          fetchEntries();
        } catch {
          toast.error("Failed to approve");
        }
        setUndoAction(null);
      }, 3000);

      setUndoAction({ entryId: entry.id, action: "approve", timer });
      toast.info(
        `Will approve ${entry.employeeName}'s entry in 3s`,
        { duration: 3000 }
      );
    } else if (swipeOffset < -100) {
      // Swipe left = reject → open dialog
      openRejectDialog(entry);
    }

    setSwipingId(null);
    setSwipeOffset(0);
  }, [swipingId, swipeOffset, entries, approverId, fetchEntries]);

  const handleUndoSwipe = useCallback(() => {
    if (undoAction) {
      clearTimeout(undoAction.timer);
      setUndoAction(null);
      toast.info("Action cancelled");
    }
  }, [undoAction]);

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
  const selectedHours = entries
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + e.totalHours, 0);

  // Group entries by date for "Approve All for Date"
  const uniqueDates = [...new Set(entries.map((e) => e.date.split("T")[0]!))].sort().reverse();

  // Active filter count for badge
  const activeFilterCount = [
    projectFilter !== ALL_VALUE,
    employeeFilter !== ALL_VALUE,
    !!startDate,
    !!endDate,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/time-tracking"
              className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              Time Entry Approval
            </h1>
          </div>
          <p className="text-muted-foreground">
            Review and approve submitted time entries
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Approver: </span>
            <Select value={approverId} onValueChange={setApproverId}>
              <SelectTrigger className="w-[200px] min-h-[44px] sm:min-h-[36px] inline-flex touch-manipulation">
                <SelectValue placeholder="Select approver" />
              </SelectTrigger>
              <SelectContent>
                {approvers.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Filters - collapsible on mobile */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((p) => !p)}
          className="sm:hidden w-full min-h-[48px] gap-2 touch-manipulation"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-amber-500 text-white text-xs ml-1">{activeFilterCount}</Badge>
          )}
        </Button>

        <Card className={`${showFilters ? "block" : "hidden"} sm:block mt-2 sm:mt-0`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="min-h-[48px] sm:min-h-[36px] touch-manipulation">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Projects</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.number} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="min-h-[48px] sm:min-h-[36px] touch-manipulation">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Employees</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || getTodayISO()}
                  className="min-h-[48px] sm:min-h-[36px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={getTodayISO()}
                  className="min-h-[48px] sm:min-h-[36px] touch-manipulation"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {!isLoading && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{entries.length}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold font-mono">
                {formatHours(totalHours)}
              </div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          <Card className="hidden sm:block">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{uniqueDates.length}</div>
              <p className="text-xs text-muted-foreground">Unique Dates</p>
            </CardContent>
          </Card>
          <Card className="hidden sm:block">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {new Set(entries.map((e) => e.projectId)).size}
              </div>
              <p className="text-xs text-muted-foreground">Projects</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* "Approve All for Date" Quick Actions */}
      {!isLoading && uniqueDates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueDates.slice(0, 5).map((dateStr) => {
            const count = entries.filter((e) => e.date.startsWith(dateStr)).length;
            return (
              <Button
                key={dateStr}
                variant="outline"
                size="sm"
                onClick={() => handleApproveAllForDate(dateStr)}
                disabled={!approverId}
                className="gap-2 min-h-[44px] touch-manipulation"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Approve All {formatDate(dateStr)} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {!isLoading && entries.length > 0 && selectedIds.size > 0 && (
        <Card className="bg-muted/50 sticky top-0 z-10">
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">{selectedIds.size}</span>{" "}
                {selectedIds.size === 1 ? "entry" : "entries"} selected
                <span className="text-muted-foreground ml-2">
                  ({formatHours(selectedHours)} hours)
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] touch-manipulation"
                  onClick={openBulkApproveDialog}
                  disabled={!approverId}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve Selected
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="min-h-[44px] touch-manipulation"
                  onClick={openBulkRejectDialog}
                  disabled={!approverId}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Undo Action Bar */}
      {undoAction && (
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 sticky bottom-4 z-10">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {undoAction.action === "approve" ? "Approving" : "Rejecting"} entry...
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndoSwipe}
                className="gap-1 min-h-[44px] touch-manipulation"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <div className="sm:hidden">
                <CardListSkeleton rows={5} />
              </div>
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["", "Date", "Employee", "Project", "Cost Code", "Phase", "Hours", "Actions"]}
                  rows={5}
                />
              </div>
            </>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All caught up!"
              description="No time entries pending approval. Check back later or adjust your filters."
            />
          ) : (
            <>
              {/* Mobile card layout with swipe */}
              <div className="sm:hidden space-y-3">
                <p className="text-xs text-muted-foreground text-center mb-2">
                  Swipe right to approve • Swipe left to reject
                </p>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`border rounded-lg p-4 space-y-3 transition-transform ${
                      selectedIds.has(entry.id) ? "border-primary bg-primary/5" : ""
                    }`}
                    style={{
                      transform: swipingId === entry.id ? `translateX(${swipeOffset}px)` : "none",
                      backgroundColor:
                        swipingId === entry.id
                          ? swipeOffset > 60
                            ? "rgba(22, 163, 74, 0.1)"
                            : swipeOffset < -60
                            ? "rgba(220, 38, 38, 0.1)"
                            : undefined
                          : undefined,
                    }}
                    onTouchStart={(e) => handleTouchStart(e, entry.id)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleSelection(entry.id)}
                        className="mt-1 min-h-[22px] min-w-[22px]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-base">
                              {entry.employeeName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(entry.date)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${timeEntryStatusBadgeClass(entry.status)} text-xs shrink-0`}
                          >
                            {timeEntryStatusLabel(entry.status)}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                          <div>
                            <span className="text-muted-foreground text-xs">Project</span>
                            <p className="font-medium truncate">{entry.projectNumber}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Hours</span>
                            <ColorCodedHours entry={entry} />
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mt-2">
                          {entry.costCodeDescription}
                        </div>

                        {/* Phase & Equipment info */}
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {entry.phaseName && (
                            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                              <Layers className="h-3 w-3" />
                              {entry.phaseName}
                            </span>
                          )}
                          {entry.equipmentName && (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                              <Wrench className="h-3 w-3" />
                              {entry.equipmentCode || entry.equipmentName}
                              {entry.equipmentHours > 0 && ` (${entry.equipmentHours.toFixed(1)}h)`}
                            </span>
                          )}
                        </div>

                        {entry.description && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {entry.description}
                          </p>
                        )}
                        <div className="flex gap-2 pt-3">
                          <Button
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[48px] touch-manipulation"
                            onClick={() => openApproveDialog(entry)}
                            disabled={!approverId}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 min-h-[48px] touch-manipulation"
                            onClick={() => openRejectDialog(entry)}
                            disabled={!approverId}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={isAllSelected}
                          ref={(el) => {
                            if (el) {
                              (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate = isSomeSelected;
                            }
                          }}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className={selectedIds.has(entry.id) ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={() => toggleSelection(entry.id)}
                            aria-label={`Select time entry for ${entry.employeeName}`}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.employeeName}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">
                            {entry.projectNumber}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">
                          {entry.costCodeDescription}
                        </TableCell>
                        <TableCell>
                          {entry.phaseName ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                              {entry.phaseName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.equipmentName ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              {entry.equipmentCode || entry.equipmentName}
                              {entry.equipmentHours > 0 && ` ${entry.equipmentHours.toFixed(1)}h`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ColorCodedHours entry={entry} />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                          {entry.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                              onClick={() => openApproveDialog(entry)}
                              disabled={!approverId}
                              title="Approve entry"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                              onClick={() => openRejectDialog(entry)}
                              disabled={!approverId}
                              title="Reject entry"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog (single) */}
      <Dialog
        open={dialogMode === "approve"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Time Entry</DialogTitle>
            <DialogDescription>
              Approve this time entry for {selectedEntry?.employeeName} on{" "}
              {selectedEntry && formatDate(selectedEntry.date)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{selectedEntry?.projectNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Code:</span>
                <span className="font-medium">{selectedEntry?.costCodeDescription}</span>
              </div>
              {selectedEntry?.phaseName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phase:</span>
                  <span className="font-medium">{selectedEntry.phaseName}</span>
                </div>
              )}
              {selectedEntry?.equipmentName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Equipment:</span>
                  <span className="font-medium">
                    {selectedEntry.equipmentName}
                    {selectedEntry.equipmentHours > 0 && ` (${selectedEntry.equipmentHours.toFixed(1)}h)`}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours:</span>
                {selectedEntry && <ColorCodedHours entry={selectedEntry} />}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvalComment">Comment (optional)</Label>
              <Textarea
                id="approvalComment"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              loading={isSubmitting}
              loadingText="Approving..."
            >
              Approve
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog (single) */}
      <Dialog
        open={dialogMode === "reject"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Time Entry</DialogTitle>
            <DialogDescription>
              Reject this time entry for {selectedEntry?.employeeName} on{" "}
              {selectedEntry && formatDate(selectedEntry.date)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{selectedEntry?.projectNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Code:</span>
                <span className="font-medium">{selectedEntry?.costCodeDescription}</span>
              </div>
              {selectedEntry?.phaseName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phase:</span>
                  <span className="font-medium">{selectedEntry.phaseName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hours:</span>
                {selectedEntry && <ColorCodedHours entry={selectedEntry} />}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Reason for rejection *</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this entry is being rejected..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              loading={isSubmitting}
              loadingText="Rejecting..."
            >
              Reject
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Dialog */}
      <Dialog
        open={dialogMode === "bulk-approve"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve {selectedIds.size} Time {selectedIds.size === 1 ? "Entry" : "Entries"}</DialogTitle>
            <DialogDescription>
              This will approve all selected time entries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entries:</span>
                <span className="font-medium">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-mono font-medium">{formatHours(selectedHours)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulkApprovalComment">Comment (optional, applies to all)</Label>
              <Textarea
                id="bulkApprovalComment"
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <LoadingButton
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleBulkApprove}
              loading={isSubmitting}
              loadingText="Approving..."
            >
              Approve All
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog
        open={dialogMode === "bulk-reject"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {selectedIds.size} Time {selectedIds.size === 1 ? "Entry" : "Entries"}</DialogTitle>
            <DialogDescription>
              This will reject all selected time entries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entries:</span>
                <span className="font-medium">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-mono font-medium">{formatHours(selectedHours)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulkRejectReason">Reason for rejection * (applies to all)</Label>
              <Textarea
                id="bulkRejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why these entries are being rejected..."
                rows={3}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              onClick={handleBulkReject}
              disabled={!rejectReason.trim()}
              loading={isSubmitting}
              loadingText="Rejecting..."
            >
              Reject All
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
