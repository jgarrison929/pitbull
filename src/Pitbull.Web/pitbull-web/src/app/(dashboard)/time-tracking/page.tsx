"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Clock, ArrowUpDown, ArrowUp, ArrowDown, Users, List, CheckCircle2, XCircle } from "lucide-react";
import api from "@/lib/api";
import type {
  ListTimeEntriesResult,
  TimeEntry,
  PagedResult,
  Project,
  ListEmployeesResult,
  Employee,
  Equipment,
  ListEquipmentResult,
} from "@/lib/types";
import {
  formatHours,
  formatDate,
  getTodayISO,
} from "@/lib/time-tracking";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
import { useCompany } from "@/contexts/company-context";
import { Suspense } from "react";

const ALL_VALUE = "__all__";

type SortField = "date" | "employee" | "project" | "phase" | "equipment" | "hours" | "status";
type SortDirection = "asc" | "desc";

function TimeTrackingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompany } = useCompany();

  // Default behavior: redirect to crew entry unless ?view=entries
  const viewParam = searchParams.get("view");

  useEffect(() => {
    if (viewParam !== "entries") {
      router.replace("/time-tracking/crew-entry");
    }
  }, [viewParam, router]);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [phaseFilter, setPhaseFilter] = useState<string>(ALL_VALUE);
  const [equipmentFilter, setEquipmentFilter] = useState<string>(ALL_VALUE);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "50");
      if (projectFilter !== ALL_VALUE) params.set("projectId", projectFilter);
      if (employeeFilter !== ALL_VALUE)
        params.set("employeeId", employeeFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
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
  }, [projectFilter, employeeFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    // Load filter options
    async function loadOptions() {
      try {
        const [projectsRes, employeesRes, equipmentRes] = await Promise.all([
          api<PagedResult<Project>>("/api/projects?pageSize=100"),
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=100"),
          api<ListEquipmentResult>("/api/equipment?isActive=true&pageSize=200"),
        ]);
        setProjects(projectsRes.items);
        setEmployees(employeesRes.items);
        setEquipmentList(equipmentRes.items);
      } catch {
        // Non-fatal: filters will just be empty
      }
    }
    loadOptions();
  }, [activeCompany?.id]);

  useEffect(() => {
    if (viewParam === "entries") {
      fetchEntries();
    }
  }, [fetchEntries, activeCompany?.id, viewParam]);

  // Client-side filtering for phase and equipment (not supported by API params)
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Phase filter (client-side)
    if (phaseFilter !== ALL_VALUE) {
      if (phaseFilter === "__none__") {
        result = result.filter((e) => !e.phaseName);
      } else {
        result = result.filter((e) => e.phaseName === phaseFilter);
      }
    }

    // Equipment filter (client-side)
    if (equipmentFilter !== ALL_VALUE) {
      if (equipmentFilter === "__none__") {
        result = result.filter((e) => !e.equipmentCode);
      } else {
        result = result.filter((e) => e.equipmentId === equipmentFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "date":
          return dir * a.date.localeCompare(b.date);
        case "employee":
          return dir * a.employeeName.localeCompare(b.employeeName);
        case "project":
          return dir * a.projectNumber.localeCompare(b.projectNumber);
        case "phase":
          return dir * (a.phaseName || "").localeCompare(b.phaseName || "");
        case "equipment":
          return dir * (a.equipmentCode || "").localeCompare(b.equipmentCode || "");
        case "hours":
          return dir * (a.totalHours - b.totalHours);
        case "status":
          return dir * (a.status - b.status);
        default:
          return 0;
      }
    });

    return result;
  }, [entries, phaseFilter, equipmentFilter, sortField, sortDirection]);

  useEffect(() => {
    const visibleIds = new Set(filteredEntries.map((e) => e.id));
    setSelectedEntryIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredEntries]);

  // Get unique phase names from entries for the filter dropdown
  const uniquePhases = useMemo(() => {
    const phases = new Set<string>();
    entries.forEach((e) => {
      if (e.phaseName) phases.add(e.phaseName);
    });
    return Array.from(phases).sort();
  }, [entries]);

  // Toggle sort
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-amber-500 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-amber-500 inline" />
    );
  }

  // Calculate totals from filtered entries
  const totalRegular = filteredEntries.reduce((sum, e) => sum + e.regularHours, 0);
  const totalOvertime = filteredEntries.reduce((sum, e) => sum + e.overtimeHours, 0);
  const totalDoubletime = filteredEntries.reduce((sum, e) => sum + e.doubletimeHours, 0);
  const totalHours = filteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
  const totalEquipmentHours = filteredEntries.reduce((sum, e) => sum + (e.equipmentHours || 0), 0);

  const allVisibleSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) => selectedEntryIds.has(entry.id));
  const someVisibleSelected =
    filteredEntries.some((entry) => selectedEntryIds.has(entry.id)) && !allVisibleSelected;

  function toggleEntrySelection(entryId: string, checked: boolean) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      filteredEntries.forEach((entry) => {
        if (checked) next.add(entry.id);
        else next.delete(entry.id);
      });
      return next;
    });
  }

  async function runBulkAction(action: "approve" | "reject") {
    const ids = Array.from(selectedEntryIds);
    if (ids.length === 0) {
      toast.error("Select at least one entry");
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        if (action === "approve") {
          await api(`/api/time-entries/${id}/approve`, {
            method: "POST",
            body: { comments: "Bulk approved from time tracking list" },
          });
        } else {
          await api(`/api/time-entries/${id}/reject`, {
            method: "POST",
            body: { reason: "Bulk rejected from time tracking list" },
          });
        }
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    if (successCount > 0) {
      toast.success(
        action === "approve"
          ? `Approved ${successCount} time entr${successCount === 1 ? "y" : "ies"}`
          : `Rejected ${successCount} time entr${successCount === 1 ? "y" : "ies"}`
      );
    }
    if (failCount > 0) {
      toast.error(`Failed on ${failCount} entr${failCount === 1 ? "y" : "ies"}`);
    }

    setSelectedEntryIds(new Set());
    await fetchEntries();
    setIsBulkProcessing(false);
  }

  // If not viewing entries, show nothing (redirect is happening)
  if (viewParam !== "entries") {
    return null;
  }

  return (
    <ErrorBoundary label="time tracking">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
            <p className="text-muted-foreground">
              Track and manage employee time entries
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => runBulkAction("approve")}
              disabled={selectedEntryIds.size === 0 || isBulkProcessing}
              className="min-h-[44px] shrink-0"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isBulkProcessing ? "Processing..." : `Bulk Approve (${selectedEntryIds.size})`}
            </Button>
            <Button
              variant="outline"
              onClick={() => runBulkAction("reject")}
              disabled={selectedEntryIds.size === 0 || isBulkProcessing}
              className="min-h-[44px] shrink-0"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {isBulkProcessing ? "Processing..." : `Bulk Reject (${selectedEntryIds.size})`}
            </Button>
            <Button
              asChild
              variant="outline"
              className="min-h-[44px] shrink-0"
            >
              <Link href="/time-tracking/approval">Review & Approve</Link>
            </Button>
            <Button
              asChild
              className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
            >
              <Link href="/time-tracking/new">+ New Entry</Link>
            </Button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 border-b">
          <Link
            href="/time-tracking/crew-entry"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors"
          >
            <Users className="h-4 w-4" />
            Crew Entry
          </Link>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-amber-500 text-amber-600 transition-colors"
          >
            <List className="h-4 w-4" />
            All Entries
          </button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <Label>Employee</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger>
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
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
                    <SelectItem value="0">Submitted</SelectItem>
                    <SelectItem value="1">Approved</SelectItem>
                    <SelectItem value="2">Rejected</SelectItem>
                    <SelectItem value="3">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Phases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Phases</SelectItem>
                    <SelectItem value="__none__">No Phase</SelectItem>
                    {uniquePhases.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>All Equipment</SelectItem>
                    <SelectItem value="__none__">No Equipment</SelectItem>
                    {equipmentList.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.code} - {eq.name}
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
              {/* Active filter indicator */}
              {(phaseFilter !== ALL_VALUE || equipmentFilter !== ALL_VALUE) && (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPhaseFilter(ALL_VALUE);
                      setEquipmentFilter(ALL_VALUE);
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    Clear phase/equipment filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {!isLoading && filteredEntries.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatHours(totalHours)}</div>
                <p className="text-xs text-muted-foreground">Total Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatHours(totalRegular)}
                </div>
                <p className="text-xs text-muted-foreground">Regular Hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatHours(totalOvertime)}
                </div>
                <p className="text-xs text-muted-foreground">Overtime (1.5x)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatHours(totalDoubletime)}
                </div>
                <p className="text-xs text-muted-foreground">Double Time (2x)</p>
              </CardContent>
            </Card>
            {totalEquipmentHours > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {formatHours(totalEquipmentHours)}
                  </div>
                  <p className="text-xs text-muted-foreground">Equipment Hours</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Time Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Time Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <div className="sm:hidden">
                  <CardListSkeleton rows={5} />
                </div>
                <div className="hidden sm:block">
                  <TableSkeleton
                    headers={[
                      "",
                      "Date",
                      "Employee",
                      "Project",
                      "Phase",
                      "Equipment",
                      "Hours",
                      "Status",
                    ]}
                    rows={5}
                  />
                </div>
              </>
            ) : filteredEntries.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No time entries"
                description="Start tracking time by creating your first entry. Labor hours flow to job costs automatically."
                actionLabel="+ Log Time Entry"
                actionHref="/time-tracking/new"
              />
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="sm:hidden space-y-3">
                  {filteredEntries.map((entry) => (
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
                        <StatusBadge
                          entityType="TimeEntry"
                          status={entry.status}
                          className="text-xs shrink-0"
                        />
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
                      {(entry.phaseName || entry.equipmentCode) && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {entry.phaseName && (
                            <Badge
                              variant="secondary"
                              className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-normal"
                            >
                              📐 {entry.phaseName}
                            </Badge>
                          )}
                          {entry.equipmentCode && (
                            <Badge
                              variant="secondary"
                              className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-normal"
                            >
                              🚜 {entry.equipmentCode}
                              {entry.equipmentHours > 0 && (
                                <span className="ml-1 font-mono">({formatHours(entry.equipmentHours)}h)</span>
                              )}
                            </Badge>
                          )}
                        </div>
                      )}
                      {/* Color-coded hours breakdown on mobile */}
                      {(entry.overtimeHours > 0 || entry.doubletimeHours > 0 || entry.equipmentHours > 0) && (
                        <div className="flex flex-wrap gap-3 text-xs border-t pt-2">
                          <span className="text-blue-600 dark:text-blue-400">
                            Reg: {formatHours(entry.regularHours)}
                          </span>
                          {entry.overtimeHours > 0 && (
                            <span className="text-orange-600 dark:text-orange-400">
                              OT: {formatHours(entry.overtimeHours)}
                            </span>
                          )}
                          {entry.doubletimeHours > 0 && (
                            <span className="text-red-600 dark:text-red-400">
                              DT: {formatHours(entry.doubletimeHours)}
                            </span>
                          )}
                          {entry.equipmentHours > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Equip: {formatHours(entry.equipmentHours)}
                            </span>
                          )}
                        </div>
                      )}
                      {entry.description && (
                        <p className="text-xs text-muted-foreground italic">
                          {entry.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[44px]">
                          <Checkbox
                            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                            aria-label="Select all visible entries"
                          />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("date")}
                        >
                          Date <SortIcon field="date" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("employee")}
                        >
                          Employee <SortIcon field="employee" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("project")}
                        >
                          Project <SortIcon field="project" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("phase")}
                        >
                          Phase <SortIcon field="phase" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("equipment")}
                        >
                          Equipment <SortIcon field="equipment" />
                        </TableHead>
                        <TableHead className="text-right">Reg</TableHead>
                        <TableHead className="text-right">OT</TableHead>
                        <TableHead className="text-right">DT</TableHead>
                        <TableHead
                          className="text-right cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("hours")}
                        >
                          Total <SortIcon field="hours" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:text-foreground"
                          onClick={() => toggleSort("status")}
                        >
                          Status <SortIcon field="status" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEntryIds.has(entry.id)}
                              onCheckedChange={(checked) => toggleEntrySelection(entry.id, checked === true)}
                              aria-label={`Select ${entry.employeeName} on ${entry.date}`}
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
                            <br />
                            <span className="text-muted-foreground text-xs">
                              {entry.projectName}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {entry.phaseName ? (
                              <Badge
                                variant="secondary"
                                className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-normal"
                              >
                                {entry.phaseName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {entry.equipmentCode ? (
                              <div>
                                <span className="font-mono">{entry.equipmentCode}</span>
                                <br />
                                <span className="text-muted-foreground">
                                  {entry.equipmentName}
                                  {entry.equipmentHours > 0 && (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      {" "}· {formatHours(entry.equipmentHours)}h
                                    </span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                            {formatHours(entry.regularHours)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.overtimeHours > 0 ? (
                              <span className="text-orange-600 dark:text-orange-400">
                                {formatHours(entry.overtimeHours)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {entry.doubletimeHours > 0 ? (
                              <span className="text-red-600 dark:text-red-400">
                                {formatHours(entry.doubletimeHours)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatHours(entry.totalHours)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              entityType="TimeEntry"
                              status={entry.status}
                            />
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
      </div>
    </ErrorBoundary>
  );
}

export default function TimeTrackingPage() {
  return (
    <Suspense>
      <TimeTrackingContent />
    </Suspense>
  );
}
