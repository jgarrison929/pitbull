"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import Link from "next/link";

interface ActivityItem {
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  resourceId?: string | null;
  description?: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  Create: "created",
  Update: "updated",
  Delete: "deleted",
  Approval: "approved",
  Rejection: "rejected",
  StatusChange: "changed status of",
  Login: "logged in",
  Export: "exported",
  Import: "imported",
  Locked: "locked",
  Unlocked: "unlocked",
};

const ENTITY_LABELS: Record<string, string> = {
  Project: "a project",
  Bid: "a bid",
  TimeEntry: "a time entry",
  Rfi: "an RFI",
  Subcontract: "a contract",
  PaymentApplication: "a pay app",
  ChangeOrder: "a change order",
  Employee: "an employee",
  ScheduleOfValues: "a schedule of values",
  PayPeriod: "a pay period",
  CostCode: "a cost code",
};

const ENTITY_ROUTES: Record<string, string> = {
  Project: "/projects",
  Bid: "/bids",
  TimeEntry: "/time-tracking",
  Rfi: "/projects",
  Subcontract: "/contracts",
  PaymentApplication: "/payment-applications",
  ChangeOrder: "/change-orders",
  Employee: "/employees",
};

function activityLink(entity: string, resourceId?: string | null): string | null {
  const base = ENTITY_ROUTES[entity];
  if (!base) return null;
  if (resourceId && entity !== "TimeEntry") return `${base}/${resourceId}`;
  return base;
}

function relativeTime(value: string): string {
  const now = Date.now();
  const target = new Date(value).getTime();
  const diffMs = now - target;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityWidget({
  data,
  isLoading,
}: {
  data: ActivityItem[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        {!isLoading &&
          data?.map((item, index) => {
            const href = activityLink(item.entity, item.resourceId);
            const actionLabel = ACTION_LABELS[item.action] || item.action.toLowerCase();
            const entityLabel = ENTITY_LABELS[item.entity] || item.entity.toLowerCase();
            const content = (
              <>
                <Activity className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.user}</span> {actionLabel}{" "}
                    <span className="font-medium">{entityLabel}</span>
                  </p>
                  {item.description && (
                    <p className="text-xs text-foreground/70 truncate">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(item.timestamp)}
                  </p>
                </div>
              </>
            );
            return href ? (
              <Link
                key={`${item.timestamp}-${index}`}
                href={href}
                className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
              >
                {content}
              </Link>
            ) : (
              <div
                key={`${item.timestamp}-${index}`}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                {content}
              </div>
            );
          })}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
      </CardContent>
    </Card>
  );
}
