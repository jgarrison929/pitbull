"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Clock,
  HelpCircle,
  ExternalLink,
  User,
} from "lucide-react";
import api from "@/lib/api";
import type { RfisNeedingAttentionResponse, RfiAttentionItem } from "@/lib/types";

function priorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case "low":
      return "bg-neutral-100 text-neutral-600";
    case "normal":
      return "bg-blue-100 text-blue-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "urgent":
      return "bg-red-100 text-red-700";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

function formatDueDate(dueDate: string | null, daysOverdue: number) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (daysOverdue > 0) {
    return `${daysOverdue}d overdue`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function RfisNeedingAttention() {
  const [data, setData] = useState<RfisNeedingAttentionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const result = await api<RfisNeedingAttentionResponse>(
          "/api/dashboard/rfis-needing-attention?limit=5"
        );
        setData(result);
      } catch (err) {
        setError("Failed to load RFIs");
        console.error("RFIs needing attention fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            RFIs Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-green-500" />
            RFIs Needing Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
              <HelpCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-700">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">
              No overdue RFIs or items in your court
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            RFIs Needing Attention
          </CardTitle>
          <Link
            href="/rfis"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View All
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="flex gap-4 mb-4 pb-3 border-b">
          {data.overdueCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-100">
                <Clock className="h-3 w-3 text-red-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{data.overdueCount}</p>
                <p className="text-[10px] text-muted-foreground">Overdue</p>
              </div>
            </div>
          )}
          {data.ballInCourtCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-amber-100">
                <User className="h-3 w-3 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{data.ballInCourtCount}</p>
                <p className="text-[10px] text-muted-foreground">Your Court</p>
              </div>
            </div>
          )}
        </div>

        {/* RFI List */}
        <div className="space-y-3">
          {data.items.map((rfi) => (
            <RfiAttentionCard key={rfi.id} rfi={rfi} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RfiAttentionCard({ rfi }: { rfi: RfiAttentionItem }) {
  const dueDateText = formatDueDate(rfi.dueDate, rfi.daysOverdue);

  return (
    <Link
      href={`/rfis/${rfi.id}?projectId=${rfi.projectId}`}
      className="block"
    >
      <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                RFI-{String(rfi.number).padStart(3, "0")}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ${priorityColor(rfi.priority)}`}
              >
                {rfi.priority}
              </Badge>
              {rfi.isOverdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Overdue
                </Badge>
              )}
              {rfi.isBallInCourt && !rfi.isOverdue && (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 hover:bg-amber-600">
                  Your Court
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium truncate">{rfi.subject}</p>
            <p className="text-xs text-muted-foreground truncate">
              {rfi.projectNumber} - {rfi.projectName}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {rfi.ballInCourtName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {rfi.ballInCourtName}
              </span>
            )}
          </span>
          {dueDateText && (
            <span
              className={`flex items-center gap-1 ${
                rfi.isOverdue ? "text-red-600 font-medium" : ""
              }`}
            >
              <Clock className="h-3 w-3" />
              {dueDateText}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
