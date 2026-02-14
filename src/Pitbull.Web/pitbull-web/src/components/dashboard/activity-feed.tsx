"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Plus,
  RefreshCw,
  UserCheck,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityAction =
  | "created"
  | "approved"
  | "rejected"
  | "updated"
  | "submitted";

export interface ActivityItem {
  id: string;
  action: ActivityAction;
  actor: string;
  /** Short description, e.g. "submitted 8 hours on Highway Project" */
  description: string;
  /** Entity type for icon routing */
  entityType: "time_entry" | "rfi" | "project" | "bid" | "employee";
  timestamp: Date;
  /** Optional link to the item */
  href?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const actionColors: Record<ActivityAction, string> = {
  approved: "bg-green-500",
  created: "bg-blue-500",
  updated: "bg-amber-500",
  submitted: "bg-blue-400",
  rejected: "bg-red-500",
};

const actionTextColors: Record<ActivityAction, string> = {
  approved: "text-green-600 dark:text-green-400",
  created: "text-blue-600 dark:text-blue-400",
  updated: "text-amber-600 dark:text-amber-400",
  submitted: "text-blue-500 dark:text-blue-300",
  rejected: "text-red-600 dark:text-red-400",
};

function getActionIcon(action: ActivityAction) {
  switch (action) {
    case "approved":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "rejected":
      return <XCircle className="h-3.5 w-3.5" />;
    case "created":
      return <Plus className="h-3.5 w-3.5" />;
    case "submitted":
      return <Clock className="h-3.5 w-3.5" />;
    case "updated":
      return <RefreshCw className="h-3.5 w-3.5" />;
  }
}

function getEntityIcon(entityType: ActivityItem["entityType"]) {
  switch (entityType) {
    case "time_entry":
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case "rfi":
      return <HelpCircle className="h-3.5 w-3.5 text-blue-500" />;
    case "project":
      return <FileText className="h-3.5 w-3.5 text-blue-500" />;
    case "bid":
      return <FileText className="h-3.5 w-3.5 text-green-500" />;
    case "employee":
      return <UserCheck className="h-3.5 w-3.5 text-purple-500" />;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRelativeTime(date: Date): string {
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

// ─── Simulated data ──────────────────────────────────────────────────────────

const simulatedActivities: ActivityItem[] = [
  {
    id: "a1",
    action: "submitted",
    actor: "Mike Torres",
    description: "submitted 8 hours on Highway Resurfacing",
    entityType: "time_entry",
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    href: "/time-tracking",
  },
  {
    id: "a2",
    action: "approved",
    actor: "Jane Doe",
    description: "approved 3 time entries for Downtown Office Tower",
    entityType: "time_entry",
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    href: "/time-tracking/approval",
  },
  {
    id: "a3",
    action: "created",
    actor: "John Smith",
    description: "created RFI #1055 – Foundation waterproofing detail",
    entityType: "rfi",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    href: "/rfis",
  },
  {
    id: "a4",
    action: "updated",
    actor: "Sarah Chen",
    description: "updated bid estimate for Riverside Mall Renovation",
    entityType: "bid",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    href: "/bids",
  },
  {
    id: "a5",
    action: "rejected",
    actor: "Jane Doe",
    description: "returned time entry – missing cost code assignment",
    entityType: "time_entry",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    href: "/time-tracking",
  },
  {
    id: "a6",
    action: "submitted",
    actor: "Demo Contact C01",
    description: "submitted 40 hours for the week on Industrial Park Phase 2",
    entityType: "time_entry",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    href: "/time-tracking",
  },
  {
    id: "a7",
    action: "created",
    actor: "Tom Nguyen",
    description: "created new project – Municipal Water Treatment Plant",
    entityType: "project",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
    href: "/projects",
  },
  {
    id: "a8",
    action: "approved",
    actor: "Sarah Chen",
    description: "approved Change Order #205 for $8,400",
    entityType: "project",
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
    href: "/contracts",
  },
  {
    id: "a9",
    action: "submitted",
    actor: "Carlos Garcia",
    description: "submitted 6.5 hours on School Gymnasium Addition",
    entityType: "time_entry",
    timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000),
    href: "/time-tracking",
  },
  {
    id: "a10",
    action: "created",
    actor: "Jane Doe",
    description: "added employee Maria Lopez – Electrician Apprentice",
    entityType: "employee",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    href: "/employees",
  },
];

const PAGE_SIZE = 5;

// ─── Component ───────────────────────────────────────────────────────────────

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>(simulatedActivities);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nextIdRef = useRef(100);

  // Simulate polling: add a new activity every 45 seconds
  const simulateNewActivity = useCallback(() => {
    const templates = [
      { action: "submitted" as const, actor: "Mike Torres", desc: "submitted 4 hours on Highway Resurfacing", entity: "time_entry" as const },
      { action: "approved" as const, actor: "Jane Doe", desc: "approved 2 time entries", entity: "time_entry" as const },
      { action: "created" as const, actor: "John Smith", desc: "created RFI #1060 – HVAC duct routing", entity: "rfi" as const },
      { action: "updated" as const, actor: "Sarah Chen", desc: "updated phase schedule for Downtown Tower", entity: "project" as const },
    ];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const id = `sim-${nextIdRef.current++}`;
    const newItem: ActivityItem = {
      id,
      action: template.action,
      actor: template.actor,
      description: template.desc,
      entityType: template.entity,
      timestamp: new Date(),
    };

    setActivities((prev) => [newItem, ...prev]);
    setNewItemIds((prev) => new Set(prev).add(id));
    // Remove "new" animation after it plays
    setTimeout(() => {
      setNewItemIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1500);
  }, []);

  useEffect(() => {
    pollTimerRef.current = setInterval(simulateNewActivity, 45000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [simulateNewActivity]);

  const visibleActivities = activities.slice(0, visibleCount);
  const hasMore = visibleCount < activities.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          Activity Feed
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {visibleActivities.length === 0 ? (
            <div className="py-10 text-center">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                No activity yet. Actions will appear here in real time.
              </p>
            </div>
          ) : (
            visibleActivities.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition-all duration-500",
                  newItemIds.has(item.id) &&
                    "animate-in slide-in-from-top-2 fade-in-0 duration-500 bg-primary/5"
                )}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                    {getInitials(item.actor)}
                  </div>
                  {/* Action badge */}
                  <div
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white",
                      actionColors[item.action]
                    )}
                  >
                    {getActionIcon(item.action)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{item.actor}</span>{" "}
                    <span className="text-muted-foreground">{item.description}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("flex items-center gap-1 text-[10px] font-medium uppercase", actionTextColors[item.action])}>
                      {getEntityIcon(item.entityType)}
                      {item.action}
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

        {/* Load more */}
        {hasMore && (
          <div className="px-4 py-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              <ChevronDown className="mr-1 h-3 w-3" />
              Load more activity
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
