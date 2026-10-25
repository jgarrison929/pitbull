"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Wrench, Layers, ArrowRight } from "lucide-react";
import api from "@/lib/api";
import type { TimeEntry } from "@/lib/types";
import { TimeEntryStatus } from "@/lib/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: TimeEntryStatus) {
  switch (status) {
    case TimeEntryStatus.Approved:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Approved
        </Badge>
      );
    case TimeEntryStatus.Submitted:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          Pending
        </Badge>
      );
    case TimeEntryStatus.Rejected:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Draft
        </Badge>
      );
  }
}

export function RecentTimeEntriesWidget() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api<{ items: TimeEntry[] }>(
          "/api/time-entries?pageSize=5&sortBy=date&sortDirection=desc"
        );
        setEntries(result.items);
      } catch {
        // Silently handle
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Recent Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No time entries yet. Start by{" "}
            <Link href="/time-tracking/new" className="text-amber-500 hover:underline">
              logging time
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Recent Time Entries
          </CardTitle>
          <Link
            href="/time-tracking"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5 text-xs font-mono text-muted-foreground w-12 shrink-0">
                {formatDate(entry.date)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">
                    {entry.employeeName}
                  </p>
                  {statusBadge(entry.status)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {entry.projectNumber} — {entry.projectName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {entry.phaseName && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Layers className="h-2.5 w-2.5" />
                      {entry.phaseName}
                    </span>
                  )}
                  {entry.equipmentName && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Wrench className="h-2.5 w-2.5" />
                      {entry.equipmentName}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{entry.totalHours.toFixed(1)}h</p>
                {entry.equipmentHours > 0 && (
                  <p className="text-[10px] text-orange-600 dark:text-orange-400">
                    +{entry.equipmentHours.toFixed(1)}h equip
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
