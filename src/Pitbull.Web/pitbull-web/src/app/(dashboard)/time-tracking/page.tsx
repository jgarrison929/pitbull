"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Clock } from "lucide-react";
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

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>(ALL_VALUE);
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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
        const [projectsRes, employeesRes] = await Promise.all([
          api<PagedResult<Project>>("/api/projects?pageSize=100"),
          api<ListEmployeesResult>("/api/employees?isActive=true&pageSize=100"),
        ]);
        setProjects(projectsRes.items);
        setEmployees(employeesRes.items);
      } catch {
        // Non-fatal: filters will just be empty
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Calculate totals
  const totalRegular = entries.reduce((sum, e) => sum + e.regularHours, 0);
  const totalOvertime = entries.reduce((sum, e) => sum + e.overtimeHours, 0);
  const totalDoubletime = entries.reduce(
    (sum, e) => sum + e.doubletimeHours,
    0
  );
  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);

  return (
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

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      {/* Summary Cards */}
      {!isLoading && entries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatHours(totalHours)}</div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatHours(totalRegular)}
              </div>
              <p className="text-xs text-muted-foreground">Regular Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatHours(totalOvertime)}
              </div>
              <p className="text-xs text-muted-foreground">Overtime (1.5x)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {formatHours(totalDoubletime)}
              </div>
              <p className="text-xs text-muted-foreground">Double Time (2x)</p>
            </CardContent>
          </Card>
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
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={[
                    "Date",
                    "Employee",
                    "Project",
                    "Cost Code",
                    "Hours",
                    "Status",
                  ]}
                  rows={5}
                />
              </div>
            </>
          ) : entries.length === 0 ? (
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
                      <TableHead className="text-right">Reg</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead className="text-right">DT</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
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
                          <br />
                          <span className="text-muted-foreground text-xs">
                            {entry.projectName}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {entry.costCodeDescription}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatHours(entry.regularHours)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.overtimeHours > 0
                            ? formatHours(entry.overtimeHours)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.doubletimeHours > 0
                            ? formatHours(entry.doubletimeHours)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatHours(entry.totalHours)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={timeEntryStatusBadgeClass(entry.status)}
                          >
                            {timeEntryStatusLabel(entry.status)}
                          </Badge>
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
  );
}
