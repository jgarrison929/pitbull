"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNewShortcut, useSearchShortcut } from "@/hooks/use-page-shortcuts";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Users, ArrowUp, ArrowDown, ArrowUpDown, Briefcase, Clock, ShieldCheck, UserPlus, FileSpreadsheet } from "lucide-react";
import api from "@/lib/api";
import type { ListEmployeesResult, Employee, ProjectAssignment } from "@/lib/types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";
const DEFAULT_PAGE_SIZE = 20;

const classificationLabels: Record<number, string> = {
  0: "Hourly",
  1: "Salaried",
  2: "Contractor",
  3: "Apprentice",
  4: "Supervisor",
};

const classificationBadgeClass: Record<number, string> = {
  0: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  1: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  3: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  4: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
};

type SortField = "employee" | "title" | "classification" | "rate" | "hireDate" | "status";
type SortDirection = "asc" | "desc";

interface EmployeeStatsResponse {
  employeeId: string;
  fullName: string;
  employeeNumber: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalEarnings: number;
  timeEntryCount: number;
  approvedEntryCount: number;
  pendingEntryCount: number;
  projectCount: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
}

interface CertificationDto {
  id?: string;
  name?: string;
  title?: string;
  certificationName?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeCertificationNames(raw: CertificationDto[] | string[] | null | undefined): string[] {
  if (!raw) return [];

  if (raw.length > 0 && typeof raw[0] === "string") {
    return (raw as string[]).filter(Boolean);
  }

  return (raw as CertificationDto[])
    .map((item) => item.name || item.title || item.certificationName || "")
    .filter(Boolean);
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filters — honor ?isActive= from workforce KPI drill
  const urlParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>(() => {
    const v = urlParams.get("isActive");
    if (v === "true" || v === "false") return v;
    if (v === "all") return ALL_VALUE;
    return "true";
  });

  // Sorting + pagination
  const [sortField, setSortField] = useState<SortField>("employee");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  // Detail sheet
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<ProjectAssignment[]>([]);
  const [selectedStats, setSelectedStats] = useState<EmployeeStatsResponse | null>(null);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);

  // Register keyboard shortcuts
  useNewShortcut("/employees/new");
  useSearchShortcut(searchInputRef);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (classificationFilter !== ALL_VALUE) params.set("classification", classificationFilter);
      if (activeFilter !== ALL_VALUE) params.set("isActive", activeFilter);

      const result = await api<ListEmployeesResult>(`/api/employees?${params.toString()}`);
      setEmployees(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages || 1, 1));
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  }, [search, classificationFilter, activeFilter, page]);

  useEffect(() => {
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [fetchEmployees]);

  useEffect(() => {
    setPage(1);
  }, [search, classificationFilter, activeFilter]);

  const sortedEmployees = useMemo(() => {
    const copy = [...employees];
    copy.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      switch (sortField) {
        case "employee": {
          const aName = `${a.lastName}, ${a.firstName}`.toLowerCase();
          const bName = `${b.lastName}, ${b.firstName}`.toLowerCase();
          return dir * aName.localeCompare(bName);
        }
        case "title":
          return dir * (a.title || "").localeCompare(b.title || "");
        case "classification":
          return dir * a.classification - b.classification;
        case "rate":
          return dir * (a.baseHourlyRate - b.baseHourlyRate);
        case "hireDate":
          return dir * ((a.hireDate || "").localeCompare(b.hireDate || ""));
        case "status":
          return dir * (Number(a.isActive) - Number(b.isActive));
        default:
          return 0;
      }
    });

    return copy;
  }, [employees, sortField, sortDirection]);

  const hourlyCount = employees.filter((e) => e.classification === 0).length;
  const avgRate =
    employees.length > 0
      ? employees.reduce((sum, e) => sum + e.baseHourlyRate, 0) / employees.length
      : 0;

  const pageStart = totalCount === 0 ? 0 : (page - 1) * DEFAULT_PAGE_SIZE + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * DEFAULT_PAGE_SIZE, totalCount);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const openEmployeeDetail = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setIsDetailOpen(true);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadEmployeeDetail() {
      if (!selectedEmployeeId || !isDetailOpen) return;

      setDetailLoading(true);
      try {
        const [employeeResult, projectsResult, statsResult, certificationsResult] = await Promise.all([
          api<Employee>(`/api/employees/${selectedEmployeeId}`),
          api<ProjectAssignment[]>(`/api/employees/${selectedEmployeeId}/projects?activeOnly=true`).catch(() => []),
          api<EmployeeStatsResponse>(`/api/employees/${selectedEmployeeId}/stats`).catch(() => null),
          api<CertificationDto[] | string[]>(`/api/employees/${selectedEmployeeId}/certifications`).catch(() => []),
        ]);

        if (cancelled) return;

        setSelectedEmployee(employeeResult);
        setSelectedProjects(projectsResult);
        setSelectedStats(statsResult);

        const parsedCerts = normalizeCertificationNames(certificationsResult);
        setSelectedCertifications(parsedCerts);
      } catch {
        if (!cancelled) {
          toast.error("Failed to load employee detail");
          setSelectedEmployee(null);
          setSelectedProjects([]);
          setSelectedStats(null);
          setSelectedCertifications([]);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadEmployeeDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId, isDetailOpen]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/60" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-amber-600" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-amber-600" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">Manage your workforce and labor rates</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="min-h-[44px]">
            <Link href="/employees/import">
              <FileSpreadsheet className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Import CSV</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-[44px]">
            <Link href="/employees/onboarding">
              <UserPlus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Start Onboarding</span>
            </Link>
          </Button>
          <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0">
            <Link href="/employees/new">+ Add Employee</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Search by Name</Label>
              <Input
                ref={searchInputRef}
                placeholder="First or last name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Classification</Label>
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Classifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All Classifications</SelectItem>
                  <SelectItem value="0">Hourly</SelectItem>
                  <SelectItem value="1">Salaried</SelectItem>
                  <SelectItem value="2">Contractor</SelectItem>
                  <SelectItem value="3">Apprentice</SelectItem>
                  <SelectItem value="4">Supervisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All</SelectItem>
                  <SelectItem value="true">Active Only</SelectItem>
                  <SelectItem value="false">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="text-2xl font-bold">{hourlyCount}</div>
              <p className="text-xs text-muted-foreground">Hourly Workers (Current Page)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatCurrency(avgRate)}/hr</div>
              <p className="text-xs text-muted-foreground">Average Rate (Current Page)</p>
            </CardContent>
          </Card>
        </div>
      )}

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
                  headers={["Employee", "Title", "Classification", "Rate", "Hire Date", "Status"]}
                  rows={5}
                />
              </div>
            </>
          ) : sortedEmployees.length === 0 && totalCount === 0 && !search.trim() && classificationFilter === ALL_VALUE && activeFilter === "true" ? (
            <EmptyState
              icon={Users}
              title="No employees yet"
              description="Add your first employee to start managing your workforce, labor rates, and certifications."
              actionLabel="+ Add Your First Employee"
              actionHref="/employees/new"
            />
          ) : sortedEmployees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <>
              <div className="sm:hidden space-y-3">
                {sortedEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    className="w-full text-left border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                    onClick={() => openEmployeeDetail(emp.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          emp.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        }
                      >
                        {emp.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Title</span>
                        <p className="font-medium">{emp.title || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Rate</span>
                        <p className="font-medium font-mono">{formatCurrency(emp.baseHourlyRate)}/hr</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={classificationBadgeClass[emp.classification] || ""}>
                        {classificationLabels[emp.classification] || "Unknown"}
                      </Badge>
                      {emp.email && <span className="text-xs text-muted-foreground truncate">{emp.email}</span>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium hover:text-foreground"
                          onClick={() => toggleSort("employee")}
                        >
                          Employee
                          <SortIcon field="employee" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium hover:text-foreground"
                          onClick={() => toggleSort("title")}
                        >
                          Title
                          <SortIcon field="title" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium hover:text-foreground"
                          onClick={() => toggleSort("classification")}
                        >
                          Classification
                          <SortIcon field="classification" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          type="button"
                          className="inline-flex items-center justify-end font-medium hover:text-foreground"
                          onClick={() => toggleSort("rate")}
                        >
                          Hourly Rate
                          <SortIcon field="rate" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium hover:text-foreground"
                          onClick={() => toggleSort("hireDate")}
                        >
                          Hire Date
                          <SortIcon field="hireDate" />
                        </button>
                      </TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center font-medium hover:text-foreground"
                          onClick={() => toggleSort("status")}
                        >
                          Status
                          <SortIcon field="status" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEmployees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openEmployeeDetail(emp.id)}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium">{emp.fullName}</span>
                            <br />
                            <span className="text-xs text-muted-foreground font-mono">{emp.employeeNumber}</span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.title || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={classificationBadgeClass[emp.classification] || ""}>
                            {classificationLabels[emp.classification] || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(emp.baseHourlyRate)}</TableCell>
                        <TableCell>{formatDate(emp.hireDate)}</TableCell>
                        <TableCell className="text-muted-foreground">{emp.supervisorName || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              emp.isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            }
                          >
                            {emp.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pr-10">
            <SheetTitle>Employee Detail</SheetTitle>
            <SheetDescription>
              Projects, time summary, and certifications for the selected employee.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-5">
            {detailLoading || !selectedEmployee ? (
              <div className="space-y-3">
                <div className="h-6 w-40 rounded bg-muted animate-pulse" />
                <div className="h-20 rounded bg-muted animate-pulse" />
                <div className="h-20 rounded bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{selectedEmployee.fullName}</p>
                      <p className="text-sm text-muted-foreground font-mono">{selectedEmployee.employeeNumber}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        selectedEmployee.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }
                    >
                      {selectedEmployee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedEmployee.title || "No title"}</p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Time Entries Summary</p>
                  </div>
                  {selectedStats ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Hours</p>
                        <p className="font-semibold">{selectedStats.totalHours.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Entries</p>
                        <p className="font-semibold">{selectedStats.timeEntryCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Approved</p>
                        <p className="font-semibold">{selectedStats.approvedEntryCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-semibold">{selectedStats.pendingEntryCount}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No time summary available.</p>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Projects</p>
                  </div>
                  {selectedProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active project assignments.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedProjects.map((assignment) => (
                        <div key={assignment.id} className="rounded border px-3 py-2">
                          <p className="font-medium text-sm">{assignment.projectName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{assignment.projectNumber}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Certifications</p>
                  </div>
                  {selectedCertifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedCertifications.map((certification) => (
                        <Badge key={certification} variant="secondary">
                          {certification}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No certifications on file.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button asChild variant="outline">
                    <Link href={`/employees/${selectedEmployee.id}`}>Open Full Profile</Link>
                  </Button>
                  <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Link href={`/employees/${selectedEmployee.id}/edit`}>Edit Employee</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
