"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import type {
  HREmployeeListDto,
  HREmployeeListResult,
} from "@/lib/hr-types";
import {
  EmploymentStatus,
  WorkerType,
  employmentStatusLabels,
  employmentStatusColors,
  workerTypeLabels,
  workerTypeColors,
} from "@/lib/hr-types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HREmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<HREmployeeListDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(String(EmploymentStatus.Active));
  const [workerTypeFilter, setWorkerTypeFilter] = useState<string>(ALL_VALUE);
  const [tradeCodeFilter, setTradeCodeFilter] = useState("");
  const [includeTerminated, setIncludeTerminated] = useState(false);

  const pageSize = 20;

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
      
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
      if (workerTypeFilter !== ALL_VALUE) params.set("workerType", workerTypeFilter);
      if (tradeCodeFilter.trim()) params.set("tradeCode", tradeCodeFilter.trim());
      if (includeTerminated) params.set("includeTerminated", "true");

      const result = await api<HREmployeeListResult>(
        `/api/hr/employees?${params.toString()}`
      );
      setEmployees(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, workerTypeFilter, tradeCodeFilter, includeTerminated, currentPage]);

  useEffect(() => {
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [fetchEmployees]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, workerTypeFilter, tradeCodeFilter, includeTerminated]);

  // Calculate stats
  const activeCount = employees.filter((e) => e.status === EmploymentStatus.Active).length;
  const fieldCount = employees.filter((e) => e.workerType === WorkerType.Field).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">HR Employees</h1>
          <p className="text-muted-foreground">
            Manage employee records in HR Core
          </p>
        </div>
        <Button
          asChild
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
        >
          <Link href="/hr/employees/new">+ Add Employee</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Name, employee #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Statuses</SelectItem>
                  <SelectItem value={String(EmploymentStatus.Active)}>Active</SelectItem>
                  <SelectItem value={String(EmploymentStatus.Inactive)}>Inactive</SelectItem>
                  <SelectItem value={String(EmploymentStatus.Pending)}>Pending</SelectItem>
                  <SelectItem value={String(EmploymentStatus.OnCall)}>On Call</SelectItem>
                  <SelectItem value={String(EmploymentStatus.Terminated)}>Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Worker Type</Label>
              <Select value={workerTypeFilter} onValueChange={setWorkerTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Types</SelectItem>
                  <SelectItem value={String(WorkerType.Field)}>Field</SelectItem>
                  <SelectItem value={String(WorkerType.Office)}>Office</SelectItem>
                  <SelectItem value={String(WorkerType.Hybrid)}>Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trade Code</Label>
              <Input
                placeholder="e.g., CARP, ELEC..."
                value={tradeCodeFilter}
                onChange={(e) => setTradeCodeFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeTerminated"
              checked={includeTerminated}
              onChange={(e) => setIncludeTerminated(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="includeTerminated" className="font-normal text-sm">
              Include terminated employees
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Total Employees</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{activeCount}</div>
              <p className="text-xs text-muted-foreground">Active (this page)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{fieldCount}</div>
              <p className="text-xs text-muted-foreground">Field Workers (this page)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["Employee #", "Name", "Status", "Type", "Trade", "Hire Date"]}
                  rows={5}
                />
              </div>
            </>
          ) : employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees found"
              description="Add employees to start managing your HR records."
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/hr/employees/${emp.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {emp.employeeNumber}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={employmentStatusColors[emp.status]}
                      >
                        {employmentStatusLabels[emp.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Type</span>
                        <p className="font-medium">{workerTypeLabels[emp.workerType]}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Trade</span>
                        <p className="font-medium">{emp.tradeCode || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Hired: {formatDate(emp.originalHireDate)}</span>
                      {emp.jobTitle && <span>• {emp.jobTitle}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Hire Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/hr/employees/${emp.id}`)}
                      >
                        <TableCell className="font-mono text-sm">
                          {emp.employeeNumber}
                        </TableCell>
                        <TableCell className="font-medium">{emp.fullName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={employmentStatusColors[emp.status]}
                          >
                            {employmentStatusLabels[emp.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={workerTypeColors[emp.workerType]}
                          >
                            {workerTypeLabels[emp.workerType]}
                          </Badge>
                        </TableCell>
                        <TableCell>{emp.tradeCode || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {emp.jobTitle || "—"}
                        </TableCell>
                        <TableCell>{formatDate(emp.originalHireDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
