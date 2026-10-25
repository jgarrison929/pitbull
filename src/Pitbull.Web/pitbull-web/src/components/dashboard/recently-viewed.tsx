"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, HardHat, FileText, HelpCircle } from "lucide-react";
import {
  useRecentlyViewed,
  type RecentlyViewedItem,
  type RecentItemType,
} from "@/hooks/use-recently-viewed";

function formatTimeAgo(timestamp: number) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getItemIcon(type: RecentItemType) {
  switch (type) {
    case "project":
      return <HardHat className="h-4 w-4 text-blue-600" />;
    case "bid":
      return <FileText className="h-4 w-4 text-green-600" />;
    case "rfi":
      return <HelpCircle className="h-4 w-4 text-purple-600" />;
    default:
      return <History className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
  }
}

function getItemLink(item: RecentlyViewedItem): string {
  switch (item.type) {
    case "project":
      return `/projects/${item.id}`;
    case "bid":
      return `/bids/${item.id}`;
    case "rfi":
      return `/rfis/${item.id}?projectId=${item.projectId}`;
    default:
      return "#";
  }
}

function getTypeLabel(type: RecentItemType): string {
  switch (type) {
    case "project":
      return "Project";
    case "bid":
      return "Bid";
    case "rfi":
      return "RFI";
    default:
      return type;
  }
}

export function RecentlyViewed() {
  const { recentItems } = useRecentlyViewed();

  if (recentItems.length === 0) {
    return null; // Don't show if no items
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Recently Viewed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentItems.map((item) => (
            <Link key={`${item.type}-${item.id}`} href={getItemLink(item)}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                <div className="p-1.5 rounded-full bg-muted group-hover:bg-background">
                  {getItemIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getTypeLabel(item.type)}
                    {item.identifier && (
                      <span className="ml-1 font-mono">• {item.identifier}</span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(item.viewedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
