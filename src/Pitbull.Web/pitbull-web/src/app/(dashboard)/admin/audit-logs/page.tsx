"use client";

import { useEffect, useState, useCallback } from "react";
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
import { FileText, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { AuditLog, AuditLogListResult } from "@/lib/types";
import { toast } from "sonner";

const actionBadgeClass: Record<string, string> = {
  Create: "bg-green-100 text-green-800",
  Update: "bg-blue-100 text-blue-800",
  Delete: "bg-red-100 text-red-800",
  Login: "bg-purple-100 text-purple-800",
  Logout: "bg-gray-100 text-gray-600",
  Export: "bg-amber-100 text-amber-800",
  Import: "bg-cyan-100 text-cyan-800",
};

const resourceBadgeClass: Record<string, string> = {
  User: "bg-indigo-100 text-indigo-800",
  Project: "bg-emerald-100 text-emerald-800",
  Employee: "bg-orange-100 text-orange-800",
  TimeEntry: "bg-violet-100 text-violet-800",
  Contract: "bg-rose-100 text-rose-800",
  Bid: "bg-sky-100 text-sky-800",
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

export default function AuditLogsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter options from API
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);
  
  // Filter state
  const [actionFilter, setActionFilter] = useState<string>("");
  const [resourceFilter, setResourceFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      if (actionFilter && actionFilter !== "all") params.set("action", actionFilter);
      if (resourceFilter && resourceFilter !== "all") params.set("resourceType", resourceFilter);
      if (userFilter.trim()) params.set("userId", userFilter.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const result = await api<AuditLogListResult>(`/api/admin/audit-logs?${params.toString()}`);
      setLogs(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.ceil(result.totalCount / pageSize));
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, actionFilter, resourceFilter, userFilter, startDate, endDate]);

  useEffect(() => {
    if (isAdmin) {
      fetchFilterOptions();
    }
  }, [isAdmin, fetchFilterOptions]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, fetchLogs]);

  const handleClearFilters = () => {
    setActionFilter("");
    setResourceFilter("");
    setUserFilter("");
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

  const hasActiveFilters = actionFilter || resourceFilter || userFilter || startDate || endDate;

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all system activity and changes within your organization
          </p>
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actionTypes.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {resourceTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
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
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
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

      {/* Summary */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {logs.length} of {totalCount} audit log entries
          </span>
          <span>
            Page {page} of {totalPages}
          </span>
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
              <CardListSkeleton rows={5} />
              <div className="hidden sm:block">
                <TableSkeleton
                  headers={["Timestamp", "User", "Action", "Resource", "Description"]}
                  rows={10}
                />
              </div>
            </>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No audit logs found"
              description={hasActiveFilters 
                ? "Try adjusting your filters to see more results." 
                : "System activity will appear here as it occurs."}
            />
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant="secondary"
                          className={actionBadgeClass[log.action] || "bg-gray-100"}
                        >
                          {log.action}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={resourceBadgeClass[log.resourceType] || "bg-gray-100"}
                        >
                          {log.resourceType}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      By: {log.userName || log.userEmail || "System"}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[150px]">User</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead className="w-[120px]">Resource</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
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
                            className={actionBadgeClass[log.action] || "bg-gray-100"}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={resourceBadgeClass[log.resourceType] || "bg-gray-100"}
                          >
                            {log.resourceType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{log.description}</span>
                          {log.resourceId && (
                            <span className="text-xs text-muted-foreground block font-mono">
                              ID: {log.resourceId}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
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
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
