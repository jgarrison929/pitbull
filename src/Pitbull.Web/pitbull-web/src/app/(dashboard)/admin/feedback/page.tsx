"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FeedbackStatus = "New" | "Reviewed" | "Resolved";
type FeedbackType = "General" | "Bug" | "Feature";

interface FeedbackItem {
  id: string;
  page: string;
  userRole: string;
  category: string;
  message: string;
  contactEmail: string | null;
  status: FeedbackStatus;
  type: FeedbackType;
  screenshotUrl: string | null;
  browserInfo: string | null;
  createdAt: string;
}

const CATEGORIES = ["All", "Bug", "Feature", "Question", "Other"] as const;
const STATUSES = ["All", "New", "Reviewed", "Resolved"] as const;
const TYPES = ["All", "General", "Bug", "Feature"] as const;

export default function AdminFeedbackPage() {
  const { isAdmin } = useRequireAdmin();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [type, setType] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (status !== "All") params.set("status", status);
    if (type !== "All") params.set("type", type);
    if (dateFrom) params.set("dateFromUtc", new Date(`${dateFrom}T00:00:00Z`).toISOString());
    if (dateTo) params.set("dateToUtc", new Date(`${dateTo}T23:59:59Z`).toISOString());
    return params.toString();
  }, [category, status, type, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<FeedbackItem[]>(`/api/feedback${queryString ? `?${queryString}` : ""}`);
      setItems(result);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load feedback");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, nextStatus: FeedbackStatus) {
    try {
      await api<FeedbackItem>(`/api/feedback/${id}/status`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
      toast.success("Feedback status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  }

  async function bulkUpdateStatus(nextStatus: FeedbackStatus) {
    if (selected.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    setIsBulkUpdating(true);
    try {
      const result = await api<{ updatedCount: number }>("/api/feedback/bulk-status", {
        method: "POST",
        body: { ids: Array.from(selected), status: nextStatus },
      });
      toast.success(`${result.updatedCount} item(s) updated to ${nextStatus}`);
      setItems((prev) =>
        prev.map((item) =>
          selected.has(item.id) ? { ...item, status: nextStatus } : item
        )
      );
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk update failed");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Admin" }, { label: "Feedback" }]} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feedback Inbox</h1>
        <p className="text-muted-foreground">Review product feedback from users across the app.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Date from</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Date to</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>

          <div className="md:col-span-5">
            <Button variant="outline" onClick={load} disabled={isLoading}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{selected.size} selected</span>
              {(["New", "Reviewed", "Resolved"] as FeedbackStatus[]).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  disabled={isBulkUpdating}
                  onClick={() => bulkUpdateStatus(value)}
                >
                  Mark as {value}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Entries ({items.length})</CardTitle>
            {items.length > 0 && (
              <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
                {selected.size === items.length ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Checkbox
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Select feedback ${item.id}`}
                  />
                  <Badge variant="outline">{item.category}</Badge>
                  <TypeBadge type={item.type} />
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{item.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Page: <span className="font-mono">{item.page}</span> • Role: {item.userRole}
                  {item.contactEmail ? ` • ${item.contactEmail}` : ""}
                </p>
                {(item.browserInfo || item.screenshotUrl) && (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {item.browserInfo && (
                      <span className="truncate max-w-xs" title={item.browserInfo}>
                        Browser: {item.browserInfo}
                      </span>
                    )}
                    {item.screenshotUrl && (
                      <a
                        href={item.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Screenshot <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["New", "Reviewed", "Resolved"] as FeedbackStatus[]).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={value === item.status ? "default" : "outline"}
                      onClick={() => updateStatus(item.id, value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            {!items.length && !isLoading && (
              <p className="text-sm text-muted-foreground">No feedback entries found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  if (status === "Resolved") {
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Resolved</Badge>;
  }
  if (status === "Reviewed") {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Reviewed</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">New</Badge>;
}

function TypeBadge({ type }: { type: FeedbackType }) {
  if (type === "Bug") {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Bug</Badge>;
  }
  if (type === "Feature") {
    return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">Feature</Badge>;
  }
  return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">General</Badge>;
}
