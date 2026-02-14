"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  HardHat,
  Users,
  Clock,
  Check,
  ChevronRight,
  X,
  Rocket,
  Settings,
  Calendar,
  PartyPopper,
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
  isComplete: (stats: DashboardStats | null, manualCompleted: string[]) => boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "project",
    title: "Create your first project",
    description: "Start tracking a construction project with budgets and timelines",
    href: "/projects/new",
    icon: HardHat,
    isComplete: (stats) => (stats?.projectCount ?? 0) > 0,
  },
  {
    id: "employee",
    title: "Add employees",
    description: "Set up your team members for time tracking and assignments",
    href: "/employees/new",
    icon: Users,
    isComplete: (stats) => (stats?.employeeCount ?? 0) > 0,
  },
  {
    id: "time",
    title: "Enter your first time entry",
    description: "Log hours against a project to start tracking labor costs",
    href: "/time-tracking/new",
    icon: Clock,
    isComplete: (stats) =>
      stats?.recentActivity?.some((a) => a.type === "timeentry") ?? false,
  },
  {
    id: "costcodes",
    title: "Set up cost codes",
    description: "Organize project costs with industry-standard codes",
    href: "/settings",
    icon: Settings,
    isComplete: (_stats, manual) => manual.includes("costcodes"),
  },
  {
    id: "payperiods",
    title: "Configure pay periods",
    description: "Define weekly, bi-weekly, or monthly pay cycles",
    href: "/settings",
    icon: Calendar,
    isComplete: (_stats, manual) => manual.includes("payperiods"),
  },
];

const STORAGE_KEY = "pitbull_getting_started_dismissed";
const MANUAL_COMPLETE_KEY = "pitbull_onboarding_completed";

export function GettingStarted({ stats }: GettingStartedProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const [manualCompleted, setManualCompleted] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(MANUAL_COMPLETE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const [showCelebration, setShowCelebration] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const completedCount = CHECKLIST_ITEMS.filter((item) =>
    item.isComplete(stats, manualCompleted)
  ).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progress = (completedCount / totalCount) * 100;
  const allComplete = completedCount === totalCount;

  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 200);
    return () => clearTimeout(timer);
  }, [progress]);

  // Celebrate when all complete
  useEffect(() => {
    if (allComplete && !isDismissed) {
      setShowCelebration(true);
      const timer = setTimeout(() => {
        setShowCelebration(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [allComplete, isDismissed]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  }, []);

  const toggleManualComplete = useCallback((id: string) => {
    setManualCompleted((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem(MANUAL_COMPLETE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  if (isDismissed) {
    return null;
  }

  return (
    <Card className="relative border-amber-200 dark:border-amber-900 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 overflow-hidden">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-amber-500/90 to-orange-500/90 backdrop-blur-sm animate-[fadeIn_0.5s_ease-out]">
          <div className="text-center text-white space-y-3 animate-[bounceIn_0.6s_ease-out]">
            <PartyPopper className="h-12 w-12 mx-auto animate-bounce" />
            <h3 className="text-2xl font-bold">All done! 🎉</h3>
            <p className="text-amber-100">You&apos;re all set up and ready to build.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDismiss}
              className="mt-2"
            >
              Close checklist
            </Button>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 shadow-sm">
              <Rocket className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg text-foreground">Getting Started</CardTitle>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {totalCount} steps complete
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
        <div className="mt-3">
          <Progress value={animatedProgress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => {
            const isComplete = item.isComplete(stats, manualCompleted);
            const isManualItem = item.id === "costcodes" || item.id === "payperiods";

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  isComplete
                    ? "bg-green-50/80 dark:bg-green-950/30"
                    : "bg-white dark:bg-neutral-800/50 hover:bg-amber-50/80 dark:hover:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 hover:shadow-sm"
                }`}
              >
                {/* Completion toggle for manual items */}
                {isManualItem ? (
                  <button
                    onClick={() => toggleManualComplete(item.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all duration-200 ${
                      isComplete
                        ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400"
                        : "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                    }`}
                    title={isComplete ? "Mark as incomplete" : "Mark as complete"}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <item.icon className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all duration-200 ${
                      isComplete
                        ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400"
                        : "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <item.icon className="h-4 w-4" />
                    )}
                  </div>
                )}

                <Link
                  href={isComplete ? "#" : item.href}
                  className="flex-1 min-w-0"
                  tabIndex={isComplete ? -1 : 0}
                >
                  <p
                    className={`text-sm font-medium transition-colors ${
                      isComplete
                        ? "text-green-700 dark:text-green-400 line-through opacity-75"
                        : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {item.description}
                  </p>
                </Link>
                {!isComplete && (
                  <Link href={item.href}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Card>
  );
}
