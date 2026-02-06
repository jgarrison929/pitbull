"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  HardHat,
  FileText,
  Users,
  Clock,
  Check,
  ChevronRight,
  X,
  Rocket,
} from "lucide-react";
import type { DashboardStats } from "@/lib/types";

interface GettingStartedProps {
  stats: DashboardStats | null;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof HardHat;
  isComplete: (stats: DashboardStats | null) => boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "project",
    title: "Create your first project",
    description: "Start tracking a construction project",
    href: "/projects/new",
    icon: HardHat,
    isComplete: (stats) => (stats?.projectCount ?? 0) > 0,
  },
  {
    id: "employee",
    title: "Add a team member",
    description: "Set up employees for time tracking",
    href: "/employees/new",
    icon: Users,
    isComplete: (stats) => (stats?.employeeCount ?? 0) > 0,
  },
  {
    id: "bid",
    title: "Create a bid",
    description: "Build your first estimate",
    href: "/bids/new",
    icon: FileText,
    isComplete: (stats) => (stats?.bidCount ?? 0) > 0,
  },
  {
    id: "time",
    title: "Log your first time entry",
    description: "Track hours on a project",
    href: "/time-tracking/new",
    icon: Clock,
    isComplete: (stats) =>
      stats?.recentActivity?.some((a) => a.type === "timeentry") ?? false,
  },
];

const STORAGE_KEY = "pitbull_getting_started_dismissed";

export function GettingStarted({ stats }: GettingStartedProps) {
  // Initialize from localStorage synchronously to prevent flash
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return true; // SSR: hide by default
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const completedCount = CHECKLIST_ITEMS.filter((item) =>
    item.isComplete(stats)
  ).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progress = (completedCount / totalCount) * 100;
  const allComplete = completedCount === totalCount;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  };

  // Don't show if dismissed or all items complete
  if (isDismissed || allComplete) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100">
              <Rocket className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Getting Started</CardTitle>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {totalCount} complete
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            title="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="h-2 mt-3" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => {
            const isComplete = item.isComplete(stats);
            return (
              <Link
                key={item.id}
                href={isComplete ? "#" : item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isComplete
                    ? "bg-green-50 cursor-default"
                    : "bg-white hover:bg-amber-50 border border-amber-100"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                    isComplete
                      ? "bg-green-100 text-green-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <item.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isComplete ? "text-green-700 line-through" : ""
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                {!isComplete && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
