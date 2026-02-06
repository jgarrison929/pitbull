"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Users } from "lucide-react";
import api from "@/lib/api";
import type { ListEmployeesResult, Employee } from "@/lib/types";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

const classificationLabels: Record<number, string> = {
  0: "Hourly",
  1: "Salaried",
  2: "Contractor",
  3: "Apprentice",
  4: "Supervisor",
};

const classificationBadgeClass: Record<number, string> = {
  0: "bg-blue-100 text-blue-800",
  1: "bg-purple-100 text-purple-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-green-100 text-green-800",
  4: "bg-amber-100 text-amber-800",
};

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

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<string>("true");

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "100");
      if (search.trim()) params.set("search", search.trim());
      if (classificationFilter !== ALL_VALUE)
        params.set("classification", classificationFilter);
      if (activeFilter !== ALL_VALUE)
        params.set("isActive", activeFilter);

      const result = await api<ListEmployeesResult>(
        `/api/employees?${params.toString()}`
      );
      setEmployees(result.items);
      setTotalCount(result.totalCount);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  }, [search, classificationFilter, activeFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [fetchEmployees]);

  // Calculate stats
  const activeCount = employees.filter((e) => e.isActive).length;
  const hourlyCount = employees.filter((e) => e.classification === 0).length;
  const avgRate =
    employees.length > 0
      ? employees.reduce((sum, e) => sum + e.baseHourlyRate, 0) / employees.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage your workforce and labor rates
          </p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white min-h-[44px] shrink-0"
          disabled
          title="Coming soon"
        >
          + Add Employee
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Name, number, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Classification</Label>
              <Select
                value={classificationFilter}
                onValueChange={setClassificationFilter}
              >
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
              <div className="text-2xl font-bold">{hourlyCount}</div>
              <p className="text-xs text-muted-foreground">Hourly Workers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatCurrency(avgRate)}/hr</div>
              <p className="text-xs text-muted-foreground">Average Rate</p>
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
                  headers={["Employee", "Title", "Classification", "Rate", "Hire Date", "Status"]}
                  rows={5}
                />
              </div>
            </>
          ) : employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees found"
              description="Add employees to start tracking time and managing labor costs."
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{emp.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.employeeNumber}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={emp.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
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
                        <p className="font-medium font-mono">
                          {formatCurrency(emp.baseHourlyRate)}/hr
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={classificationBadgeClass[emp.classification] || ""}
                      >
                        {classificationLabels[emp.classification] || "Unknown"}
                      </Badge>
                      {emp.email && (
                        <span className="text-xs text-muted-foreground truncate">
                          {emp.email}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead className="text-right">Hourly Rate</TableHead>
                      <TableHead>Hire Date</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{emp.fullName}</span>
                            <br />
                            <span className="text-xs text-muted-foreground font-mono">
                              {emp.employeeNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.title || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={classificationBadgeClass[emp.classification] || ""}
                          >
                            {classificationLabels[emp.classification] || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(emp.baseHourlyRate)}
                        </TableCell>
                        <TableCell>{formatDate(emp.hireDate)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {emp.supervisorName || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={emp.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                          >
                            {emp.isActive ? "Active" : "Inactive"}
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
