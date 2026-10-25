"use client";

/**
 * Mobile time entry approve/reject (2.21.7).
 * One lifecycle: Submitted time entries via existing /api/time-entries/review.
 * Same transition rules as desktop — no forked status strings.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  formatDate,
  formatHours,
  timeEntryStatusLabel,
} from "@/lib/time-tracking";
import type {
  ReviewQueueResult,
  ReviewTimeEntriesResult,
  TimeEntry,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function MobileTimeApprovalPage() {
  const [queue, setQueue] = useState<ReviewQueueResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<ReviewQueueResult>(
        "/api/time-entries/review-queue"
      );
      setQueue(result);
    } catch {
      toast.error("Failed to load approval queue");
      setQueue(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const flatEntries: TimeEntry[] = useMemo(() => {
    if (!queue?.groups?.length) return [];
    return queue.groups.flatMap((g) => g.entries ?? []);
  }, [queue]);

  async function decide(id: string, decision: "approve" | "reject") {
    if (decision === "reject") {
      const reason = (rejectReason[id] ?? "").trim();
      if (!reason) {
        toast.error("Rejection reason is required");
        return;
      }
    }
    setBusyId(id);
    try {
      const result = await api<ReviewTimeEntriesResult>(
        "/api/time-entries/review",
        {
          method: "POST",
          body: {
            decisions: [
              {
                timeEntryId: id,
                decision,
                comment:
                  decision === "reject"
                    ? (rejectReason[id] ?? "").trim()
                    : undefined,
              },
            ],
          },
        }
      );
      if ((result.failed ?? 0) > 0) {
        toast.error("Review failed for this entry", {
          description: "Check permissions or status and try again.",
        });
      } else {
        toast.success(
          decision === "approve" ? "Time entry approved" : "Time entry rejected"
        );
      }
      await fetchQueue();
    } catch (err) {
      toast.error("Failed to submit decision", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ErrorBoundary label="mobile time approval">
      <div
        className="mx-auto max-w-lg space-y-4 p-4 pb-24"
        data-testid="mobile-time-approval"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/time-tracking/approval"
            className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Approve time</h1>
            <p className="text-xs text-muted-foreground">
              Submitted time entries only — same rules as desktop review.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {!isLoading && flatEntries.length === 0 && (
          <Card data-testid="mobile-time-approval-empty">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No submitted time entries waiting. Zero is honest — not a hidden
              queue.
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          flatEntries.map((entry) => (
            <Card key={entry.id} data-testid={`mobile-time-entry-${entry.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {entry.employeeName}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {entry.projectNumber} — {entry.projectName} ·{" "}
                  {formatDate(entry.date)} · {formatHours(entry.totalHours)}h ·{" "}
                  {timeEntryStatusLabel(entry.status)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`reject-${entry.id}`} className="text-xs">
                    Reject reason (required to reject)
                  </Label>
                  <Input
                    id={`reject-${entry.id}`}
                    className="min-h-[44px]"
                    value={rejectReason[entry.id] ?? ""}
                    onChange={(e) =>
                      setRejectReason((prev) => ({
                        ...prev,
                        [entry.id]: e.target.value,
                      }))
                    }
                    placeholder="Why is this rejected?"
                  />
                </div>
                <div className="flex gap-2">
                  <LoadingButton
                    type="button"
                    className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-700"
                    data-testid={`mobile-approve-${entry.id}`}
                    loading={busyId === entry.id}
                    onClick={() => void decide(entry.id, "approve")}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </LoadingButton>
                  <LoadingButton
                    type="button"
                    variant="outline"
                    className="flex-1 min-h-[48px] border-red-300 text-red-700"
                    data-testid={`mobile-reject-${entry.id}`}
                    loading={busyId === entry.id}
                    onClick={() => void decide(entry.id, "reject")}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </LoadingButton>
                </div>
              </CardContent>
            </Card>
          ))}

        <Button asChild variant="outline" className="w-full min-h-[48px]">
          <Link href="/time-tracking/approval">Desktop review queue</Link>
        </Button>
      </div>
    </ErrorBoundary>
  );
}
