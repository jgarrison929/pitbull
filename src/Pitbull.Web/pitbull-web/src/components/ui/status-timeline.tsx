"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock, Loader2, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";

interface WorkflowTransition {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string;
  changedByName: string | null;
  changedAt: string;
  comment: string | null;
}

interface StatusTimelineProps {
  entityType: string;
  entityId: string;
  className?: string;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateStr);
}

export function StatusTimeline({ entityType, entityId, className }: StatusTimelineProps) {
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api<WorkflowTransition[]>(
        `/api/workflow-transitions/${entityType}/${entityId}`
      );
      setTransitions(result);
    } catch {
      // Non-critical — silently degrade
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 py-4", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading history...</span>
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className={cn("py-4 text-center", className)}>
        <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No workflow history yet</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Vertical line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />

      <div className="space-y-0">
        {transitions.map((transition, index) => {
          const isLast = index === transitions.length - 1;
          return (
            <div key={transition.id} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Dot */}
              <div className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                isLast
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50"
                  : "border-green-500 bg-green-50 dark:bg-green-950/50"
              )}>
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  isLast ? "bg-blue-500" : "bg-green-500"
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                {/* Status transition */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {transition.fromStatus && (
                    <>
                      <StatusBadge
                        entityType={entityType}
                        status={transition.fromStatus}
                        className="text-[10px] h-5"
                      />
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </>
                  )}
                  <StatusBadge
                    entityType={entityType}
                    status={transition.toStatus}
                    className="text-[10px] h-5"
                  />
                </div>

                {/* Meta line: who + when */}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{transition.changedByName ?? "System"}</span>
                  </div>
                  <span title={formatDateTime(transition.changedAt)}>
                    {formatRelativeTime(transition.changedAt)}
                  </span>
                </div>

                {/* Comment */}
                {transition.comment && (
                  <div className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{transition.comment}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
