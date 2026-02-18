"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getWeekStart as getWeekStartFn } from "@/lib/date-utils";
import {
  formatDate,
  formatHours,
  getTodayISO,
  timeEntryStatusBadgeClass,
  timeEntryStatusLabel,
} from "@/lib/time-tracking";
import type {
  PagedResult,
  Project,
  ReviewDecisionType,
  ReviewQueueResult,
  ReviewTimeEntriesResult,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingButton } from "@/components/ui/loading-button";
import { TableSkeleton } from "@/components/skeletons";

const ALL = "__all__";

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const monday = getWeekStartFn(now, 1); // Monday start
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split("T")[0] ?? getTodayISO(),
    end: sunday.toISOString().split("T")[0] ?? getTodayISO(),
  };
}

export default function TimeTrackingApprovalPage() {
  const week = useMemo(() => getWeekRange(), []);

  const [queue, setQueue] = useState<ReviewQueueResult | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [startDate, setStartDate] = useState<string>(week.start);
  const [endDate, setEndDate] = useState<string>(week.end);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [decisionById, setDecisionById] = useState<Record<string, ReviewDecisionType>>({});
  const [commentById, setCommentById] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (projectFilter !== ALL) params.set("projectId", projectFilter);

      const result = await api<ReviewQueueResult>(
        `/api/time-entries/review-queue?${params.toString()}`,
      );

      setQueue(result);
      setSelectedIds(new Set());
      setDecisionById({});
      setCommentById({});
    } catch {
      toast.error("Failed to load PM review queue");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, projectFilter]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const projectsRes = await api<PagedResult<Project>>("/api/projects?pageSize=100");
        setProjects(projectsRes.items);
      } catch {
        // Non-fatal for queue usage
      }
    }

    loadOptions();
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

    setDecisionById((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: "approve" };
    });
  };

  const applyDecisionToSelected = (decision: ReviewDecisionType) => {
    if (selectedIds.size === 0) return;

    setDecisionById((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        next[id] = decision;
      }
      return next;
    });
  };

  const submitReview = async (ids?: string[]) => {
    const targetIds = ids ?? Array.from(selectedIds);

    if (targetIds.length === 0) {
      toast.error("Select at least one time entry");
      return;
    }

    const decisions = targetIds.map((id) => {
      const decision = decisionById[id] ?? "approve";
      const comment = commentById[id]?.trim();

      return {
        timeEntryId: id,
        decision,
        comment: decision === "reject" ? comment : undefined,
      };
    });

    const missingRejectComments = decisions.some(
      (d) => d.decision === "reject" && !d.comment,
    );

    if (missingRejectComments) {
      toast.error("Rejection reason is required for rejected entries");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api<ReviewTimeEntriesResult>("/api/time-entries/review", {
        method: "POST",
        body: {
          decisions,
        },
      });

      toast.success(
        `Review complete: ${result.approved} approved, ${result.rejected} rejected, ${result.failed} failed`,
      );

      await fetchQueue();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Link href="/time-tracking" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">PM Time Review</h1>
          </div>
          <p className="text-muted-foreground">Approve or reject submitted time for your projects.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <Label>Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchQueue} className="w-full">Refresh Queue</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isLoading && queue && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queue.totalEntries}</div>
              <p className="text-xs text-muted-foreground">Submitted Entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{queue.totalProjects}</div>
              <p className="text-xs text-muted-foreground">Projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold font-mono">{formatHours(queue.totalHours)}</div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {selectedIds.size}
              </div>
              <p className="text-xs text-muted-foreground">Selected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => applyDecisionToSelected("approve")}
              disabled={selectedIds.size === 0}
            >
              Mark Selected Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => applyDecisionToSelected("reject")}
              disabled={selectedIds.size === 0}
            >
              Mark Selected Reject
            </Button>
            <LoadingButton
              onClick={() => submitReview()}
              loading={isSubmitting}
              disabled={selectedIds.size === 0}
            >
              Submit Selected Review
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton
          headers={["", "Employee", "Date", "Hours", "Status", "Decision", "Comment", "Action"]}
          rows={8}
        />
      ) : !queue || queue.groups.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="Queue is clear"
          description="No submitted entries match your current filters."
        />
      ) : (
        <div className="space-y-5">
          {queue.groups.map((group) => (
            <Card key={group.projectId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {group.projectNumber} - {group.projectName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {group.entryCount} entries • {group.employeeCount} employees • {formatHours(group.totalHours)} hours
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]" />
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="text-right">Line Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.entries.map((entry) => {
                      const selected = selectedIds.has(entry.id);
                      const decision = decisionById[entry.id] ?? "approve";

                      return (
                        <TableRow key={entry.id} className={selected ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selected}
                              onCheckedChange={(checked) => toggleSelected(entry.id, checked === true)}
                              aria-label={`Select ${entry.employeeName}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{entry.employeeName}</TableCell>
                          <TableCell>{formatDate(entry.date)}</TableCell>
                          <TableCell className="text-right font-mono">{formatHours(entry.totalHours)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={timeEntryStatusBadgeClass(entry.status)}>
                              {timeEntryStatusLabel(entry.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={decision}
                              onValueChange={(value) => {
                                const next = value as ReviewDecisionType;
                                setDecisionById((prev) => ({ ...prev, [entry.id]: next }));
                              }}
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approve">Approve</SelectItem>
                                <SelectItem value="reject">Reject</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={decision === "reject" ? "Rejection reason (required)" : "Optional comment"}
                              value={commentById[entry.id] ?? ""}
                              onChange={(e) =>
                                setCommentById((prev) => ({ ...prev, [entry.id]: e.target.value }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  submitReview([entry.id])
                                }
                                disabled={isSubmitting}
                              >
                                {decision === "approve" ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
