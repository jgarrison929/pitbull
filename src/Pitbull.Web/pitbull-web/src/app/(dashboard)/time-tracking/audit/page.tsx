"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const ALL_VALUE = "__all__";

interface AuditEntry {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  description: string;
  changes: string | null;
  timestamp: string;
}

interface AuditListResponse {
  items: AuditEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const actionBadgeClass: Record<string, string> = {
  Approval: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  Rejection: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  StatusChange: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  Update: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  Create: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseStatusFromChanges(changes: string | null): string | null {
  if (!changes) return null;
  try {
    const parsed = JSON.parse(changes) as Record<string, { oldValue?: string; newValue?: string; OldValue?: string; NewValue?: string }>;
    // Check both "Status" (dict key = C# property name) and camelCase value props
    const statusEntry = parsed.Status || parsed.status;
    if (statusEntry) {
      const oldStatus = statusEntry.oldValue ?? statusEntry.OldValue ?? "—";
      const newStatus = statusEntry.newValue ?? statusEntry.NewValue ?? "—";
      return `${oldStatus} → ${newStatus}`;
    }
  } catch { /* ignore */ }
  return null;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function minusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export default function TimeEntryAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Initialize date range after mount to avoid SSR hydration mismatch
  // (new Date() can differ between server and client timezone/time)
  useEffect(() => {
    setFrom(minusDaysIso(29));
    setTo(todayIso());
  }, []);
  const [actionFilter, setActionFilter] = useState<string>(ALL_VALUE);
  const [search, setSearch] = useState("");

  const fetchAudit = useCallback(async () => {
    if (!from || !to) return; // Wait for date initialization
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "25");
      params.set("from", from);
      params.set("to", to);
      if (actionFilter !== ALL_VALUE) params.set("action", actionFilter);
      if (search.trim()) params.set("search", search.trim());

      const result = await api<AuditListResponse>(
        `/api/time-entries/audit-trail?${params.toString()}`
      );
      setEntries(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(Math.max(result.totalPages, 1));
    } catch {
      toast.error("Failed to load audit trail");
    } finally {
      setIsLoading(false);
    }
  }, [page, from, to, actionFilter, search]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  useEffect(() => {
    setPage(1);
  }, [from, to, actionFilter, search]);

  const pageStart = totalCount === 0 ? 0 : (page - 1) * 25 + 1;
  const pageEnd = totalCount === 0 ? 0 : Math.min(page * 25, totalCount);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Time Tracking", href: "/time-tracking" },
          { label: "Audit Trail" },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Audit Trail</h1>
          <p className="text-muted-foreground">
            Who submitted, approved, or rejected time entries and when
          </p>
        </div>
        <Button variant="outline" onClick={fetchAudit}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All actions</SelectItem>
                <SelectItem value="Approval">Approved</SelectItem>
                <SelectItem value="Rejection">Rejected</SelectItem>
                <SelectItem value="StatusChange">Status Change</SelectItem>
                <SelectItem value="Update">Updated</SelectItem>
                <SelectItem value="Create">Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton
              headers={["Timestamp", "Action", "By", "Description", "Status Change"]}
              rows={10}
            />
          ) : entries.length === 0 ? (
            <EmptyState
              title="No audit entries found"
              description="Try adjusting the date range or filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const statusChange = parseStatusFromChanges(entry.changes);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={actionBadgeClass[entry.action] || ""}
                          >
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {entry.userName || "System"}
                          </div>
                          {entry.userEmail && (
                            <div className="text-xs text-muted-foreground">
                              {entry.userEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {entry.description}
                        </TableCell>
                        <TableCell>
                          {statusChange ? (
                            <span className="text-sm font-mono">
                              {statusChange}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && entries.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageStart}-{pageEnd} of {totalCount}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
