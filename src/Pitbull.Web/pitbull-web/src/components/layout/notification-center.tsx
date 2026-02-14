"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationCategory = "time_entry" | "approval" | "rfi" | "system";
export type NotificationType =
  | "overdue_rfi"
  | "pending_approval"
  | "change_order"
  | "time_entry_submitted"
  | "time_entry_approved"
  | "time_entry_rejected"
  | "rfi_created"
  | "rfi_answered"
  | "system_update"
  | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  href?: string;
  /** If the notification has an inline action (e.g. Approve) */
  actionLabel?: string;
  actionType?: "approve" | "dismiss";
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

const STORAGE_KEY = "pitbull_notification_read_state";

function loadReadState(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadState(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // quota exceeded – ignore
  }
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "pending_approval",
    category: "approval",
    title: "3 time entries need approval",
    message: "Mike Torres submitted 24 hours on Highway Resurfacing",
    timestamp: new Date(Date.now() - 25 * 60 * 1000),
    read: false,
    href: "/time-tracking/approval",
    actionLabel: "Review",
    actionType: "approve",
  },
  {
    id: "n2",
    type: "time_entry_approved",
    category: "time_entry",
    title: "Time entry approved",
    message: "Your 8-hour entry on Downtown Office Tower was approved by Jane Doe",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    read: false,
    href: "/time-tracking",
  },
  {
    id: "n3",
    type: "overdue_rfi",
    category: "rfi",
    title: "RFI #1042 Overdue",
    message: "Electrical rough-in clarification – Due 3 days ago",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    read: false,
    href: "/rfis",
  },
  {
    id: "n4",
    type: "rfi_created",
    category: "rfi",
    title: "New RFI #1055 created",
    message: "Foundation waterproofing detail – assigned to you",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read: false,
    href: "/rfis",
  },
  {
    id: "n5",
    type: "change_order",
    category: "approval",
    title: "Change Order #208 submitted",
    message: "CO #208 for Downtown Office Tower awaiting your approval – $14,200",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    read: false,
    href: "/contracts",
    actionLabel: "Approve",
    actionType: "approve",
  },
  {
    id: "n6",
    type: "time_entry_rejected",
    category: "time_entry",
    title: "Time entry rejected",
    message: "Your entry on Feb 10 was returned – missing cost code",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    read: false,
    href: "/time-tracking",
  },
  {
    id: "n7",
    type: "time_entry_submitted",
    category: "time_entry",
    title: "Weekly timesheet submitted",
    message: "40 hours submitted for week ending Feb 9",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: false,
    href: "/time-tracking",
  },
  {
    id: "n8",
    type: "system_update",
    category: "system",
    title: "Scheduled maintenance",
    message: "System maintenance planned for Sunday 2 AM – 4 AM PST",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    read: false,
  },
  {
    id: "n9",
    type: "rfi_answered",
    category: "rfi",
    title: "RFI #1038 answered",
    message: "Foundation detail response received from engineer",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    read: true,
    href: "/rfis",
  },
  {
    id: "n10",
    type: "info",
    category: "system",
    title: "Weekly report ready",
    message: "Project status report for Week 6 is available",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    read: true,
    href: "/projects",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "overdue_rfi":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "pending_approval":
    case "change_order":
      return <Clock className="h-4 w-4 text-amber-500" />;
    case "time_entry_submitted":
    case "time_entry_approved":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "time_entry_rejected":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "rfi_created":
    case "rfi_answered":
      return <HelpCircle className="h-4 w-4 text-blue-500" />;
    case "system_update":
      return <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
  }
}

function formatRelativeTime(date: Date): string {
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
  onAction,
  onClick,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onAction: (n: Notification) => void;
  onClick: (n: Notification) => void;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col gap-1 px-3 py-3 hover:bg-accent/50 transition-colors border-b border-border/40 last:border-b-0",
        !notification.read && "bg-primary/5 dark:bg-primary/10"
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
                !notification.read && "font-semibold"
              )}
            >
              {notification.title}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!notification.read && (
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-muted-foreground">
              {formatRelativeTime(notification.timestamp)}
            </span>
            <div className="flex items-center gap-1">
              {notification.actionLabel && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px] font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(notification);
                  }}
                >
                  {notification.actionLabel}
                </Button>
              )}
              {!notification.read && (
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
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const readIds = loadReadState();
    return mockNotifications.map((n) => ({
      ...n,
      read: n.read || readIds.has(n.id),
    }));
  });
  const [hasNewSinceLastOpen, setHasNewSinceLastOpen] = useState(true);

  // Persist read state on change
  const persistReadState = useCallback((updated: Notification[]) => {
    const readIds = new Set(updated.filter((n) => n.read).map((n) => n.id));
    saveReadState(readIds);
  }, []);

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        persistReadState(updated);
        return updated;
      });
    },
    [persistReadState]
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      persistReadState(updated);
      return updated;
    });
    setHasNewSinceLastOpen(false);
  }, [persistReadState]);

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      markAsRead(notification.id);
      if (notification.href) {
        router.push(notification.href);
      }
      setIsOpen(false);
    },
    [markAsRead, router]
  );

  const handleAction = useCallback(
    (notification: Notification) => {
      // Mark as read and navigate
      markAsRead(notification.id);
      if (notification.href) {
        router.push(notification.href);
      }
      setIsOpen(false);
    },
    [markAsRead, router]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const unreadByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications) {
      if (!n.read) {
        counts[n.category] = (counts[n.category] || 0) + 1;
      }
    }
    return counts;
  }, [notifications]);

  // When dropdown opens, clear the "new" pulse
  useEffect(() => {
    if (isOpen) {
      // Small delay so the user sees the transition
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
        className="w-[380px] p-0"
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
                    className="text-[11px] px-2 py-1 gap-1 flex-1 data-[state=active]:bg-background"
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
                      onAction={handleAction}
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
              router.push("/settings");
            }}
          >
            Notification Settings
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
