"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton, CardListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  RefreshCw,
  Activity,
  Users,
  LogIn,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type {
  AuditLog,
  AuditLogListResult,
  AuditLogSummary,
  PropertyChange,
} from "@/lib/types";
import { toast } from "sonner";

const actionBadgeClass: Record<string, string> = {
  Create:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  Update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  Delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  Login:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  Logout: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  Export:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  Import: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
  Approval:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  Rejection:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
  StatusChange:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
  FailedLogin:
    "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  Locked:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  Unlocked:
    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
  RoleChange:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
  PasswordReset:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
};

const resourceBadgeClass: Record<string, string> = {
  User: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
  Project:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  Employee:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  TimeEntry:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
  Contract:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
  Bid: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
  Subcontract:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200",
  ChangeOrder:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  Rfi: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
  Equipment:
    "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-200",
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseChanges(
  changesJson: string | null
): Record<string, PropertyChange> | null {
  if (!changesJson) return null;
  try {
    return JSON.parse(changesJson);
  } catch {
    return null;
  }
}

function ChangeDiffViewer({
  changes,
  action,
}: {
  changes: Record<string, PropertyChange>;
  action: string;
}) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      {entries.map(([prop, change]) => (
        <div
          key={prop}
          className="grid grid-cols-[140px_1fr] gap-2 text-xs font-mono"
        >
          <span className="text-muted-foreground font-semibold truncate">
            {prop}
          </span>
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {action === "Delete" ? (
              <span className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded line-through break-all">
                {change.oldValue ?? "null"}
              </span>
            ) : action === "Create" ? (
              <span className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 px-1.5 py-0.5 rounded break-all">
                {change.newValue ?? "null"}
              </span>
            ) : (
              <>
                <span className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded line-through break-all">
                  {change.oldValue ?? "null"}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 px-1.5 py-0.5 rounded break-all">
                  {change.newValue ?? "null"}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // Summary
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filter options from API
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  // Filter state
  const [actionFilter, setActionFilter] = useState<string>("");
  const [resourceFilter, setResourceFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sorting
  const [sortBy, setSortBy] = useState<string>("timestamp");
  const [sortDir, setSortDir] = useState<string>("desc");

  // Row expansion for diff viewer
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check admin access
  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      toast.error("Access denied. Admin privileges required.");
    }
  }, [isAdmin, router]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const [actions, resources] = await Promise.all([
        api<string[]>("/api/admin/audit-logs/actions"),
        api<string[]>("/api/admin/audit-logs/resource-types"),
      ]);
      setActionTypes(actions);
      setResourceTypes(resources);
    } catch {
      // Options are optional, don't show error
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await api<AuditLogSummary>("/api/admin/audit-logs/summary");
      setSummary(data);
    } catch {
      // Summary is optional, don't block the page
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      if (actionFilter && actionFilter !== "all")
        params.set("action", actionFilter);
      if (resourceFilter && resourceFilter !== "all")
        params.set("resourceType", resourceFilter);
      if (searchFilter.trim()) params.set("search", searchFilter.trim());
      if (startDate) params.set("from", startDate);
      if (endDate) params.set("to", endDate);

      const result = await api<AuditLogListResult>(
        `/api/admin/audit-logs?${params.toString()}`
      );
      setLogs(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    pageSize,
    sortBy,
    sortDir,
    actionFilter,
    resourceFilter,
    searchFilter,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    if (isAdmin) {
      fetchFilterOptions();
      fetchSummary();
    }
  }, [isAdmin, fetchFilterOptions, fetchSummary]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, fetchLogs]);

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchLogs();
        fetchSummary();
      }, 30000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, fetchLogs, fetchSummary]);

  const handleClearFilters = () => {
    setActionFilter("");
    setResourceFilter("");
    setSearchFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleSetToday = () => {
    const today = formatDateForInput(new Date());
    setStartDate(today);
    setEndDate(today);
    setPage(1);
  };

  const handleSetThisWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    setStartDate(formatDateForInput(startOfWeek));
    setEndDate(formatDateForInput(today));
    setPage(1);
  };

  const handleSetThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(formatDateForInput(startOfMonth));
    setEndDate(formatDateForInput(today));
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== "all")
        params.set("action", actionFilter);
      if (resourceFilter && resourceFilter !== "all")
        params.set("resourceType", resourceFilter);
      if (startDate) params.set("from", startDate);
      if (endDate) params.set("to", endDate);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000"}/api/admin/audit-logs/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Audit logs exported");
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  const hasActiveFilters =
    actionFilter || resourceFilter || searchFilter || startDate || endDate;

  const SortHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
      {sortBy === column && (
        <span className="text-xs">
          {sortDir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all system activity and changes with automatic diff tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={
              autoRefresh ? "Auto-refresh ON (30s)" : "Enable auto-refresh"
            }
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`}
            />
            {autoRefresh ? "Live" : "Auto"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Events Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">
                {summary?.totalEventsToday ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Most Active User
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : summary?.topUser ? (
              <div>
                <div className="text-lg font-bold truncate">
                  {summary.topUser.userName || summary.topUser.userEmail || "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.topUser.eventCount} events
                </p>
              </div>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Top Entity Type
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-20 bg-muted animate-pulse rounded" />
            ) : summary?.topEntityType ? (
              <div>
                <div className="text-lg font-bold">
                  {summary.topEntityType}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.topEntityTypeCount} changes
                </p>
              </div>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Logins Today</CardTitle>
            <LogIn className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 w-12 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">
                {summary?.loginCountToday ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={actionFilter}
                onValueChange={(v) => {
                  setActionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select
                value={resourceFilter}
                onValueChange={(v) => {
                  setResourceFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                type="text"
                placeholder="User, description, ID..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Date presets */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Quick filters:
            </span>
            <Button variant="outline" size="sm" onClick={handleSetToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleSetThisWeek}>
              This Week
            </Button>
            <Button variant="outline" size="sm" onClick={handleSetThisMonth}>
              This Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary + Pagination Info */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {logs.length} of {totalCount} audit log entries
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Per page:</Label>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(parseInt(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span>
              Page {page} of {totalPages}
            </span>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
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
                    "Timestamp",
                    "User",
                    "Action",
                    "Resource",
                    "Description",
                    "IP",
                  ]}
                  rows={10}
                />
              </div>
            </>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No audit logs found"
              description={
                hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "System activity will appear here as it occurs."
              }
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {logs.map((log) => {
                  const changes = parseChanges(log.changes);
                  const isExpanded = expandedRows.has(log.id);

                  return (
                    <div
                      key={log.id}
                      className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleRowExpansion(log.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="secondary"
                            className={
                              actionBadgeClass[log.action] || "bg-gray-100"
                            }
                          >
                            {log.action}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={
                              resourceBadgeClass[log.resourceType] ||
                              "bg-gray-100"
                            }
                          >
                            {log.resourceType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </span>
                          {changes && (
                            isExpanded ? (
                              <ChevronUp className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </div>
                      <p className="text-sm">{log.description}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          By: {log.userName || log.userEmail || "System"}
                        </p>
                        {log.ipAddress && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.ipAddress}
                          </p>
                        )}
                      </div>

                      {/* Expanded diff view */}
                      {isExpanded && changes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            Changes:
                          </p>
                          <ChangeDiffViewer
                            changes={changes}
                            action={log.action}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]" />
                      <TableHead className="w-[180px]">
                        <SortHeader column="timestamp">Timestamp</SortHeader>
                      </TableHead>
                      <TableHead className="w-[150px]">
                        <SortHeader column="user">User</SortHeader>
                      </TableHead>
                      <TableHead className="w-[110px]">
                        <SortHeader column="action">Action</SortHeader>
                      </TableHead>
                      <TableHead className="w-[120px]">
                        <SortHeader column="resourcetype">
                          Resource
                        </SortHeader>
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[120px]">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const changes = parseChanges(log.changes);
                      const isExpanded = expandedRows.has(log.id);
                      const hasChanges = changes && Object.keys(changes).length > 0;

                      return (
                        <>
                          <TableRow
                            key={log.id}
                            className={`${hasChanges ? "cursor-pointer hover:bg-muted/50" : ""} ${isExpanded ? "bg-muted/30" : ""}`}
                            onClick={() =>
                              hasChanges && toggleRowExpansion(log.id)
                            }
                          >
                            <TableCell className="px-2">
                              {hasChanges &&
                                (isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ))}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {formatDateTime(log.timestamp)}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[150px]">
                                <span className="font-medium text-sm truncate block">
                                  {log.userName || "System"}
                                </span>
                                {log.userEmail && (
                                  <span className="text-xs text-muted-foreground truncate block">
                                    {log.userEmail}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  actionBadgeClass[log.action] || "bg-gray-100"
                                }
                              >
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={
                                  resourceBadgeClass[log.resourceType] ||
                                  "bg-gray-100"
                                }
                              >
                                {log.resourceType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {log.description}
                              </span>
                              {log.resourceId && (
                                <span className="text-xs text-muted-foreground block font-mono">
                                  ID: {log.resourceId}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {log.ipAddress || "—"}
                            </TableCell>
                          </TableRow>

                          {/* Expanded diff row */}
                          {isExpanded && changes && (
                            <TableRow
                              key={`${log.id}-diff`}
                              className="bg-muted/20 hover:bg-muted/20"
                            >
                              <TableCell colSpan={7} className="py-4 px-6">
                                <div className="max-w-2xl">
                                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                                    Change Details
                                  </p>
                                  <ChangeDiffViewer
                                    changes={changes}
                                    action={log.action}
                                  />
                                  {log.userAgent && (
                                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t truncate">
                                      User Agent: {log.userAgent}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
