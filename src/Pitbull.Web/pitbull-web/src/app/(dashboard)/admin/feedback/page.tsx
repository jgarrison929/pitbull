"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FeedbackStatus = "New" | "Reviewed" | "Resolved";

interface FeedbackItem {
  id: string;
  page: string;
  userRole: string;
  category: string;
  message: string;
  contactEmail: string | null;
  status: FeedbackStatus;
  createdAt: string;
}

const CATEGORIES = ["All", "Bug", "Feature", "Question", "Other"] as const;
const STATUSES = ["All", "New", "Reviewed", "Resolved"] as const;

export default function AdminFeedbackPage() {
  const { isAdmin } = useRequireAdmin();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (status !== "All") params.set("status", status);
    if (dateFrom) params.set("dateFromUtc", new Date(`${dateFrom}T00:00:00Z`).toISOString());
    if (dateTo) params.set("dateToUtc", new Date(`${dateTo}T23:59:59Z`).toISOString());
    return params.toString();
  }, [category, status, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<FeedbackItem[]>(`/api/feedback${queryString ? `?${queryString}` : ""}`);
      setItems(result);
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
        <CardContent className="grid gap-3 md:grid-cols-4">
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

          <div className="md:col-span-4">
            <Button variant="outline" onClick={load} disabled={isLoading}>
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.category}</Badge>
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
