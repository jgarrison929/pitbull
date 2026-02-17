"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Clock,
  FileText,
  HardHat,
  HelpCircle,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { RecentActivityItem } from "@/lib/types";

interface ActivityFeedProps {
  activities: RecentActivityItem[];
}

function getEntityIcon(type: string) {
  switch (type) {
    case "project":
      return <HardHat className="h-4 w-4 text-blue-500" />;
    case "bid":
      return <FileText className="h-4 w-4 text-green-500" />;
    case "employee":
      return <UserCheck className="h-4 w-4 text-purple-500" />;
    case "timeentry":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "subcontract":
      return <Wrench className="h-4 w-4 text-orange-500" />;
    case "rfi":
      return <HelpCircle className="h-4 w-4 text-blue-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "project":
      return "Project";
    case "bid":
      return "Bid";
    case "employee":
      return "Employee";
    case "timeentry":
      return "Time Entry";
    case "subcontract":
      return "Subcontract";
    case "rfi":
      return "RFI";
    default:
      return type;
  }
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins === 1) return "1m ago";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours === 1) return "1h ago";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {activities.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Actions will appear here as you use the system.
              </p>
            </div>
          ) : (
            activities.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 px-4 py-3"
              >
                {/* Icon / avatar */}
                <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {getInitials(item.title)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{item.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase">
                      {getEntityIcon(item.type)}
                      {getTypeLabel(item.type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
