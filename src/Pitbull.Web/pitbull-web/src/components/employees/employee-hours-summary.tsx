"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import api from "@/lib/api";

interface TimeEntry {
  id: string;
  date: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  status: number;
  projectName?: string;
}

interface TimeEntriesResponse {
  items: TimeEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface EmployeeHoursSummaryProps {
  employeeId: string;
}

const statusLabels: Record<number, string> = {
  0: "Submitted",
  1: "Approved",
  2: "Rejected",
};

const statusColors: Record<number, string> = {
  0: "bg-amber-100 text-amber-800",
  1: "bg-green-100 text-green-800",
  2: "bg-red-100 text-red-800",
};

export function EmployeeHoursSummary({ employeeId }: EmployeeHoursSummaryProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await api<TimeEntriesResponse>(
          `/api/time-entries?employeeId=${employeeId}&pageSize=50`
        );
        setEntries(response.items || []);
      } catch (err) {
        setError("Failed to load time entries");
        console.error("Time entries fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [employeeId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hours Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalRegular = entries.reduce((sum, e) => sum + e.regularHours, 0);
  const totalOT = entries.reduce((sum, e) => sum + e.overtimeHours, 0);
  const totalDT = entries.reduce((sum, e) => sum + e.doubleTimeHours, 0);
  const totalHours = totalRegular + totalOT + totalDT;

  const approvedEntries = entries.filter((e) => e.status === 1);
  const pendingEntries = entries.filter((e) => e.status === 0);

  const formatHours = (hours: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(hours);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hours Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No time entries recorded for this employee.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={`/time-tracking/new?employeeId=${employeeId}`}>
              Log Time Entry
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Hours Summary
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
            <Link href={`/time-tracking?employeeId=${employeeId}`}>
              View All
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Hours */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{formatHours(totalHours)} hrs</p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>Reg: {formatHours(totalRegular)}</span>
              {totalOT > 0 && (
                <span className="text-amber-600">OT: {formatHours(totalOT)}</span>
              )}
              {totalDT > 0 && (
                <span className="text-red-600">DT: {formatHours(totalDT)}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{entries.length} entries</p>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="flex gap-2">
          {pendingEntries.length > 0 && (
            <Badge variant="secondary" className={statusColors[0]}>
              <AlertCircle className="h-3 w-3 mr-1" />
              {pendingEntries.length} pending
            </Badge>
          )}
          {approvedEntries.length > 0 && (
            <Badge variant="secondary" className={statusColors[1]}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {approvedEntries.length} approved
            </Badge>
          )}
        </div>

        {/* Recent entries (last 3) */}
        {entries.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Recent Entries</p>
            {entries.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>{new Date(entry.date).toLocaleDateString()}</span>
                  {entry.projectName && (
                    <span className="text-muted-foreground text-xs truncate max-w-[100px]">
                      {entry.projectName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">
                    {formatHours(
                      entry.regularHours + entry.overtimeHours + entry.doubleTimeHours
                    )}
                    h
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${statusColors[entry.status]}`}
                  >
                    {statusLabels[entry.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
