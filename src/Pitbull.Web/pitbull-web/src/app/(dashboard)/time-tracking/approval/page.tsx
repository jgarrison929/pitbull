"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { LoadingButton } from "@/components/ui/loading-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { CheckCircle, XCircle, ArrowLeft } from "lucide-react";
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

export default function TimeTrackingApprovalPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvers, setApprovers] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Selection and actions
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [approverId, setApproverId] = useState<string>("");
  const [rejectReason, setRejectReason] = useState<string>("");
  const [approvalComment, setApprovalComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<"approve" | "reject" | null>(
    null
  );

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      params.set("status", "0"); // Submitted only
      if (projectFilter !== ALL_VALUE) params.set("projectId", projectFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const result = await api<ListTimeEntriesResult>(
        `/api/time-entries?${params.toString()}`
      );
      setEntries(result.items);
    } catch {
      toast.error("Failed to load time entries");
    } finally {
      setIsLoading(false);
    }
  }, [projectFilter, startDate, endDate]);

  useEffect(() => {
    // Load filter options
    async function loadOptions() {
      try {
        const [projectsRes, employeesRes] = await Promise.all([
          api<PagedResult<Project>>("/api/projects?pageSize=100"),
          api<ListEmployeesResult>(
            "/api/employees?isActive=true&classification=4&pageSize=100"
          ), // Supervisors only
        ]);
        setProjects(projectsRes.items);
        setApprovers(employeesRes.items);

        // Default to first approver if available
        if (employeesRes.items.length > 0) {
          setApproverId(employeesRes.items[0]!.id);
        }
      } catch {
        // Non-fatal: filters will just be empty
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

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

  // Calculate totals
  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/time-tracking"
              className="text-muted-foreground hover:text-foreground"
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
              <SelectTrigger className="w-[200px] inline-flex">
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

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
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
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || getTodayISO()}
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{entries.length}</div>
              <p className="text-xs text-muted-foreground">
                Pending Approval
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatHours(totalHours)}
              </div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pending Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={[
                    "Date",
                    "Employee",
                    "Project",
                    "Cost Code",
                    "Hours",
                    "Actions",
                  ]}
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
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
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
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Project
                        </span>
                        <p className="font-medium truncate">
                          {entry.projectNumber}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Hours
                        </span>
                        <p className="font-medium font-mono">
                          {formatHours(entry.totalHours)}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.costCodeDescription}
                    </div>
                    {entry.description && (
                      <p className="text-xs text-muted-foreground italic">
                        {entry.description}
                      </p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => openApproveDialog(entry)}
                        disabled={!approverId}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => openRejectDialog(entry)}
                        disabled={!approverId}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
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
                        <TableCell className="text-right font-mono font-medium">
                          {formatHours(entry.totalHours)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                          {entry.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openApproveDialog(entry)}
                              disabled={!approverId}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openRejectDialog(entry)}
                              disabled={!approverId}
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

      {/* Approve Dialog */}
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
                <span className="font-medium">
                  {selectedEntry?.projectNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Code:</span>
                <span className="font-medium">
                  {selectedEntry?.costCodeDescription}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-mono font-medium">
                  {selectedEntry && formatHours(selectedEntry.totalHours)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvalComment">
                Comment (optional)
              </Label>
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

      {/* Reject Dialog */}
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
                <span className="font-medium">
                  {selectedEntry?.projectNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Code:</span>
                <span className="font-medium">
                  {selectedEntry?.costCodeDescription}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-mono font-medium">
                  {selectedEntry && formatHours(selectedEntry.totalHours)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">
                Reason for rejection *
              </Label>
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
    </div>
  );
}
