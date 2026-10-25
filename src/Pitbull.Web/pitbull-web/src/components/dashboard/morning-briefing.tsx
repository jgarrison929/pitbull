"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { useCompany } from "@/contexts/company-context";
import { roleKpiDrillHref } from "@/lib/role-kpi-drills";
import { cn } from "@/lib/utils";

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
  bidPipelineValue?: number;
  openBidCount?: number;
  arOverdue?: number;
}

interface BriefingEstimatorSection {
  openBidCount: number;
  bidsDueThisWeek: number;
  pipelineValue: number;
}

interface BriefingContractsSection {
  activeOwnerContractCount: number;
  activeSubcontractCount: number;
  openChangeOrderCount: number;
  pendingPayAppCount: number;
  expiringComplianceDocCount: number;
  expiredComplianceDocCount: number;
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
  estimator?: BriefingEstimatorSection | null;
  contracts?: BriefingContractsSection | null;
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

/**
 * Briefing metric tile — large type on phone, optional drill-through.
 * Previously looked tappable but had no href and crushed 3-across on mobile.
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: "amber" | "red" | "blue" | "green";
  href?: string;
}) {
  const accentClasses = {
    amber:
      "border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5",
    red: "border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5",
    blue: "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/5",
    green:
      "border-green-200 bg-green-50/50 dark:border-green-500/20 dark:bg-green-500/5",
  };

  const body = (
    <div
      className={cn(
        "flex min-h-[4.5rem] flex-col justify-between gap-1.5 rounded-xl border p-3 touch-manipulation transition-colors",
        accent ? accentClasses[accent] : "border-border bg-card",
        href &&
          "active:bg-muted/80 hover:border-amber-500/40 group-active:scale-[0.99]"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium leading-snug text-muted-foreground">
            {label}
          </span>
        </div>
        {href ? (
          <ChevronRight
            className="h-4 w-4 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
        ) : null}
      </div>
      <p className="text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl">
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        aria-label={`${label}: ${value}`}
      >
        {body}
      </Link>
    );
  }

  return body;
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
          <Skeleton className="h-[4.5rem] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hour = new Date(data.generatedAtUtc).getHours();

  return (
    <div className="space-y-3" data-testid="morning-briefing">
      {/* Greeting header */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 shadow-sm dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/10 dark:border dark:border-amber-500/10">
        <CardContent className="flex items-center justify-between gap-2 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <TimeIcon hour={hour} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight sm:text-lg truncate">
                {data.greeting}
              </h2>
              <p className="text-sm text-muted-foreground">
                Here&apos;s your {data.role} briefing — tap a metric to drill in
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss briefing"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Core metrics — 2-up on phone (was 3-up and unreadable) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricCard
          icon={FolderOpen}
          label="Active projects"
          value={data.core.activeProjectCount}
          accent="blue"
          href={roleKpiDrillHref("activeProjects")}
        />
        <MetricCard
          icon={Clock}
          label="Pending approvals"
          value={data.core.pendingApprovals}
          accent={data.core.pendingApprovals > 0 ? "amber" : undefined}
          href={roleKpiDrillHref("pendingTimeApprovals")}
        />
        <MetricCard
          icon={Bell}
          label="Unread notifications"
          value={data.core.unreadNotifications}
          href="/settings/notifications"
        />
      </div>

      {/* Role-specific metrics */}
      {data.pm && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard
            icon={FileQuestion}
            label="Open RFIs"
            value={data.pm.openRfiCount}
            href={roleKpiDrillHref("openRfis")}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Overdue RFIs"
            value={data.pm.overdueRfiCount}
            accent={data.pm.overdueRfiCount > 0 ? "red" : undefined}
            href="/rfis?status=open"
          />
          <MetricCard
            icon={FileCheck}
            label="Pending submittals"
            value={data.pm.pendingSubmittals}
            href="/projects"
          />
          <MetricCard
            icon={Calendar}
            label="Today's meetings"
            value={data.pm.todaysMeetingCount}
            href="/projects"
          />
        </div>
      )}

      {data.controller && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard
            icon={TrendingDown}
            label="AR overdue"
            value={formatCurrency(data.controller.arOverdue)}
            accent={data.controller.arOverdue > 0 ? "red" : undefined}
            href={roleKpiDrillHref("arOverdue")}
          />
          <MetricCard
            icon={DollarSign}
            label="AP due this week"
            value={formatCurrency(data.controller.apDueThisWeek)}
            accent="amber"
            href={roleKpiDrillHref("apNearTerm")}
          />
          <MetricCard
            icon={BarChart3}
            label="AR − AP net"
            value={formatCurrency(data.controller.netCashPosition)}
            accent={data.controller.netCashPosition >= 0 ? "green" : "red"}
            href={roleKpiDrillHref("arApNet")}
          />
          <MetricCard
            icon={Receipt}
            label="Pending pay apps"
            value={data.controller.pendingPayApps}
            href="/payment-applications"
          />
        </div>
      )}

      {data.foreman && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard
            icon={Users}
            label="Active crew"
            value={data.foreman.crewSize}
            href="/time-tracking/crew-entry"
          />
          <MetricCard
            icon={Timer}
            label="Pending hours"
            value={`${data.foreman.pendingTimeEntryHours.toFixed(1)}h`}
            accent={data.foreman.pendingTimeEntryHours > 0 ? "amber" : undefined}
            href={roleKpiDrillHref("hoursThisWeek")}
          />
          <MetricCard
            icon={Briefcase}
            label="Today's projects"
            value={data.foreman.todaysProjectCount}
            href={roleKpiDrillHref("activeProjects")}
          />
        </div>
      )}

      {data.executive && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard
            icon={DollarSign}
            label="Portfolio contract $"
            value={formatCurrency(data.executive.totalContractValue)}
            accent="green"
            href={roleKpiDrillHref("activeProjects")}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Over budget (labor)"
            value={data.executive.projectsOverBudget}
            accent={data.executive.projectsOverBudget > 0 ? "red" : undefined}
            href={roleKpiDrillHref("budgetAlert")}
          />
          <MetricCard
            icon={GitPullRequestDraft}
            label="Open change orders"
            value={data.executive.openChangeOrders}
            accent={data.executive.openChangeOrders > 0 ? "amber" : undefined}
            href={roleKpiDrillHref("openChangeOrders")}
          />
          <MetricCard
            icon={ClipboardList}
            label="Bid pipeline"
            value={formatCurrency(data.executive.bidPipelineValue ?? 0)}
            accent="blue"
            href={roleKpiDrillHref("bidPipeline")}
          />
          <MetricCard
            icon={FolderOpen}
            label="Open bids"
            value={data.executive.openBidCount ?? 0}
            href={roleKpiDrillHref("bidPipeline")}
          />
          <MetricCard
            icon={TrendingDown}
            label="AR overdue 31+"
            value={formatCurrency(data.executive.arOverdue ?? 0)}
            accent={(data.executive.arOverdue ?? 0) > 0 ? "red" : undefined}
            href={roleKpiDrillHref("arOverdue")}
          />
        </div>
      )}

      {data.estimator && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard
            icon={ClipboardList}
            label="Open bids"
            value={data.estimator.openBidCount}
            accent="blue"
            href={roleKpiDrillHref("bidPipeline")}
          />
          <MetricCard
            icon={Calendar}
            label="Due this week"
            value={data.estimator.bidsDueThisWeek}
            accent={data.estimator.bidsDueThisWeek > 0 ? "amber" : undefined}
            href="/bids?pipeline=open"
          />
          <MetricCard
            icon={DollarSign}
            label="Pipeline value"
            value={formatCurrency(data.estimator.pipelineValue)}
            accent="green"
            href={roleKpiDrillHref("bidPipeline")}
          />
        </div>
      )}

      {data.contracts && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard
            icon={Briefcase}
            label="Owner contracts"
            value={data.contracts.activeOwnerContractCount}
            accent="blue"
            href="/billing/contracts"
          />
          <MetricCard
            icon={FileCheck}
            label="Active subcontracts"
            value={data.contracts.activeSubcontractCount}
            accent="blue"
            href="/contracts"
          />
          <MetricCard
            icon={Receipt}
            label="Sub pay apps"
            value={data.contracts.pendingPayAppCount}
            accent={
              data.contracts.pendingPayAppCount > 0 ? "amber" : undefined
            }
            href="/payment-applications"
          />
          <MetricCard
            icon={GitPullRequestDraft}
            label="Open change orders"
            value={data.contracts.openChangeOrderCount}
            accent={
              data.contracts.openChangeOrderCount > 0 ? "amber" : undefined
            }
            href="/change-orders"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Insurance expiring (30d)"
            value={data.contracts.expiringComplianceDocCount}
            accent={
              data.contracts.expiringComplianceDocCount > 0
                ? "amber"
                : undefined
            }
            href="/reports/compliance"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Insurance / compliance expired"
            value={data.contracts.expiredComplianceDocCount}
            accent={
              data.contracts.expiredComplianceDocCount > 0 ? "red" : undefined
            }
            href="/reports/compliance"
          />
        </div>
      )}
    </div>
  );
}
