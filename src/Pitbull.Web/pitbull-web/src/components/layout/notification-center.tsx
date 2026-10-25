"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  AlertCircle,
  Clock,
  FileText,
  CheckCircle2,
  Check,
  Inbox,
  ClipboardList,
  Shield,
  HelpCircle,
  Settings,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | "Info"
  | "Success"
  | "Warning"
  | "Error"
  | "TimeEntrySubmitted"
  | "TimeEntryApproved"
  | "TimeEntryRejected"
  | "PendingApproval"
  | "ChangeOrder"
  | "OverdueRfi"
  | "RfiCreated"
  | "RfiAnswered"
  | "SystemUpdate"
  | "RfiDeadlineApproaching"
  | "SubmittalDeadlineApproaching"
  | "OverdueSubmittal"
  | "RetentionDeadline"
  | "InspectionDeadline";

export type NotificationCategory = "time_entry" | "approval" | "rfi" | "deadline" | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEADLINE_TYPES = new Set<NotificationType>([
  "RfiDeadlineApproaching",
  "SubmittalDeadlineApproaching",
  "OverdueSubmittal",
  "RetentionDeadline",
  "InspectionDeadline",
]);

const URGENT_TYPES = new Set<NotificationType>([
  "OverdueRfi",
  "OverdueSubmittal",
  "RfiDeadlineApproaching",
  "SubmittalDeadlineApproaching",
]);

function getCategory(type: NotificationType): NotificationCategory {
  if (DEADLINE_TYPES.has(type)) return "deadline";
  switch (type) {
    case "TimeEntrySubmitted":
    case "TimeEntryApproved":
    case "TimeEntryRejected":
      return "time_entry";
    case "PendingApproval":
    case "ChangeOrder":
      return "approval";
    case "OverdueRfi":
    case "RfiCreated":
    case "RfiAnswered":
      return "rfi";
    default:
      return "system";
  }
}

function isUrgent(type: NotificationType): boolean {
  return URGENT_TYPES.has(type);
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "OverdueRfi":
    case "OverdueSubmittal":
    case "Error":
    case "TimeEntryRejected":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "RfiDeadlineApproaching":
    case "SubmittalDeadlineApproaching":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "RetentionDeadline":
    case "InspectionDeadline":
      return <CalendarClock className="h-4 w-4 text-orange-500" />;
    case "PendingApproval":
    case "ChangeOrder":
    case "Warning":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "TimeEntrySubmitted":
    case "TimeEntryApproved":
    case "Success":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "RfiCreated":
    case "RfiAnswered":
      return <HelpCircle className="h-4 w-4 text-blue-500" />;
    case "SystemUpdate":
      return <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
  }
}

function getNotificationHref(n: Notification): string | undefined {
  switch (n.type) {
    case "TimeEntrySubmitted":
    case "TimeEntryApproved":
    case "TimeEntryRejected":
      return "/time-tracking";
    case "PendingApproval":
      return "/time-tracking";
    case "ChangeOrder":
      return "/change-orders";
    case "OverdueRfi":
    case "RfiCreated":
    case "RfiAnswered":
    case "RfiDeadlineApproaching":
      return "/rfis";
    case "OverdueSubmittal":
    case "SubmittalDeadlineApproaching":
      return n.relatedEntityId
        ? `/projects/${n.relatedEntityId}/submittals`
        : undefined;
    case "RetentionDeadline":
      return "/payment-applications";
    case "InspectionDeadline":
      return n.relatedEntityId
        ? `/projects/${n.relatedEntityId}/schedule`
        : undefined;
    default:
      return undefined;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

const categoryConfig = {
  all: { label: "All", icon: Inbox },
  time_entry: { label: "Time Entry", icon: ClipboardList },
  approval: { label: "Approvals", icon: Shield },
  rfi: { label: "RFIs", icon: FileText },
  deadline: { label: "Deadlines", icon: CalendarClock },
  system: { label: "System", icon: Settings },
} as const;

type CategoryTab = "all" | NotificationCategory;

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ category }: { category: CategoryTab }) {
  const labels: Record<CategoryTab, string> = {
    all: "You're all caught up!",
    time_entry: "No time entry notifications",
    approval: "No pending approvals",
    rfi: "No RFI notifications",
    deadline: "No deadline notifications",
    system: "No system notifications",
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Bell className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{labels[category]}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        We&apos;ll notify you when something needs your attention.
      </p>
    </div>
  );
}

// ─── Notification row ────────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
  onClick,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: (n: Notification) => void;
}) {
  const urgent = isUrgent(notification.type);

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col gap-1 px-3 py-3 hover:bg-accent/50 transition-colors border-b border-border/40 last:border-b-0",
        !notification.isRead && "bg-primary/5 dark:bg-primary/10",
        urgent && !notification.isRead && "border-l-2 border-l-red-500"
      )}
      onClick={() => onClick(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(notification);
        }
      }}
    >
      <div className="flex w-full items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-sm truncate",
                !notification.isRead && "font-semibold",
                urgent && !notification.isRead && "text-red-700 dark:text-red-400"
              )}
            >
              {notification.title}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!notification.isRead && (
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </span>
            <div className="flex items-center gap-1">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRead(notification.id);
                  }}
                  aria-label="Mark as read"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewSinceLastOpen, setHasNewSinceLastOpen] = useState(false);

  const prevUnreadRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await api<PagedResult<Notification>>("/api/notifications?pageSize=50");
      setNotifications(result.items);
      const newUnread = result.items.filter((n) => !n.isRead).length;
      if (newUnread > prevUnreadRef.current) setHasNewSinceLastOpen(true);
      prevUnreadRef.current = newUnread;
      setUnreadCount(newUnread);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    const timeout = setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 30_000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await api(`/api/notifications/${id}/read`, { method: "POST" });
      } catch {
        // Revert on failure
        fetchNotifications();
      }
    },
    [fetchNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
    setHasNewSinceLastOpen(false);

    try {
      await api("/api/notifications/read-all", { method: "POST" });
    } catch {
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) markAsRead(notification.id);
      const href = getNotificationHref(notification);
      if (href) router.push(href);
      setIsOpen(false);
    },
    [markAsRead, router]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => getCategory(n.type) === activeTab);
  }, [notifications, activeTab]);

  const unreadByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications) {
      if (!n.isRead) {
        const cat = getCategory(n.type);
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [notifications]);

  // When dropdown opens, clear the "new" pulse
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setHasNewSinceLastOpen(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 min-h-[44px] min-w-[44px]"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold",
                hasNewSinceLastOpen && "animate-pulse"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[420px] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as CategoryTab)}
          className="w-full"
        >
          <div className="px-2 pt-1">
            <TabsList className="w-full h-8 bg-muted/50">
              {(Object.keys(categoryConfig) as CategoryTab[]).map((key) => {
                const count = key === "all" ? unreadCount : (unreadByCategory[key] || 0);
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="text-[10px] px-1.5 py-1 gap-0.5 flex-1 data-[state=active]:bg-background"
                  >
                    {categoryConfig[key].label}
                    {count > 0 && (
                      <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {(Object.keys(categoryConfig) as CategoryTab[]).map((key) => (
            <TabsContent key={key} value={key} className="mt-0">
              <div className="max-h-[400px] overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <EmptyState category={key} />
                ) : (
                  filteredNotifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onRead={markAsRead}
                      onClick={handleNotificationClick}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Footer */}
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsOpen(false);
              router.push("/settings/notifications");
            }}
          >
            <Settings className="mr-1.5 h-3 w-3" />
            Notification Settings
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
