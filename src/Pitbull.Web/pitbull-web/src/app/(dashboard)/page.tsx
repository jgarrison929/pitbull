"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardStatsSkeleton, DashboardActivitySkeleton } from "@/components/skeletons";
import {
  HardHat,
  FileText,
  Users,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { GettingStarted } from "@/components/ui/getting-started";
import { WeeklyHoursChart } from "@/components/dashboard/weekly-hours-chart";
import { RfisNeedingAttention } from "@/components/dashboard/rfis-needing-attention";
import { RecentlyViewed } from "@/components/dashboard/recently-viewed";
import { EquipmentUtilizationWidget } from "@/components/dashboard/equipment-utilization-widget";
import { PhaseProgressWidget } from "@/components/dashboard/phase-progress-widget";
import { CostBreakdownWidget } from "@/components/dashboard/cost-breakdown-widget";
import { RecentTimeEntriesWidget } from "@/components/dashboard/recent-time-entries-widget";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import api from "@/lib/api";
import type { DashboardStats } from "@/lib/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useCompany } from "@/contexts/company-context";

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [state, setState] = useState<DashboardState>({
    stats: null,
    isLoading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const stats = await api<DashboardStats>("/api/dashboard/stats");
        setState({
          stats,
          isLoading: false,
        });
      } catch {
        toast.error("Failed to load dashboard data");
        setState((s) => ({ ...s, isLoading: false }));
      }
    }
    fetchStats();
  }, [activeCompany?.id]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const hasNoData =
    state.stats !== null &&
    state.stats.projectCount === 0 &&
    state.stats.employeeCount === 0 &&
    state.stats.bidCount === 0;

  const firstName = user?.name?.split(" ")[0] ?? "";

  const statCards = [
    {
      title: "Active Projects",
      value: state.stats ? state.stats.projectCount.toString() : "—",
      icon: HardHat,
      color: "text-blue-500 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      href: "/projects",
    },
    {
      title: "Open Bids",
      value: state.stats ? state.stats.bidCount.toString() : "—",
      icon: FileText,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10",
      href: "/bids",
    },
    {
      title: "Team Members",
      value: state.stats ? state.stats.employeeCount.toString() : "—",
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
      href: "/employees",
    },
    {
      title: "Pending Approvals",
      value: state.stats ? state.stats.pendingTimeApprovals.toString() : "—",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
      href: "/time-tracking/approval",
    },
  ];

  const quickActions = [
    {
      title: "New Project",
      description: "Start tracking a project",
      href: "/projects/new",
      icon: HardHat,
      color: "text-blue-500 dark:text-blue-400",
    },
    {
      title: "New Bid",
      description: "Create an estimate",
      href: "/bids/new",
      icon: FileText,
      color: "text-green-600 dark:text-green-400",
    },
    {
      title: "Add Employee",
      description: "Grow your team",
      href: "/employees/new",
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Log Time",
      description: "Record work hours",
      href: "/time-tracking/new",
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {hasNoData
              ? "Let's get your workspace set up."
              : "Here's what's happening with your projects today."}
          </p>
        </div>
        {state.stats && state.stats.totalProjectValue > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Portfolio Value:</span>
            <span className="font-semibold">
              {formatCurrency(state.stats.totalProjectValue)}
            </span>
          </div>
        )}
      </div>

      {state.isLoading ? (
        <>
          <DashboardStatsSkeleton />
          <DashboardActivitySkeleton />
        </>
      ) : hasNoData ? (
        /* ═══════ Welcome State (No Data) ═══════ */
        <div className="space-y-6">
          {/* Getting Started Checklist - prominent */}
          <GettingStarted stats={state.stats} />

          {/* Welcome Banner */}
          <Card className="border-dashed border-2 bg-gradient-to-br from-background to-muted/30">
            <CardContent className="py-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/50 mb-4">
                <Sparkles className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">Welcome to Pitbull, {firstName || "there"}!</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Your construction management platform is ready. Start by creating
                a project or adding your team members.
              </p>
            </CardContent>
          </Card>

          {/* Quick Action Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/projects/new" className="group">
              <Card className="h-full hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200 cursor-pointer">
                <CardContent className="flex flex-col items-center py-8 text-center">
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-4 group-hover:scale-110 transition-transform duration-200">
                    <HardHat className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold mb-1">Create a Project</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track scope, budgets, and timelines
                  </p>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/employees/new" className="group">
              <Card className="h-full hover:shadow-md hover:border-purple-300 dark:hover:border-purple-800 transition-all duration-200 cursor-pointer">
                <CardContent className="flex flex-col items-center py-8 text-center">
                  <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Users className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="font-semibold mb-1">Add Employees</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set up your team for tracking
                  </p>
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/time-tracking/new" className="group">
              <Card className="h-full hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800 transition-all duration-200 cursor-pointer">
                <CardContent className="flex flex-col items-center py-8 text-center">
                  <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold mb-1">Enter Time</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Log work hours on projects
                  </p>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      ) : (
        /* ═══════ Normal Dashboard (Has Data) ═══════ */
        <>
          {/* Getting Started Checklist - shows until dismissed */}
          <GettingStarted stats={state.stats} />

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Actions + Activity Feed */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick Actions */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action) => (
                  <Link key={action.title} href={action.href}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer group">
                      <div className={`${action.color}`}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Activity Feed */}
            <div className="lg:col-span-2">
              <ActivityFeed />
            </div>
          </div>

          {/* Recently Viewed + RFIs Needing Attention */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-6">
              <RecentlyViewed />
              <RfisNeedingAttention />
            </div>
            <div className="lg:col-span-2">
              <WeeklyHoursChart />
            </div>
          </div>

          {/* Intelligence Widgets: Equipment, Phases, Costs, Recent Entries */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <EquipmentUtilizationWidget />
            <PhaseProgressWidget />
            <CostBreakdownWidget />
          </div>

          {/* Recent Time Entries */}
          <RecentTimeEntriesWidget />

          {/* Portfolio Summary */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Project Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(state.stats?.totalProjectValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {state.stats?.projectCount ?? 0} active projects
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Bid Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(state.stats?.totalBidValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {state.stats?.bidCount ?? 0} open bids
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
