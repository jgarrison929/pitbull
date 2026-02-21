"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun,
  Sunset,
  Moon,
  X,
  FolderOpen,
  Clock,
  Bell,
  FileQuestion,
  AlertTriangle,
  FileCheck,
  Calendar,
  DollarSign,
  TrendingDown,
  Receipt,
  Users,
  Timer,
  Briefcase,
  BarChart3,
  GitPullRequestDraft,
} from "lucide-react";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";

interface BriefingCoreSection {
  activeProjectCount: number;
  pendingApprovals: number;
  unreadNotifications: number;
}

interface BriefingPmSection {
  openRfiCount: number;
  overdueRfiCount: number;
  pendingSubmittals: number;
  todaysMeetingCount: number;
}

interface BriefingControllerSection {
  arOverdue: number;
  apDueThisWeek: number;
  netCashPosition: number;
  pendingPayApps: number;
}

interface BriefingForemanSection {
  crewSize: number;
  pendingTimeEntryHours: number;
  todaysProjectCount: number;
}

interface BriefingExecutiveSection {
  totalContractValue: number;
  projectsOverBudget: number;
  openChangeOrders: number;
}

interface MorningBriefingDto {
  greeting: string;
  role: string;
  generatedAtUtc: string;
  core: BriefingCoreSection;
  pm: BriefingPmSection | null;
  controller: BriefingControllerSection | null;
  foreman: BriefingForemanSection | null;
  executive: BriefingExecutiveSection | null;
}

function getDismissKey(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `briefing-dismissed-${today}`;
}

function isDismissedToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(getDismissKey()) === "true";
}

function TimeIcon({ hour }: { hour: number }) {
  if (hour < 12) return <Sun className="h-5 w-5 text-amber-500" />;
  if (hour < 17) return <Sunset className="h-5 w-5 text-orange-500" />;
  return <Moon className="h-5 w-5 text-indigo-400" />;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: "amber" | "red" | "blue" | "green";
}) {
  const accentClasses = {
    amber:
      "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5",
    red: "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5",
    blue: "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/5",
    green:
      "border-green-200 bg-green-50/50 dark:border-green-500/20 dark:bg-green-500/5",
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        accent
          ? accentClasses[accent]
          : "border-border bg-muted/30"
      }`}
    >
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

export function MorningBriefing() {
  const { activeCompany } = useCompany();
  const [data, setData] = useState<MorningBriefingDto | null>(null);
  const [dismissed, setDismissed] = useState(true); // default hidden until checked
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDismissed(isDismissedToday());
  }, []);

  const fetchBriefing = useCallback(async () => {
    try {
      const result = await api<MorningBriefingDto>("/api/briefing/morning");
      setData(result);
    } catch {
      // Silent fail — don't block the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dismissed) {
      setLoading(true);
      fetchBriefing();
    }
  }, [dismissed, fetchBriefing, activeCompany?.id]);

  const handleDismiss = () => {
    localStorage.setItem(getDismissKey(), "true");
    setDismissed(true);
  };

  if (dismissed) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hour = new Date(data.generatedAtUtc).getHours();

  return (
    <div className="space-y-3">
      {/* Greeting header */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 shadow-sm dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/10 dark:border dark:border-amber-500/10">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <TimeIcon hour={hour} />
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {data.greeting}
              </h2>
              <p className="text-sm text-muted-foreground">
                Here&apos;s your {data.role} briefing for today
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss briefing"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Core metrics (always shown) */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          icon={FolderOpen}
          label="Active projects"
          value={data.core.activeProjectCount}
          accent="blue"
        />
        <MetricCard
          icon={Clock}
          label="Pending approvals"
          value={data.core.pendingApprovals}
          accent={data.core.pendingApprovals > 0 ? "amber" : undefined}
        />
        <MetricCard
          icon={Bell}
          label="Unread notifications"
          value={data.core.unreadNotifications}
        />
      </div>

      {/* Role-specific metrics */}
      {data.pm && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            icon={FileQuestion}
            label="Open RFIs"
            value={data.pm.openRfiCount}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Overdue RFIs"
            value={data.pm.overdueRfiCount}
            accent={data.pm.overdueRfiCount > 0 ? "red" : undefined}
          />
          <MetricCard
            icon={FileCheck}
            label="Pending submittals"
            value={data.pm.pendingSubmittals}
          />
          <MetricCard
            icon={Calendar}
            label="Today's meetings"
            value={data.pm.todaysMeetingCount}
          />
        </div>
      )}

      {data.controller && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            icon={TrendingDown}
            label="AR overdue"
            value={formatCurrency(data.controller.arOverdue)}
            accent={data.controller.arOverdue > 0 ? "red" : undefined}
          />
          <MetricCard
            icon={DollarSign}
            label="AP due this week"
            value={formatCurrency(data.controller.apDueThisWeek)}
            accent="amber"
          />
          <MetricCard
            icon={BarChart3}
            label="Net cash position"
            value={formatCurrency(data.controller.netCashPosition)}
            accent={data.controller.netCashPosition >= 0 ? "green" : "red"}
          />
          <MetricCard
            icon={Receipt}
            label="Pending pay apps"
            value={data.controller.pendingPayApps}
          />
        </div>
      )}

      {data.foreman && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            icon={Users}
            label="Active crew"
            value={data.foreman.crewSize}
          />
          <MetricCard
            icon={Timer}
            label="Pending hours"
            value={`${data.foreman.pendingTimeEntryHours.toFixed(1)}h`}
            accent={data.foreman.pendingTimeEntryHours > 0 ? "amber" : undefined}
          />
          <MetricCard
            icon={Briefcase}
            label="Today's projects"
            value={data.foreman.todaysProjectCount}
          />
        </div>
      )}

      {data.executive && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            icon={DollarSign}
            label="Total contract value"
            value={formatCurrency(data.executive.totalContractValue)}
            accent="green"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Over budget"
            value={data.executive.projectsOverBudget}
            accent={data.executive.projectsOverBudget > 0 ? "red" : undefined}
          />
          <MetricCard
            icon={GitPullRequestDraft}
            label="Open change orders"
            value={data.executive.openChangeOrders}
            accent={data.executive.openChangeOrders > 0 ? "amber" : undefined}
          />
        </div>
      )}
    </div>
  );
}
